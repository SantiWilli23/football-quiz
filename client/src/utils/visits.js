// Cuándo entraste por última vez a cada juego (por ruta). Alcanza para dos
// cosas del panel: el punto verde de «jugado hoy» en el catálogo y el aviso
// «reto semanal sin jugar». Vive solo en este dispositivo.
const KEY = "fq_game_visits";

// Rutas de juegos de la app (las páginas estáticas de Cotrero/Draft/Mentiroso
// no pasan por Layout, así que quedan afuera).
export const GAME_ROUTES = [
  "/fulbodle", "/escudos", "/supervivencia", "/duelos", "/copa-8a2", "/equipo-jugador", "/fantasyfiction",
  "/dt-liga", "/un-minuto", "/arbitraje-var", "/quiniela", "/pronosticos", "/carrera-dt", "/presidente", "/vida-fut",
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function readVisits() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function markVisit(pathname) {
  const route = GAME_ROUTES.find((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (!route) return;
  try {
    const visits = readVisits();
    if (visits[route] === today()) return;
    visits[route] = today();
    localStorage.setItem(KEY, JSON.stringify(visits));
  } catch {
    /* sin storage: el punto verde simplemente no aparece */
  }
}

export function playedToday(route, visits = readVisits()) {
  return visits[route] === today();
}

export function daysSince(route, visits = readVisits()) {
  const v = visits[route];
  if (!v) return Infinity;
  const [y, m, d] = v.split("-").map(Number);
  return Math.round((Date.now() - new Date(y, m - 1, d).getTime()) / 86400000);
}
