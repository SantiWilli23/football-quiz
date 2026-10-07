import api from "../api.js";

// Avisa al historial que terminó una partida. Dificultad de 1 a 5 y
// rendimiento de 0 a 1; el puntaje lo calcula el server. Si falla (sin red),
// no pasa nada: el historial es un registro, no parte del juego.
export function logGame(gameKey, difficulty, performance, detail) {
  api.post("/game-history/log", { gameKey, difficulty, performance, detail }).catch(() => {});
}
