// Tabla central de puntos. Antes cada ruta tenía sus propios números sueltos
// (EXACT_POINTS acá, HIT_POINTS allá...) sin ningún criterio compartido entre
// ellos. Ahora viven todos acá, agrupados por franja de esfuerzo/cadencia,
// para que sea fácil ver de un vistazo cómo se comparan entre sí antes de
// tocar cualquiera. Los valores de duelos (server/routes/duels.js) y modo B
// (server/utils/mode-b.js) se quedaron en sus archivos porque ya eran objetos
// con nombre propio bien documentados — están listados acá solo como
// referencia en el comentario de abajo.
//
// Franjas (de menor a mayor esfuerzo/cadencia):
//   MICRO   — varias veces por día, esfuerzo mínimo (quiniela por fecha)
//   DIARIO  — una vez al día (reto diario, ranking diario de trivia)
//   SESION  — una partida completa con skill real (duelos, Fichado)
//   SEMANAL — requiere que se resuelva una semana entera (DT League)
//   TEMPORADA — una vez cada varios meses, lo más difícil de acertar
//
// DT League (server/utils/dt-match.js, dtWeeklyPoints) queda TAL CUAL por
// ahora — sin techo, puede superar los 40-50 puntos con una diferencia de
// categoría grande. Se decidió dejarlo así por el momento; si en algún
// momento se quiere parejo con el resto, ahí es donde hay que tocar.

// MICRO
export const QUINIELA_EXACT_POINTS = 5;
export const QUINIELA_RESULT_POINTS = 2;

// DIARIO
export const DAILY_CHALLENGE_BONUS_POINTS = 5;
// Ranking diario de trivia por % de acierto del grupo (1° a 4° puesto).
export const TRIVIA_DAILY_RANK_POINTS = { 1: 10, 2: 5, 3: 3, 4: 2 };

// TEMPORADA
export const TRANSFER_HIT_POINTS = 10;
export const SEASON_CHAMPION_POINTS = 20;
export const SEASON_RELEGATED_POINTS = 7; // por cada equipo que sí bajó, hasta 3 = 21

// Referencia (definidos en su propio archivo, no acá):
//   - Duelos: server/routes/duels.js → DUEL_DIFFICULTIES (15/22/32 según dificultad)
//   - Modo B: server/utils/mode-b.js → MODE_B_POINTS (5 por respuesta, 15 por predicción)
//   - Fichado: server/routes/wordle.js → finalPoints() (8-18 según eficiencia y dificultad,
//     el mismo número que ve el jugador en pantalla ahora suma al ranking)
//   - DT League: server/utils/dt-match.js → dtWeeklyPoints() (sin techo, ver nota arriba)
