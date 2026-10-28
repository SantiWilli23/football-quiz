import { ArrowLeftRight, Gavel, Grid3x3, ShieldCheck, Target, Timer, Wallet } from "lucide-react";

// Juegos fusionados (Futotal 2.0, punto 1 de ESPEC-PENDIENTES). Cada juego fusionado tiene una
// pantalla de entrada (/jugar/<slug>/<variante>) y se juega en /jugar/<slug>/<variante>/jugar, que
// abre la pantalla de siempre. Ninguna clave de localStorage ni tabla cambia de nombre: los récords
// salen de lo que ya hay (`statsKey` = clave de futgames/storage.js).
export const JUEGOS = {
  quien_es: {
    slug: "quien-es", label: "¿Quién es?", icon: Target, text: "Adiviná al futbolista de tres maneras.",
    variantes: [
      { id: "parecido", label: "Parecido", text: "Colores y número de parecido, con dificultades y ligas.", play: "/fulbodle", old: "/fulbodle" },
      { id: "carrera", label: "Carrera", text: "Su trayectoria club por club: menos pistas, más puntos.", play: "/quien-es", old: "/quien-es" },
      { id: "traspasos", label: "Traspasos", text: "Una línea de clubes que se completa con cada fallo.", play: "/traspasos", old: "/traspasos", statsKey: "traspasos" },
    ],
  },
  que_club: {
    slug: "que-club", label: "¿Qué club?", icon: ShieldCheck, text: "Adiviná el club por su escudo o su plantel.",
    variantes: [
      { id: "escudos", label: "Escudos", text: "Un escudo borroso: fácil con pistas o experto.", play: "/escudos", old: "/escudos" },
      { id: "plantel", label: "Plantel", text: "Las nacionalidades de la torta, en 3 intentos.", play: "/torta", old: "/torta", statsKey: "torta" },
    ],
  },
  mas_o_menos: {
    slug: "mas-o-menos", label: "Más o menos", icon: Wallet, text: "¿Quién vale más? Más, menos… o igual.",
    variantes: [
      { id: "compro", label: "¿A quién me compro?", text: "Mirá lo que vale uno y apostá por el otro. 10 rondas.", play: "/a-quien-me-compro", old: "/a-quien-me-compro", statsKey: "a_quien_me_compro" },
      { id: "piramide", label: "Pirámide", text: "Ordená 10 jugadores de mayor a menor.", play: "/piramide", old: "/piramide", statsKey: "piramide" },
    ],
  },
  trivia: {
    slug: "trivia", label: "Trivia", icon: Timer, text: "Preguntas de fútbol contra el reloj o hasta que falles.",
    variantes: [
      { id: "un-minuto", label: "Un minuto", text: "Todas las que puedas antes de que se acabe el reloj.", play: "/un-minuto", old: "/un-minuto" },
      { id: "supervivencia", label: "Supervivencia", text: "Una sola vida: en cuanto fallás, se termina.", play: "/supervivencia", old: "/supervivencia", statsKey: "survival" },
    ],
  },
  var: {
    slug: "var", label: "VAR", icon: Gavel, text: "Mirá la jugada y decidí como árbitro.",
    variantes: [{ id: "arbitro", label: "Árbitro", text: "Jugadas reales en video, con o sin reloj.", play: "/arbitraje-var", old: "/arbitraje-var" }],
    tabs: [{ id: "votacion", label: "Votación del club", text: "Votá una jugada y mirá el reparto del club. No suma puntos.", play: "/jugar/var/votacion/jugar" }],
  },
  bingo: {
    slug: "bingo", label: "Bingo", icon: Grid3x3, text: "Completá el tablero con jugadores que pasaron por el club.",
    variantes: [{ id: "bingo", label: "Bingo", text: "Tablero 3×3 del día: una fila y una columna por casilla.", play: "/bingo", old: "/bingo", statsKey: "tateti" }],
  },
};

export const bySlug = (slug) => Object.entries(JUEGOS).map(([id, j]) => ({ id, ...j })).find((j) => j.slug === slug) || null;

// Tabla de redirecciones (ruta vieja → ruta nueva). Se conserva la query; el «diario=1» de los
// juegos viejos queda como semilla compartida porque la pantalla de siempre lo sigue leyendo.
export const REDIRECCIONES = {
  "/fulbodle": ["quien_es", "/jugar/quien-es/parecido"],
  "/quien-es": ["quien_es", "/jugar/quien-es/carrera"],
  "/traspasos": ["quien_es", "/jugar/quien-es/traspasos"],
  "/escudos": ["que_club", "/jugar/que-club/escudos"],
  "/torta": ["que_club", "/jugar/que-club/plantel"],
  "/piramide": ["mas_o_menos", "/jugar/mas-o-menos/piramide"],
  "/a-quien-me-compro": ["mas_o_menos", "/jugar/mas-o-menos/compro"],
  "/un-minuto": ["trivia", "/jugar/trivia/un-minuto"],
  "/supervivencia": ["trivia", "/jugar/trivia/supervivencia"],
  "/arbitraje-var": ["var", "/jugar/var"],
  "/var-votacion": ["var", "/jugar/var?tab=votacion"],
  "/bingo": ["bingo", "/jugar/bingo"],
  "/tateti": ["bingo", "/jugar/bingo"],
};

export const ICONOS = { ArrowLeftRight };
