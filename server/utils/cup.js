import { db } from "../db/client.js";
import { grant, safely } from "./achievements.js";
import { addDays, mondayOf, todayStr } from "./points.js";
import { COPA_POINTS, creditPointsToGroup } from "./ledger.js";

// Copa semanal automática (Futotal 2.0), sin inscripción.
//   Lunes a jueves: clasificas con la suma de tus partidos del día.
//   8+ miembros: cuartos (viernes), semis (sábado) y final (domingo).
//   4–7 miembros: semis (sábado) y final (domingo).
//   2–3 miembros: solo la final (domingo). El viernes solo se confirma el cuadro.
// Cada cruce lo gana quien saque más en el partido del día de esa fecha; si no juegas,
// pierdes. Empate: gana quien sumó más de lunes a jueves.
const SEEDING = {
  8: [[1, 8], [4, 5], [2, 7], [3, 6]],
  4: [[1, 4], [2, 3]],
  2: [[1, 2]],
};
const ROUNDS = {
  8: [{ key: "cuartos", day: 4 }, { key: "semis", day: 5 }, { key: "final", day: 6 }],
  4: [{ key: "semis", day: 5 }, { key: "final", day: 6 }],
  2: [{ key: "final", day: 6 }],
};

export const bracketSize = (members) => (members >= 8 ? 8 : members >= 4 ? 4 : members >= 2 ? 2 : 0);

// entries: [{ userId, qual }] ya filtrados a quienes jugaron lunes a jueves.
// scores: { "YYYY-MM-DD": { [userId]: total } } con los partidos del día de la semana.
// today: fecha actual. Devuelve el cuadro con cada cruce resuelto solo si su día ya pasó.
export function buildCup(entries, scores, monday, today, memberCount) {
  const size = Math.min(bracketSize(memberCount), 2 ** Math.floor(Math.log2(Math.max(entries.length, 1))));
  if (size < 2) return { size: 0, rounds: [], seeds: [], champion: null, complete: false };
  const seeds = [...entries].sort((a, b) => b.qual - a.qual || a.userId - b.userId).slice(0, size);
  const seedOf = new Map(seeds.map((s, i) => [s.userId, i + 1]));
  const dayScore = (date, userId) => scores[date]?.[userId] ?? 0;

  let alive = SEEDING[size].map(([a, b]) => [seeds[a - 1], seeds[b - 1]]);
  const rounds = [];
  for (const round of ROUNDS[size]) {
    const date = addDays(monday, round.day);
    const closed = date < today;
    const matches = alive.map(([a, b]) => {
      if (!a || !b) return { a, b, date, winner: null, closed };
      let winner = null;
      if (closed) {
        const sa = dayScore(date, a.userId);
        const sb = dayScore(date, b.userId);
        winner = sa !== sb ? (sa > sb ? a : b) : a.qual !== b.qual ? (a.qual > b.qual ? a : b) : (seedOf.get(a.userId) < seedOf.get(b.userId) ? a : b);
        return { a, b, date, sa, sb, winner, closed };
      }
      return { a, b, date, sa: dayScore(date, a.userId), sb: dayScore(date, b.userId), winner: null, closed };
    });
    rounds.push({ key: round.key, date, closed, matches });
    // Los ganadores arman el cruce siguiente en orden de llave.
    const next = [];
    for (let i = 0; i < matches.length; i += 2) next.push([matches[i].winner, matches[i + 1]?.winner ?? null]);
    alive = matches.length === 1 ? [] : next;
  }
  const final = rounds[rounds.length - 1].matches[0];
  const champion = final?.winner || null;
  return { size, seeds, rounds, champion, complete: !!champion };
}

// Puntos base de cada participante según hasta dónde llegó (la fuente «copa» suma el
// doble en clubes Total, eso lo resuelve el libro de puntos).
export function cupPrizes(cup) {
  if (!cup.complete) return [];
  const prizes = new Map(cup.seeds.map((s) => [s.userId, { userId: s.userId, base: COPA_POINTS.participar, stage: "participante" }]));
  const set = (u, base, stage) => prizes.set(u.userId, { userId: u.userId, base, stage });
  for (const round of cup.rounds) {
    if (round.key === "semis") for (const m of round.matches) for (const u of [m.a, m.b]) if (u) set(u, COPA_POINTS.semifinal, "semifinalista");
  }
  const final = cup.rounds[cup.rounds.length - 1].matches[0];
  const runnerUp = final.winner.userId === final.a.userId ? final.b : final.a;
  if (cup.size === 2) {
    set(final.a, COPA_POINTS.finalista, "finalista");
    set(final.b, COPA_POINTS.finalista, "finalista");
  } else {
    set(runnerUp, COPA_POINTS.finalista, "finalista");
  }
  set(final.winner, COPA_POINTS.campeon, "campeón");
  return [...prizes.values()];
}

async function loadWeek(groupId, monday) {
  const members = (await db.execute({
    sql: `SELECT m.user_id, u.username, m.debuts_month FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ?`,
    args: [groupId],
  })).rows;
  const sunday = addDays(monday, 6);
  const rows = (await db.execute({
    sql: `SELECT r.user_id, r.date, r.total FROM daily_match_results r
          JOIN group_members m ON m.user_id = r.user_id AND m.group_id = ?
          WHERE r.date BETWEEN ? AND ?`,
    args: [groupId, monday, sunday],
  })).rows;
  const scores = {};
  const qual = new Map();
  for (const r of rows) {
    (scores[r.date] ||= {})[r.user_id] = Number(r.total);
    if (r.date <= addDays(monday, 3)) qual.set(r.user_id, (qual.get(r.user_id) || 0) + Number(r.total));
  }
  const names = new Map(members.map((m) => [m.user_id, m.username]));
  const entries = [...qual.entries()].map(([userId, q]) => ({ userId, qual: q, username: names.get(userId) }));
  return { members, entries, scores };
}

export async function cupFor(groupId, monday = mondayOf(todayStr()), today = todayStr()) {
  const club = (await db.execute({ sql: "SELECT season_started_at FROM groups_t WHERE id = ?", args: [groupId] })).rows[0];
  const { members, entries, scores } = await loadWeek(groupId, monday);
  const phase = today <= addDays(monday, 3) ? "clasificacion" : "llaves";
  const cup = buildCup(entries, scores, monday, today, members.length);
  const named = (e) => (e ? { ...e, username: members.find((m) => m.user_id === e.userId)?.username } : null);
  const decorate = (m) => ({ ...m, a: named(m.a), b: named(m.b), winner: named(m.winner) });
  return {
    week: monday, phase, started: !!club?.season_started_at, members: members.length,
    qualifying: entries.sort((a, b) => b.qual - a.qual).map((e) => ({ userId: e.userId, username: e.username, points: e.qual })),
    cup: { ...cup, seeds: cup.seeds.map(named), champion: named(cup.champion), rounds: cup.rounds.map((r) => ({ ...r, matches: r.matches.map(decorate) })) },
    raw: cup,
  };
}

// Reparte los puntos de una copa ya terminada (idempotente: el libro tiene una fila
// por usuario, club, fecha y fuente). Se llama al mirar el club y desde la tarea del domingo.
export async function settleCup(groupId, monday) {
  const sunday = addDays(monday, 6);
  if (sunday >= todayStr()) return { settled: false, reason: "todavía no terminó" };
  const club = (await db.execute({ sql: "SELECT season_started_at FROM groups_t WHERE id = ?", args: [groupId] })).rows[0];
  if (!club?.season_started_at || club.season_started_at > sunday) return { settled: false, reason: "sin temporada" };
  const { raw } = await cupFor(groupId, monday, todayStr());
  if (!raw.complete) return { settled: false, reason: "sin copa" };
  let credited = 0;
  for (const prize of cupPrizes(raw)) {
    const res = await creditPointsToGroup(prize.userId, groupId, sunday, "copa", prize.base);
    if (res.credited) credited += 1;
  }
  if (raw.champion?.userId) await safely(grant(raw.champion.userId, "copa_ganada"));
  return { settled: true, credited, champion: raw.champion.userId };
}

// La última copa terminada de un club, por si nadie la había repartido todavía.
export async function settleLastCup(groupId) {
  return settleCup(groupId, addDays(mondayOf(todayStr()), -7));
}
