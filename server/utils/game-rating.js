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

// Un pleno es una partida con el rendimiento máximo.
export const isPleno = (performance) => Number(performance) >= 0.999;

// Puntuación de una partida (1-1000). Cuentan cuatro cosas:
//  - dificultad (1 a 5): fija el techo, de 480 a 800.
//  - rendimiento (0 a 1): qué tan bien salió.
//  - duración (segundos): una partida larga vale más que una de segundos.
//  - racha: los plenos seguidos anteriores en ese juego suman hasta +200.
// Sin racha el máximo es 800: el 1000 pide dificultad máxima, pleno y 10 plenos seguidos.
export function computeScore(difficulty, performance, seconds = 0, streak = 0) {
  const d = Math.min(5, Math.max(1, Math.round(Number(difficulty) || 1)));
  const p = Math.min(1, Math.max(0, Number(performance) || 0));
  const s = Number(seconds) || 0;
  const duration = s > 0 ? 0.85 + 0.15 * Math.min(1, s / 180) : 0.92;
  const base = (400 + 80 * d) * p * duration;
  const bonus = Math.min(200, 20 * Math.max(0, Math.floor(Number(streak) || 0))) * p;
  return Math.min(1000, Math.max(1, Math.round(base + bonus)));
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
