// Funciones apagadas por ahora: el código sigue en el proyecto, pero las rutas
// responden 404 y no se pueden usar. Para volver a prenderlas:
//   PRONOSTICOS_ENABLED=1 (variable de entorno) o poner `pronosticos: true` acá.
// Lo mismo, del lado del cliente, en client/src/data/features.js.
export const FEATURES = {
  // Pronóstico: Quiniela semanal, Campeón y descenso, Mercado de pases.
  pronosticos: process.env.PRONOSTICOS_ENABLED === "1",
  // Campeón y descenso y Mercado de pases: prendidos, pero cada uno abre solo
  // al inicio y al final de la temporada (ver utils/season-windows.js).
  temporada: true,
};

export function featureGate(flag) {
  return (req, res, next) => {
    if (FEATURES[flag]) return next();
    res.status(404).json({ error: "Esta función está desactivada por ahora" });
  };
}
