import {
  Building2, CalendarDays, Crown, Gavel, Link2, Shield, ShieldCheck, Skull, Sparkles,
  Star, Swords, Target, Timer, Trophy, TrendingUp, User, Users, Zap,
} from "lucide-react";

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
  carrera: { label: "Carrera larga", subtitle: "Temporada a temporada, partidas de horas.", tw: "purple" },
};

export const FAMILY_ORDER = ["solo", "grupo", "reloj", "pronostico", "carrera"];

export const GAMES = [
  // ---- Solo ----
  { href: "/fichado/", label: "Fichado", icon: Target, description: "Adiviná al futbolista secreto: cada intento te dice qué tan cerca estás.", family: "solo", available: true },
  { to: "/fulbodle", label: "Fulbodle", icon: User, description: "El Wordle del fútbol: adiviná al jugador secreto en 6 intentos con pistas de cada uno.", family: "solo", available: true },
  { to: "/escudos", label: "Escudos borrosos", icon: ShieldCheck, description: "El escudo aparece borroso y se va aclarando: adiviná el club con la menor cantidad de pistas.", family: "solo", available: true },
  { to: "/supervivencia", label: "Supervivencia", icon: Skull, description: "Trivia sin margen de error: una vida, a ver hasta dónde llegás.", family: "solo", available: true },
  { href: "/draft-europeo.html", label: "8a2", icon: Star, description: "Armá tu XI con jugadores de 138 planteles históricos de la Champions League.", family: "solo", available: true },

  // ---- Con amigos ----
  { to: "/duelos", label: "Duelos", icon: Swords, description: "Uno contra uno con las preguntas más difíciles del grupo.", family: "grupo", available: true },
  { href: "/mentiroso.html", label: "Mentiroso", icon: Zap, description: "Duelo 1 contra 1: ¿sabés más jugadores que el otro antes de que se te acaben?", family: "grupo", available: true },
  { to: "/copa-8a2", label: "Copa 8a2", icon: Trophy, description: "Torneo de eliminación directa del grupo: cada uno arma su equipo draftando jugadores reales.", family: "grupo", available: true },
  { to: "/equipo-jugador", label: "Equipo-Jugador", icon: Link2, description: "Cadena de conexiones futbolísticas: jugador → equipo → jugador. El que falla, queda eliminado.", family: "grupo", available: true },
  { to: "/fantasyfiction", label: "FantasyFiction", icon: TrendingUp, description: "Liga simulada con todo tu grupo: jornadas semanales y dos mercados de pases por semana apenas se sumen todos.", family: "grupo", available: true },
  { to: "/dt-liga", label: "Modo DT Online", icon: Users, description: "Armá una liga con amigos: cada uno elige un club real y compite temporada a temporada.", family: "grupo", available: true },

  // ---- Contrarreloj ----
  { to: "/un-minuto", label: "Un Minuto", icon: Timer, description: "Trivia contrarreloj: respondé todas las que puedas antes de que se acabe el reloj.", family: "reloj", available: true },
  { to: "/arbitraje-var", label: "Arbitraje / VAR", icon: Gavel, description: "Se te describe la jugada: decidí como el árbitro contra reloj y comparate con el VAR.", family: "reloj", available: true },

  // ---- Pronóstico ----
  { to: "/quiniela", label: "Quiniela semanal", icon: CalendarDays, description: "Predecí el resultado exacto de los próximos partidos reales antes de que arranquen.", family: "pronostico", available: true },
  { to: "/pronosticos", label: "Campeón y descenso", icon: Trophy, description: "Predecí quién sale campeón y qué 3 equipos bajan esta temporada real.", family: "pronostico", available: true },
  { label: "Fantasy Liga Real", icon: TrendingUp, description: "Armá tu 11 con jugadores reales y sumá puntos según cómo rindan en cada jornada real de su liga.", family: "pronostico", available: false },

  // ---- Carrera larga ----
  { href: "/cotrero.html", label: "Cotrero", icon: Crown, description: "De potrero a leyenda: simulá toda la carrera de un jugador, temporada a temporada.", family: "carrera", available: true },
  { to: "/carrera-dt", label: "Modo DT", icon: Shield, description: "Dirigí un equipo de Premier League o La Liga: tácticas, fichajes, selección nacional y partidos en vivo.", family: "carrera", available: true },
  { to: "/presidente", label: "Modo Presidente", icon: Building2, description: "Un nivel arriba del DT: manejás la plata del club, el estadio, los sponsors y la hinchada.", family: "carrera", available: true },
  { to: "/vida-fut", label: "Vida FUT", icon: Sparkles, description: "Jugador en Cotrero, después 3 temporadas de DT y 3 de presidente: una carrera larga en tres etapas.", family: "carrera", available: true },
];

export function gamesByFamily(familyKey) {
  return GAMES.filter((g) => g.family === familyKey);
}
