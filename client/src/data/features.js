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

export const isEnabled = (flag) => !flag || !!FEATURES[flag];
