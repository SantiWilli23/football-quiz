// Festejo con puntaje para cuando un juego suma puntos. Se dispara con un
// evento global (así sirve desde cualquier lado, incluso fuera de React) y lo
// muestra <ScoreCelebration /> (montado una vez en main.jsx).
// Si llegan varios casi juntos (p. ej. el puntaje del juego y los puntos del
// juego diario), se juntan en la misma ventana.
export function celebrateScore({ points, unit = "puntos", detail = "" }) {
  const n = Number(points);
  if (!Number.isFinite(n) || n <= 0) return;
  window.dispatchEvent(new CustomEvent("fq:score", { detail: { points: n, unit, detail } }));
}
