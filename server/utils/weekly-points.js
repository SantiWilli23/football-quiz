import { db } from "../db/client.js";
import { addDays, mondayOf, todayStr } from "./points.js";
import {
  CUP_PARTICIPATION_POINTS,
  CUP_PLACE_EXTRA_POINTS,
  DAILY_GAME_PLACEMENT_POINTS,
  WEEKLY_GAME_PODIUM_POINTS,
} from "./points-config.js";
import { dailyGameKeyFor, dailyGameRows, quinielaDailyRows } from "./daily-games.js";

const inList = (ids) => ids.map(() => "?").join(",");

// Puestos con empate compartido: [{ user_id, score }] -> [{ user_id, score, rank }]
// (solo cuentan quienes tienen puntaje > 0).
function ranked(entries) {
  const list = entries.filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
  return list.map((e) => ({ ...e, rank: 1 + list.filter((o) => o.score > e.score).length }));
}

function podiumPoints(entries, table) {
  const list = ranked(entries);
  if (list.length < 2) return []; // hace falta competencia para que haya podio
  return list.map((e) => ({ user_id: e.user_id, points: table[e.rank] || 0 }));
}

const addTo = (map, userId, pts) => { if (pts) map.set(userId, (map.get(userId) || 0) + pts); };

// Juego diario: cada día YA TERMINADO se ordena al grupo por su puntaje de
// referencia (0-20) y el podio suma 5 / 3 / 3.
export async function dailyPlacementPointsByUser(memberIds, from, to) {
  const out = new Map();
  const lastDay = to < todayStr() ? to : addDays(todayStr(), -1);
  if (memberIds.length === 0 || lastDay < from) return out;
  const rows = [...(await dailyGameRows(memberIds, from, lastDay)), ...(await quinielaDailyRows(memberIds, from, lastDay))]
    .filter((r) => r.game_key === dailyGameKeyFor(r.date));
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, new Map());
    const m = byDate.get(r.date);
    m.set(r.user_id, (m.get(r.user_id) || 0) + r.points);
  }
  for (const scores of byDate.values()) {
    for (const p of podiumPoints([...scores].map(([user_id, score]) => ({ user_id, score })), DAILY_GAME_PLACEMENT_POINTS)) addTo(out, p.user_id, p.points);
  }
  return out;
}

// Los domingos (semana lunes-domingo) cuyo domingo cae en [from, to] y ya llegó.
function sundaysIn(from, to) {
  const today = todayStr();
  const out = [];
  let monday = mondayOf(from);
  for (; monday <= to; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    if (sunday >= from && sunday <= to && sunday <= today) out.push({ monday, sunday });
  }
  return out;
}

export async function weeklyGamesEnabled(groupId) {
  const row = (await db.execute({ sql: "SELECT weekly_games_enabled FROM groups_t WHERE id = ?", args: [groupId] })).rows[0];
  return !!row?.weekly_games_enabled;
}

// Juegos semanales: se reparten los domingos y SOLO si el grupo los activó.
//  - quiniela: el puntaje que ya tiene (5 exacto / 2 resultado), suma de la semana
//  - fichado: podio por el rendimiento de la semana (suma de sus partidas)
//  - dt: podio por el rendimiento de la semana en el Modo DT Online
export async function weeklyGamePointsByUser(groupId, memberIds, from, to) {
  const out = { quiniela: new Map(), fichado: new Map(), dt: new Map() };
  if (memberIds.length === 0 || !(await weeklyGamesEnabled(groupId))) return out;
  for (const { monday, sunday } of sundaysIn(from, to)) {
    const [q, f, d] = await Promise.all([
      db.execute({
        sql: `SELECT user_id, COALESCE(SUM(points), 0) AS s FROM quiniela_predictions
              WHERE user_id IN (${inList(memberIds)}) AND scored = 1 AND fixture_date >= ? AND fixture_date <= ?
              GROUP BY user_id`,
        args: [...memberIds, monday, sunday],
      }),
      db.execute({
        sql: `SELECT user_id, COALESCE(SUM(points), 0) AS s FROM fichado_games
              WHERE user_id IN (${inList(memberIds)}) AND status != 'playing' AND date(created_at) >= ? AND date(created_at) <= ?
              GROUP BY user_id`,
        args: [...memberIds, monday, sunday],
      }),
      db.execute({
        sql: `SELECT user_id, COALESCE(SUM(points), 0) AS s FROM dt_league_weekly_scores
              WHERE group_id = ? AND date(settled_at) >= ? AND date(settled_at) <= ?
              GROUP BY user_id`,
        args: [groupId, monday, sunday],
      }),
    ]);
    for (const r of q.rows) addTo(out.quiniela, r.user_id, Number(r.s));
    for (const p of podiumPoints(f.rows.map((r) => ({ user_id: r.user_id, score: Number(r.s) })), WEEKLY_GAME_PODIUM_POINTS)) addTo(out.fichado, p.user_id, p.points);
    for (const p of podiumPoints(d.rows.map((r) => ({ user_id: r.user_id, score: Number(r.s) })), WEEKLY_GAME_PODIUM_POINTS)) addTo(out.dt, p.user_id, p.points);
  }
  return out;
}

// Copa semanal: cuando termina (final jugada) paga 5 por participar y un extra a
// los 4 primeros: campeón +50 (55 en total), finalista +30, semifinalistas +15.
export async function cupPointsByUser(groupId, from, to) {
  const out = new Map();
  for (const { monday, sunday } of sundaysIn(from, to)) {
    const [signups, matches] = await Promise.all([
      db.execute({ sql: "SELECT user_id FROM cup_signups WHERE week = ? AND group_id = ?", args: [monday, groupId] }),
      db.execute({ sql: "SELECT round, a, b, winner FROM cup_matches WHERE week = ? AND group_id = ?", args: [monday, groupId] }),
    ]);
    if (signups.rows.length < 2 || matches.rows.length === 0) continue;
    const R = Math.max(...matches.rows.map((m) => m.round));
    const final = matches.rows.find((m) => m.round === R);
    if (!final?.winner) continue; // la copa todavía no terminó
    for (const s of signups.rows) addTo(out, s.user_id, CUP_PARTICIPATION_POINTS);
    addTo(out, final.winner, CUP_PLACE_EXTRA_POINTS.champion);
    const finalist = final.a === final.winner ? final.b : final.a;
    if (finalist) addTo(out, finalist, CUP_PLACE_EXTRA_POINTS.finalist);
    if (R >= 2) {
      for (const m of matches.rows.filter((x) => x.round === R - 1 && x.b !== null && x.winner)) {
        addTo(out, m.winner === m.a ? m.b : m.a, CUP_PLACE_EXTRA_POINTS.semifinalist);
      }
    }
  }
  return out;
}
