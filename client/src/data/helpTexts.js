// Textos de ayuda del botón «?»: uno por pantalla. `match` es el prefijo de ruta;
// gana el más largo. Se usan también en el tutorial de bienvenida.
//
// Regla común a casi todos los juegos: lo que jugás suma un puntaje semanal a tu
// grupo, que crece con el esfuerzo (dificultad, aciertos) y la rapidez. Cada
// semana arranca de cero.

const WEEKLY = "Suma un puntaje semanal para tu grupo: cuenta el esfuerzo (aciertos, dificultad) y el tiempo. Cada semana se reinicia.";

export const GROUP_HELP = {
  title: "Cómo funcionan los grupos",
  intro: "Un grupo es tu pandilla de amigos dentro de Futotal. Todo lo que jugás se compara con ellos.",
  points: [
    "Crear o unirte: creás un grupo y compartís el código o el link de invitación; los demás entran con eso. Podés estar en varios grupos y cambiar de uno a otro arriba.",
    "Escudo del grupo: se genera con el nombre y los colores del grupo, y es la identidad que ven todos.",
    "Ranking semanal: suma los puntos de todos los juegos de la semana (trivia, duelos, retos, Copa 8a2, FantasyFiction y más). Cada lunes se reinicia y queda en el historial.",
    "Retos semanales: cada juego tiene su propia tabla del grupo, con puntajes según esfuerzo y tiempo. Se premia al top 3.",
    "Copa semanal: te anotás de lunes a jueves y de viernes a domingo se juega a eliminación según los puntos de cada día.",
    "Preguntas del grupo: el grupo puede escribir sus propias preguntas de trivia para pelearse entre amigos.",
    "Liga del grupo (opcional): la activa quien creó el grupo y hace falta tener al menos 10 miembros. Hay dos divisiones, Primera y Segunda, con ascensos y descensos cada temporada, y se pueden habilitar sobres de cartas según tu posición y división.",
    "Sobres de cartas: si el creador los habilita, la Liga del grupo reparte sobres al cerrar la temporada.",
  ],
};

const H = (title, intro, points = []) => ({ title, intro, points });

export const HELP = [
  { match: "/panel", ...H("Inicio", "Tu pizarra del día: qué te falta jugar hoy, cómo viene tu grupo y lo que sigue.", [
    "Arriba ves tu progreso del día y la trivia diaria.",
    "El ranking semanal del grupo está acá resumido; el detalle está en Mi grupo.",
  ]) },
  { match: "/trivia", ...H("Trivia", "Preguntas de fútbol: la diaria y las especiales.", [
    "Trivia diaria: una tanda por día, igual para todo tu grupo. Cada pregunta acertada suma 1 punto, sin rachas ni bonus.",
    "Especial: preguntas temáticas de la semana o del momento.",
    WEEKLY,
  ]) },
  { match: "/juegos", ...H("Juegos", "Arriba, el juego diario de hoy; después «Con amigos» y «Fútbol 12» (todos los demás, incluido el diario).", [
    "El juego diario cambia cada día (rota entre diez): tu partida da un puntaje de 0 a 20 (solo de referencia) y un sobre de cartas (normal, bueno o top según tu rendimiento). Con ese puntaje se ordena al grupo ese día: el 1° suma 5 puntos, el 2° 3 y el 3° 3. Los demás juegos dan un sobre normal por jugar. Los demás juegos se juegan libres ese día.",
    "La semana se suma: los diarios de la semana dan sobres al podio del grupo (top, bueno y normal). Los «Juegos semanales» (Copa semanal, FantasyFiction, Quiniela y Modo DT Online) pagan sus puntos los domingos, solo en grupos que los activaron.",
    "Cada juego tiene su propio «?» con las reglas y cómo puntúa.",
  ]) },
  { match: "/futbol", ...H("En vivo", "Partidos, tablas y goleadores reales de las 5 grandes de Europa y de Chile.", [
    "Hoy: todos los partidos del día, los que están jugando primero. Se actualiza solo.",
    "Partidos: los próximos 2 días. Con «Elegir día» abrís un calendario del mes y mirás cualquier fecha.",
    "Tabla: tocá un equipo para ver cómo le fue la liga pasada, su plantilla, lesionados y títulos de liga.",
    "Los títulos se cuentan por la tabla final de cada temporada (Europa desde 2005-06, Chile desde 2020) y no incluyen copas.",
  ]) },
  { match: "/grupo", ...GROUP_HELP },
  { match: "/estadisticas", ...H("Estadísticas", "Tus números y los del grupo: aciertos, rachas y evolución.") },
  { match: "/historial", ...H("Historial", "Las semanas anteriores: quién ganó cada una y con cuántos puntos.") },
  { match: "/ranking-global", ...H("Ranking global", "Todos los jugadores de Futotal comparados, más allá de tu grupo.") },
  { match: "/perfil", ...H("Mi perfil", "Tu avatar, tu vitrina de logros y tus ajustes.", [
    "Acá también cambiás el tema, el sonido y los avisos.",
  ]) },
  { match: "/pase", ...H("Pase de temporada", "Cada cosa que jugás suma experiencia; al subir de nivel desbloqueás recompensas hasta fin de temporada.") },
  { match: "/vida-fut", ...H("Vida FUT", "Una carrera larga en tres etapas: jugador (Cotrero), 3 temporadas de DT y 3 de presidente.", [
    "Cada etapa se juega con su propio modo; lo que lográs en una pasa a la siguiente.",
  ]) },

  { match: "/fulbodle", ...H("Fichado", "Adiviná al futbolista secreto.", [
    "Cada intento te da colores y un número de parecido: verde es acierto exacto, amarillo está cerca.",
    "Según por dónde entres: como juego diario es UN solo jugador y no se repite; como reto del día, el secreto sale de un grupo restringido (jóvenes, leyendas, porteros…); desde Juegos es partida libre, sin límite. Es un juego semanal: su rendimiento de la semana se premia los domingos.",
    WEEKLY,
  ]) },
  { match: "/copa-semanal", ...H("Copa semanal", "Un torneo del grupo cada semana.", [
    "De lunes a jueves te anotás. De viernes a domingo se juega a eliminación: gana quien sume más puntos ese día. Al terminar: 5 puntos por participar y un extra a los 4 primeros (el campeón suma 55 en total). Cada fase ganada da además un sobre.",
    "Te anotás una vez y se arma sola; no necesitás jugar un partido aparte.",
  ]) },
  { match: "/mercado", ...H("Mercado de pases", "Predecí a dónde se va cada figura. Hay un mercado de Europa y otro de Chile.", [
    "Solo abre al inicio y al final de cada temporada. Europa: julio–agosto y abril–mayo. Chile: enero–febrero y octubre–15 de diciembre.",
    "Fuera de esas fechas podés ver el último mercado, pero no elegir.",
    "Cada acierto suma puntos cuando se resuelve el mercado.",
  ]) },
  { match: "/cartas", ...H("Cartas", "Abrí sobres con jugadores reales, armá tu once y jugá partidos.", [
    "La química sale de los clubes que compartieron los jugadores de tu equipo: más química, mejor rendimiento.",
    "Tipos de carta: Jugador, Ícono (versión de leyenda con más media), Momento (una jugada histórica) y Entrenador.",
    "Entrenador: no juega, se pone aparte y da bonus (por ejemplo +3 a los argentinos o más química). Tiene un tope para que no regale el partido.",
    "Capitán: eliges uno de tu once y sus conexiones de club cuentan doble.",
    "Selecciones: si pones en tu once jugadores de un plantel histórico (Chile 2015, Argentina 2022…) ganas química extra.",
    "En forma: las cartas de quienes hicieron un gol en las ligas reales en los últimos 7 días suman +3 por esa semana.",
    "Los Íconos, Momentos y entrenadores salen en los sobres; el Sobre Íconos tiene un Ícono asegurado.",
    "Podés jugar contra la máquina o contra otra persona del grupo.",
    "Tu mejor victoria de la semana suma al grupo: cuenta la diferencia de goles y si el rival era más fuerte. Ganarle a una persona vale más.",
  ]) },
  { match: "/escudos", ...H("Escudos a ciegas", "Adiviná el club solo por su escudo borroso.", [
    "Fácil: con pistas y las veces que quieras (da un sobre normal por día).",
    "Experto: clubes de ascenso y los más oscuros, sin pistas.",
    "Juego diario: solo aparece si entrás desde el juego diario; el escudo no cambia los primeros 3 segundos.",
  ]) },
  { match: "/quien-sabe-mas", ...H("¿Quién sabe más de fútbol?", "Cinco formas de medirte: Duelos, Mentiroso, Equipo-Jugador, ¿Quién es? y Supervivencia.", [
    "Elegí el modo según el tiempo y con quién juegues. Cada uno tiene su «?».",
  ]) },
  { match: "/duelos", ...H("Duelos", "Uno contra uno con las preguntas más difíciles del grupo.", [
    "Ganás puntos por cada pregunta que le sacás de ventaja al rival; también se pueden hacer apuestas.",
    "Suma al ranking semanal del grupo.",
  ]) },
  { match: "/equipo-jugador", ...H("Equipo-Jugador", "Una cadena de conexiones: jugador → equipo → jugador.", [
    "Si fallás, quedás eliminado. Gana quien llegue más lejos.",
    WEEKLY,
  ]) },
  { match: "/quien-es-vivo", ...H("¿Quién es? en vivo", "Uno contra uno con las mismas pistas para los dos.", [
    "Crean una sala y pasan el código. Sale una pista nueva cada 12 segundos; gana quien adivine primero.",
    "Cuantas menos pistas necesites, más puntos. " + WEEKLY,
  ]) },
  { match: "/quien-es", ...H("¿Quién es?", "Adiviná al jugador por su carrera: clubes y años, de a una pista.", [
    "Menos pistas usadas = más puntos.",
    "También podés jugarlo en vivo contra una persona.",
  ]) },
  { match: "/supervivencia", ...H("Supervivencia", "Trivia sin margen de error: una vida.", [
    "En cuanto fallás, se termina. Cuantas más rondas aguantes y más difícil el nivel, más puntos.",
    WEEKLY,
  ]) },
  { match: "/copa-8a2", ...H("Copa 8a2", "Torneo de eliminación directa del grupo.", [
    "Cada uno arma su equipo draftando jugadores reales y se cruzan por rondas.",
    "Sumás puntos por anotarte y por cada ronda que ganás, más cuanto más avanzás.",
  ]) },
  { match: "/fantasyfiction", ...H("FantasyFiction", "Liga simulada con todo tu grupo.", [
    "Hay jornadas semanales y dos mercados de pases por semana.",
    "En cada jornada el top 3 del grupo suma 8, 5 y 3 puntos, y el resto 1.",
  ]) },
  { match: "/dt-liga", ...H("Modo DT Online", "Una liga con amigos: cada uno elige un club real y compite temporada a temporada.", [
    "Los partidos entre ustedes se pueden seguir en vivo.",
  ]) },
  { match: "/un-minuto", ...H("Un Minuto", "Trivia contrarreloj: respondé todas las que puedas en un minuto.", [
    "Cada acierto suma; fallar no resta. Sirve para entrar en calor.",
    WEEKLY,
  ]) },
  { match: "/arbitraje-var", ...H("Arbitraje / VAR", "Mirá la jugada y decidí como árbitro.", [
    "Decidí por lo que ves en el video, no por la descripción. Después se muestra qué decidió el VAR y por qué.",
    "Un clip sin sonido por ronda, contra reloj.",
    WEEKLY,
  ]) },
  { match: "/quiniela", ...H("Quiniela diaria", "Predecí el resultado exacto de los partidos de hoy.", [
    "Tenés que cargar tu pronóstico antes de que arranque cada partido.",
    "Exacto suma 5; acertar solo el ganador o el empate suma 2. Es un juego semanal: esos puntos se pagan los domingos si tu grupo activó los juegos semanales. Cada día que jugás te da un sobre de cartas.",
  ]) },
  { match: "/pronosticos", ...H("Campeón y descenso", "Predecí quién sale campeón y quiénes bajan esta temporada, en las 5 grandes de Europa y en Chile.", [
    "Solo abre al inicio y al final de cada temporada. Europa: julio–agosto y abril–mayo. Chile: enero–febrero y octubre–15 de diciembre.",
    "Se paga cuando termina la temporada real: 20 puntos por el campeón y 7 por cada descenso acertado (en Chile bajan 2, en Europa se eligen 3).",
    "Lo que predecís al final de temporada vale la mitad, porque ya se sabe mucho más.",
  ]) },
  { match: "/carrera-dt", ...H("Modo DT", "Dirigí un club real: tácticas, fichajes, selección y partidos en vivo.", [
    "Cada temporada suma al puntaje semanal; los objetivos y títulos valen más.",
  ]) },
  { match: "/presidente", ...H("Modo Presidente", "Tu historia como presidente de un club: decisiones, prensa y presión de la directiva.", [
    "Se juega solo, a tu ritmo. Tu legado puntúa para el grupo.",
  ]) },
];

export function helpFor(pathname) {
  let best = null;
  for (const h of HELP) {
    if (pathname === h.match || pathname.startsWith(`${h.match}/`)) {
      if (!best || h.match.length > best.match.length) best = h;
    }
  }
  return best;
}
