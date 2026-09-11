import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { normalize } from "../db/seed-equipo-jugador.js";

const router = Router();
router.use(requireAuth);

const BRACKET_SIZES = [4, 8];
const SQUAD_SIZE = 5;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// No hay un rating "oficial" de estos jugadores en la base (Equipo-Jugador
// solo guarda nombre/nacionalidad/posición/año), así que la fuerza de cada
// plantel se deriva de forma determinística del id del jugador: mismo
// jugador, misma "calidad" siempre, sin necesidad de cargar un dataset nuevo.
function ratingForPlayer(id) {
  const h = (id * 2654435761) >>> 0;
  return 74 + (h % 19); // 74..92
}

function squadRating(playerIds) {
  const sum = playerIds.reduce((acc, id) => acc + ratingForPlayer(id), 0);
  return sum / playerIds.length;
}

function poisson(lambda) {
  const l = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}

// Simulación liviana de un partido de copa a partir del rating promedio de
// cada plantel (mismo estilo Poisson que ya usa Liga Online DT, pero
// alimentado directo por rating en vez de por tier de club).
function simulateCupMatch(ratingA, ratingB) {
  const dayFactor = () => clamp(1 + ((Math.random() + Math.random() + Math.random() - 1.5) / 1.5) * 0.22, 0.68, 1.32);
  const diff = ratingA * dayFactor() - ratingB * dayFactor();
  const baseA = clamp(1.35 + diff / 20, 0.15, 4.4);
  const baseB = clamp(1.35 - diff / 24, 0.15, 4.4);
  let scoreA = poisson(baseA);
  let scoreB = poisson(baseB);
  if (scoreA === scoreB) (Math.random() < 0.5 ? scoreA++ : scoreB++); // la copa no admite empates
  return { scoreA, scoreB };
}

async function assertMember(userId, groupId) {
  const result = await db.execute({
    sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return result.rows.length > 0;
}

async function loadCupById(cupId) {
  const result = await db.execute({ sql: "SELECT * FROM group_cups WHERE id = ?", args: [cupId] });
  return result.rows[0] || null;
}

async function loadParticipants(cupId) {
  const result = await db.execute({
    sql: `SELECT p.*, u.username FROM group_cup_participants p
          LEFT JOIN users u ON u.id = p.user_id
          WHERE p.cup_id = ? ORDER BY p.id ASC`,
    args: [cupId],
  });
  return result.rows.map((r) => ({ ...r, squad: JSON.parse(r.squad) }));
}

async function loadMatches(cupId) {
  const result = await db.execute({
    sql: "SELECT * FROM group_cup_matches WHERE cup_id = ? ORDER BY round ASC, slot_index ASC",
    args: [cupId],
  });
  return result.rows;
}

async function takenPlayerIds(cupId) {
  const participants = await loadParticipants(cupId);
  const ids = new Set();
  participants.forEach((p) => p.squad.forEach((id) => ids.add(id)));
  return ids;
}

async function playerNamesById(ids) {
  if (!ids.length) return {};
  const result = await db.execute({
    sql: `SELECT id, name FROM ej_players WHERE id IN (${ids.map(() => "?").join(",")})`,
    args: ids,
  });
  return Object.fromEntries(result.rows.map((r) => [r.id, r.name]));
}

async function serializeCup(cup, userId) {
  const participants = await loadParticipants(cup.id);
  const matches = await loadMatches(cup.id);
  const allPlayerIds = [...new Set(participants.flatMap((p) => p.squad))];
  const namesById = await playerNamesById(allPlayerIds);

  const myParticipant = participants.find((p) => p.user_id === userId) || null;

  return {
    id: cup.id,
    groupId: cup.group_id,
    name: cup.name,
    bracketSize: cup.bracket_size,
    squadSize: cup.squad_size,
    status: cup.status,
    round: cup.round,
    createdBy: cup.created_by,
    isMine: cup.created_by === userId,
    iJoined: !!myParticipant,
    participants: participants.map((p) => ({
      id: p.id,
      userId: p.user_id,
      username: p.is_cpu ? p.team_name : p.username,
      isCpu: !!p.is_cpu,
      teamName: p.team_name,
      squadNames: p.squad.map((id) => namesById[id] || "?"),
      rating: Math.round(p.rating * 10) / 10,
      eliminated: !!p.eliminated,
    })),
    matches: matches.map((m) => ({
      id: m.id,
      round: m.round,
      slotIndex: m.slot_index,
      participantAId: m.participant_a_id,
      participantBId: m.participant_b_id,
      scoreA: m.score_a,
      scoreB: m.score_b,
      winnerId: m.winner_id,
      played: !!m.played,
    })),
  };
}

// Copa activa (lobby o en curso) del grupo, o la última terminada si no hay
// ninguna activa — así el grupo siempre ve algo relevante.
router.get("/", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!(await assertMember(req.userId, groupId))) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  const active = await db.execute({
    sql: "SELECT * FROM group_cups WHERE group_id = ? AND status != 'finished' ORDER BY created_at DESC LIMIT 1",
    args: [groupId],
  });
  let cup = active.rows[0];
  if (!cup) {
    const last = await db.execute({
      sql: "SELECT * FROM group_cups WHERE group_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [groupId],
    });
    cup = last.rows[0];
  }
  if (!cup) return res.json({ cup: null });
  res.json({ cup: await serializeCup(cup, req.userId) });
});

router.post("/", async (req, res) => {
  const groupId = Number(req.body?.groupId);
  const name = String(req.body?.name || "").trim().slice(0, 60) || "Copa del grupo";
  const bracketSize = BRACKET_SIZES.includes(Number(req.body?.bracketSize)) ? Number(req.body.bracketSize) : 8;

  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!(await assertMember(req.userId, groupId))) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  const existing = await db.execute({
    sql: "SELECT 1 FROM group_cups WHERE group_id = ? AND status != 'finished'",
    args: [groupId],
  });
  if (existing.rows.length) return res.status(400).json({ error: "Ya hay una copa en curso en este grupo" });

  const result = await db.execute({
    sql: "INSERT INTO group_cups (group_id, name, bracket_size, squad_size, created_by) VALUES (?, ?, ?, ?, ?)",
    args: [groupId, name, bracketSize, SQUAD_SIZE, req.userId],
  });
  const cup = await loadCupById(Number(result.lastInsertRowid));
  res.status(201).json({ cup: await serializeCup(cup, req.userId) });
});

// Autocompletado de jugadores para armar el plantel, excluyendo los que ya
// tomó otro participante de ESTA copa (no se puede repetir jugador).
router.get("/:cupId/players", async (req, res) => {
  const cup = await loadCupById(Number(req.params.cupId));
  if (!cup) return res.status(404).json({ error: "Copa no encontrada" });
  if (!(await assertMember(req.userId, cup.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  const q = normalize(req.query.q || "");
  if (q.length < 2) return res.json({ players: [] });

  const taken = [...(await takenPlayerIds(cup.id))];
  const excludeClause = taken.length ? `AND id NOT IN (${taken.map(() => "?").join(",")})` : "";
  const result = await db.execute({
    sql: `SELECT id, name, nationality, position FROM ej_players
          WHERE normalized_name LIKE ? ${excludeClause}
          ORDER BY LENGTH(name) ASC LIMIT 8`,
    args: [`%${q}%`, ...taken],
  });
  res.json({ players: result.rows });
});

router.post("/:cupId/join", async (req, res) => {
  const cup = await loadCupById(Number(req.params.cupId));
  if (!cup) return res.status(404).json({ error: "Copa no encontrada" });
  if (!(await assertMember(req.userId, cup.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });
  if (cup.status !== "lobby") return res.status(400).json({ error: "Esta copa ya arrancó" });

  const squad = Array.isArray(req.body?.squad) ? req.body.squad.map(Number).filter(Number.isInteger) : [];
  if (squad.length !== cup.squad_size || new Set(squad).size !== squad.length) {
    return res.status(400).json({ error: `Elegí ${cup.squad_size} jugadores distintos` });
  }

  const already = await db.execute({
    sql: "SELECT 1 FROM group_cup_participants WHERE cup_id = ? AND user_id = ?",
    args: [cup.id, req.userId],
  });
  if (already.rows.length) return res.status(409).json({ error: "Ya armaste tu equipo en esta copa" });

  const taken = await takenPlayerIds(cup.id);
  const clash = squad.find((id) => taken.has(id));
  if (clash) return res.status(409).json({ error: "Uno de esos jugadores ya lo eligió otro participante" });

  const validPlayers = await db.execute({
    sql: `SELECT id FROM ej_players WHERE id IN (${squad.map(() => "?").join(",")})`,
    args: squad,
  });
  if (validPlayers.rows.length !== squad.length) return res.status(400).json({ error: "Algún jugador no existe" });

  const participantsCount = (await db.execute({ sql: "SELECT COUNT(*) as c FROM group_cup_participants WHERE cup_id = ?", args: [cup.id] })).rows[0].c;
  if (Number(participantsCount) >= cup.bracket_size) return res.status(400).json({ error: "La copa ya está completa" });

  const meResult = await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [req.userId] });
  const teamName = meResult.rows[0]?.username || "Jugador";

  await db.execute({
    sql: `INSERT INTO group_cup_participants (cup_id, user_id, is_cpu, team_name, squad, rating)
          VALUES (?, ?, 0, ?, ?, ?)`,
    args: [cup.id, req.userId, teamName, JSON.stringify(squad), squadRating(squad)],
  });

  res.status(201).json({ cup: await serializeCup(cup, req.userId) });
});

// Arma un plantel CPU al azar (5 jugadores reales que no estén ya tomados en la copa).
async function draftCpuSquad(cupId, squadSize, excludeIds) {
  const exclude = [...excludeIds];
  const excludeClause = exclude.length ? `AND id NOT IN (${exclude.map(() => "?").join(",")})` : "";
  const result = await db.execute({
    sql: `SELECT id FROM ej_players WHERE 1=1 ${excludeClause} ORDER BY RANDOM() LIMIT ?`,
    args: [...exclude, squadSize],
  });
  return result.rows.map((r) => r.id);
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

router.post("/:cupId/start", async (req, res) => {
  const cup = await loadCupById(Number(req.params.cupId));
  if (!cup) return res.status(404).json({ error: "Copa no encontrada" });
  if (cup.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó la copa puede arrancarla" });
  if (cup.status !== "lobby") return res.status(400).json({ error: "Esta copa ya arrancó" });

  let participants = await loadParticipants(cup.id);
  if (participants.length < 1) return res.status(400).json({ error: "Necesitás al menos un participante" });

  // Rellena los cupos vacíos con CPU (plantel al azar, sin pisar jugadores ya tomados).
  const taken = new Set(participants.flatMap((p) => p.squad));
  const missing = cup.bracket_size - participants.length;
  for (let i = 0; i < missing; i++) {
    const squad = await draftCpuSquad(cup.id, cup.squad_size, taken);
    squad.forEach((id) => taken.add(id));
    const rating = squadRating(squad);
    await db.execute({
      sql: `INSERT INTO group_cup_participants (cup_id, user_id, is_cpu, team_name, squad, rating)
            VALUES (?, NULL, 1, ?, ?, ?)`,
      args: [cup.id, `CPU ${i + 1}`, JSON.stringify(squad), rating],
    });
  }

  participants = shuffled(await loadParticipants(cup.id));
  const round1 = [];
  for (let i = 0; i < participants.length; i += 2) {
    round1.push([participants[i], participants[i + 1]]);
  }
  for (let i = 0; i < round1.length; i++) {
    const [a, b] = round1[i];
    await db.execute({
      sql: `INSERT INTO group_cup_matches (cup_id, round, slot_index, participant_a_id, participant_b_id)
            VALUES (?, 1, ?, ?, ?)`,
      args: [cup.id, i, a.id, b.id],
    });
  }

  await db.execute({ sql: "UPDATE group_cups SET status = 'in_progress', round = 1 WHERE id = ?", args: [cup.id] });
  const updated = await loadCupById(cup.id);
  res.json({ cup: await serializeCup(updated, req.userId) });
});

// Resuelve TODOS los partidos pendientes de la ronda actual (no hay partido
// jugable en vivo: la copa se decide por el rating de cada plantel) y arma
// la siguiente ronda con los ganadores. Si era la final, cierra la copa.
router.post("/:cupId/advance", async (req, res) => {
  const cup = await loadCupById(Number(req.params.cupId));
  if (!cup) return res.status(404).json({ error: "Copa no encontrada" });
  if (cup.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó la copa puede avanzar de ronda" });
  if (cup.status !== "in_progress") return res.status(400).json({ error: "Esta copa no está en curso" });

  const participants = await loadParticipants(cup.id);
  const byId = Object.fromEntries(participants.map((p) => [p.id, p]));
  const matches = (await loadMatches(cup.id)).filter((m) => m.round === cup.round);
  const pending = matches.filter((m) => !m.played);

  for (const m of pending) {
    const a = byId[m.participant_a_id];
    const b = byId[m.participant_b_id];
    const { scoreA, scoreB } = simulateCupMatch(a.rating, b.rating);
    const winnerId = scoreA > scoreB ? a.id : b.id;
    await db.execute({
      sql: "UPDATE group_cup_matches SET score_a = ?, score_b = ?, winner_id = ?, played = 1 WHERE id = ?",
      args: [scoreA, scoreB, winnerId, m.id],
    });
    if (winnerId !== a.id) await db.execute({ sql: "UPDATE group_cup_participants SET eliminated = 1 WHERE id = ?", args: [a.id] });
    if (winnerId !== b.id) await db.execute({ sql: "UPDATE group_cup_participants SET eliminated = 1 WHERE id = ?", args: [b.id] });
  }

  const playedThisRound = await db.execute({
    sql: "SELECT winner_id FROM group_cup_matches WHERE cup_id = ? AND round = ? ORDER BY slot_index ASC",
    args: [cup.id, cup.round],
  });
  const winners = playedThisRound.rows.map((r) => r.winner_id);

  if (winners.length === 1) {
    await db.execute({ sql: "UPDATE group_cups SET status = 'finished' WHERE id = ?", args: [cup.id] });
  } else {
    const nextRound = cup.round + 1;
    for (let i = 0; i < winners.length; i += 2) {
      await db.execute({
        sql: `INSERT INTO group_cup_matches (cup_id, round, slot_index, participant_a_id, participant_b_id)
              VALUES (?, ?, ?, ?, ?)`,
        args: [cup.id, nextRound, i / 2, winners[i], winners[i + 1]],
      });
    }
    await db.execute({ sql: "UPDATE group_cups SET round = ? WHERE id = ?", args: [nextRound, cup.id] });
  }

  const updated = await loadCupById(cup.id);
  res.json({ cup: await serializeCup(updated, req.userId) });
});

export default router;
