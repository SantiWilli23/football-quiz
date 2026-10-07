import api from "../api.js";
import { celebrateScore } from "./celebrate.js";

// Manda el resultado de la primera partida del día de un juego diario. `fraction`
// es qué tan bien salió (0 a 1); el servidor lo convierte en puntos con el tope
// común de todos los diarios. Devuelve { points, max, already } o null si falló.
export async function submitDaily(gameKey, fraction, score = 0) {
  try {
    const { data } = await api.post("/daily-games/submit", { gameKey, fraction, score });
    if (!data.already && !data.practice && data.points > 0) {
      celebrateScore({ points: data.points, unit: `puntos del juego diario (de ${data.max})`, detail: data.pack ? `y un sobre ${data.pack} de cartas` : "" });
    }
    return data;
  } catch {
    return null;
  }
}

export function dailyMessage(res) {
  if (res?.practice) return res.pack ? "Partida libre: ganaste un sobre normal de cartas (no suma puntos)." : "Partida libre: hoy ya tenés el sobre de este juego.";
  if (!res || res.notToday) return ""; // hoy el diario es otro juego: esta partida es práctica
  if (res.already) return "Ya jugaste el diario de hoy: tus puntos y tu sobre ya están. Esta partida no da más.";
  return res.pack
    ? `Juego diario: +${res.points} de ${res.max} puntos y un sobre ${res.pack} de cartas.`
    : `Juego diario: +${res.points} de ${res.max} puntos. Esta vez no alcanzó para sobre.`;
}
