import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { rng, shuffle } from "../utils/futgames.js";
import {
  FORMATIONS, MENTALITIES, LEAGUE_LABEL, MAX_SQUAD, TOTAL_ROUNDS, clubsOf, buildLeaguePlayers, startingSquads, autoLineup,
  slotsOf, simulateRound, scoreLineup, progressPlayer, minBidFor, bankPrice, fixturesFor,
} from "../utils/fantasy-engine.js";

// Fantasy (ver el comentario de las tablas fx_* en schema.sql). Todo el avance del tiempo es perezoso: cada vez
// que alguien pide el estado de la liga se cierran las pujas vencidas y se juegan las fechas que ya tocaban.
const router = Router();
router.use(requireAuth);

const DAY_MS = Number(process.env.FX_DAY_MS) || 24 * 60 * 60 * 1000;
const SHOP_DAYS = 3;
const SHOP_SIZE = 7;
const START_CASH = 250; // millones de euros para la tienda y los fichajes
const MAX_SEASONS = 3;
const AWARDS = [60, 40, 20, 10]; // 1°, 2°, 3° y 4°; cada temporada siguiente suma 5 más a cada puesto
const norm = (n) => Math.round(n * 10) / 10;

const one = async (sql, args = []) => (await db.execute({ sql, args })).rows[0] || null;
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;

async function getLeague(id) {
  return one("SELECT * FROM fx_leagues WHERE id = ?", [id]);
}

async function members(leagueId) {
  return all(
    `SELECT m.*, u.username, u.avatar, u.avatar_config FROM fx_members m JOIN users u ON u.id = m.user_id WHERE m.league_id = ? ORDER BY m.id`,
    [leagueId],
  );
}

async function inGroup(groupId, userId) {
  return !!(await one("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", [groupId, userId]));
}

async function setLineup(userId, leagueId, formation, ids, mentality) {
  await db.execute({
    sql: "UPDATE fx_members SET formation = ?, lineup = ?, mentality = COALESCE(?, mentality) WHERE league_id = ? AND user_id = ?",
    args: [formation, JSON.stringify(ids), mentality ?? null, leagueId, userId],
  });
}

// Saca a un jugador del once de su dueño (cuando lo vende o lo traspasa).
async function dropFromLineup(leagueId, userId, playerId) {
  const m = await one("SELECT lineup FROM fx_members WHERE league_id = ? AND user_id = ?", [leagueId, userId]);
  if (!m) return;
  let ids = [];
  try { ids = JSON.parse(m.lineup); } catch { ids = []; }
  if (!ids.includes(playerId)) return;
  await db.execute({ sql: "UPDATE fx_members SET lineup = ? WHERE league_id = ? AND user_id = ?", args: [JSON.stringify(ids.map((x) => (x === playerId ? null : x))), leagueId, userId] });
}

// ---------------------------------- tienda ----------------------------------
async function ensureShop(league, day) {
  if (await one("SELECT 1 FROM fx_shop WHERE league_id = ? AND season = ? AND day = ?", [league.id, league.season, day])) return;
  const free = await all("SELECT id FROM fx_players WHERE league_id = ? AND owner_id IS NULL", [league.id]);
  const rand = rng((league.seed * 31 + league.season * 7 + day) >>> 0);
  const picked = shuffle(free, rand).slice(0, SHOP_SIZE);
  await db.batch(picked.map((p, i) => ({
    sql: "INSERT INTO fx_shop (league_id, season, day, slot, player_id) VALUES (?, ?, ?, ?, ?)",
    args: [league.id, league.season, day, i + 1, p.id],
  })), "write");
}

// Cierra las pujas de un día: en cada jugador gana la oferta más alta (y la más temprana si empatan) siempre que
// el participante tenga la plata y lugar en el plantel.
async function resolveShopDay(league, day) {
  const rows = await all("SELECT * FROM fx_shop WHERE league_id = ? AND season = ? AND day = ? AND resolved = 0", [league.id, league.season, day]);
  if (!rows.length) return;
  const bids = await all(`SELECT * FROM fx_bids WHERE shop_id IN (${rows.map(() => "?").join(",")}) ORDER BY amount DESC, created_at ASC`, rows.map((r) => r.id));
  const cash = new Map((await members(league.id)).map((m) => [m.user_id, m.cash]));
  const squadSize = new Map();
  for (const r of await all("SELECT owner_id, COUNT(*) AS n FROM fx_players WHERE league_id = ? AND owner_id IS NOT NULL GROUP BY owner_id", [league.id])) squadSize.set(r.owner_id, Number(r.n));
  const stmts = [];
  // las ofertas más altas se resuelven primero (en todas las vitrinas) para repartir bien la plata
  for (const b of bids) {
    const shop = rows.find((r) => r.id === b.shop_id);
    if (!shop || shop.resolved || shop.sold_to) continue;
    if ((cash.get(b.user_id) ?? 0) < b.amount || (squadSize.get(b.user_id) ?? 0) >= MAX_SQUAD) continue;
    shop.sold_to = b.user_id;
    shop.price = b.amount;
    cash.set(b.user_id, norm(cash.get(b.user_id) - b.amount));
    squadSize.set(b.user_id, (squadSize.get(b.user_id) ?? 0) + 1);
    stmts.push({ sql: "UPDATE fx_players SET owner_id = ? WHERE id = ?", args: [b.user_id, shop.player_id] });
    stmts.push({ sql: "UPDATE fx_members SET cash = ? WHERE league_id = ? AND user_id = ?", args: [cash.get(b.user_id), league.id, b.user_id] });
  }
  for (const r of rows) stmts.push({ sql: "UPDATE fx_shop SET resolved = 1, sold_to = ?, price = ? WHERE id = ?", args: [r.sold_to ?? null, r.price ?? null, r.id] });
  await db.batch(stmts, "write");
}

// ---------------------------------- jornadas ----------------------------------
async function playRound(league, round) {
  const players = (await all("SELECT * FROM fx_players WHERE league_id = ?", [league.id])).map((p) => ({ ...p }));
  const byClub = new Map();
  for (const p of players) (byClub.get(p.club) || byClub.set(p.club, []).get(p.club)).push(p);
  const { matches, lines } = simulateRound(league.league_key, league.seed, league.season, round, byClub);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const linesById = new Map(lines.map((l) => [l.id, l]));
  const stmts = matches.map((m) => ({
    sql: "INSERT INTO fx_matches (league_id, season, round, home, away, hg, ag) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [league.id, league.season, round, m.home, m.away, m.hg, m.ag],
  }));
  for (const l of lines) {
    const p = playerById.get(l.id);
    const next = progressPlayer(p, l.rating);
    stmts.push({
      sql: "UPDATE fx_players SET form = ?, played = ?, ovr = ?, value = ?, points = points + ?, goals = goals + ?, assists = assists + ? WHERE id = ?",
      args: [next.form, next.played, next.ovr, next.value, l.rating, l.goals, l.assists, l.id],
    });
  }
  for (const m of await members(league.id)) {
    let ids = [];
    try { ids = JSON.parse(m.lineup); } catch { ids = []; }
    const mine = ids.filter((id) => id != null && playerById.get(id)?.owner_id === m.user_id);
    const { points, detail } = scoreLineup(mine, playerById, linesById, m.mentality);
    stmts.push({
      sql: "INSERT OR REPLACE INTO fx_scores (league_id, season, round, user_id, points, detail) VALUES (?, ?, ?, ?, ?, ?)",
      args: [league.id, league.season, round, m.user_id, points, JSON.stringify(detail)],
    });
    stmts.push({ sql: "UPDATE fx_members SET season_points = season_points + ? WHERE league_id = ? AND user_id = ?", args: [points, league.id, m.user_id] });
  }
  stmts.push({ sql: "UPDATE fx_leagues SET round = ? WHERE id = ?", args: [round, league.id] });
  // en lotes para no mandar cientos de sentencias de una sola vez
  for (let i = 0; i < stmts.length; i += 150) await db.batch(stmts.slice(i, i + 150), "write");
}

// Fin de temporada: el podio del grupo suma puntos (60/40/20/10, y 5 más por puesto cada temporada que pasa).
async function closeSeason(league) {
  const ms = (await members(league.id)).sort((a, b) => b.season_points - a.season_points || a.user_id - b.user_id);
  const extra = 5 * (league.season - 1);
  const stmts = [];
  ms.slice(0, AWARDS.length).forEach((m, i) => {
    const points = AWARDS[i] + extra;
    stmts.push({ sql: "INSERT OR IGNORE INTO fx_awards (league_id, season, user_id, position, points) VALUES (?, ?, ?, ?, ?)", args: [league.id, league.season, m.user_id, i + 1, points] });
    stmts.push({
      sql: "INSERT OR IGNORE INTO online_game_points (user_id, group_id, game_key, room, date, opponents, points) VALUES (?, ?, 'fantasy', ?, ?, ?, ?)",
      args: [m.user_id, league.group_id, `fx-${league.id}-s${league.season}-p${i + 1}`, todayStr(), Math.max(0, ms.length - 1), points],
    });
  });
  if (league.season < MAX_SEASONS) {
    // la temporada siguiente arranca con la tienda abierta, justo al terminar la última fecha
    stmts.push({ sql: "UPDATE fx_leagues SET season = season + 1, status = 'shop', round = 0, phase_started_at = ? WHERE id = ?", args: [league.phase_started_at + TOTAL_ROUNDS * DAY_MS, league.id] });
    stmts.push({ sql: "UPDATE fx_members SET season_points = 0 WHERE league_id = ?", args: [league.id] });
  } else {
    stmts.push({ sql: "UPDATE fx_leagues SET status = 'finished' WHERE id = ?", args: [league.id] });
  }
  await db.batch(stmts, "write");
}

async function advance(leagueId) {
  let league = await getLeague(leagueId);
  const now = Date.now();
  for (let guard = 0; guard < 20 && league; guard++) {
    if (league.status === "shop") {
      const elapsed = Math.floor((now - league.phase_started_at) / DAY_MS);
      const day = Math.min(SHOP_DAYS, elapsed + 1);
      await ensureShop(league, day);
      for (let d = 1; d < day; d++) await resolveShopDay(league, d);
      if (elapsed >= SHOP_DAYS) {
        await resolveShopDay(league, SHOP_DAYS);
        await db.execute({ sql: "UPDATE fx_leagues SET status = 'season', round = 0, phase_started_at = ? WHERE id = ?", args: [league.phase_started_at + SHOP_DAYS * DAY_MS, league.id] });
        league = await getLeague(leagueId);
        continue;
      }
      break;
    }
    if (league.status === "season") {
      const due = Math.min(TOTAL_ROUNDS, Math.floor((now - league.phase_started_at) / DAY_MS) + 1);
      let played = 0;
      while (league.round < due && played < 10) {
        await playRound(league, league.round + 1);
        league = await getLeague(leagueId);
        played += 1;
      }
      if (league.round >= TOTAL_ROUNDS) { await closeSeason(league); league = await getLeague(leagueId); continue; }
      break;
    }
    break;
  }
  return league;
}

// ---------------------------------- ligas ----------------------------------
router.get("/", async (req, res) => {
  const rows = await all(
    `SELECT l.id, l.name, l.league_key, l.mode, l.status, l.season, l.round, l.group_id, g.name AS group_name,
            (SELECT COUNT(*) FROM fx_members m WHERE m.league_id = l.id) AS member_count,
            EXISTS(SELECT 1 FROM fx_members m WHERE m.league_id = l.id AND m.user_id = ?) AS joined
     FROM fx_leagues l JOIN groups_t g ON g.id = l.group_id
     WHERE l.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?) ORDER BY l.id DESC`,
    [req.userId, req.userId],
  );
  res.json({ leagues: rows.map((r) => ({ ...r, joined: !!r.joined, leagueLabel: LEAGUE_LABEL[r.league_key] })) });
});

router.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 40);
  const groupId = Number(req.body?.groupId);
  const leagueKey = req.body?.leagueKey === "laliga" ? "laliga" : req.body?.leagueKey === "premier" ? "premier" : null;
  const mode = req.body?.mode === "historica" ? "historica" : "actual";
  if (!name || !groupId || !leagueKey) return res.status(400).json({ error: "Poné un nombre, elegí el grupo y la liga (Premier o LaLiga)" });
  if (!(await inGroup(groupId, req.userId))) return res.status(403).json({ error: "No pertenecés a ese grupo" });
  const seed = Math.floor(Math.random() * 2000000000);
  const r = await db.execute({ sql: "INSERT INTO fx_leagues (group_id, name, league_key, mode, created_by, seed) VALUES (?, ?, ?, ?, ?, ?)", args: [groupId, name, leagueKey, mode, req.userId, seed] });
  const id = Number(r.lastInsertRowid);
  await db.execute({ sql: "INSERT INTO fx_members (league_id, user_id) VALUES (?, ?)", args: [id, req.userId] });
  res.status(201).json({ id });
});

router.post("/:id/join", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) return res.status(404).json({ error: "Liga inexistente" });
  if (!(await inGroup(league.group_id, req.userId))) return res.status(403).json({ error: "Esta liga es solo para el grupo" });
  if (league.status !== "lobby") return res.status(400).json({ error: "La liga ya arrancó" });
  const n = Number((await one("SELECT COUNT(*) AS n FROM fx_members WHERE league_id = ?", [league.id])).n);
  if (n >= 8) return res.status(400).json({ error: "La liga está llena (máximo 8)" });
  await db.execute({ sql: "INSERT OR IGNORE INTO fx_members (league_id, user_id) VALUES (?, ?)", args: [league.id, req.userId] });
  res.json({ ok: true });
});

// Arranca la liga: arma los jugadores de la liga real, reparte planteles de valor parecido y abre la tienda.
router.post("/:id/start", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) return res.status(404).json({ error: "Liga inexistente" });
  if (league.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó la liga puede arrancarla" });
  if (league.status !== "lobby") return res.status(400).json({ error: "La liga ya arrancó" });
  const ms = await members(league.id);
  if (ms.length < 2) return res.status(400).json({ error: "Hacen falta al menos 2 participantes" });

  const pool = buildLeaguePlayers(league.league_key, league.mode, league.seed);
  const { squads } = startingSquads(pool, ms.length, league.seed);
  const owner = new Map();
  squads.forEach((sq, i) => sq.forEach((p) => owner.set(p.id, ms[i].user_id)));
  const stmts = pool.map((p) => ({
    sql: `INSERT INTO fx_players (league_id, pid, name, pos, ovr, age, club, nat, value, legend, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [league.id, p.id, p.name, p.pos, p.ovr, p.age || 26, p.club, p.nat || "", p.value, p.legend ? 1 : 0, owner.get(p.id) ?? null],
  }));
  for (let i = 0; i < stmts.length; i += 150) await db.batch(stmts.slice(i, i + 150), "write");
  const rows = await all("SELECT id, pos, ovr, owner_id FROM fx_players WHERE league_id = ? AND owner_id IS NOT NULL", [league.id]);
  const lineups = [];
  for (const m of ms) {
    const mine = rows.filter((p) => p.owner_id === m.user_id);
    lineups.push({ sql: "UPDATE fx_members SET cash = ?, lineup = ? WHERE league_id = ? AND user_id = ?", args: [START_CASH, JSON.stringify(autoLineup(mine, "4-3-3")), league.id, m.user_id] });
  }
  lineups.push({ sql: "UPDATE fx_leagues SET status = 'shop', phase_started_at = ?, season = 1, round = 0 WHERE id = ?", args: [Date.now(), league.id] });
  await db.batch(lineups, "write");
  await advance(league.id);
  res.json({ ok: true });
});

// Estado completo de la liga para la pantalla.
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  let league = await getLeague(id);
  if (!league) return res.status(404).json({ error: "Liga inexistente" });
  if (!(await inGroup(league.group_id, req.userId))) return res.status(403).json({ error: "No pertenecés a este grupo" });
  league = await advance(id);
  const ms = await members(id);
  const me = ms.find((m) => m.user_id === req.userId) || null;
  const base = {
    id: league.id, name: league.name, leagueKey: league.league_key, leagueLabel: LEAGUE_LABEL[league.league_key], mode: league.mode,
    status: league.status, season: league.season, maxSeasons: MAX_SEASONS, round: league.round, totalRounds: TOTAL_ROUNDS,
    isCreator: league.created_by === req.userId, joined: !!me, dayMs: DAY_MS,
    members: ms.map((m) => ({ userId: m.user_id, username: m.username, avatar: m.avatar, avatar_config: m.avatar_config })),
    awards: await all(`SELECT a.season, a.position, a.points, u.username FROM fx_awards a JOIN users u ON u.id = a.user_id WHERE a.league_id = ? ORDER BY a.season, a.position`, [id]),
  };
  if (league.status === "lobby" || !me) return res.json({ league: base });

  const players = await all("SELECT * FROM fx_players WHERE league_id = ?", [id]);
  const clubs = Object.fromEntries(clubsOf(league.league_key).map((c) => [c.id, c]));
  const mine = players.filter((p) => p.owner_id === req.userId);
  const view = (p) => ({ id: p.id, name: p.name, pos: p.pos, ovr: p.ovr, age: p.age, club: p.club, clubName: clubs[p.club]?.name, nat: p.nat, value: p.value, legend: !!p.legend, form: p.form, played: p.played, points: norm(p.points), goals: p.goals, assists: p.assists, ownerId: p.owner_id });
  let lineup = [];
  try { lineup = JSON.parse(me.lineup); } catch { lineup = []; }

  // posiciones de la liga real en esta temporada
  const matches = await all("SELECT * FROM fx_matches WHERE league_id = ? AND season = ? ORDER BY round, id", [id, league.season]);
  const table = Object.fromEntries(Object.keys(clubs).map((c) => [c, { club: c, name: clubs[c].name, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }]));
  for (const m of matches) {
    const h = table[m.home], a = table[m.away];
    if (!h || !a) continue;
    h.pj++; a.pj++; h.gf += m.hg; h.gc += m.ag; a.gf += m.ag; a.gc += m.hg;
    if (m.hg > m.ag) { h.g++; h.pts += 3; a.p++; } else if (m.hg < m.ag) { a.g++; a.pts += 3; h.p++; } else { h.e++; a.e++; h.pts++; a.pts++; }
  }
  const standings = Object.values(table).sort((x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf);

  // jornada que se muestra: la última jugada, con los partidos y mis puntos
  const lastRound = league.round;
  const lastMatches = matches.filter((m) => m.round === lastRound).map((m) => ({ ...m, homeName: clubs[m.home]?.name, awayName: clubs[m.away]?.name }));
  const nextFixtures = league.status === "season" && lastRound < TOTAL_ROUNDS
    ? (fixturesFor(league.league_key, league.seed)[lastRound] || []).map(([h, a]) => ({ home: h, away: a, homeName: clubs[h]?.name, awayName: clubs[a]?.name }))
    : [];
  const myScores = await all("SELECT round, points, detail FROM fx_scores WHERE league_id = ? AND season = ? AND user_id = ? ORDER BY round", [id, league.season, req.userId]);
  const ranking = ms.map((m) => ({ userId: m.user_id, username: m.username, avatar: m.avatar, avatar_config: m.avatar_config, points: norm(m.season_points) })).sort((a, b) => b.points - a.points);
  const lastScore = myScores.find((s) => s.round === lastRound);
  const topPlayers = [...players].filter((p) => p.owner_id).sort((a, b) => b.points - a.points).slice(0, 10).map((p) => ({ ...view(p), ownerName: ms.find((m) => m.user_id === p.owner_id)?.username }));

  // tienda: solo los primeros días de la temporada. Veo mis pujas, nunca las de los demás.
  let shop = null;
  if (league.status === "shop") {
    const elapsed = Math.floor((Date.now() - league.phase_started_at) / DAY_MS);
    const day = Math.min(SHOP_DAYS, elapsed + 1);
    const items = await all("SELECT s.id, s.slot, s.player_id FROM fx_shop s WHERE s.league_id = ? AND s.season = ? AND s.day = ? ORDER BY s.slot", [id, league.season, day]);
    const myBids = Object.fromEntries((await all("SELECT shop_id, amount FROM fx_bids WHERE user_id = ? AND shop_id IN (SELECT id FROM fx_shop WHERE league_id = ? AND season = ? AND day = ?)", [req.userId, id, league.season, day])).map((b) => [b.shop_id, b.amount]));
    const byId = new Map(players.map((p) => [p.id, p]));
    shop = {
      day, totalDays: SHOP_DAYS,
      closesAt: league.phase_started_at + day * DAY_MS,
      items: items.map((it) => { const p = byId.get(it.player_id); return { shopId: it.id, slot: it.slot, player: view(p), minBid: minBidFor(p.value), myBid: myBids[it.id] ?? null }; }),
    };
  }

  const offers = (await all(
    `SELECT o.*, p.name AS player_name, fu.username AS from_name, tu.username AS to_name FROM fx_offers o
     JOIN fx_players p ON p.id = o.player_id JOIN users fu ON fu.id = o.from_user JOIN users tu ON tu.id = o.to_user
     WHERE o.league_id = ? AND o.status = 'pending' AND (o.from_user = ? OR o.to_user = ?) ORDER BY o.id DESC`,
    [id, req.userId, req.userId],
  )).map((o) => ({ id: o.id, playerId: o.player_id, playerName: o.player_name, amount: o.amount, fromId: o.from_user, fromName: o.from_name, toId: o.to_user, toName: o.to_name }));

  res.json({
    league: {
      ...base,
      cash: me.cash, formation: me.formation, lineup, mentality: me.mentality,
      slots: slotsOf(me.formation), formations: Object.keys(FORMATIONS), mentalities: Object.keys(MENTALITIES),
      players: mine.map(view), ranking, topPlayers, standings,
      lastRound: { round: lastRound, matches: lastMatches, myPoints: lastScore ? lastScore.points : null, myDetail: lastScore ? JSON.parse(lastScore.detail || "[]") : [] },
      nextFixtures, myScores: myScores.map((s) => ({ round: s.round, points: s.points })), shop, offers,
      nextRoundAt: league.status === "season" && lastRound < TOTAL_ROUNDS ? league.phase_started_at + lastRound * DAY_MS : null,
      marketPlayers: players.filter((p) => p.owner_id && p.owner_id !== req.userId).map((p) => ({ ...view(p), ownerName: ms.find((m) => m.user_id === p.owner_id)?.username })),
    },
  });
});

// Once, formación y mentalidad.
router.post("/:id/lineup", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  const me = league && (await one("SELECT * FROM fx_members WHERE league_id = ? AND user_id = ?", [league.id, req.userId]));
  if (!me) return res.status(404).json({ error: "No estás en esa liga" });
  const formation = FORMATIONS[req.body?.formation] ? req.body.formation : me.formation;
  const mentality = MENTALITIES[req.body?.mentality] ? req.body.mentality : null;
  const slots = slotsOf(formation);
  const ids = Array.isArray(req.body?.lineup) ? req.body.lineup.slice(0, slots.length).map((x) => (x == null ? null : Number(x))) : [];
  while (ids.length < slots.length) ids.push(null);
  const mine = new Map((await all("SELECT id, pos FROM fx_players WHERE league_id = ? AND owner_id = ?", [league.id, req.userId])).map((p) => [p.id, p.pos]));
  const seen = new Set();
  for (let i = 0; i < slots.length; i++) {
    if (ids[i] == null) continue;
    if (!mine.has(ids[i])) return res.status(400).json({ error: "Ese jugador no es tuyo" });
    if (mine.get(ids[i]) !== slots[i]) return res.status(400).json({ error: "Un jugador solo puede ocupar un puesto de su posición" });
    if (seen.has(ids[i])) return res.status(400).json({ error: "Un jugador no puede estar dos veces" });
    seen.add(ids[i]);
  }
  await setLineup(req.userId, league.id, formation, ids, mentality);
  res.json({ ok: true });
});

// Vender al banco: paga el 10% menos de su valor.
router.post("/:id/sell", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league || league.status === "lobby") return res.status(400).json({ error: "La liga no está en juego" });
  const p = await one("SELECT * FROM fx_players WHERE id = ? AND league_id = ? AND owner_id = ?", [Number(req.body?.playerId), league.id, req.userId]);
  if (!p) return res.status(404).json({ error: "No tenés a ese jugador" });
  const price = bankPrice(p.value);
  await db.batch([
    { sql: "UPDATE fx_players SET owner_id = NULL WHERE id = ?", args: [p.id] },
    { sql: "UPDATE fx_members SET cash = cash + ? WHERE league_id = ? AND user_id = ?", args: [price, league.id, req.userId] },
  ], "write");
  await dropFromLineup(league.id, req.userId, p.id);
  res.json({ ok: true, price });
});

// Puja ciega: la mínima es la mitad del valor y la suma de lo que ofertás no puede pasar de tu plata.
router.post("/:id/bid", async (req, res) => {
  let league = await advance(Number(req.params.id));
  if (!league || league.status !== "shop") return res.status(400).json({ error: "La tienda está cerrada" });
  const me = await one("SELECT * FROM fx_members WHERE league_id = ? AND user_id = ?", [league.id, req.userId]);
  if (!me) return res.status(404).json({ error: "No estás en esa liga" });
  const day = Math.min(SHOP_DAYS, Math.floor((Date.now() - league.phase_started_at) / DAY_MS) + 1);
  const shop = await one("SELECT s.*, p.value, p.owner_id FROM fx_shop s JOIN fx_players p ON p.id = s.player_id WHERE s.id = ? AND s.league_id = ? AND s.season = ? AND s.day = ? AND s.resolved = 0", [Number(req.body?.shopId), league.id, league.season, day]);
  if (!shop) return res.status(404).json({ error: "Ese jugador ya no está en la tienda" });
  const amount = Math.round(Number(req.body?.amount) || 0);
  if (amount === 0) { await db.execute({ sql: "DELETE FROM fx_bids WHERE shop_id = ? AND user_id = ?", args: [shop.id, req.userId] }); return res.json({ ok: true, removed: true }); }
  const min = minBidFor(shop.value);
  if (amount < min) return res.status(400).json({ error: `La puja mínima es ${min} M` });
  const others = await all("SELECT b.amount FROM fx_bids b JOIN fx_shop s ON s.id = b.shop_id WHERE b.user_id = ? AND s.league_id = ? AND s.season = ? AND s.day = ? AND b.shop_id != ?", [req.userId, league.id, league.season, day, shop.id]);
  const committed = others.reduce((s, b) => s + b.amount, 0);
  if (committed + amount > me.cash) return res.status(400).json({ error: `Te alcanzan ${norm(me.cash - committed)} M para esta puja` });
  const size = Number((await one("SELECT COUNT(*) AS n FROM fx_players WHERE league_id = ? AND owner_id = ?", [league.id, req.userId])).n);
  if (size >= MAX_SQUAD) return res.status(400).json({ error: `Tu plantel está lleno (${MAX_SQUAD}): vendé a alguien primero` });
  await db.execute({
    sql: "INSERT INTO fx_bids (shop_id, user_id, amount, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(shop_id, user_id) DO UPDATE SET amount = excluded.amount, created_at = excluded.created_at",
    args: [shop.id, req.userId, amount, Date.now()],
  });
  res.json({ ok: true });
});

// Fichajes entre participantes: ofrecés plata por un jugador de otro y él acepta o rechaza.
router.post("/:id/offer", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league || league.status === "lobby" || league.status === "finished") return res.status(400).json({ error: "La liga no está en juego" });
  const p = await one("SELECT * FROM fx_players WHERE id = ? AND league_id = ? AND owner_id IS NOT NULL AND owner_id != ?", [Number(req.body?.playerId), league.id, req.userId]);
  if (!p) return res.status(404).json({ error: "Ese jugador no está disponible para ofertas" });
  const amount = Math.round(Number(req.body?.amount) || 0);
  const me = await one("SELECT cash FROM fx_members WHERE league_id = ? AND user_id = ?", [league.id, req.userId]);
  if (!me || amount < 1 || amount > me.cash) return res.status(400).json({ error: "Oferta inválida o sin plata suficiente" });
  await db.execute({ sql: "INSERT INTO fx_offers (league_id, player_id, from_user, to_user, amount) VALUES (?, ?, ?, ?, ?)", args: [league.id, p.id, req.userId, p.owner_id, amount] });
  res.status(201).json({ ok: true });
});

router.post("/:id/offer/:offerId/respond", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  const o = league && (await one("SELECT * FROM fx_offers WHERE id = ? AND league_id = ? AND status = 'pending'", [Number(req.params.offerId), league.id]));
  if (!o) return res.status(404).json({ error: "Oferta inexistente" });
  const accept = !!req.body?.accept;
  const cancel = req.body?.cancel && o.from_user === req.userId;
  if (!cancel && o.to_user !== req.userId) return res.status(403).json({ error: "Esa oferta no es para vos" });
  if (cancel || !accept) {
    await db.execute({ sql: "UPDATE fx_offers SET status = ? WHERE id = ?", args: [cancel ? "cancelled" : "rejected", o.id] });
    return res.json({ ok: true });
  }
  const buyer = await one("SELECT cash FROM fx_members WHERE league_id = ? AND user_id = ?", [league.id, o.from_user]);
  const p = await one("SELECT * FROM fx_players WHERE id = ? AND owner_id = ?", [o.player_id, req.userId]);
  const size = Number((await one("SELECT COUNT(*) AS n FROM fx_players WHERE league_id = ? AND owner_id = ?", [league.id, o.from_user])).n);
  if (!p || !buyer || buyer.cash < o.amount || size >= MAX_SQUAD) {
    await db.execute({ sql: "UPDATE fx_offers SET status = 'rejected' WHERE id = ?", args: [o.id] });
    return res.status(400).json({ error: "El traspaso ya no se puede hacer (falta plata, lugar o el jugador cambió de dueño)" });
  }
  await db.batch([
    { sql: "UPDATE fx_players SET owner_id = ? WHERE id = ?", args: [o.from_user, p.id] },
    { sql: "UPDATE fx_members SET cash = cash - ? WHERE league_id = ? AND user_id = ?", args: [o.amount, league.id, o.from_user] },
    { sql: "UPDATE fx_members SET cash = cash + ? WHERE league_id = ? AND user_id = ?", args: [o.amount, league.id, req.userId] },
    { sql: "UPDATE fx_offers SET status = 'accepted' WHERE id = ?", args: [o.id] },
    { sql: "UPDATE fx_offers SET status = 'rejected' WHERE player_id = ? AND status = 'pending' AND id != ?", args: [p.id, o.id] },
  ], "write");
  await dropFromLineup(league.id, req.userId, p.id);
  res.json({ ok: true });
});

export default router;
