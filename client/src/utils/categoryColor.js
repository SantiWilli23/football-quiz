// Un color por categoría de trivia, para que la pregunta dé una pista visual
// de qué tema es antes de leerla. Reusa los mismos tokens de tema que ya usa
// el resto de la app (ver client/src/index.css) para que respete Nocturno/
// Azul/Bengala/Cancha de noche sin hex propios.
const COLORS = {
  Mundiales: "rgb(var(--c-blue))",
  "Champions League": "rgb(var(--c-purple))",
  Libertadores: "rgb(var(--c-amber))",
  "Copa América": "rgb(var(--c-emerald))",
  Eurocopa: "rgb(var(--c-blue))",
  Europa: "rgb(var(--c-purple))",
  "Liga Chilena": "rgb(var(--c-red))",
  Historia: "rgb(var(--c-orange))",
  Individuales: "rgb(var(--c-amber))",
  Reglas: "rgb(var(--c-emerald))",
};

export function categoryColor(category) {
  return COLORS[category] || "rgb(var(--c-gray-500))";
}
