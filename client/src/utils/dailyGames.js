import api from "../api.js";

// Manda el resultado de la primera partida del día de un juego diario. `fraction`
// es qué tan bien salió (0 a 1); el servidor lo convierte en puntos con el tope
// común de todos los diarios. Devuelve { points, max, already } o null si falló.
export async function submitDaily(gameKey, fraction, score = 0) {
  try {
    const { data } = await api.post("/daily-games/submit", { gameKey, fraction, score });
    return data;
  } catch {
    return null;
  }
}

export function dailyMessage(res) {
  if (!res) return "";
  if (res.already) return `Ya jugaste el diario de hoy (${res.points}/${res.max} pts). Esta partida no suma al día.`;
  return `Juego diario: +${res.points} de ${res.max} puntos.`;
}
