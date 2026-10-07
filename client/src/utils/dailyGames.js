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
  if (!res || res.notToday) return ""; // hoy el diario es otro juego: esta partida es práctica
  if (res.already) return "Ya jugaste el diario de hoy: tu sobre ya está en Cartas. Esta partida no da otro.";
  return res.pack
    ? `Juego diario: puntaje ${res.points}/${res.max} · ganaste un sobre ${res.pack} de cartas.`
    : `Juego diario: puntaje ${res.points}/${res.max}. Esta vez no alcanzó para sobre.`;
}
