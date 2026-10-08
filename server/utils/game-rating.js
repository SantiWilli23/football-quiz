// Puntaje de rendimiento de una partida (0-100): mezcla qué tan difícil era el
// juego (1 a 5) con cómo te fue (0 a 1). El techo sube con la dificultad, así
// que 100 solo sale jugando lo más difícil y sin errores. Es un puntaje propio
// del historial: no tiene nada que ver con los puntos del ranking.
export function computeRating(difficulty, performance) {
  const d = Math.min(5, Math.max(1, Math.round(Number(difficulty) || 1)));
  const p = Math.min(1, Math.max(0, Number(performance) || 0));
  const ceiling = 40 + 12 * d; // 52, 64, 76, 88, 100
  return Math.min(100, Math.round(ceiling * p));
}

export const GAME_LABELS = {
  escudos: "Escudos a ciegas",
  arbitraje_var: "Arbitraje / VAR",
  un_minuto: "Un Minuto",
  quien_es: "¿Quién es?",
  fichado: "Fichado",
  duelos: "Duelos",
  tateti: "Bingo",
  piramide: "Pirámide",
  torta: "Torta de plantel",
  traspasos: "Traspasos a ciegas",
  a_quien_me_compro: "¿A quién me compro?",
};
