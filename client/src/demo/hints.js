// Textos de la pantalla «elige cómo jugar» de la Demo: una línea por variante.
export const HINTS = {
  "quien_es/parecido": ["Fichado", "Escribe jugadores y mira en verde lo que comparten con el secreto."],
  "quien_es/carrera": ["Carrera", "Adivina al futbolista por los clubes en los que jugó."],
  "que_club/escudos": ["Escudos", "Un escudo borroso: ¿de qué club es?"],
  "que_club/plantel": ["Torta de plantel", "La torta de nacionalidades de un plantel: ¿de quién es?"],
  "mas_o_menos/compro": ["¿A quién me compro?", "Elige al jugador más valioso, ronda tras ronda."],
  "mas_o_menos/piramide": ["Pirámide", "Ordena a los jugadores de más a menos valor."],
  "trivia/un-minuto": ["Un minuto", "Todas las preguntas que puedas antes de que se acabe el reloj."],
  "trivia/supervivencia": ["Supervivencia", "Sigues hasta que falles. ¿Hasta dónde llegas?"],
  "var/arbitro": ["Árbitro", "Mira la jugada y decide como en el VAR."],
  "var/votacion": ["Votación del club", "Vota las jugadas polémicas con tu club."],
  "draft/solo": ["Solo (8a2)", "Arma tu once por rondas y llévalo a la Champions."],
  "draft/copa": ["Copa 8a2", "El mismo draft, en copa con tu club."],
  "draft/subasta": ["Subasta", "Puja por los jugadores contra tus amigos."],
  "draft/amigo": ["Contra un amigo", "Una sala con código: arman su once y el servidor juega el partido."],
  "bingo/bingo": ["Bingo", "Completa el tablero con jugadores que pasaron por cada club."],
};
export const hintFor = (game, variant) => HINTS[`${game}/${variant}`] || null;
