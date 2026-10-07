// Funciones apagadas por ahora: el código sigue en el proyecto, pero no se
// muestran ni funcionan. Para volver a prenderlas, poné la bandera en true
// (y en el servidor, PRONOSTICOS_ENABLED=1 — ver server/utils/features.js).
export const FEATURES = {
  // Pronóstico: Quiniela semanal, Campeón y descenso, Mercado de pases.
  pronosticos: false,
  // Campeón y descenso y Mercado de pases: abren solo al inicio y al final de
  // cada temporada (Europa y Chile por separado; lo decide el servidor).
  temporada: true,
};

// Ventanas de temporada (espejo de server/utils/season-windows.js): Campeón y
// descenso y Mercado de pases solo aparecen cuando alguna región está abierta.
// [mes, día] inclusivos; una ventana puede cruzar el año.
const SEASON_WINDOWS = [
  [[7, 1], [8, 31]], [[4, 1], [5, 31]], // Europa: inicio y final
  [[1, 1], [2, 28]], [[10, 1], [12, 15]], // Chile: inicio y final
];

export function seasonWindowOpen(now = new Date()) {
  const x = (now.getMonth() + 1) * 100 + now.getDate();
  const v = ([m, d]) => m * 100 + d;
  return SEASON_WINDOWS.some(([from, to]) => (v(from) <= v(to) ? x >= v(from) && x <= v(to) : x >= v(from) || x <= v(to)));
}

export const isEnabled = (flag) => {
  if (!flag) return true;
  if (!FEATURES[flag]) return false;
  return flag === "temporada" ? seasonWindowOpen() : true;
};
