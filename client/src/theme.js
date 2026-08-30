// Paleta unificada: el mismo esquema de color en Futotal, Draft Europeo 8a2
// y Cotrero. Gris azulado oscuro de fondo, tres acentos (azul de marca,
// verde azulado secundario, dorado para valores especiales). Reemplaza a
// "Pizarra" (verde pizarrón + amarillo) — ver tailwind.config.js, que
// mantiene estos mismos valores en paralelo para las clases de Tailwind.
//
// Los componentes importan de acá en vez de escribir el hex a mano, así
// cambiar un color es un solo lugar. Lo que se puede resolver con clases de
// Tailwind vive en tailwind.config.js.
export const CHALK = {
  board: "#2a2c30",
  boardLight: "#34363b",
  line: "#45474c",

  white: "#f2f2f0",
  dim: "#a8a9ac",
  faint: "#7c7d80",

  yellow: "#d9a441",
  blue: "#3b9dd6",
  green: "#3fae9a",
  pink: "#f0c674",
  red: "#f0907e",
  orange: "#8a6423",
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
