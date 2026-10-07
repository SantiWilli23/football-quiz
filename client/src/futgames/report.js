import { dailyMessage, submitDaily } from "../utils/dailyGames.js";
import { logGame } from "../utils/logGame.js";

// Al terminar una partida: la manda al juego diario (puntos y sobre si hoy le
// toca a este juego; si no, sobre normal de práctica) y al Historial.
// Devuelve el mensaje para mostrar ("" si no se pudo enviar).
export async function reportResult(gameKey, { fraction, score, difficulty, detail }) {
  logGame(gameKey, difficulty, fraction, detail);
  const res = await submitDaily(gameKey, fraction, score);
  return dailyMessage(res);
}
