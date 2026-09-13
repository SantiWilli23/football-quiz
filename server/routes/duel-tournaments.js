import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { sendToUser } from "../utils/push.js";
import { DUEL_DIFFICULTIES, DEFAULT_DIFFICULTY } from "./duels.js";

const QUESTIONS_PER_DUEL = 5;

async function notify(userId, body) {
  try {
    await sendToUser(userId, { title: "Futotal", body, url: "/duelos" });
  } catch (err) {
    console.error("no se pudo avisar del torneo:", err.message);
  }
}

async function usernameOf(userId) {
  const result = await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [userId] });
  return result.rows[0]?.username ?? "Alguien";
}

async function requireMembership(groupId, userId) {
  const result = await db.execute({
    sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return result.rows.length > 0;
}

// Crea el duelo real detrás de un cruce del bracket — mismo mecanismo que
// un duelo suelto (duels.js), pero sin pasar por esa ruta HTTP: acá se
// arma directo en la base, ligado a su cruce (tournament_match_id).
async function createDuelForMatch(groupId, difficulty, playerA, playerB, matchId) {
  const questions = await db.execute({
    sql: "SELECT id FROM duel_questions WHERE difficulty = ? ORDER BY RANDOM() LIMIT ?",
    args: [difficulty, QUESTIONS_PER_DUEL],
  });
  if (questions.rows.length < QUESTIONS_PER_DUEL) {
    throw new Error("No hay suficientes preguntas de ese nivel cargadas");
  }
  const inserted = await db.execute({
    sql: `INSERT INTO duels (group_id, challenger_id, opponent_id, question_ids, difficulty, tournament_match_id)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [groupId, playerA, playerB, JSON.stringify(questions.rows.map((q) => q.id)), difficulty, matchId],
  });
  const duelId = Number(inserted.lastInsertRowid);
  await db.execute({ sql: "UPDATE duel_tournament_matches SET duel_id = ? WHERE id = ?", args: [duelId, matchId] });
  return duelId;
}

// Arma los cruces de una ronda a partir de una lista de jugadores ya
// ordenada (posición 0 contra 1, 2 contra 3, ...) y crea el duelo de cada
// uno. `players` puede traer null en algún slot solo en la ronda 1 si en
// algún momento se habilita bye — hoy start() exige potencia de 2, así que
// nunca pasa, pero la función queda preparada por si cambia.
async function createRoundMatches(tournament, round, players) {
  const matchIds = [];
  for (let i = 0; i < players.length; i += 2) {
    const a = players[i];
    const b = players[i + 1];
    const slot = i / 2;
    const inserted = await db.execute({
      sql: `INSERT INTO duel_tournament_matches (tournament_id, round, slot, player_a_id, player_b_id)
            VALUES (?, ?, ?, ?, ?)`,
      args: [tournament.id, round, slot, a, b],
    });
    const matchId = Number(inserted.lastInsertRowid);
    matchIds.push(matchId);
    const duelId = await createDuelForMatch(tournament.group_id, tournament.difficulty, a, b, matchId);
    const [nameA, nameB] = await Promise.all([usernameOf(a), usernameOf(b)]);
    await Promise.all([
      notify(a, `Torneo "${tournament.name}": te toca jugar contra ${nameB}.`),
      notify(b, `Torneo "${tournament.name}": te toca jugar contra ${nameA}.`),
    ]);
    void duelId;
  }
  return matchIds;
}

// Se llama después de que CUALQUIER duelo se resuelve (ver duels.js). Si
// ese duelo pertenecía a un cruce de torneo, decide el ganador (a penales
// si terminó empatado — mismo criterio que ya usa Copa del Rey en Carrera
// DT), lo guarda, y si con eso se completó la ronda arma la siguiente o
// corona campeón.
export async function advanceTournamentForDuel(duel) {
  if (!duel.tournament_match_id) return;
  const matchResult = await db.execute({ sql: "SELECT * FROM duel_tournament_matches WHERE id = ?", args: [duel.tournament_match_id] });
  const match = matchResult.rows[0];
  if (!match || match.winner_id !== null) return;

  const decidedByCoin = duel.winner_id === null;
  const winnerId = decidedByCoin
    ? (Math.random() < 0.5 ? duel.challenger_id : duel.opponent_id)
    : duel.winner_id;

  await db.execute({
    sql: "UPDATE duel_tournament_matches SET winner_id = ?, decided_by_coin = ? WHERE id = ?",
    args: [winnerId, decidedByCoin ? 1 : 0, match.id],
  });

  const tournamentResult = await db.execute({ sql: "SELECT * FROM duel_tournaments WHERE id = ?", args: [match.tournament_id] });
  const tournament = tournamentResult.rows[0];
  if (!tournament) return;

  const roundMatches = await db.execute({
    sql: "SELECT * FROM duel_tournament_matches WHERE tournament_id = ? AND round = ? ORDER BY slot",
    args: [match.tournament_id, match.round],
  });
  const pending = roundMatches.rows.some((m) => m.id === match.id ? false : m.winner_id === null);
  if (pending) return; // todavía falta algún otro cruce de esta ronda

  const winners = roundMatches.rows.map((m) => (m.id === match.id ? winnerId : m.winner_id));

  if (winners.length === 1) {
    await db.execute({
      sql: "UPDATE duel_tournaments SET status = 'terminado', champion_id = ? WHERE id = ?",
      args: [winners[0], tournament.id],
    });
    const champName = await usernameOf(winners[0]);
    const players = await db.execute({ sql: "SELECT user_id FROM duel_tournament_players WHERE tournament_id = ?", args: [tournament.id] });
    await Promise.all(
      players.rows.map((p) => notify(p.user_id, `🏆 ${champName} se coronó campeón del torneo "${tournament.name}".`))
    );
    return;
  }

  await createRoundMatches(tournament, match.round + 1, winners);
}

const router = Router();
router.use(requireAuth);

// Crear un torneo nuevo (queda "abierto" a inscripción; el creador ya
// cuenta como anotado).
router.post("/", async (req, res) => {
  const groupId = Number(req.body?.group_id);
  const name = String(req.body?.name || "").trim().slice(0, 60);
  const difficulty = req.body?.difficulty || DEFAULT_DIFFICULTY;

  if (!groupId || !name) return res.status(400).json({ error: "Faltan campos requeridos" });
  if (!DUEL_DIFFICULTIES[difficulty]) return res.status(400).json({ error: "Dificultad inválida" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const inserted = await db.execute({
      sql: "INSERT INTO duel_tournaments (group_id, name, difficulty, created_by) VALUES (?, ?, ?, ?)",
      args: [groupId, name, difficulty, req.userId],
    });
    const tournamentId = Number(inserted.lastInsertRowid);
    await db.execute({
      sql: "INSERT INTO duel_tournament_players (tournament_id, user_id) VALUES (?, ?)",
      args: [tournamentId, req.userId],
    });

    res.status(201).json({ id: tournamentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Listado de torneos del grupo (abiertos, en curso y recién terminados).
router.get("/", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const result = await db.execute({
      sql: `SELECT t.*, u.username AS creator_name,
                   (SELECT COUNT(*) FROM duel_tournament_players p WHERE p.tournament_id = t.id) AS player_count,
                   EXISTS(SELECT 1 FROM duel_tournament_players p WHERE p.tournament_id = t.id AND p.user_id = ?) AS joined
            FROM duel_tournaments t
            JOIN users u ON u.id = t.created_by
            WHERE t.group_id = ?
            ORDER BY t.created_at DESC LIMIT 20`,
      args: [req.userId, groupId],
    });

    const tournaments = result.rows.map((t) => ({
      id: t.id,
      name: t.name,
      difficulty: t.difficulty,
      difficulty_label: DUEL_DIFFICULTIES[t.difficulty]?.label ?? t.difficulty,
      status: t.status,
      creator_name: t.creator_name,
      is_creator: t.created_by === req.userId,
      player_count: Number(t.player_count),
      joined: !!t.joined,
      champion_id: t.champion_id,
      created_at: t.created_at,
    }));

    res.json({ tournaments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/:id/join", async (req, res) => {
  const tournamentId = Number(req.params.id);
  try {
    const result = await db.execute({ sql: "SELECT * FROM duel_tournaments WHERE id = ?", args: [tournamentId] });
    const tournament = result.rows[0];
    if (!tournament) return res.status(404).json({ error: "Torneo no encontrado" });
    if (!(await requireMembership(tournament.group_id, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    if (tournament.status !== "abierto") return res.status(400).json({ error: "Este torneo ya arrancó" });

    try {
      await db.execute({
        sql: "INSERT INTO duel_tournament_players (tournament_id, user_id) VALUES (?, ?)",
        args: [tournamentId, req.userId],
      });
    } catch {
      return res.status(409).json({ error: "Ya estás anotado" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/:id/leave", async (req, res) => {
  const tournamentId = Number(req.params.id);
  try {
    const result = await db.execute({ sql: "SELECT * FROM duel_tournaments WHERE id = ?", args: [tournamentId] });
    const tournament = result.rows[0];
    if (!tournament) return res.status(404).json({ error: "Torneo no encontrado" });
    if (tournament.status !== "abierto") return res.status(400).json({ error: "Este torneo ya arrancó" });

    await db.execute({
      sql: "DELETE FROM duel_tournament_players WHERE tournament_id = ? AND user_id = ?",
      args: [tournamentId, req.userId],
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Arranca el torneo: exige una cantidad de anotados que sea potencia de 2
// (2, 4, 8, 16...) para que el bracket cierre parejo sin tener que inventar
// un "bye". Solo lo puede arrancar quien lo creó.
router.post("/:id/start", async (req, res) => {
  const tournamentId = Number(req.params.id);
  try {
    const result = await db.execute({ sql: "SELECT * FROM duel_tournaments WHERE id = ?", args: [tournamentId] });
    const tournament = result.rows[0];
    if (!tournament) return res.status(404).json({ error: "Torneo no encontrado" });
    if (tournament.created_by !== req.userId) return res.status(403).json({ error: "Solo quien lo creó puede arrancarlo" });
    if (tournament.status !== "abierto") return res.status(400).json({ error: "Este torneo ya arrancó" });

    const playersResult = await db.execute({
      sql: "SELECT user_id FROM duel_tournament_players WHERE tournament_id = ?",
      args: [tournamentId],
    });
    const playerIds = playersResult.rows.map((r) => r.user_id);
    const isPowerOfTwo = playerIds.length >= 2 && (playerIds.length & (playerIds.length - 1)) === 0;
    if (!isPowerOfTwo) {
      return res.status(400).json({ error: `Hacen falta 2, 4, 8 o 16 anotados (hoy hay ${playerIds.length}) para armar el bracket` });
    }

    // Sorteo del cuadro: orden al azar, no por orden de inscripción.
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
    }

    await db.execute({ sql: "UPDATE duel_tournaments SET status = 'en_curso' WHERE id = ?", args: [tournamentId] });
    await createRoundMatches(tournament, 1, playerIds);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Detalle completo: jugadores anotados y el bracket ronda por ronda, con
// el estado del duelo real detrás de cada cruce.
router.get("/:id", async (req, res) => {
  const tournamentId = Number(req.params.id);
  try {
    const result = await db.execute({ sql: "SELECT * FROM duel_tournaments WHERE id = ?", args: [tournamentId] });
    const tournament = result.rows[0];
    if (!tournament) return res.status(404).json({ error: "Torneo no encontrado" });
    if (!(await requireMembership(tournament.group_id, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const playersResult = await db.execute({
      sql: `SELECT u.id, u.username, u.avatar, u.avatar_config FROM duel_tournament_players p
            JOIN users u ON u.id = p.user_id WHERE p.tournament_id = ? ORDER BY p.joined_at`,
      args: [tournamentId],
    });

    const matchesResult = await db.execute({
      sql: `SELECT m.*, d.status AS duel_status, d.challenger_correct, d.opponent_correct,
                   ua.username AS a_name, ua.avatar AS a_avatar, ua.avatar_config AS a_avatar_config,
                   ub.username AS b_name, ub.avatar AS b_avatar, ub.avatar_config AS b_avatar_config
            FROM duel_tournament_matches m
            LEFT JOIN duels d ON d.id = m.duel_id
            LEFT JOIN users ua ON ua.id = m.player_a_id
            LEFT JOIN users ub ON ub.id = m.player_b_id
            WHERE m.tournament_id = ? ORDER BY m.round, m.slot`,
      args: [tournamentId],
    });

    const roundsMap = new Map();
    for (const m of matchesResult.rows) {
      if (!roundsMap.has(m.round)) roundsMap.set(m.round, []);
      roundsMap.get(m.round).push({
        id: m.id,
        slot: m.slot,
        duel_id: m.duel_id,
        duel_status: m.duel_status,
        player_a: m.player_a_id ? { id: m.player_a_id, username: m.a_name, avatar: m.a_avatar, avatar_config: m.a_avatar_config } : null,
        player_b: m.player_b_id ? { id: m.player_b_id, username: m.b_name, avatar: m.b_avatar, avatar_config: m.b_avatar_config } : null,
        winner_id: m.winner_id,
        decided_by_coin: !!m.decided_by_coin,
        score: m.duel_status === "terminado" ? { a: m.challenger_correct, b: m.opponent_correct } : null,
      });
    }
    const rounds = [...roundsMap.entries()].sort((a, b) => a[0] - b[0]).map(([round, matches]) => ({ round, matches }));
    const totalRounds = rounds.length > 0 ? Math.max(...rounds.map((r) => r.round)) : 0;

    res.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        difficulty: tournament.difficulty,
        difficulty_label: DUEL_DIFFICULTIES[tournament.difficulty]?.label ?? tournament.difficulty,
        status: tournament.status,
        created_by: tournament.created_by,
        is_creator: tournament.created_by === req.userId,
        champion_id: tournament.champion_id,
      },
      players: playersResult.rows,
      rounds,
      total_rounds: totalRounds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
