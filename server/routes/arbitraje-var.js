import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Modo Arbitraje/VAR: jugadas polémicas REALES de LaLiga revisadas por el VAR.
// Los clips son de los videos oficiales "Audio revisión VAR" de la Real
// Federación Española de Fútbol (RFEF), embebidos desde su canal de YouTube
// (no se copian ni se re-alojan). Cada clip junta dos tramos del mismo video:
// la jugada en vivo y la repetición cercana (zoom) que muestra el contacto.
// "crop" recorta el borde inferior del video para tapar los subtítulos del
// diálogo del VAR, que dicen la decisión; el cliente además reproduce todo SIN
// SONIDO. Cada decisión se verificó con el diálogo y los gráficos del propio
// video. "correct" es el índice dentro de "options" y "why" se muestra recién
// después de responder. El puntaje va al framework genérico de "retos".
const RFEF_CREDIT = "Real Federación Española de Fútbol (RFEF) · Audio revisión VAR";

const SITUATIONS = [
  {
    id: 1,
    video: { id: "YrmGWw6RsLk", segments: [[2, 10.4], [10.8, 24]], crop: true, credit: RFEF_CREDIT },
    text: "Elche vs Real Sociedad, minuto 61. Un jugador de Real Sociedad corta un pase del Elche en pleno ataque. Mirá en la repetición con qué parte del cuerpo toca la pelota.",
    options: ["Sigue el juego", "Tiro libre y amarilla", "Tiro libre directo y roja", "Penal"],
    correct: 2,
    why: "El VAR recomendó revisar una posible roja: la mano corta un pase en una ocasión manifiesta de gol, y eso es punible. El árbitro cobró tiro libre directo y expulsó al jugador (la roja se ve al final del video original).",
  },
  {
    id: 2,
    video: { id: "Z4QWPGsj_F4", segments: [[0.5, 6.5], [36, 52]], crop: true, credit: RFEF_CREDIT },
    text: "Atlético vs Real Madrid, minuto 36. Entrada en el piso entre un jugador del Madrid y uno del Atlético: el árbitro amonestó al del Madrid. Mirá la repetición: quién toca la pelota y qué pasa con el pie de cada uno.",
    options: [
      "Se mantiene la amarilla al jugador del Madrid",
      "Se cancela esa amarilla y se amonesta al jugador del Atlético",
      "Roja al jugador del Atlético",
      "Sin tarjetas",
    ],
    correct: 1,
    why: "El VAR observó que el jugador del Madrid es el que toca el balón y que el del Atlético es el que lo pisa. El árbitro canceló la amarilla del Madrid y amonestó al jugador del Atlético.",
  },
  {
    id: 3,
    video: { id: "mISh-y9W8Pc", segments: [[0.5, 8.5], [24.5, 40]], crop: true, credit: RFEF_CREDIT },
    text: "Atlético vs Real Madrid, minuto 49. Falta de Huijsen (Madrid) sobre un delantero que iba hacia el arco: el árbitro le había mostrado amarilla. Mirá la repetición del contacto.",
    options: ["Se mantiene la amarilla", "La amarilla pasa a roja", "Se retira la amarilla (sin tarjeta)"],
    correct: 1,
    why: "El VAR señaló que Huijsen sujeta al jugador sin opción de disputar el balón, en una ocasión manifiesta de gol. Tras ver las repeticiones, el árbitro retiró la amarilla y le mostró la roja (se ve en el gráfico del video).",
  },
  {
    id: 4,
    video: { id: "4DGpY0xxGTw", segments: [[0.5, 8], [17.5, 33]], crop: true, credit: RFEF_CREDIT },
    text: "Atlético vs Villarreal, minuto 72. Un defensor y un delantero pelean por la pelota en el área y el árbitro no cobra nada, pero el VAR lo llama al monitor. Mirá cómo usa las manos el defensor.",
    options: ["Sigue el juego", "Penal", "Penal y amarilla", "Penal y roja"],
    correct: 3,
    why: "El defensor empuja al delantero con las dos manos, sin posibilidad de jugar la pelota. El árbitro, tras ver las imágenes, cobró penal y roja directa.",
  },
  {
    id: 5,
    video: { id: "Yj1zehwObH4", segments: [[0.5, 6], [9.5, 25]], crop: true, credit: RFEF_CREDIT },
    text: "Celta vs Osasuna, minuto 38. Entrada de Marcos Alonso (Celta) sobre un rival, y el árbitro le mostró amarilla. Mirá en la repetición dónde impactan los tacos.",
    options: ["Se mantiene la amarilla", "La amarilla pasa a roja", "Sin tarjeta"],
    correct: 1,
    why: "Los tacos le impactan al rival en la tibia, no en el pie ni en el tobillo. El árbitro cambió la amarilla por tarjeta roja para Marcos Alonso.",
  },
  {
    id: 6,
    video: {
      id: "SykqgukYMko",
      segments: [[12, 23], [61, 72]],
      credit: "ESPN · Real Madrid vs Santiago Wanderers, Intercontinental Sub-20",
    },
    text: "Real Madrid vs Santiago Wanderers (final Intercontinental Sub-20). El 7 del Madrid encara hacia el área, el 18 de Wanderers lo persigue y lo derriba. Mirá en la repetición dónde es el contacto.",
    options: ["Sigue el juego", "Tiro libre", "Penal"],
    correct: 1,
    why: "El contacto del 18 de Wanderers es falta, pero ocurre afuera del área: el árbitro cobró tiro libre (no penal), pese a las protestas de los jugadores de Wanderers.",
  },
];

function publicSituation(s) {
  return { id: s.id, text: s.text, options: s.options, video: s.video };
}

router.get("/situation", (req, res) => {
  const exclude = String(req.query.exclude || "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));

  const pool = SITUATIONS.filter((s) => !exclude.includes(s.id));
  const list = pool.length ? pool : SITUATIONS;
  const picked = list[Math.floor(Math.random() * list.length)];
  res.json({ situation: publicSituation(picked), total: SITUATIONS.length });
});

router.post("/decide", (req, res) => {
  const situationId = Number(req.body?.situationId);
  const decisionIdx = Number(req.body?.decisionIdx);
  const situation = SITUATIONS.find((s) => s.id === situationId);
  if (!situation || !Number.isInteger(decisionIdx)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  res.json({ correct: situation.correct === decisionIdx, correctIdx: situation.correct, why: situation.why });
});

export default router;
