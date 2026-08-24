// Paleta "Pizarra": la app como el pizarrón del técnico. Verde profundo de
// fondo y tizas encima. Las tizas nunca son colores puros de pantalla — son
// tonos lavados, como los de una caja de tizas de verdad, porque un #3b82f6
// sobre verde oscuro se ve digital y rompe la idea.
//
// Los componentes importan de acá en vez de escribir el hex a mano, así
// cambiar una tiza es un solo lugar. Lo que se puede resolver con clases de
// Tailwind vive en tailwind.config.js.
export const CHALK = {
  board: "#10231b",
  boardLight: "#14291f",
  line: "#2f5243",

  white: "#dff0e6",
  dim: "#a8c9b6",
  faint: "#7fa691",

  yellow: "#f2c14e",
  blue: "#8fc4e8",
  green: "#a3dda8",
  pink: "#e8a8d8",
  red: "#f0907e",
  orange: "#f2a65a",
};

// Los tres slots de trivia. Antes eran azul/verde/ámbar de pantalla; ahora son
// tres tizas distintas de la misma caja.
export const SLOT_CHALK = {
  1: { color: CHALK.white, label: "🌍 General" },
  2: { color: CHALK.yellow, label: "🇨🇱 Liga Chilena" },
  3: { color: CHALK.blue, label: "⚽ Europa" },
};

export const KIND_CHALK = {
  quien_es_mas: CHALK.blue,
  que_prefieres: CHALK.green,
  personalidad: CHALK.pink,
  grupal: CHALK.yellow,
};

export const DUEL_CHALK = {
  dificil: CHALK.yellow,
  ultra: CHALK.orange,
  demonio: CHALK.red,
};

// En un pizarrón casi nada está relleno: el color se insinúa con un fondo muy
// tenue y el peso lo lleva el trazo.
export function chalkFill(color, alpha = "1a") {
  return `${color}${alpha}`;
}
