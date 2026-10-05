// Funciones apagadas por ahora: el código sigue en el proyecto, pero no se
// muestran ni funcionan. Para volver a prenderlas, poné la bandera en true
// (y en el servidor, PRONOSTICOS_ENABLED=1 — ver server/utils/features.js).
export const FEATURES = {
  // Pronóstico: Quiniela semanal, Campeón y descenso, Mercado de pases.
  pronosticos: false,
};

export const isEnabled = (flag) => !flag || !!FEATURES[flag];
