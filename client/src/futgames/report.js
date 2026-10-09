import { dailyMessage, submitDaily } from "../utils/dailyGames.js";
import { logGame } from "../utils/logGame.js";

// Al terminar una partida: la manda al juego diario (puntos y sobre si hoy le
// toca a este juego; si no, sobre normal de práctica) y al Historial.
// Devuelve el mensaje para mostrar ("" si no se pudo enviar).
// `mode` "fun" = partida de diversión: no suma puntos, da sobre según rendimiento,
// dificultad (`level`) y tiempo de juego (`seconds`).
export async function reportResult(gameKey, { fraction, score, difficulty, detail, mode = "daily", level = "", seconds = 0 }) {
  logGame(gameKey, difficulty, fraction, detail, seconds);
  const res = await submitDaily(gameKey, fraction, score, { mode, level, seconds });
  return dailyMessage(res);
}
