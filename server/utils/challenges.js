// Ranking de "retos" (versión semanal de cada juego + trivia diaria) por grupo.
// 1° = 100 puntos, 2° = 50, 3° = 30, 4° = 10, el resto no suma.
export const RANK_POINTS = { 1: 100, 2: 50, 3: 30, 4: 10 };

export function pointsForRank(rank) {
  return RANK_POINTS[rank] || 0;
}

// Juegos donde GANA quien tiene el número más BAJO (ej. Fichado: menos
// intentos es mejor). Todo lo que no está acá se ordena de mayor a menor.
export const LOWER_IS_BETTER = new Set(["fichado"]);

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Semana ISO (lunes a domingo), como "YYYY-Www". Reutiliza el mismo criterio
// que ya usaba la tabla semanal local de Draft Europeo (semana arranca lunes).
export function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - day + 3); // jueves de esa semana (para el cálculo ISO estándar)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNumber = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

// Ordena y asigna puntos. `rows` = [{user_id, username, score}, ...]
export function rankEntries(rows, gameKey) {
  const ascending = LOWER_IS_BETTER.has(gameKey);
  const sorted = [...rows].sort((a, b) => (ascending ? a.score - b.score : b.score - a.score));
  return sorted.map((row, i) => ({ ...row, rank: i + 1, points: pointsForRank(i + 1) }));
}
