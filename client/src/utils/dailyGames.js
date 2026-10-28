import api from "../api.js";
import { celebrateScore } from "./celebrate.js";

// Manda el resultado de la primera partida del día de un juego diario. `fraction`
// es qué tan bien salió (0 a 1); el servidor lo convierte en puntos con el tope
// común de todos los diarios. Devuelve { points, max, already } o null si falló.
// `extra` lleva { mode: "fun" | "daily", level, seconds } para la práctica (sobres).
export async function submitDaily(gameKey, fraction, score = 0, extra = {}) {
  try {
    const { data } = await api.post("/daily-games/submit", { gameKey, fraction, score, ...extra });
    if (!data.already && !data.practice && data.points > 0) {
      celebrateScore({ points: data.points, unit: `de puntaje en el juego diario (de ${data.max})`, detail: data.pack ? `y un sobre ${data.pack} de cartas` : "" });
    }
    return data;
  } catch {
    return null;
  }
}

// Lo que pasó con los puntos del club (Futotal 2.0): sumó, ya había sumado hoy o no suma en este club.
function clubNote(res) {
  const c = res?.club;
  if (!c) return "";
  if (res.rejected === "duracion") return " La partida fue demasiado rápida para contar.";
  if (c.credited?.length) return ` Sumaste ${Math.max(...c.credited.map((x) => x.points))} a tu club.`;
  if (res.firstToday === false) return " Ya sumaste hoy en este juego: esta partida es de práctica.";
  if (c.wouldHave > 0) return ` Habrías sumado ${c.wouldHave} · en tu club no suma.`;
  return "";
}

export function dailyMessage(res) {
  if (res?.practice && res.club) {
    const base = res.pack ? "Partida libre: ganaste un sobre de cartas." : "Partida libre.";
    return base + clubNote(res);
  }
  if (res?.practice) return res.pack ? "Partida libre: ganaste un sobre normal de cartas (no suma puntos)." : "Partida libre: hoy ya tenés el sobre de este juego.";
  if (!res || res.notToday) return ""; // hoy el diario es otro juego: esta partida es práctica
  if (res.already) return "Ya jugaste el diario de hoy: tu puntaje y tu sobre ya están. Esta partida no da más.";
  return res.pack
    ? `Juego diario: puntaje ${res.points}/${res.max} y un sobre ${res.pack} de cartas. El podio del día suma 5 / 3 / 1 puntos.`
    : `Juego diario: puntaje ${res.points}/${res.max}. Esta vez no alcanzó para sobre.`;
}
