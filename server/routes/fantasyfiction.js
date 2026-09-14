import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { normalize } from "../db/seed-equipo-jugador.js";

const router = Router();
router.use(requireAuth);

const JORNADA_MS = 7 * 24 * 60 * 60 * 1000; // una jornada por semana
const MAX_CATCHUP_JORNADAS = 8; // por si la liga estuvo mucho tiempo sin que nadie entre

// Mismo criterio que la Copa 8a2 (group-cup.js): no hay un rating oficial de
// estos jugadores en la base, así que se deriva de forma determinística del
// id — mismo jugador, mismo nivel siempre. El precio sale de ese rating.
function ratingForPlayer(id) {
  const h = (id * 2654435761) >>> 0;
  return 74 + (h % 19); // 74..92
}

function priceForPlayer(id) {
  return Math.round((ratingForPlayer(id) - 50) * 12);
}

function squadCost(playerIds) {
  return playerIds.reduce((sum, id) => sum + priceForPlayer(id), 0);
}

// El mercado (vender/comprar) sólo abre miércoles y domingo.
function isMarketOpen(date = new Date()) {
  const day = date.getDay(); // 0 = domingo, 3 = miércoles
  return day === 0 || day === 3;
}

function poisson(lambda) {
  const l = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}

// Puntaje de un jugador en una jornada simulada: mezcla su nivel base con
// una parte de azar (partido bueno/malo), como cualquier fantasy real.
function simulatePlayerJornada(playerId) {
  const rating = ratingForPlayer(playerId);
  const base = (rating - 70) * 0.6;
  const noise = poisson(2.2) - 2.2;
  return Math.round(base + noise * 3 + 2);
}

async function assertMember(userId, groupId) {
  const result = await db.execute({
    sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return result.rows.length > 0;
}

async function loadLeagueById(id) {
  const result = await db.execute({ sql: "SELECT * FROM fantasy_leagues WHERE id = ?", args: [id] });
  return result.rows[0] || null;
}

async function loadParticipants(leagueId) {
  const result = await db.execute({
    sql: `SELECT p.*, u.username FROM fantasy_participants p
          JOIN users u ON u.id = p.user_id
          WHERE p.league_id = ? ORDER BY p.points_total DESC, p.joined_at ASC`,
    args: [leagueId],
  });
  return result.rows.map((r) => ({ ...r, squad: JSON.parse(r.squad) }));
}

async function playerNamesById(ids) {
  if (!ids.length) return {};
  const result = await db.execute({
    sql: `SELECT id, name FROM ej_players WHERE id IN (${ids.map(() => "?").join(",")})`,
    args: ids,
  });
  return Object.fromEntries(result.rows.map((r) => [r.id, r.name]));
}

// Resuelve las jornadas pendientes (una por semana transcurrida desde la
// última) y, de paso, revisa si ya se sumaron todos los miembros del grupo
// para recién ahí arrancar la liga — todo de forma perezosa, al leer,
// mismo patrón que ya usa Liga Online DT para sus fixtures.
async function resolvePendingJornadas(league) {
  if (league.status !== "active") return league;
  if (!league.last_jornada_at) return league;

  const lastAt = new Date(league.last_jornada_at.replace(" ", "T") + "Z").getTime();
  const elapsed = Date.now() - lastAt;
  let pending = Math.min(MAX_CATCHUP_JORNADAS, Math.floor(elapsed / JORNADA_MS));
  if (pending <= 0) return league;

  const participants = await loadParticipants(league.id);
  let jornada = league.jornada;

  for (let i = 0; i < pending; i++) {
    jornada += 1;
    for (const p of participants) {
      const points = p.squad.reduce((sum, id) => sum + simulatePlayerJornada(id), 0);
      await db.execute({
        sql: `INSERT INTO fantasy_jornada_scores (league_id, jornada, participant_id, points)
              VALUES (?, ?, ?, ?)`,
        args: [league.id, jornada, p.id, points],
      });
      await db.execute({
        sql: "UPDATE fantasy_participants SET points_total = points_total + ? WHERE id = ?",
        args: [points, p.id],
      });
    }
  }

  const newLastAt = new Date(lastAt + pending * JORNADA_MS).toISOString().replace("T", " ").slice(0, 19);
  await db.execute({
    sql: "UPDATE fantasy_leagues SET jornada = ?, last_jornada_at = ? WHERE id = ?",
    args: [jornada, newLastAt, league.id],
  });

  return loadLeagueById(league.id);
}

async function serializeLeague(league, userId) {
  const participants = await loadParticipants(league.id);
  const allIds = [...new Set(participants.flatMap((p) => p.squad))];
  const namesById = await playerNamesById(allIds);
  const memberCount = (await db.execute({
    sql: "SELECT COUNT(*) as c FROM group_members WHERE group_id = ?",
    args: [league.group_id],
  })).rows[0].c;

  const myParticipant = participants.find((p) => p.user_id === userId) || null;

  return {
    id: league.id,
    groupId: league.group_id,
    status: league.status,
    budgetTotal: league.budget_total,
    squadSize: league.squad_size,
    jornada: league.jornada,
    marketOpen: isMarketOpen(),
    memberCount: Number(memberCount),
    participantCount: participants.length,
    iJoined: !!myParticipant,
    myBudgetRemaining: myParticipant?.budget_remaining ?? null,
    mySquad: myParticipant
      ? myParticipant.squad.map((id) => ({ id, name: namesById[id] || "?", price: priceForPlayer(id) }))
      : null,
    standings: participants.map((p, i) => ({
      position: i + 1,
      userId: p.user_id,
      username: p.username,
      points: p.points_total,
      isMe: p.user_id === userId,
    })),
  };
}

router.get("/", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!(await assertMember(req.userId, groupId))) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  const active = await db.execute({
    sql: "SELECT * FROM fantasy_leagues WHERE group_id = ? AND status != 'finished' ORDER BY created_at DESC LIMIT 1",
    args: [groupId],
  });
  let league = active.rows[0];
  if (!league) {
    const last = await db.execute({
      sql: "SELECT * FROM fantasy_leagues WHERE group_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [groupId],
    });
    league = last.rows[0];
  }
  if (!league) return res.json({ league: null });

  league = await resolvePendingJornadas(league);
  res.json({ league: await serializeLeague(league, req.userId) });
});

router.post("/", async (req, res) => {
  const groupId = Number(req.body?.groupId);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!(await assertMember(req.userId, groupId))) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  const existing = await db.execute({
    sql: "SELECT 1 FROM fantasy_leagues WHERE group_id = ? AND status != 'finished'",
    args: [groupId],
  });
  if (existing.rows.length) return res.status(400).json({ error: "Ya hay una FantasyFiction en curso en este grupo" });

  const result = await db.execute({
    sql: "INSERT INTO fantasy_leagues (group_id, created_by) VALUES (?, ?)",
    args: [groupId, req.userId],
  });
  const league = await loadLeagueById(Number(result.lastInsertRowid));
  res.status(201).json({ league: await serializeLeague(league, req.userId) });
});

router.get("/:leagueId/players", async (req, res) => {
  const league = await loadLeagueById(Number(req.params.leagueId));
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (!(await assertMember(req.userId, league.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  const q = normalize(req.query.q || "");
  if (q.length < 2) return res.json({ players: [] });

  const result = await db.execute({
    sql: `SELECT id, name, nationality, position FROM ej_players
          WHERE normalized_name LIKE ? ORDER BY LENGTH(name) ASC LIMIT 8`,
    args: [`%${q}%`],
  });
  res.json({ players: result.rows.map((p) => ({ ...p, price: priceForPlayer(p.id) })) });
});

// Arma el plantel inicial. En cuanto se suman TODOS los miembros del grupo
// con su plantel, la liga arranca sola (jornada 1, mercado habilitado).
router.post("/:leagueId/join", async (req, res) => {
  const league = await loadLeagueById(Number(req.params.leagueId));
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (!(await assertMember(req.userId, league.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });
  if (league.status !== "draft") return res.status(400).json({ error: "Esta liga ya arrancó a jugarse" });

  const squad = Array.isArray(req.body?.squad) ? req.body.squad.map(Number).filter(Number.isInteger) : [];
  if (squad.length !== league.squad_size || new Set(squad).size !== squad.length) {
    return res.status(400).json({ error: `Elegí ${league.squad_size} jugadores distintos` });
  }

  const already = await db.execute({
    sql: "SELECT 1 FROM fantasy_participants WHERE league_id = ? AND user_id = ?",
    args: [league.id, req.userId],
  });
  if (already.rows.length) return res.status(409).json({ error: "Ya armaste tu plantel en esta liga" });

  const validPlayers = await db.execute({
    sql: `SELECT id FROM ej_players WHERE id IN (${squad.map(() => "?").join(",")})`,
    args: squad,
  });
  if (validPlayers.rows.length !== squad.length) return res.status(400).json({ error: "Algún jugador no existe" });

  const cost = squadCost(squad);
  if (cost > league.budget_total) {
    return res.status(400).json({ error: `Ese plantel cuesta ${cost} y tu presupuesto es ${league.budget_total}` });
  }

  await db.execute({
    sql: `INSERT INTO fantasy_participants (league_id, user_id, squad, budget_remaining)
          VALUES (?, ?, ?, ?)`,
    args: [league.id, req.userId, JSON.stringify(squad), league.budget_total - cost],
  });

  const memberCount = (await db.execute({
    sql: "SELECT COUNT(*) as c FROM group_members WHERE group_id = ?",
    args: [league.group_id],
  })).rows[0].c;
  const participantCount = (await db.execute({
    sql: "SELECT COUNT(*) as c FROM fantasy_participants WHERE league_id = ?",
    args: [league.id],
  })).rows[0].c;

  if (Number(participantCount) >= Number(memberCount)) {
    await db.execute({
      sql: "UPDATE fantasy_leagues SET status = 'active', jornada = 0, last_jornada_at = datetime('now') WHERE id = ?",
      args: [league.id],
    });
  }

  const updated = await loadLeagueById(league.id);
  res.status(201).json({ league: await serializeLeague(updated, req.userId) });
});

// Vender un jugador del plantel y comprar otro — sólo mié/dom, sólo con la liga activa.
router.post("/:leagueId/transfer", async (req, res) => {
  let league = await loadLeagueById(Number(req.params.leagueId));
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (!(await assertMember(req.userId, league.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });
  if (league.status !== "active") return res.status(400).json({ error: "La liga todavía no arrancó" });
  if (!isMarketOpen()) return res.status(400).json({ error: "El mercado sólo abre los miércoles y domingos" });

  const sellId = Number(req.body?.sellPlayerId);
  const buyId = Number(req.body?.buyPlayerId);
  if (!Number.isInteger(sellId) || !Number.isInteger(buyId)) {
    return res.status(400).json({ error: "Faltan los jugadores a vender/comprar" });
  }
  if (sellId === buyId) return res.status(400).json({ error: "Elegí un jugador distinto para comprar" });

  const participantResult = await db.execute({
    sql: "SELECT * FROM fantasy_participants WHERE league_id = ? AND user_id = ?",
    args: [league.id, req.userId],
  });
  const participant = participantResult.rows[0];
  if (!participant) return res.status(400).json({ error: "Todavía no armaste tu plantel" });

  const squad = JSON.parse(participant.squad);
  if (!squad.includes(sellId)) return res.status(400).json({ error: "Ese jugador no es tuyo" });
  if (squad.includes(buyId)) return res.status(409).json({ error: "Ese jugador ya está en tu plantel" });

  const buyExists = await db.execute({ sql: "SELECT 1 FROM ej_players WHERE id = ?", args: [buyId] });
  if (!buyExists.rows.length) return res.status(400).json({ error: "Ese jugador no existe" });

  const newBudget = participant.budget_remaining + priceForPlayer(sellId) - priceForPlayer(buyId);
  if (newBudget < 0) return res.status(400).json({ error: "No te alcanza el presupuesto para ese fichaje" });

  const newSquad = squad.map((id) => (id === sellId ? buyId : id));
  await db.execute({
    sql: "UPDATE fantasy_participants SET squad = ?, budget_remaining = ? WHERE id = ?",
    args: [JSON.stringify(newSquad), newBudget, participant.id],
  });

  league = await resolvePendingJornadas(league);
  res.json({ league: await serializeLeague(league, req.userId) });
});

export default router;
