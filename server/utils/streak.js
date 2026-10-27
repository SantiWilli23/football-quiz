import { db } from "../db/client.js";
import { addDays, mondayOf } from "./points.js";

// Racha personal de Futotal 2.0: días seguidos en que jugaste el partido del día.
// Cada semana (lunes a domingo) hay UN protector: un día sin jugar que no corta la
// racha (y tampoco suma). Hoy sin jugar todavía no corta nada: el día sigue abierto.
export function streakFromDates(dates, today) {
  const played = dates instanceof Set ? dates : new Set(dates);
  const protectedWeeks = new Set();
  let streak = 0;
  let protectors = 0;
  let day = played.has(today) ? today : addDays(today, -1);
  // Un límite de seguridad: nadie tiene una racha de más de 4 años.
  for (let i = 0; i < 1500; i++) {
    if (played.has(day)) { streak += 1; day = addDays(day, -1); continue; }
    const week = mondayOf(day);
    // El protector solo sirve si hay racha previa que cuidar (algo jugado antes).
    const hasEarlier = [...played].some((d) => d < day);
    if (!protectedWeeks.has(week) && hasEarlier && streak > 0) {
      protectedWeeks.add(week);
      protectors += 1;
      day = addDays(day, -1);
      continue;
    }
    break;
  }
  return { streak, protectorsUsed: protectors, protectorAvailable: !protectedWeeks.has(mondayOf(today)) };
}

// Fechas en las que el usuario jugó el partido del día (o el juego diario de hoy en
// el sistema viejo mientras el rediseño no reemplaza a ese juego).
export async function playedDates(userId) {
  const rows = (await db.execute({
    sql: `SELECT date FROM points_ledger WHERE user_id = ? AND source = 'partido_dia'
          UNION SELECT date FROM daily_game_results WHERE user_id = ?`,
    args: [userId, userId],
  })).rows;
  return new Set(rows.map((r) => r.date));
}

export async function personalStreak(userId, today) {
  return streakFromDates(await playedDates(userId), today);
}
