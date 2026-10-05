import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Modo Arbitraje/VAR: jugadas polémicas REALES revisadas por el VAR en la MLS
// 2026. Los clips son del programa "Inside Video Review" de la Professional
// Referee Organization (PRO), embebidos desde su canal oficial de YouTube
// (no se copian ni se re-alojan). "video.start/end" recorta el tramo de la
// jugada en vivo, antes de que el video muestre la sala del VAR. El cliente
// los reproduce SIN SONIDO: el comentario del video dice la decisión.
// "correct" es el índice dentro de DECISIONS y "why" se muestra recién
// después de responder. El puntaje va al framework genérico de "retos".
const DECISIONS = ["Sigue el juego", "Amarilla", "Roja", "Penal", "Fuera de juego", "Gol anulado"];

const MLS27 = "8yUs8cGzGww";
const MLS2526 = "C5NmUjVD6RU";
const MLS24 = "q4EpQPYsx4o";
const PRO_CREDIT = "Professional Referee Organization (PRO) · MLS 2026";
// Resumen de ESPN: muestra la jugada en vivo y después la repetición con
// zoom, así que esos clips encadenan los dos tramos ("segments").
const WANDERERS = "SykqgukYMko";
const WANDERERS_CREDIT = "ESPN · Real Madrid vs Santiago Wanderers, Intercontinental Sub-20";

const SITUATIONS = [
  {
    id: 1,
    video: { id: MLS27, start: 12, end: 22, credit: PRO_CREDIT },
    text: "Montreal. La jugada termina en gol de Prince Owusu. Mirá dónde está Fabian Herbers en el momento en que le juegan la pelota.",
    correct: 4,
    why: "Herbers estaba en posición adelantada cuando recibió el pase que terminó en el gol de Owusu. El VAR intervino y el gol se anuló por fuera de juego.",
  },
  {
    id: 2,
    video: { id: MLS27, start: 22, end: 35, credit: PRO_CREDIT },
    text: "St. Louis. Gol tras una jugada que arranca cerca de la mitad de cancha. Fijate en Carlo Holse al inicio.",
    correct: 4,
    why: "Holse estaba adelantado cerca de la mitad de cancha y después interfirió al tocar la pelota antes del gol. Fuera de juego: gol anulado.",
  },
  {
    id: 3,
    video: { id: MLS27, start: 37, end: 46, credit: PRO_CREDIT },
    text: "LAFC. Gol de Son Heung-min. Revisá el comienzo del ataque: Sergio Valencia intenta regatear a Costa.",
    correct: 5,
    why: "Valencia erró la pelota y pisó con los tapones la bota de Costa, que no pudo seguir defendiendo. Falta en la fase de ataque del gol: gol anulado, tiro libre directo y amarilla por temeraria.",
  },
  {
    id: 4,
    video: { id: MLS27, start: 186, end: 195, credit: PRO_CREDIT },
    text: "New England. El árbitro cobró mano de Miller y dio tiro libre justo afuera del área. Mirá dónde le pega la pelota.",
    correct: 3,
    why: "La pelota tocó el brazo derecho extendido de Miller antes de pegarle en la cara, y el contacto fue sobre la línea del área (la línea es parte del área). El VAR recomendó revisión y el árbitro cambió el tiro libre por penal.",
  },
  {
    id: 5,
    video: { id: MLS2526, start: 20, end: 30, credit: PRO_CREDIT },
    text: "Orlando. Tiro libre y gol en contra de Walker Zimmerman (Toronto). Fijate en el número 5 de Orlando, Luis Otávio.",
    correct: 4,
    why: "Cuando se pateó el tiro libre, Luis Otávio estaba adelantado y después disputó con Zimmerman, afectando su posibilidad de jugar la pelota. Fuera de juego por interferir con un rival: no hay gol.",
  },
  {
    id: 6,
    video: { id: MLS2526, start: 147, end: 157, credit: PRO_CREDIT },
    text: "Orlando. El arquero Luka Gavran se tira a los pies de Martín Ojeda y el árbitro cobra penal con amarilla para el arquero.",
    correct: 0,
    why: "Gavran llegó a jugar la pelota con el pie antes de cualquier contacto con Ojeda. En el monitor quedó claro que era una disputa legal: sin penal, y el juego se reanudó con balón a tierra.",
  },
  {
    id: 7,
    video: { id: MLS2526, start: 245, end: 257, credit: PRO_CREDIT },
    text: "San Diego. Alejandro Alvarado patea la pelota contra la cabeza de un rival justo cuando suena el silbato. El árbitro mostró roja.",
    correct: 1,
    why: "La patada ocurrió al mismo tiempo que el silbatazo y no hubo malicia ni brutalidad. El árbitro fue al monitor y bajó la roja a amarilla por imprudente.",
  },
  {
    id: 11,
    video: { id: WANDERERS, segments: [[12, 23], [61, 72]], credit: WANDERERS_CREDIT },
    text: "Real Madrid vs Santiago Wanderers (final Intercontinental Sub-20). El 7 del Madrid encara hacia el área, el 18 de Wanderers lo persigue y lo derriba. Mirá en la repetición dónde es el contacto.",
    options: ["Sigue el juego", "Tiro libre", "Penal"],
    correct: 1,
    why: "El contacto del 18 de Wanderers es falta, pero ocurre afuera del área: el árbitro cobró tiro libre (no penal), pese a las protestas de los jugadores de Wanderers.",
  },
  {
    id: 9,
    video: { id: MLS24, start: 222, end: 233, credit: PRO_CREDIT },
    text: "Miami. Miguel Almirón remata al arco y Casemiro intenta bloquear. El árbitro dio córner.",
    correct: 3,
    why: "Casemiro hizo contacto con los tapones en la pierna de Almirón al bloquear el remate. Falta temeraria dentro del área: penal y amarilla.",
  },
  {
    id: 10,
    video: { id: MLS24, start: 326, end: 336, credit: PRO_CREDIT },
    text: "Vancouver. Centro al área y el árbitro cobra penal por mano del número 6. Mirá en qué parte del cuerpo le pega la pelota.",
    correct: 0,
    why: "La pelota rebotó en la cabeza de otro jugador y le dio en la parte de atrás de la cabeza al número 6, no en la mano. Tras la revisión se anuló el penal.",
  },
];

function publicSituation(s) {
  return { id: s.id, text: s.text, options: s.options || DECISIONS, video: s.video };
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
