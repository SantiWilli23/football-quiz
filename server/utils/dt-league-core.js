// Operaciones con base de datos de la temporada de la Liga Online DT: calendario con copas y
// torneos europeos, cierre de jornadas con puntaje, pase de mes con "Listo", multas, expulsión,
// mercados de verano e invierno y cierre de temporada. Las cuentas puras están en dt-season.js.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { generateRoundRobin } from "./dt-match.js";
import {
  baseRatingForTier, budgetAfterSeason, CHAMPIONS_SPOTS, cupRoundPoints, EURO_COMPS, EUROPA_SPOTS, EXPEL_AFTER_DAYS,
  FINE_PER_DAY, firstRound, initialBudget, levelFromRating, matchPoints, NATIONAL_COMPS, nextRoundPairs, outcomeOf,
  overdueDays, positionPoints, qualificationPoints, ratingAfterSelling, ratingAfterSigning, roundName, tierFromLevel, windowAt,
} from "./dt-season.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_PATH = path.join(__dirname, "../data/dt-teams.json");
export const TEAMS = fs.existsSync(TEAMS_PATH) ? JSON.parse(fs.readFileSync(TEAMS_PATH, "utf-8")) : [];
export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
export const LEAGUE_KEYS = ["premier", "laliga", "seriea", "bundesliga"];
// Los clubes de cada liga cambian con la temporada (ascensos y descensos). Cada liga guarda con qué
// versión de clubes arrancó (team_version): las ligas viejas siguen con los clubes de siempre y las
// nuevas usan los de 2026-27. En los datos, `until: 1` = ya no está en la versión 2 y `since: 2` = entró en la 2.
export const CURRENT_TEAM_VERSION = 2;
export const teamsForLeague = (leagueKey, version = CURRENT_TEAM_VERSION) =>
  TEAMS.filter((t) => t.league === leagueKey && (t.since || 1) <= version && (!t.until || t.until >= version));
export const leagueTeams = (league) => teamsForLeague(league.league_key, Number(league.team_version || 1));

const DAY_MS = 86400000;
export const parseSql = (s) => (s ? new Date(String(s).replace(" ", "T") + (String(s).endsWith("Z") ? "" : "Z")).getTime() : null);
export const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");

// Cada temporada usa su propio rango de "semana" en la tabla de puntos semanales del grupo,
// así que el puntaje de una temporada no pisa el de otra.
export const weekCode = (season, week) => (Number(season || 1) - 1) * 100 + week;

export const compInfo = (leagueKey, comp) => {
  if (comp === "liga") return { key: "liga", label: "Liga", kind: "liga", rounds: 0 };
  const national = (NATIONAL_COMPS[leagueKey] || []).find((c) => c.key === comp);
  if (national) return national;
  return EURO_COMPS.find((c) => c.key === comp) || null;
};

export const humansOf = (members) => members.filter((m) => m.team_id && !m.expelled_at);

// ---------- Clubes: rating, nivel, tier y presupuesto ----------
export async function ensureClubs(league) {
  const have = new Set((await db.execute({ sql: "SELECT team_id FROM dt_league_clubs WHERE league_id = ?", args: [league.id] })).rows.map((r) => r.team_id));
  for (const t of leagueTeams(league)) {
    if (have.has(t.id)) continue;
    const rating = baseRatingForTier(t.tier, t.id);
    await db.execute({
      sql: "INSERT OR IGNORE INTO dt_league_clubs (league_id, team_id, rating, budget) VALUES (?, ?, ?, ?)",
      args: [league.id, t.id, rating, initialBudget(levelFromRating(rating))],
    });
  }
}

// teamId -> { rating, level, tier, budget, human }. Un club manejado por un humano rinde
// como su plantel real (la fuerza que guardó), el resto como su rating de CPU.
export async function clubInfo(league, members = []) {
  await ensureClubs(league);
  const rows = (await db.execute({ sql: "SELECT team_id, rating, budget FROM dt_league_clubs WHERE league_id = ?", args: [league.id] })).rows;
  const power = Object.fromEntries((await db.execute({ sql: "SELECT team_id, power FROM dt_league_tactics WHERE league_id = ? AND power IS NOT NULL", args: [league.id] })).rows.map((r) => [r.team_id, Number(r.power)]));
  const humanTeams = new Set(humansOf(members).map((m) => m.team_id));
  const info = {};
  for (const r of rows) {
    const human = humanTeams.has(r.team_id);
    const rating = human && power[r.team_id] != null ? power[r.team_id] : Number(r.rating);
    const level = levelFromRating(rating);
    info[r.team_id] = { rating, level, tier: tierFromLevel(level), budget: Number(r.budget), human };
  }
  return info;
}

// Para clubes de otras ligas (rivales de las copas europeas): rating fijo según su tier original.
export function foreignInfo(teamId) {
  const t = TEAM_BY_ID[teamId];
  const rating = baseRatingForTier(t?.tier ?? 2, teamId);
  const level = levelFromRating(rating);
  return { rating, level, tier: tierFromLevel(level), budget: 0, human: false };
}
export const infoOf = (info, teamId) => info[teamId] || foreignInfo(teamId);

// ---------- Calendario de la temporada ----------
async function insertFixtures(league, rows) {
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const args = chunk.flatMap((r) => [league.id, r.week, r.month, r.home, r.away, r.comp || "liga", r.round || 0, r.season, r.played ? 1 : 0, r.winner || null]);
    await db.execute({
      sql: `INSERT INTO dt_league_fixtures (league_id, week, month, home_team_id, away_team_id, comp, round, season, played, winner) VALUES ${placeholders}`,
      args,
    });
  }
}

const monthOfWeek = (league, week) => Math.ceil(week / (league.weeks_per_month || 4));

// Equipos de otras ligas que clasifican a Europa: los mejores por rating base de cada una.
function foreignQualifiers(leagueKey, from, to) {
  const out = [];
  for (const key of LEAGUE_KEYS) {
    if (key === leagueKey) continue;
    const sorted = teamsForLeague(key).slice().sort((a, b) => baseRatingForTier(b.tier, b.id) - baseRatingForTier(a.tier, a.id));
    out.push(...sorted.slice(from, to).map((t) => t.id));
  }
  return out;
}

async function previousFinalOrder(league, season) {
  if (season <= 1) return null;
  const rows = (await db.execute({
    sql: "SELECT home_team_id, away_team_id, home_goals, away_goals FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND comp = 'liga' AND played = 1",
    args: [league.id, season - 1],
  })).rows;
  if (!rows.length) return null;
  return standingsFrom(leagueTeams(league).map((t) => t.id), rows).map((s) => s.teamId);
}

export function standingsFrom(teamIds, rows) {
  const st = {};
  teamIds.forEach((id) => { st[id] = { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }; });
  rows.forEach((r) => {
    const h = st[r.home_team_id], a = st[r.away_team_id];
    if (!h || !a) return;
    h.played += 1; a.played += 1;
    h.gf += r.home_goals; h.ga += r.away_goals; a.gf += r.away_goals; a.ga += r.home_goals;
    if (r.home_goals > r.away_goals) { h.won += 1; h.pts += 3; a.lost += 1; }
    else if (r.home_goals < r.away_goals) { a.won += 1; a.pts += 3; h.lost += 1; }
    else { h.drawn += 1; a.drawn += 1; h.pts += 1; a.pts += 1; }
  });
  return Object.values(st).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
}

// Arma TODA la temporada: la liga ida y vuelta y la primera ronda de cada copa. Las rondas
// siguientes de las copas se crean solas a medida que se juegan.
export async function generateSeasonFixtures(league, members) {
  const season = Number(league.season || 1);
  const info = await clubInfo(league, members);
  const ids = leagueTeams(league).map((t) => t.id);
  const ratingOf = (id) => infoOf(info, id).rating;

  const rounds = generateRoundRobin(ids);
  const rows = [];
  rounds.forEach((round, idx) => {
    const week = idx + 1;
    round.forEach(([home, away]) => rows.push({ week, month: monthOfWeek(league, week), home, away, comp: "liga", season }));
  });

  // Copas nacionales.
  const order = await previousFinalOrder(league, season);
  const byStrength = order || ids.slice().sort((a, b) => ratingOf(b) - ratingOf(a));
  for (const c of NATIONAL_COMPS[league.league_key] || []) {
    const field = c.kind === "supercopa" ? byStrength.slice(0, c.teams) : byStrength.slice(0, c.teams);
    addFirstRound(rows, league, c, season, field, ratingOf);
  }
  // Torneos europeos: los de arriba de la liga (por la tabla anterior o por rating) + clubes de otras ligas.
  const champ = byStrength.slice(0, CHAMPIONS_SPOTS);
  const europa = byStrength.slice(CHAMPIONS_SPOTS, CHAMPIONS_SPOTS + EUROPA_SPOTS);
  const euroFields = {
    champions: [...champ, ...foreignQualifiers(league.league_key, 0, 4)],
    europa: [...europa, ...foreignQualifiers(league.league_key, 4, 6)],
  };
  for (const c of EURO_COMPS) {
    addFirstRound(rows, league, c, season, euroFields[c.key].slice(0, c.teams), (id) => infoOf(info, id).rating);
  }

  await insertFixtures(league, rows);
  const totalWeeks = rounds.length;
  await db.execute({ sql: "UPDATE dt_leagues SET total_weeks = ? WHERE id = ?", args: [totalWeeks, league.id] });
}

function addFirstRound(rows, league, comp, season, field, ratingOf) {
  if (field.length < 2) return;
  const { pairs, byes } = firstRound(field, ratingOf);
  const week = comp.weeks[0];
  pairs.forEach(([a, b]) => rows.push({ week, month: monthOfWeek(league, week), home: a, away: b, comp: comp.key, round: 0, season }));
  // Los que pasan directo quedan como "libre" (partido ya jugado de un club contra sí mismo).
  byes.forEach((t) => rows.push({ week, month: monthOfWeek(league, week), home: t, away: t, comp: comp.key, round: 0, season, played: true, winner: t }));
}

// Si una ronda de una copa terminó, crea la siguiente con los ganadores.
export async function advanceCompetitions(league) {
  const season = Number(league.season || 1);
  const comps = [...(NATIONAL_COMPS[league.league_key] || []), ...EURO_COMPS];
  let created = 0;
  for (const c of comps) {
    const fx = (await db.execute({
      sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND comp = ? ORDER BY round, id",
      args: [league.id, season, c.key],
    })).rows;
    if (!fx.length) continue;
    const lastRound = Math.max(...fx.map((f) => f.round));
    const inRound = fx.filter((f) => f.round === lastRound);
    if (inRound.some((f) => !f.played)) continue;
    const winners = inRound.map((f) => f.winner).filter(Boolean);
    const nextWeek = c.weeks[lastRound + 1];
    if (nextWeek == null || winners.length < 2) continue;
    const rows = nextRoundPairs(winners).map(([a, b]) => ({ week: nextWeek, month: monthOfWeek(league, nextWeek), home: a, away: b, comp: c.key, round: lastRound + 1, season }));
    await insertFixtures(league, rows);
    created += rows.length;
  }
  return created;
}

// ---------- Resultados ----------
function penaltyWinner(fx, info) {
  const rh = infoOf(info, fx.home_team_id).rating, ra = infoOf(info, fx.away_team_id).rating;
  const pHome = Math.max(0.35, Math.min(0.65, 0.5 + (rh - ra) * 0.01));
  return Math.random() < pHome ? fx.home_team_id : fx.away_team_id;
}

// Guarda el resultado de un partido (en las copas, quien gane pasa: si hay empate, por penales).
export async function recordResult(league, fx, homeGoals, awayGoals, { walkover = null, info = {} } = {}) {
  let winner = null;
  if (fx.comp && fx.comp !== "liga") {
    winner = homeGoals > awayGoals ? fx.home_team_id : awayGoals > homeGoals ? fx.away_team_id : penaltyWinner(fx, info);
  }
  await db.execute({
    sql: "UPDATE dt_league_fixtures SET home_goals = ?, away_goals = ?, played = 1, winner = ?, walkover = COALESCE(?, walkover) WHERE id = ? AND played = 0",
    args: [homeGoals, awayGoals, winner, walkover, fx.id],
  });
}

// ---------- Puntaje de los humanos ----------
async function ligaStandings(league, season) {
  const rows = (await db.execute({
    sql: "SELECT home_team_id, away_team_id, home_goals, away_goals FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND comp = 'liga' AND played = 1",
    args: [league.id, season],
  })).rows;
  return standingsFrom(leagueTeams(league).map((t) => t.id), rows);
}

// Cuando todos los partidos de una jornada (de todas las competencias) están jugados, se le
// suma a cada humano lo que hizo: resultado según el nivel del rival, copas y su posición en la
// tabla frente a lo que se esperaba de su club. El puntaje cae en la mini liga semanal del grupo.
export async function settleWeeks(league, members) {
  if (!league.group_id) {
    await db.execute({ sql: "UPDATE dt_league_fixtures SET scored = 1 WHERE league_id = ? AND played = 1 AND scored = 0", args: [league.id] });
    return;
  }
  const season = Number(league.season || 1);
  const weeks = (await db.execute({
    sql: `SELECT week FROM dt_league_fixtures WHERE league_id = ? AND season = ?
          GROUP BY week HAVING SUM(CASE WHEN played = 0 THEN 1 ELSE 0 END) = 0 AND SUM(CASE WHEN scored = 0 THEN 1 ELSE 0 END) > 0
          ORDER BY week`,
    args: [league.id, season],
  })).rows.map((r) => r.week);
  if (!weeks.length) return;

  const info = await clubInfo(league, members);
  const humanByTeam = Object.fromEntries(humansOf(members).map((m) => [m.team_id, m]));
  const nTeams = leagueTeams(league).length;

  for (const week of weeks) {
    const fx = (await db.execute({
      sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND week = ? AND scored = 0 AND played = 1",
      args: [league.id, season, week],
    })).rows;
    const points = new Map(); // userId -> puntos de esta jornada
    const add = (userId, p) => points.set(userId, (points.get(userId) || 0) + p);
    let hadLiga = false;

    for (const f of fx) {
      if (f.home_team_id === f.away_team_id) continue; // libre
      const sides = [[f.home_team_id, f.away_team_id, f.home_goals, f.away_goals], [f.away_team_id, f.home_team_id, f.away_goals, f.home_goals]];
      for (const [mine, theirs, gm, gt] of sides) {
        const human = humanByTeam[mine];
        if (!human) continue;
        const myLevel = infoOf(info, mine).level, oppLevel = infoOf(info, theirs).level;
        if (f.comp === "liga") {
          hadLiga = true;
          add(human.user_id, matchPoints(myLevel, oppLevel, outcomeOf(gm, gt)));
        } else {
          const outcome = f.winner === mine ? "win" : "loss";
          add(human.user_id, cupRoundPoints(compInfo(league.league_key, f.comp)?.kind || "copa", f.round, outcome, myLevel, oppLevel));
        }
      }
    }

    if (hadLiga) {
      const table = await ligaStandings(league, season);
      for (const m of humansOf(members)) {
        const pos = table.findIndex((s) => s.teamId === m.team_id) + 1;
        if (pos > 0) add(m.user_id, positionPoints(infoOf(info, m.team_id).level, pos, table[pos - 1].played, nTeams));
      }
    }

    for (const [userId, pts] of points) {
      await db.execute({
        sql: `INSERT INTO dt_league_weekly_scores (league_id, group_id, user_id, week, points)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(league_id, user_id, week) DO UPDATE SET points = points + excluded.points, settled_at = datetime('now')`,
        args: [league.id, league.group_id, userId, weekCode(season, week), pts],
      });
    }
    await db.execute({ sql: "UPDATE dt_league_fixtures SET scored = 1 WHERE league_id = ? AND season = ? AND week = ? AND played = 1", args: [league.id, season, week] });
  }
}

// ---------- Semana de la liga (para que el club de cada manager avance con ella) ----------
export async function refreshLeagueWeek(league) {
  if (league.status !== "in_progress" && league.status !== "finished") return league;
  const season = Number(league.season || 1);
  const r = (await db.execute({
    sql: "SELECT MIN(week) AS w FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND comp = 'liga' AND played = 0",
    args: [league.id, season],
  })).rows[0];
  const week = r?.w == null ? Number(league.total_weeks || 0) : Math.max(0, Number(r.w) - 1);
  if (week !== Number(league.current_week)) {
    await db.execute({ sql: "UPDATE dt_leagues SET current_week = ? WHERE id = ?", args: [week, league.id] });
    return { ...league, current_week: week };
  }
  return league;
}

// ---------- Mes, "Listo", multas y expulsión ----------
export async function totalMonthsOf(league) {
  const r = (await db.execute({ sql: "SELECT MAX(month) AS m FROM dt_league_fixtures WHERE league_id = ? AND season = ?", args: [league.id, Number(league.season || 1)] })).rows[0];
  return Number(r?.m || 1);
}

// Qué le falta a cada humano para cerrar el mes actual.
export async function monthStatus(league, members) {
  const month = Number(league.current_month || 1);
  const season = Number(league.season || 1);
  const pending = (await db.execute({
    sql: "SELECT home_team_id, away_team_id FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND month = ? AND played = 0",
    args: [league.id, season, month],
  })).rows;
  const out = {};
  for (const m of humansOf(members)) {
    const left = pending.filter((f) => f.home_team_id === m.team_id || f.away_team_id === m.team_id).length;
    out[m.user_id] = { userId: m.user_id, username: m.username, pendingMatches: left, ready: Number(m.ready_month || 0) >= month, done: left === 0 && Number(m.ready_month || 0) >= month };
  }
  return { month, humans: out };
}

export async function touchMember(leagueId, userId) {
  await db.execute({ sql: "UPDATE dt_league_members SET last_active_at = datetime('now') WHERE league_id = ? AND user_id = ?", args: [leagueId, userId] });
}

// Multas por demorar: si alguien ya cerró su mes (todo jugado y "Listo") y otro humano sigue
// trabando, al que traba se le cobra por cada día desde la última vez que jugó, y al tercero se lo
// expulsa: su club pasa a la CPU. El reloj de cada uno arranca en su último movimiento.
export async function applyOverdue(league, members, now = Date.now()) {
  if (league.status !== "in_progress") return { expelled: [] };
  const st = await monthStatus(league, members);
  const list = Object.values(st.humans);
  if (list.length < 2) return { expelled: [] };
  const waiting = list.filter((h) => h.done);
  if (!waiting.length) return { expelled: [] };
  const firstReadyAt = Math.min(...members.filter((m) => st.humans[m.user_id]?.done).map((m) => parseSql(m.ready_at) || now));
  const monthStart = parseSql(league.month_started_at) || 0;
  const expelled = [];

  for (const m of members) {
    const h = st.humans[m.user_id];
    if (!h || h.done) continue;
    const since = Math.max(parseSql(m.last_active_at) || 0, monthStart, firstReadyAt);
    const days = overdueDays(since, now);
    for (let d = 1; d <= days; d++) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO dt_league_fines (league_id, user_id, month, day, amount) VALUES (?, ?, ?, ?, ?)",
        args: [league.id, m.user_id, st.month, d, FINE_PER_DAY],
      });
    }
    if (days >= EXPEL_AFTER_DAYS) {
      await expelMember(league, m);
      expelled.push(m.user_id);
    }
  }
  return { expelled };
}

// Un humano expulsado deja el club: pasa a manejarlo la CPU con el nivel que tenía.
export async function expelMember(league, member) {
  const power = (await db.execute({ sql: "SELECT power FROM dt_league_tactics WHERE league_id = ? AND team_id = ?", args: [league.id, member.team_id] })).rows[0]?.power;
  if (power != null) await db.execute({ sql: "UPDATE dt_league_clubs SET rating = ? WHERE league_id = ? AND team_id = ?", args: [Number(power), league.id, member.team_id] });
  await db.execute({
    sql: "UPDATE dt_league_members SET team_id = NULL, expelled_at = datetime('now') WHERE league_id = ? AND user_id = ?",
    args: [league.id, member.user_id],
  });
  await db.execute({ sql: "UPDATE dt_league_cpu_offers SET status = 'cancelled' WHERE league_id = ? AND to_user_id = ? AND status = 'pending'", args: [league.id, member.user_id] });
}

// Multas y ajustes de presupuesto que el club del manager todavía no aplicó (en M€; positivo = restar).
export async function pendingBudgetAdjustment(leagueId, userId, { markApplied = false } = {}) {
  const rows = (await db.execute({ sql: "SELECT id, amount FROM dt_league_fines WHERE league_id = ? AND user_id = ? AND applied = 0", args: [leagueId, userId] })).rows;
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  if (markApplied && rows.length) {
    await db.execute({ sql: "UPDATE dt_league_fines SET applied = 1 WHERE league_id = ? AND user_id = ? AND applied = 0", args: [leagueId, userId] });
  }
  return { total: Math.round(total * 10) / 10, count: rows.length };
}

// ---------- Mercados ----------
function priceFor(ovr) {
  return Math.round(Math.pow(Math.max(ovr - 55, 1), 1.55) * 0.55 * 10) / 10;
}

const rand = (a, b) => a + Math.random() * (b - a);

// Los clubes CPU ficharán: entre ellos (cambia rating y plata de los dos) y a jugadores de los
// humanos (les llega una oferta que tienen que aceptar). Sin tope de fichajes: solo manda el presupuesto.
export async function runCpuMarket(league, members, windowKind) {
  const season = Number(league.season || 1);
  const marker = windowKind === "summer" ? -1 : -2;
  const done = (await db.execute({ sql: "SELECT 1 FROM dt_league_week_settled WHERE league_id = ? AND season = ? AND week = ?", args: [league.id, season, marker] })).rows.length;
  if (done) return { deals: 0, offers: 0 };
  await db.execute({ sql: "INSERT OR IGNORE INTO dt_league_week_settled (league_id, season, week) VALUES (?, ?, ?)", args: [league.id, season, marker] });

  const info = await clubInfo(league, members);
  const cpu = Object.entries(info).filter(([, c]) => !c.human).map(([id, c]) => ({ id, ...c }));
  let deals = 0, offers = 0;

  // CPU contra CPU.
  const buyers = cpu.slice().sort(() => Math.random() - 0.5);
  for (const buyer of buyers) {
    const wants = Math.floor(rand(0, 3.4)); // fichajes que intenta
    for (let i = 0; i < wants; i++) {
      const sellers = cpu.filter((c) => c.id !== buyer.id);
      if (!sellers.length) break;
      const seller = sellers[Math.floor(Math.random() * sellers.length)];
      const ovr = Math.round(Math.max(60, Math.min(92, buyer.rating + rand(-2, 7))));
      const price = priceFor(ovr);
      if (buyer.budget < price) continue;
      buyer.budget = Math.round((buyer.budget - price) * 10) / 10;
      seller.budget = Math.round((seller.budget + price) * 10) / 10;
      buyer.rating = ratingAfterSigning(buyer.rating, ovr);
      seller.rating = ratingAfterSelling(seller.rating, ovr);
      deals += 1;
    }
  }
  for (const c of cpu) {
    await db.execute({ sql: "UPDATE dt_league_clubs SET rating = ?, budget = ? WHERE league_id = ? AND team_id = ?", args: [c.rating, c.budget, league.id, c.id] });
  }

  // CPU contra humanos: ofertas por jugadores de su plantel.
  for (const m of humansOf(members)) {
    const row = (await db.execute({ sql: "SELECT state FROM dt_league_squads WHERE league_id = ? AND user_id = ?", args: [league.id, m.user_id] })).rows[0];
    let squad = [];
    try { squad = JSON.parse(row?.state || "{}").squad || []; } catch { squad = []; }
    if (squad.length < 14) continue;
    for (const club of cpu) {
      if (Math.random() > 0.22) continue;
      const candidates = squad.filter((p) => p && !p.isYouth && p.ovr >= club.rating - 6 && p.ovr <= club.rating + 9);
      if (!candidates.length) continue;
      const p = candidates[Math.floor(Math.random() * candidates.length)];
      const base = Number(p.value) > 0 ? Number(p.value) : priceFor(p.ovr);
      const amount = Math.round(base * rand(0.9, 1.3) * 20) / 20;
      if (club.budget < amount) continue;
      await db.execute({
        sql: `INSERT INTO dt_league_cpu_offers (league_id, season, team_id, to_user_id, player_id, player_name, ovr, amount, window)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [league.id, season, club.id, m.user_id, String(p.id), String(p.name || "Jugador"), Number(p.ovr), amount, windowKind],
      });
      offers += 1;
    }
  }
  return { deals, offers };
}

// El humano decidió: si aceptó, el club CPU paga y mejora; si no, queda como rechazada.
export async function resolveCpuOffer(league, offerId, userId, accept) {
  const offer = (await db.execute({ sql: "SELECT * FROM dt_league_cpu_offers WHERE id = ? AND league_id = ? AND to_user_id = ?", args: [offerId, league.id, userId] })).rows[0];
  if (!offer || offer.status !== "pending") return null;
  if (accept) {
    const club = (await db.execute({ sql: "SELECT rating, budget FROM dt_league_clubs WHERE league_id = ? AND team_id = ?", args: [league.id, offer.team_id] })).rows[0];
    if (club) {
      await db.execute({
        sql: "UPDATE dt_league_clubs SET rating = ?, budget = ? WHERE league_id = ? AND team_id = ?",
        args: [ratingAfterSigning(Number(club.rating), Number(offer.ovr)), Math.max(0, Math.round((Number(club.budget) - Number(offer.amount)) * 10) / 10), league.id, offer.team_id],
      });
    }
    // Las demás ofertas por el mismo jugador se cancelan: ya no está.
    await db.execute({ sql: "UPDATE dt_league_cpu_offers SET status = 'cancelled' WHERE league_id = ? AND to_user_id = ? AND player_id = ? AND status = 'pending' AND id != ?", args: [league.id, userId, offer.player_id, offer.id] });
  }
  await db.execute({ sql: "UPDATE dt_league_cpu_offers SET status = ? WHERE id = ?", args: [accept ? "accepted" : "rejected", offer.id] });
  return offer;
}

// ---------- Pasar de mes y cerrar la temporada ----------
export async function finishSeason(league, members) {
  const season = Number(league.season || 1);
  const table = await ligaStandings(league, season);
  const info = await clubInfo(league, members);
  const nTeams = table.length;

  // Presupuesto de los CPU según su temporada (los humanos reciben el ajuste como crédito).
  for (const row of table) {
    const pos = table.indexOf(row) + 1;
    const club = info[row.teamId];
    if (!club) continue;
    const budget = budgetAfterSeason(club.budget, club.level, pos, nTeams);
    if (club.human) {
      const owner = humansOf(members).find((m) => m.team_id === row.teamId);
      if (owner) {
        const delta = Math.round((budget - club.budget) * 10) / 10;
        await db.execute({ sql: "INSERT OR IGNORE INTO dt_league_fines (league_id, user_id, month, day, amount) VALUES (?, ?, ?, 0, ?)", args: [league.id, owner.user_id, 1000 + season, -delta] });
      }
    } else {
      await db.execute({ sql: "UPDATE dt_league_clubs SET budget = ? WHERE league_id = ? AND team_id = ?", args: [budget, league.id, row.teamId] });
    }
  }

  for (const m of humansOf(members)) {
    const pos = table.findIndex((s) => s.teamId === m.team_id) + 1;
    const comp = pos > 0 && pos <= CHAMPIONS_SPOTS ? "champions" : pos > CHAMPIONS_SPOTS && pos <= CHAMPIONS_SPOTS + EUROPA_SPOTS ? "europa" : null;
    const bonus = comp ? qualificationPoints(league.league_key, comp, pos) : 0;
    if (bonus && league.group_id) {
      await db.execute({
        sql: `INSERT INTO dt_league_weekly_scores (league_id, group_id, user_id, week, points) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(league_id, user_id, week) DO UPDATE SET points = points + excluded.points, settled_at = datetime('now')`,
        args: [league.id, league.group_id, m.user_id, weekCode(season, 99), bonus],
      });
    }
    const total = league.group_id
      ? Number((await db.execute({ sql: "SELECT COALESCE(SUM(points), 0) AS s FROM dt_league_weekly_scores WHERE league_id = ? AND user_id = ? AND week >= ? AND week < ?", args: [league.id, m.user_id, weekCode(season, 0), weekCode(season, 0) + 100] })).rows[0].s)
      : 0;
    await db.execute({
      sql: `INSERT OR REPLACE INTO dt_league_history (league_id, season, user_id, team_id, position, points, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [league.id, season, m.user_id, m.team_id, pos || null, total, JSON.stringify({ qualified: comp, qualificationBonus: bonus })],
    });
  }
  await db.execute({ sql: "UPDATE dt_leagues SET status = 'finished' WHERE id = ?", args: [league.id] });
  return { ...league, status: "finished" };
}

// Revisa si el mes se puede cerrar: todos los humanos jugaron todo y apretaron "Listo". Si sí,
// arranca el siguiente (con el mercado si toca) o termina la temporada.
export async function tryAdvanceMonth(league, members) {
  if (league.status !== "in_progress") return league;
  const st = await monthStatus(league, members);
  const humans = Object.values(st.humans);
  if (humans.some((h) => !h.done)) return league;

  const total = await totalMonthsOf(league);
  const unplayed = Number((await db.execute({ sql: "SELECT COUNT(*) AS c FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND played = 0", args: [league.id, Number(league.season || 1)] })).rows[0].c);
  const month = Number(league.current_month || 1);
  // Quedan partidos de este mes sin humanos (CPU contra CPU): se resuelven antes (resolveAuto).
  const leftThisMonth = Number((await db.execute({ sql: "SELECT COUNT(*) AS c FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND month = ? AND played = 0", args: [league.id, Number(league.season || 1), month] })).rows[0].c);
  if (leftThisMonth > 0) return league;

  if (month >= total && unplayed === 0) return finishSeason(league, members);
  const nextMonth = month + 1;
  await db.execute({ sql: "UPDATE dt_leagues SET current_month = ?, month_started_at = datetime('now') WHERE id = ?", args: [nextMonth, league.id] });
  const next = { ...league, current_month: nextMonth, month_started_at: nowSql() };

  // Mercado: si las jornadas del mes que arranca caen dentro de una ventana, la CPU opera.
  const wpm = league.weeks_per_month || 4;
  const firstWeek = (nextMonth - 1) * wpm;
  const win = windowAt(firstWeek);
  if (win) await runCpuMarket(next, members, win);
  else {
    const winter = windowAt(firstWeek + wpm - 1);
    if (winter) await runCpuMarket(next, members, winter);
  }
  return next;
}

// Todo lo que hay que revisar cada vez que alguien toca la liga: resolver lo que no necesita
// humanos, cerrar jornadas, crear rondas nuevas de copas, multas y pase de mes.
export async function resolveAuto(league, members) {
  let cur = league;
  const info = await clubInfo(cur, members);
  for (let guard = 0; guard < 12; guard++) {
    let changed = 0;
    changed += await resolveCpuOnlyFixtures(cur, members, info);
    changed += await advanceCompetitions(cur);
    if (!changed) break;
  }
  await settleWeeks(cur, members);
  cur = await refreshLeagueWeek(cur);
  const { expelled } = await applyOverdue(cur, members);
  if (expelled.length) {
    // Con menos humanos el cierre de mes puede destrabarse: recargar los miembros.
    const fresh = (await db.execute({
      sql: `SELECT m.id, m.user_id, m.team_id, m.joined_at, m.ready_month, m.ready_at, m.last_active_at, m.expelled_at, u.username
            FROM dt_league_members m JOIN users u ON u.id = m.user_id WHERE m.league_id = ? ORDER BY m.joined_at ASC`,
      args: [cur.id],
    })).rows;
    members = fresh;
  }
  cur = await tryAdvanceMonth(cur, members);
  if (cur.current_month !== league.current_month && cur.status === "in_progress") {
    // Mes nuevo: puede haber partidos solo de CPU que se resuelven ya.
    return resolveAuto(cur, members);
  }
  return cur;
}

// Partidos sin humanos del mes actual: se juegan solos.
async function resolveCpuOnlyFixtures(league, members, info) {
  const { simulateFixture } = await import("./dt-match.js");
  const humanTeams = new Set(humansOf(members).map((m) => m.team_id));
  const pending = (await db.execute({
    sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND month = ? AND played = 0",
    args: [league.id, Number(league.season || 1), Number(league.current_month || 1)],
  })).rows;
  let n = 0;
  for (const fx of pending) {
    if (humanTeams.has(fx.home_team_id) || humanTeams.has(fx.away_team_id)) continue;
    const { homeGoals, awayGoals } = simulateFixture({
      homeTier: infoOf(info, fx.home_team_id).tier, awayTier: infoOf(info, fx.away_team_id).tier,
      homeTactics: null, awayTactics: null,
      homeRating: infoOf(info, fx.home_team_id).rating, awayRating: infoOf(info, fx.away_team_id).rating,
    });
    await recordResult(league, fx, homeGoals, awayGoals, { info });
    n += 1;
  }
  return n;
}

export function labelForFixture(league, fx) {
  const c = compInfo(league.league_key, fx.comp || "liga");
  if (!c || c.kind === "liga") return { compLabel: "Liga", roundLabel: null };
  return { compLabel: c.label, roundLabel: roundName(c.teams, fx.round || 0) };
}

export async function startSeason(league, members) {
  await db.execute({ sql: "UPDATE dt_leagues SET status = 'in_progress', current_month = 1, month_started_at = datetime('now'), current_week = 0 WHERE id = ?", args: [league.id] });
  await db.execute({ sql: "UPDATE dt_league_members SET ready_month = 0, ready_at = NULL, last_active_at = datetime('now') WHERE league_id = ?", args: [league.id] });
  const fresh = { ...league, status: "in_progress", current_month: 1, month_started_at: nowSql() };
  await generateSeasonFixtures(fresh, members);
  const first = windowAt(0);
  if (first) await runCpuMarket(fresh, members, first);
  return fresh;
}
