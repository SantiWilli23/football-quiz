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

// Rating 74..92 mapeado a precio 4..12 — un plantel de 13 "promedio" (rating
// ~83) cuesta ~104, así que con 100 de presupuesto no entra cualquier
// combinación: hay que elegir entre algunas figuras caras o completar con
// más jugadores baratos, como cualquier fantasy real.
function priceForPlayer(id, modern = false) {
  const rating = ratingForPlayer(id);
  if (!modern) return Math.round(4 + ((rating - 74) / 18) * 8);
  // Ligas nuevas: precios en millones de euros, curva convexa (las figuras
  // valen mucho más que los del medio). Un plantel de 13 al azar sale ~200M.
  const t = (rating - 74) / 18;
  return Math.round(2 + 45 * Math.pow(t, 2.2));
}

// Las ligas viejas (presupuesto 100) siguen con la escala vieja para no
// romper lo que ya se armó; las nuevas arrancan con 200M.
const isModern = (league) => league.budget_total > 100;
const NEW_LEAGUE_BUDGET = 200;
const STARTER_SHAPE = { Portero: 2, Defensa: 4, Mediocampista: 4, Delantero: 3 };

function squadCost(playerIds, modern = false) {
  return playerIds.reduce((sum, id) => sum + priceForPlayer(id, modern), 0);
}

let playersByPosition = null;
async function loadPlayersByPosition() {
  if (playersByPosition) return playersByPosition;
  const rows = (await db.execute("SELECT id, name, position FROM ej_players")).rows;
  const map = {};
  const CATEGORY = { Portero: "Portero", Arquero: "Portero", Defensa: "Defensa", Mediocampista: "Mediocampista", Delantero: "Delantero", Extremo: "Delantero" };
  for (const r of rows) {
    const cat = CATEGORY[r.position];
    if (cat) (map[cat] ||= []).push({ id: r.id, name: r.name, position: r.position, category: cat });
  }
  playersByPosition = map;
  return map;
}

// Plantel inicial "regalado": 2 arqueros, 4 defensas, 4 medios y 3 delanteros
// al azar cuyo valor total ronda el presupuesto (~200M) sin pasarse. Cada
// llamada sortea uno nuevo, así que sirve también para "sortear otro".
// Último plantel sorteado por usuario y liga: solo se puede confirmar uno de estos.
const issuedStarters = new Map();

async function buildStarterSquad(budget, modern) {
  const pool = await loadPlayersByPosition();
  let best = null;
  for (let attempt = 0; attempt < 600; attempt++) {
    const picked = [];
    const used = new Set();
    for (const [pos, n] of Object.entries(STARTER_SHAPE)) {
      const list = pool[pos] || [];
      for (let i = 0; i < n && list.length; i++) {
        let p;
        do { p = list[Math.floor(Math.random() * list.length)]; } while (used.has(p.id));
        used.add(p.id);
        picked.push(p);
      }
    }
    const cost = squadCost(picked.map((p) => p.id), modern);
    if (cost <= budget && (!best || cost > best.cost)) best = { picked, cost };
    if (best && best.cost >= budget * 0.94) break;
  }
  const squad = best.picked.map((p) => ({ ...p, price: priceForPlayer(p.id, modern) }));
  return { squad, cost: best.cost };
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

async function loadPendingTradeOffers(leagueId) {
  const result = await db.execute({
    sql: `SELECT t.*, fp_from.user_id AS from_user_id, u_from.username AS from_username,
                 fp_to.user_id AS to_user_id, u_to.username AS to_username
          FROM fantasy_trade_offers t
          JOIN fantasy_participants fp_from ON fp_from.id = t.from_participant_id
          JOIN users u_from ON u_from.id = fp_from.user_id
          JOIN fantasy_participants fp_to ON fp_to.id = t.to_participant_id
          JOIN users u_to ON u_to.id = fp_to.user_id
          WHERE t.league_id = ? AND t.status = 'pendiente'
          ORDER BY t.created_at DESC`,
    args: [leagueId],
  });
  return result.rows;
}

async function serializeLeague(league, userId) {
  const participants = await loadParticipants(league.id);
  const allIds = [...new Set(participants.flatMap((p) => p.squad))];
  const offers = await loadPendingTradeOffers(league.id);
  for (const o of offers) {
    if (!allIds.includes(o.offer_player_id)) allIds.push(o.offer_player_id);
    if (!allIds.includes(o.want_player_id)) allIds.push(o.want_player_id);
  }
  const namesById = await playerNamesById(allIds);
  const memberCount = (await db.execute({
    sql: "SELECT COUNT(*) as c FROM group_members WHERE group_id = ?",
    args: [league.group_id],
  })).rows[0].c;

  const myParticipant = participants.find((p) => p.user_id === userId) || null;

  const asOffer = (o) => ({
    id: o.id,
    fromUsername: o.from_username,
    toUsername: o.to_username,
    offerPlayer: { id: o.offer_player_id, name: namesById[o.offer_player_id] || "?", price: priceForPlayer(o.offer_player_id, isModern(league)) },
    wantPlayer: { id: o.want_player_id, name: namesById[o.want_player_id] || "?", price: priceForPlayer(o.want_player_id, isModern(league)) },
  });

  return {
    id: league.id,
    groupId: league.group_id,
    status: league.status,
    budgetTotal: league.budget_total,
    unit: isModern(league) ? "M€" : "",
    squadSize: league.squad_size,
    jornada: league.jornada,
    marketOpen: isMarketOpen(),
    memberCount: Number(memberCount),
    participantCount: participants.length,
    iJoined: !!myParticipant,
    myBudgetRemaining: myParticipant?.budget_remaining ?? null,
    mySquad: myParticipant
      ? myParticipant.squad.map((id) => ({ id, name: namesById[id] || "?", price: priceForPlayer(id, isModern(league)) }))
      : null,
    standings: participants.map((p, i) => ({
      position: i + 1,
      userId: p.user_id,
      username: p.username,
      points: p.points_total,
      isMe: p.user_id === userId,
    })),
    otherParticipants: participants
      .filter((p) => p.user_id !== userId)
      .map((p) => ({
        userId: p.user_id,
        username: p.username,
        squad: p.squad.map((id) => ({ id, name: namesById[id] || "?", price: priceForPlayer(id, isModern(league)) })),
      })),
    tradeOffersReceived: myParticipant ? offers.filter((o) => o.to_user_id === userId).map(asOffer) : [],
    tradeOffersSent: myParticipant ? offers.filter((o) => o.from_user_id === userId).map(asOffer) : [],
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
    sql: "INSERT INTO fantasy_leagues (group_id, created_by, budget_total, squad_size) VALUES (?, ?, ?, 13)",
    args: [groupId, req.userId, NEW_LEAGUE_BUDGET],
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
  res.json({ players: result.rows.map((p) => ({ ...p, price: priceForPlayer(p.id, isModern(league)) })) });
});

// Plantel inicial sorteado (~el presupuesto entero). Cada llamada, uno nuevo.
router.get("/:leagueId/starter", async (req, res) => {
  const league = await loadLeagueById(Number(req.params.leagueId));
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (!(await assertMember(req.userId, league.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });
  const { squad, cost } = await buildStarterSquad(league.budget_total, isModern(league));
  issuedStarters.set(`${league.id}:${req.userId}`, squad.map((p) => p.id).sort((a, b) => a - b).join(","));
  res.json({ squad, cost, budgetTotal: league.budget_total });
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

  const issued = issuedStarters.get(`${league.id}:${req.userId}`);
  if (!issued || issued !== [...squad].sort((a, b) => a - b).join(",")) {
    return res.status(400).json({ error: "El plantel inicial es solo por sorteo: pedí uno y confirmalo" });
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

  const cost = squadCost(squad, isModern(league));
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

  const newBudget = participant.budget_remaining + priceForPlayer(sellId, isModern(league)) - priceForPlayer(buyId, isModern(league));
  if (newBudget < 0) return res.status(400).json({ error: "No te alcanza el presupuesto para ese fichaje" });

  const newSquad = squad.map((id) => (id === sellId ? buyId : id));
  await db.execute({
    sql: "UPDATE fantasy_participants SET squad = ?, budget_remaining = ? WHERE id = ?",
    args: [JSON.stringify(newSquad), newBudget, participant.id],
  });

  league = await resolvePendingJornadas(league);
  res.json({ league: await serializeLeague(league, req.userId) });
});

async function myParticipantIn(leagueId, userId) {
  const result = await db.execute({
    sql: "SELECT * FROM fantasy_participants WHERE league_id = ? AND user_id = ?",
    args: [leagueId, userId],
  });
  return result.rows[0] || null;
}

// Proponerle un cambio 1x1 a otro participante de la misma liga — no toca
// presupuesto, es un intercambio directo. No hace falta que sea mié/dom: eso
// es solo para el mercado con dinero, esto es un acuerdo entre dos personas.
router.post("/:leagueId/trade-offer", async (req, res) => {
  const league = await loadLeagueById(Number(req.params.leagueId));
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (!(await assertMember(req.userId, league.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });
  if (league.status !== "active") return res.status(400).json({ error: "La liga todavía no arrancó" });

  const toUserId = Number(req.body?.toUserId);
  const offerPlayerId = Number(req.body?.offerPlayerId);
  const wantPlayerId = Number(req.body?.wantPlayerId);
  if (!Number.isInteger(toUserId) || !Number.isInteger(offerPlayerId) || !Number.isInteger(wantPlayerId)) {
    return res.status(400).json({ error: "Faltan datos de la oferta" });
  }
  if (toUserId === req.userId) return res.status(400).json({ error: "No te podés hacer una oferta a vos mismo" });

  const me = await myParticipantIn(league.id, req.userId);
  if (!me) return res.status(400).json({ error: "Todavía no armaste tu plantel" });
  const mySquad = JSON.parse(me.squad);
  if (!mySquad.includes(offerPlayerId)) return res.status(400).json({ error: "Ese jugador no es tuyo" });

  const target = await myParticipantIn(league.id, toUserId);
  if (!target) return res.status(404).json({ error: "Ese jugador de la liga no existe" });
  const targetSquad = JSON.parse(target.squad);
  if (!targetSquad.includes(wantPlayerId)) return res.status(400).json({ error: "Ese jugador no está en el plantel del otro" });

  const result = await db.execute({
    sql: `INSERT INTO fantasy_trade_offers (league_id, from_participant_id, to_participant_id, offer_player_id, want_player_id)
          VALUES (?, ?, ?, ?, ?)`,
    args: [league.id, me.id, target.id, offerPlayerId, wantPlayerId],
  });

  res.status(201).json({ offerId: Number(result.lastInsertRowid), league: await serializeLeague(league, req.userId) });
});

async function loadOwnOffer(offerId, leagueId) {
  const result = await db.execute({
    sql: "SELECT * FROM fantasy_trade_offers WHERE id = ? AND league_id = ? AND status = 'pendiente'",
    args: [offerId, leagueId],
  });
  return result.rows[0] || null;
}

router.post("/:leagueId/trade-offer/:offerId/accept", async (req, res) => {
  const league = await loadLeagueById(Number(req.params.leagueId));
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (!(await assertMember(req.userId, league.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  const offer = await loadOwnOffer(Number(req.params.offerId), league.id);
  if (!offer) return res.status(404).json({ error: "Esa oferta ya no está disponible" });

  const me = await myParticipantIn(league.id, req.userId);
  if (!me || me.id !== offer.to_participant_id) return res.status(403).json({ error: "Esa oferta no es para vos" });

  const fromResult = await db.execute({ sql: "SELECT * FROM fantasy_participants WHERE id = ?", args: [offer.from_participant_id] });
  const from = fromResult.rows[0];
  const fromSquad = JSON.parse(from.squad);
  const toSquad = JSON.parse(me.squad);

  if (!fromSquad.includes(offer.offer_player_id) || !toSquad.includes(offer.want_player_id)) {
    await db.execute({ sql: "UPDATE fantasy_trade_offers SET status = 'cancelada', resolved_at = datetime('now') WHERE id = ?", args: [offer.id] });
    return res.status(409).json({ error: "Alguno de los dos jugadores ya no está disponible — la oferta se canceló sola" });
  }

  const newFromSquad = fromSquad.map((id) => (id === offer.offer_player_id ? offer.want_player_id : id));
  const newToSquad = toSquad.map((id) => (id === offer.want_player_id ? offer.offer_player_id : id));

  await db.execute({ sql: "UPDATE fantasy_participants SET squad = ? WHERE id = ?", args: [JSON.stringify(newFromSquad), from.id] });
  await db.execute({ sql: "UPDATE fantasy_participants SET squad = ? WHERE id = ?", args: [JSON.stringify(newToSquad), me.id] });
  await db.execute({ sql: "UPDATE fantasy_trade_offers SET status = 'aceptada', resolved_at = datetime('now') WHERE id = ?", args: [offer.id] });

  res.json({ league: await serializeLeague(league, req.userId) });
});

router.post("/:leagueId/trade-offer/:offerId/decline", async (req, res) => {
  const league = await loadLeagueById(Number(req.params.leagueId));
  if (!league) return res.status(404).json({ error: "Liga no encontrada" });
  if (!(await assertMember(req.userId, league.group_id))) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  const offer = await loadOwnOffer(Number(req.params.offerId), league.id);
  if (!offer) return res.status(404).json({ error: "Esa oferta ya no está disponible" });

  const me = await myParticipantIn(league.id, req.userId);
  const isRecipient = me && me.id === offer.to_participant_id;
  const isSender = me && me.id === offer.from_participant_id;
  if (!isRecipient && !isSender) return res.status(403).json({ error: "Esa oferta no es tuya" });

  await db.execute({
    sql: `UPDATE fantasy_trade_offers SET status = ?, resolved_at = datetime('now') WHERE id = ?`,
    args: [isSender ? "cancelada" : "rechazada", offer.id],
  });

  res.json({ league: await serializeLeague(league, req.userId) });
});

export default router;
