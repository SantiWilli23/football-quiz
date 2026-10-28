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

// Qué pasó con los puntos del club (Futotal 2.0): sumó, ya había sumado hoy, llegó al tope o no suma
// porque el club es Clásico o no hay club. Sin `club` (rediseño apagado) no dice nada.
export function clubMessage(club) {
  if (!club) return "";
  if (club.credited?.length) {
    const n = club.credited.length;
    return `Sumaste ${club.credited[0].points} ${n > 1 ? `a cada uno de tus ${n} clubes` : "a tu club"}.`;
  }
  if (club.reason === "ya") return "Hoy ya sumaste en este juego: esta partida es de práctica.";
  if (club.reason === "tope") return "Llegaste al tope de 100 puntos libres de hoy.";
  if (club.wouldHave > 0) return club.reason === "clasico" ? `Habrías sumado ${club.wouldHave} · tu club es Clásico y no suma.` : `Habrías sumado ${club.wouldHave} · no va a ningún club con la temporada iniciada.`;
  return "";
}

export function dailyMessage(res) {
  if (res?.practice) {
    const pack = res.pack ? "Partida libre: ganaste un sobre normal de cartas." : "Partida libre: hoy ya tenés el sobre de este juego.";
    if (!res.club) return `${pack.replace(/\.$/, "")} (no suma puntos).`;
    return `${pack} ${clubMessage(res.club)}`.trim();
  }
  if (!res || res.notToday) return ""; // hoy el diario es otro juego: esta partida es práctica
  if (res.already) return "Ya jugaste el diario de hoy: tu puntaje y tu sobre ya están. Esta partida no da más.";
  return res.pack
    ? `Juego diario: puntaje ${res.points}/${res.max} y un sobre ${res.pack} de cartas. El podio del día suma 5 / 3 / 1 puntos.`
    : `Juego diario: puntaje ${res.points}/${res.max}. Esta vez no alcanzó para sobre.`;
}
