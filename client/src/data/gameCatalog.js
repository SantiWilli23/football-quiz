import {
  Brain, Building2, Grid3x3, PieChart, Triangle, CalendarDays, Crown, Gavel, Shield, ShieldCheck, Sparkles,
  Layers, Repeat, Star, Target, Timer, Trophy, TrendingUp, Users, ArrowLeftRight, Wallet,
} from "lucide-react";
import { isEnabled } from "./features.js";

// Familias de color secundario: reemplazan los ~14 hex sueltos que tenía
// cada juego antes. Usan los slots de color que YA existen por tema (ver
// --c-blue/--c-purple/--c-emerald/--c-amber/--c-red en client/src/index.css,
// uno por tema — Nocturno/Azul/Bengala) en vez de hex fijos, así que cada
// familia se adapta sola al tema elegido sin tocar nada acá. El color ahora
// identifica el TIPO de juego, no el juego en sí.
export const FAMILIES = {
  solo: { label: "Solo", subtitle: "Para jugar sin depender de nadie más.", tw: "emerald" },
  grupo: { label: "Con amigos", subtitle: "Se juegan o se compiten entre los miembros de tu grupo.", tw: "amber" },
  reloj: { label: "Contrarreloj", subtitle: "El reloj corre — respondé rápido o se acaba.", tw: "red" },
  pronostico: { label: "Pronóstico", subtitle: "Predecí resultados reales antes de que pasen.", tw: "blue" },
  carrera: { label: "Vida FUT", subtitle: "Temporada a temporada, partidas de horas.", tw: "purple" },
};

const ALL_FAMILY_ORDER = ["solo", "grupo", "reloj", "pronostico", "carrera"];

// Los juegos con `feature` apagada (client/src/data/features.js) siguen definidos acá
// pero no salen en el catálogo, ni en el buscador, ni en la barra superior.
const ALL_GAMES = [
  // ---- Solo ----
  { to: "/fulbodle", label: "Fichado", icon: Target, description: "Adiviná al futbolista secreto con colores, número de parecido, ligas y dificultades. Diario o aleatorio; la partida suma al reto semanal del grupo.", family: "solo", daily: true, available: true },
  { to: "/copa-semanal", label: "Copa semanal", icon: Trophy, description: "Anotate de lunes a jueves; de viernes a domingo se juega a eliminación por puntos de cada día.", family: "grupo", weekly: true, available: true },
  { to: "/mercado", label: "Mercado de pases", icon: Repeat, description: "Predecí a dónde juega cada figura, en Europa o en Chile. Abre solo en las vacaciones de verano.", family: "pronostico", feature: "temporada", available: true },
  { to: "/cartas", label: "Cartas", icon: Layers, description: "Abrí sobres con los 2000 jugadores, armá tu once y jugá partidos: la química sale de los clubes que compartieron.", family: "grupo", available: true },
  { to: "/escudos", label: "Escudos a ciegas", icon: ShieldCheck, description: "Fácil con pistas o Experto con clubes de ascenso: adiviná el club solo por el escudo borroso.", family: "solo", daily: true, available: true },
  { to: "/bingo", label: "Bingo", icon: Grid3x3, description: "Tablero 3x3 del día: un jugador que haya pasado por el club (o sea de la selección) de la fila y el club de la columna.", family: "solo", daily: true, available: true },
  { to: "/piramide", label: "Pirámide", icon: Triangle, description: "Ordená 10 jugadores de mayor a menor según la estadística del día, sin saber quién viene después.", family: "solo", daily: true, available: true },
  { to: "/torta", label: "Torta de plantel", icon: PieChart, description: "Adiviná el club por la torta de nacionalidades de sus jugadores, en 3 intentos.", family: "solo", daily: true, available: true },
  { to: "/traspasos", label: "Traspasos a ciegas", icon: ArrowLeftRight, description: "Adiviná al jugador por su línea de clubes: arrancás con 2 y cada fallo suma uno más. 5 intentos.", family: "solo", daily: true, available: true },
  { to: "/a-quien-me-compro", label: "¿A quién me compro?", icon: Wallet, description: "Mirá lo que vale un futbolista y decí si el de al lado vale más, igual o menos. 10 rondas; el diario es en difícil.", family: "solo", daily: true, available: true },
  { href: "/draft-europeo.html", label: "8a2", icon: Star, description: "Armá tu XI con jugadores de 138 planteles históricos de la Champions League.", family: "solo", daily: true, available: true },

  // ---- Con amigos ----
  { to: "/quien-sabe-mas", label: "¿Quién sabe más de fútbol?", icon: Brain, description: "Elegí entre Duelos, Mentiroso, Equipo-Jugador, ¿Quién es? (solo o en vivo), Votación del VAR, Dorsal histórico y Supervivencia.", family: "grupo", available: true },
  { to: "/copa-8a2", label: "Copa 8a2", icon: Trophy, description: "Torneo de eliminación directa del grupo: cada uno arma su equipo draftando jugadores reales.", family: "grupo", available: true },
  { to: "/fantasy", label: "Fantasy", icon: TrendingUp, description: "Liga de fantasy de la Premier o LaLiga con tu grupo: plantel, tienda de pujas a ciegas, fichajes y hasta 3 temporadas.", family: "grupo", available: true },
  { to: "/dt-liga", label: "Modo DT Online", icon: Users, description: "Armá una liga con amigos: cada uno elige un club real y compite temporada a temporada.", family: "grupo", weekly: true, available: true },

  // ---- Contrarreloj ----
  { to: "/quien-es", label: "¿Quién es?", icon: Users, description: "Te mostramos la carrera de un jugador club por club: adivinalo con las menos pistas. Libre, o el jugador del día igual para todos.", family: "solo", daily: true, available: true },
  { to: "/trivia", label: "Trivia del día", icon: Brain, description: "Las preguntas del día, 20 segundos por pregunta: las mismas para todo el grupo.", family: "solo", daily: true, dailyOnly: true, available: true },
  { to: "/un-minuto", label: "Un Minuto", icon: Timer, description: "Trivia contrarreloj: respondé todas las que puedas antes de que se acabe el reloj.", family: "solo", daily: true, available: true },
  { to: "/arbitraje-var", label: "Arbitraje / VAR", icon: Gavel, description: "Jugadas polémicas reales en video: decidí como el árbitro contra reloj y comparate con el VAR.", family: "solo", daily: true, available: true },

  // ---- Pronóstico ----
  { to: "/quiniela", label: "Quiniela", icon: CalendarDays, description: "Predecí el marcador exacto de los partidos de hoy antes de que arranquen.", family: "pronostico", feature: "pronosticos", daily: true, weekly: true, available: true },
  { to: "/pronosticos", label: "Campeón y descenso", icon: Trophy, description: "Predecí campeón y descensos de las ligas europeas y la chilena. Abre solo en las vacaciones de verano.", family: "pronostico", feature: "temporada", available: true },

  // ---- Carrera ----
  { href: "/cotrero.html", label: "Cotrero simple", icon: Crown, description: "De potrero a leyenda: simulá toda la carrera de un jugador, temporada a temporada. Cada día, el primer bloque de temporadas da el sobre del juego diario.", family: "carrera", daily: true, available: true },
  { to: "/carrera-dt", label: "Modo DT", icon: Shield, description: "Dirigí un equipo de Premier League o La Liga: tácticas, fichajes, selección nacional y partidos en vivo.", family: "carrera", available: true },
  { to: "/presidente", label: "Modo Presidente", icon: Building2, description: "Tu historia como presidente: decisiones, prensa y presión de la directiva. Solo, a tu ritmo, sin depender del grupo.", family: "carrera", available: true },
  { to: "/vida-fut", label: "Vida FUT", icon: Sparkles, description: "Jugador en Cotrero, después 3 temporadas de DT y 3 de presidente, en tres etapas.", family: "carrera", available: true },
];

export const GAMES = ALL_GAMES.filter((g) => isEnabled(g.feature));
// Una familia sin juegos habilitados no se muestra (ni su filtro).
export const FAMILY_ORDER = ALL_FAMILY_ORDER.filter((k) => GAMES.some((g) => g.family === k));

// Duración aproximada de una partida, en minutos. Sirve para filtrar en /juegos.
const MINUTES = {
  Fichado: 5, Fulbodle: 5, Bingo: 5, "Pirámide": 3, "Torta de plantel": 3, "Traspasos a ciegas": 3, "¿A quién me compro?": 3, "¿Quién es?": 3, Cartas: 10, "Copa semanal": 5, "¿Quién es? en vivo": 4, "Mercado de pases": 5, "Escudos a ciegas": 5, Supervivencia: 10, "8a2": 15,
  "¿Quién sabe más de fútbol?": 10, "Copa 8a2": 30, Subasta: 25, Fantasy: 10, "Modo DT Online": 60,
  "¿Quién es?": 3, "Trivia del día": 3, "Un Minuto": 1, "Arbitraje / VAR": 3, "Quiniela": 5, "Campeón y descenso": 5,
  "Cotrero simple": 60, "Modo DT": 120, "Modo Presidente": 120, "Vida FUT": 240,
};
export const minutesOf = (game) => MINUTES[game.label] ?? 15;

export const TIME_FILTERS = [
  { key: "todos", label: "Cualquier duración", test: () => true },
  { key: "corto", label: "Menos de 5 min", test: (m) => m <= 5 },
  { key: "medio", label: "5 a 30 min", test: (m) => m > 5 && m <= 30 },
  { key: "largo", label: "Más de 30 min", test: (m) => m > 30 },
];

export function gamesByFamily(familyKey) {
  return GAMES.filter((g) => g.family === familyKey);
}

// Los diez juegos diarios (todos pagan el mismo tope de puntos por día).
export const DAILY_GAMES = GAMES.filter((g) => g.daily);

// La pantalla de Juegos tiene tres bloques:
//  - Arriba, en la casilla grande: el juego diario de hoy (uno de los diez, rota).
//  - "Con amigos": la familia de grupo.
//  - "Fútbol 12": todos los demás juegos, incluido el diario de hoy (se repite
//    a propósito: arriba es el destacado y acá sigue en su lugar).
// Juegos semanales: sus puntos se reparten los domingos y solo cuentan en los
// grupos que los activaron. Salen de las otras listas para no repetirse.
export const JUEGOS_SEMANALES = GAMES.filter((g) => g.weekly);
export const CON_AMIGOS_GAMES = GAMES.filter((g) => g.family === "grupo" && !g.weekly);
// dailyOnly: juegos que solo salen como juego diario cuando les toca (no en Fútbol 12).
export const FUTBOL12_GAMES = GAMES.filter((g) => g.family !== "grupo" && !g.weekly && !g.dailyOnly);
