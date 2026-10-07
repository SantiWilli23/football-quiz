import { db } from "../db/client.js";
import { addDays, mondayOf } from "./points.js";
import { DAILY_GAME_MAX_POINTS, WEEKLY_GAME_RANK_POINTS } from "./points-config.js";

// Los siete juegos diarios. Todos pagan hasta DAILY_GAME_MAX_POINTS por día.
// "level" es la dificultad en la que cuenta el puntaje del día (todos en la
// media, salvo Cotrero que no tiene niveles).
//   - fichado y quiniela se puntúan en el servidor (ver wordle.js / quiniela.js)
//   - el resto manda su resultado a POST /daily-games/submit
export const DAILY_GAMES = [
  { key: "cotrero", label: "Cotrero simple", to: "/cotrero.html", level: "Modo simple" },
  { key: "fichado", label: "Fichado", to: "/fulbodle", level: "Normal" },
  { key: "quiniela", label: "Quiniela diaria", to: "/quiniela", level: null },
  { key: "escudos", label: "Escudos a ciegas", to: "/escudos", level: "Media" },
  { key: "draft_europeo", label: "8a2", to: "/draft-europeo.html", level: "Clásico" },
  { key: "un_minuto", label: "Un Minuto", to: "/un-minuto", level: "Ultra difícil" },
  { key: "arbitraje_var", label: "Arbitraje / VAR", to: "/arbitraje-var", level: null },
];

// Los que mandan su resultado desde el cliente (fichado y quiniela no).
export const SUBMITTABLE_DAILY = new Set(["cotrero", "escudos", "draft_europeo", "un_minuto", "arbitraje_var"]);

export function pointsFromFraction(fraction) {
  const f = Number(fraction);
  if (!Number.isFinite(f)) return 0;
  return Math.round(Math.min(1, Math.max(0, f)) * DAILY_GAME_MAX_POINTS);
}

// Solo cuenta la primera partida del día de cada juego (INSERT OR IGNORE).
// Devuelve { points, already }.
export async function recordDailyResult(userId, date, gameKey, fraction, score = 0) {
  const points = pointsFromFraction(fraction);
  const res = await db.execute({
    sql: "INSERT OR IGNORE INTO daily_game_results (user_id, date, game_key, score, points) VALUES (?, ?, ?, ?, ?)",
    args: [userId, date, gameKey, Number.isFinite(Number(score)) ? Number(score) : 0, points],
  });
  if (res.rowsAffected > 0) return { points, already: false };
  const prev = (await db.execute({
    sql: "SELECT points FROM daily_game_results WHERE user_id = ? AND date = ? AND game_key = ?",
    args: [userId, date, gameKey],
  })).rows[0];
  return { points: Number(prev?.points || 0), already: true };
}

const inList = (ids) => ids.map(() => "?").join(",");

// La quiniela puntúa por partido (exacto 5, resultado 2); como juego diario el
// total de cada día se topa en DAILY_GAME_MAX_POINTS.
export async function quinielaDailyRows(userIds, from, to) {
  if (userIds.length === 0) return [];
  const result = await db.execute({
    sql: `SELECT user_id, fixture_date AS date, MIN(SUM(points), ?) AS points
          FROM quiniela_predictions
          WHERE user_id IN (${inList(userIds)}) AND scored = 1 AND fixture_date >= ? AND fixture_date <= ?
          GROUP BY user_id, fixture_date`,
    args: [DAILY_GAME_MAX_POINTS, ...userIds, from, to],
  });
  return result.rows.map((r) => ({ user_id: r.user_id, date: r.date, game_key: "quiniela", points: Number(r.points) }));
}

// Puntos por usuario y día de los juegos diarios (sin la quiniela, que ya suma
// aparte con su propia cuenta en el ranking) dentro del rango.
export async function dailyGameRows(userIds, from, to) {
  if (userIds.length === 0) return [];
  const result = await db.execute({
    sql: `SELECT user_id, date, game_key, points FROM daily_game_results
          WHERE user_id IN (${inList(userIds)}) AND date >= ? AND date <= ?`,
    args: [...userIds, from, to],
  });
  return result.rows.map((r) => ({ user_id: r.user_id, date: r.date, game_key: r.game_key, points: Number(r.points) }));
}

export async function dailyPointsByUser(userIds, from, to) {
  const totals = new Map();
  for (const r of await dailyGameRows(userIds, from, to)) totals.set(r.user_id, (totals.get(r.user_id) || 0) + r.points);
  return totals;
}

// Podio de una semana (lunes) para un juego: suma de la semana por jugador,
// ordenada, con puesto compartido en caso de empate. Sin podio si juega uno solo.
function standingsOf(rows) {
  const totals = new Map();
  for (const r of rows) totals.set(r.user_id, (totals.get(r.user_id) || 0) + r.points);
  const entries = [...totals.entries()].filter(([, score]) => score > 0).map(([user_id, score]) => ({ user_id, score }));
  entries.sort((a, b) => b.score - a.score);
  const withRank = entries.map((e) => ({ ...e, rank: 1 + entries.filter((o) => o.score > e.score).length }));
  const podium = entries.length >= 2;
  return withRank.map((e) => ({ ...e, bonus: podium ? WEEKLY_GAME_RANK_POINTS[e.rank] || 0 : 0 }));
}

// Todas las clasificaciones (por semana y juego) de las semanas cuyo lunes cae
// en [from, to]: { week, game_key, standings: [{ user_id, score, rank, bonus }] }.
export async function weeklyStandings(userIds, from, to) {
  let first = mondayOf(from);
  if (first < from) first = addDays(first, 7);
  const last = mondayOf(to);
  if (first > last) return [];

  const lastDay = addDays(last, 6);
  const [daily, quiniela] = await Promise.all([
    dailyGameRows(userIds, first, lastDay),
    quinielaDailyRows(userIds, first, lastDay),
  ]);
  const rows = [...daily, ...quiniela];

  const out = [];
  for (let week = first; week <= last; week = addDays(week, 7)) {
    const weekEnd = addDays(week, 6);
    const inWeek = rows.filter((r) => r.date >= week && r.date <= weekEnd);
    for (const g of DAILY_GAMES) {
      const standings = standingsOf(inWeek.filter((r) => r.game_key === g.key));
      if (standings.length) out.push({ week, game_key: g.key, standings });
    }
  }
  return out;
}

// Bonus por clasificación semanal, sumado por usuario.
export async function weeklyGameBonusByUser(userIds, from, to) {
  const totals = new Map();
  for (const { standings } of await weeklyStandings(userIds, from, to)) {
    for (const s of standings) if (s.bonus) totals.set(s.user_id, (totals.get(s.user_id) || 0) + s.bonus);
  }
  return totals;
}
