import { db } from "../db/client.js";

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  const da = new Date(a + "T00:00:00Z");
  const db_ = new Date(b + "T00:00:00Z");
  return Math.round((da - db_) / 86400000);
}

// Distinct dates (DESC) on which the user answered at least one question
// correctly. A day counts toward the streak once, regardless of how many
// of that day's questions were answered correctly.
async function getCorrectDates(userId) {
  const result = await db.execute({
    sql: `SELECT DISTINCT q.scheduled_date AS date FROM answers a
          JOIN questions q ON q.id = a.question_id
          WHERE a.user_id = ? AND a.is_correct = 1
          ORDER BY q.scheduled_date DESC`,
    args: [userId],
  });
  return result.rows.map((r) => r.date);
}

// Longest run of consecutive correct-answer days walking back starting exactly at `dateStr`.
// Returns 0 if there is no correct answer on `dateStr` itself.
export async function streakEndingExactlyOn(userId, dateStr) {
  const dates = new Set(await getCorrectDates(userId));
  if (!dates.has(dateStr)) return 0;
  let streak = 0;
  let cursor = dateStr;
  while (dates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// Current active streak with 1-day grace (a streak is only considered "broken"
// once a full day passes with no correct answer).
export async function getCurrentStreak(userId) {
  const dates = await getCorrectDates(userId);
  if (dates.length === 0) return 0;
  const today = todayStr();
  const mostRecent = dates[0];
  if (diffDays(today, mostRecent) > 1) return 0;
  return streakEndingExactlyOnFromList(dates, mostRecent);
}

function streakEndingExactlyOnFromList(sortedDatesDesc, anchor) {
  const dateSet = new Set(sortedDatesDesc);
  let streak = 0;
  let cursor = anchor;
  while (dateSet.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function getBestStreak(userId) {
  const dates = await getCorrectDates(userId);
  if (dates.length === 0) return 0;
  const sortedAsc = [...dates].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedAsc.length; i++) {
    if (diffDays(sortedAsc[i], sortedAsc[i - 1]) === 1) {
      run++;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }
  return best;
}

// Ya no se paga 10 puntos fijos por pregunta acertada: se paga por el
// PORCENTAJE DE ACIERTO DEL DÍA respecto a todos los demás. 1° lugar = 10,
// 2° = 5, 3° = 3, 4° = 2, el resto no suma (empates comparten puesto y premio).
const RANK_TIER_POINTS = { 1: 10, 2: 5, 3: 3, 4: 2 };

async function dailyQuestionCount(dateStr) {
  const result = await db.execute({ sql: "SELECT COUNT(*) as c FROM questions WHERE scheduled_date = ?", args: [dateStr] });
  return Number(result.rows[0]?.c || 0);
}

// Si esta respuesta completa las preguntas de HOY para el usuario, calcula su
// puesto en el ranking del día por % de acierto (contra todo el que ya haya
// terminado también) y le asigna los puntos según el puesto. Si todavía le
// faltan preguntas de hoy por responder, no hay nada que asignar aún: se
// devuelve null y esa respuesta puntual queda en 0 hasta que complete el día.
export async function settleDailyScoreIfComplete(userId, dateStr) {
  const total = await dailyQuestionCount(dateStr);
  if (total === 0) return null;

  const mine = await db.execute({
    sql: `SELECT COUNT(*) as answered, COALESCE(SUM(is_correct), 0) as correct
          FROM answers a JOIN questions q ON q.id = a.question_id
          WHERE a.user_id = ? AND q.scheduled_date = ?`,
    args: [userId, dateStr],
  });
  const answered = Number(mine.rows[0].answered);
  const correct = Number(mine.rows[0].correct);
  if (answered < total) return null;

  const myAccuracy = correct / total;

  const others = await db.execute({
    sql: `SELECT a.user_id, COUNT(*) as answered, COALESCE(SUM(a.is_correct), 0) as correct
          FROM answers a JOIN questions q ON q.id = a.question_id
          WHERE q.scheduled_date = ? AND a.user_id != ?
          GROUP BY a.user_id
          HAVING answered >= ?`,
    args: [dateStr, userId, total],
  });

  const betterCount = others.rows.filter((r) => Number(r.correct) / total > myAccuracy).length;
  const rank = betterCount + 1; // ranking denso: empatados comparten puesto y premio
  const tierPoints = RANK_TIER_POINTS[rank] || 0;

  const yesterday = addDays(dateStr, -1);
  const priorStreak = await streakEndingExactlyOn(userId, yesterday);
  const streakAfter = correct > 0 ? priorStreak + 1 : 0;
  const streakBonus = correct > 0 && streakAfter >= 3 ? 2 : 0;

  return { rank, accuracy: myAccuracy, points: tierPoints + streakBonus, streakAfter };
}
