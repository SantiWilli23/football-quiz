import { db } from "../db/client.js";
import { addDays, mondayOf } from "./points.js";
import { DAILY_GAME_MAX_POINTS, WEEKLY_GAME_RANK_POINTS } from "./points-config.js";
import { WEEKLY_PODIUM_PACKS, dailyPackQuality, grantPack } from "./rewards.js";

// Los doce juegos que se turnan como "juego diario": cada día es UNO solo (ver
// dailyGameKeyFor), y ese paga hasta DAILY_GAME_MAX_POINTS. Los otros nueve ese
// día se juegan igual, pero no suman al juego diario.
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
  { key: "tateti", label: "Bingo", to: "/bingo", level: null },
  { key: "piramide", label: "Pirámide", to: "/piramide", level: null },
  { key: "torta", label: "Torta de plantel", to: "/torta", level: null },
  { key: "traspasos", label: "Traspasos a ciegas", to: "/traspasos", level: null },
  { key: "a_quien_me_compro", label: "¿A quién me compro?", to: "/a-quien-me-compro", level: "Difícil" },
];

// El juego diario de una fecha: rota por todos en orden, un día cada uno.
// Lo decide el servidor, así que todos los miembros juegan el mismo.
export function dailyGameKeyFor(dateStr) {
  const day = Math.floor(Date.parse(dateStr + "T00:00:00Z") / 86400000);
  return DAILY_GAMES[((day % DAILY_GAMES.length) + DAILY_GAMES.length) % DAILY_GAMES.length].key;
}

// Los que mandan su resultado desde el cliente (fichado y quiniela no).
export const SUBMITTABLE_DAILY = new Set(["cotrero", "escudos", "draft_europeo", "un_minuto", "arbitraje_var", "tateti", "piramide", "torta", "traspasos", "a_quien_me_compro"]);

export function pointsFromFraction(fraction) {
  const f = Number(fraction);
  if (!Number.isFinite(f)) return 0;
  return Math.round(Math.min(1, Math.max(0, f)) * DAILY_GAME_MAX_POINTS);
}

// Solo cuenta la primera partida del día de cada juego (INSERT OR IGNORE).
// Devuelve { points, already }.
export async function recordDailyResult(userId, date, gameKey, fraction, score = 0, play = {}) {
  // Solo el juego diario de HOY suma; jugar otro es práctica libre.
  if (dailyGameKeyFor(date) !== gameKey) {
    // Práctica libre: no suma puntos. El sobre depende del rendimiento, la dificultad
    // y la duración, con tope de sobres de práctica por día.
    const got = await practicePack(userId, date, gameKey, fraction, play);
    return { points: 0, already: false, notToday: true, practice: true, pack: got?.quality ?? null, packsLeft: got?.left ?? 0, today: dailyGameKeyFor(date) };
  }
  const points = pointsFromFraction(fraction);
  const res = await db.execute({
    sql: "INSERT OR IGNORE INTO daily_game_results (user_id, date, game_key, score, points) VALUES (?, ?, ?, ?, ?)",
    args: [userId, date, gameKey, Number.isFinite(Number(score)) ? Number(score) : 0, points],
  });
  if (res.rowsAffected > 0) {
    // La recompensa del juego diario es un sobre de cartas: su calidad depende
    // de qué tan bien salió la partida. El puntaje queda para la clasificación.
    const pack = dailyPackQuality(points / DAILY_GAME_MAX_POINTS);
    await grantPack(userId, date, pack, `juego-${gameKey}`);
    return { points, already: false, pack };
  }
  const prev = (await db.execute({
    sql: "SELECT points FROM daily_game_results WHERE user_id = ? AND date = ? AND game_key = ?",
    args: [userId, date, gameKey],
  })).rows[0];
  return { points: Number(prev?.points || 0), already: true };
}

export const PRACTICE_PACKS_PER_DAY = 3;
const PACK_TIERS = ["normal", "bueno", "top"];
const LEVEL_BUMP = { facil: 0, normal: 0, dificil: 1, demonio: 2 };

// Sobre de una partida de práctica. Base = rendimiento (dailyPackQuality). Sube un
// nivel si la dificultad es difícil/demonio, y otro si el tiempo de juego es de 3
// minutos o más (partida larga). Máximo PRACTICE_PACKS_PER_DAY por día y usuario.
export async function practicePack(userId, date, gameKey, fraction, play = {}) {
  const base = dailyPackQuality(fraction);
  if (!base) return null;
  const used = Number((await db.execute({
    sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND date = ? AND source LIKE '%practica-%'",
    args: [userId, date],
  })).rows[0].n);
  if (used >= PRACTICE_PACKS_PER_DAY) return { quality: null, left: 0 };
  let idx = PACK_TIERS.indexOf(base) + (LEVEL_BUMP[play.level] || 0);
  const seconds = Number(play.seconds);
  if (Number.isFinite(seconds) && seconds >= 180) idx += 1; // tiempo de juego: partida de 3 min o más
  const quality = PACK_TIERS[Math.min(idx, PACK_TIERS.length - 1)];
  await db.execute({
    sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)",
    args: [userId, date, `${quality}-practica-${gameKey}${used + 1}`],
  });
  return { quality, left: PRACTICE_PACKS_PER_DAY - used - 1 };
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
  // La quiniela solo cuenta como juego diario los días que le toca.
  return result.rows
    .filter((r) => dailyGameKeyFor(r.date) === "quiniela")
    .map((r) => ({ user_id: r.user_id, date: r.date, game_key: "quiniela", points: Number(r.points) }));
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

// Podio de una semana (lunes): suma de los juegos diarios de la semana por
// jugador, ordenada, con puesto compartido en caso de empate. Sin podio si
// juega uno solo.
function standingsOf(rows) {
  const totals = new Map();
  for (const r of rows) totals.set(r.user_id, (totals.get(r.user_id) || 0) + r.points);
  const entries = [...totals.entries()].filter(([, score]) => score > 0).map(([user_id, score]) => ({ user_id, score }));
  entries.sort((a, b) => b.score - a.score);
  const withRank = entries.map((e) => ({ ...e, rank: 1 + entries.filter((o) => o.score > e.score).length }));
  const podium = entries.length >= 2;
  return withRank.map((e) => ({
    ...e,
    bonus: podium ? WEEKLY_GAME_RANK_POINTS[e.rank] || 0 : 0,
    pack: podium ? WEEKLY_PODIUM_PACKS[e.rank] || null : null,
  }));
}

// La clasificación de cada semana cuyo lunes cae en [from, to]:
// { week, standings: [{ user_id, score, rank, bonus }] }. Es UNA por semana (la
// suma de los diarios de esa semana), no una por juego.
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
    const standings = standingsOf(inWeek);
    if (standings.length) out.push({ week, standings });
  }
  return out;
}

// Puntos del podio semanal, sumados por usuario (además del sobre).
export async function weeklyGameBonusByUser(userIds, from, to) {
  const totals = new Map();
  for (const { standings } of await weeklyStandings(userIds, from, to)) {
    for (const s of standings) if (s.bonus) totals.set(s.user_id, (totals.get(s.user_id) || 0) + s.bonus);
  }
  return totals;
}

// Sobres del podio de la SEMANA PASADA en cada grupo del usuario (1° top, 2°
// bueno, 3° normal). Se entregan perezosamente (al visitar Cartas), una vez por
// grupo y semana terminada; date = lunes de esa semana lo hace idempotente.
const WEEKLY_PACK_DONE = new Set();

export async function grantWeeklyGamePacks(userId) {
  const lastMonday = addDays(mondayOf(new Date().toISOString().slice(0, 10)), -7);
  const groups = (await db.execute({ sql: "SELECT group_id FROM group_members WHERE user_id = ?", args: [userId] })).rows;
  for (const { group_id: groupId } of groups) {
    const key = `${userId}|${groupId}|${lastMonday}`;
    if (WEEKLY_PACK_DONE.has(key)) continue;
    const members = (await db.execute({ sql: "SELECT user_id FROM group_members WHERE group_id = ?", args: [groupId] })).rows.map((r) => r.user_id);
    const entry = (await weeklyStandings(members, lastMonday, addDays(lastMonday, 6))).find((s) => s.week === lastMonday);
    const mine = entry?.standings.find((s) => s.user_id === userId);
    if (mine?.pack) await grantPack(userId, lastMonday, mine.pack, `semana${groupId}`);
    WEEKLY_PACK_DONE.add(key);
  }
}

// La quiniela se puntúa de forma perezosa (cuando terminan los partidos): cada
// día en que le tocó ser el juego diario y ya tiene resultado, da su sobre.
export async function grantQuinielaPacks(userId) {
  const rows = (await db.execute({
    sql: `SELECT fixture_date AS date, SUM(points) AS p FROM quiniela_predictions
          WHERE user_id = ? AND scored = 1 GROUP BY fixture_date`,
    args: [userId],
  })).rows;
  for (const r of rows) {
    // Si le tocaba ser el juego diario, el sobre depende del rendimiento; el resto de
    // los días un sobre normal por haber jugado.
    const quality = dailyGameKeyFor(r.date) === "quiniela"
      ? dailyPackQuality(Math.min(DAILY_GAME_MAX_POINTS, Number(r.p)) / DAILY_GAME_MAX_POINTS)
      : "normal";
    await grantPack(userId, r.date, quality, "juego-quiniela");
  }
}
