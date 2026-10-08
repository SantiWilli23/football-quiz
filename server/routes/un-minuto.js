import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Modo "Un minuto": preguntas rápidas de a una, contra reloj (del lado del
// cliente). Reutiliza el pool grande de duel_questions (no está atado a fecha
// como la trivia diaria) para no necesitar contenido propio — esa base no
// tiene categoría por tema, solo dificultad (dificil/ultra/demonio), así que
// la elección es por dificultad; a más difícil, más puntos por acierto. El
// puntaje final (aciertos × multiplicador) se manda al framework genérico de
// "retos" (server/routes/challenges.js) como cualquier otro juego semanal.
const DIFFICULTIES = {
  dificil: { label: "Difícil", multiplier: 1 },
  ultra: { label: "Ultra difícil", multiplier: 1.5 },
  demonio: { label: "Demonio", multiplier: 2 },
};

function difficultyOf(raw) {
  return DIFFICULTIES[raw] ? raw : "dificil";
}

router.get("/difficulties", (req, res) => {
  res.json({ difficulties: Object.entries(DIFFICULTIES).map(([id, d]) => ({ id, label: d.label, multiplier: d.multiplier })) });
});

// Categorías a elección: la base no trae tema, así que se filtra por palabras
// clave de la pregunta y sus opciones. Si una categoría no tiene preguntas en la
// dificultad pedida, se sirve cualquiera (y se avisa con fallback: true).
const CATEGORIES = {
  mundiales: ["Mundial", "Copa del Mundo"],
  champions: ["Champions", "Copa de Europa"],
  chile: ["Chile", "Colo-Colo", "La Roja", "Universidad de Chile", "Universidad Católica"],
  premier: ["Premier League", "Manchester", "Liverpool", "Arsenal", "Chelsea"],
  laliga: ["LaLiga", "La Liga", "Real Madrid", "Barcelona", "Atlético de Madrid"],
};

router.get("/categories", (req, res) => {
  res.json({ categories: Object.keys(CATEGORIES) });
});

router.get("/question", async (req, res) => {
  const difficulty = difficultyOf(req.query.difficulty);
  const exclude = String(req.query.exclude || "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));
  const words = CATEGORIES[String(req.query.category || "")] || null;

  const excludeSql = exclude.length > 0 ? `AND id NOT IN (${exclude.map(() => "?").join(",")})` : "";
  const baseArgs = [difficulty, ...exclude];
  const select = "SELECT id, question, option_a, option_b, option_c, option_d FROM duel_questions WHERE difficulty = ?";

  let row;
  let fallback = false;
  if (words) {
    const like = words.map(() => "(question LIKE ? OR option_a LIKE ? OR option_b LIKE ? OR option_c LIKE ? OR option_d LIKE ?)").join(" OR ");
    const likeArgs = words.flatMap((w) => Array(5).fill(`%${w}%`));
    row = (await db.execute({ sql: `${select} ${excludeSql} AND (${like}) ORDER BY RANDOM() LIMIT 1`, args: [...baseArgs, ...likeArgs] })).rows[0];
    if (!row) fallback = true;
  }
  if (!row) row = (await db.execute({ sql: `${select} ${excludeSql} ORDER BY RANDOM() LIMIT 1`, args: baseArgs })).rows[0];
  if (!row) return res.status(404).json({ error: "No hay más preguntas disponibles en esta dificultad" });
  res.json({ question: row, fallback });
});

// Comodín 50/50: devuelve dos opciones incorrectas para ocultar. No revela cuál es la correcta.
router.post("/fifty", async (req, res) => {
  const questionId = Number(req.body?.questionId);
  if (!Number.isInteger(questionId)) return res.status(400).json({ error: "Datos inválidos" });
  const row = (await db.execute({ sql: "SELECT correct_answer FROM duel_questions WHERE id = ?", args: [questionId] })).rows[0];
  if (!row) return res.status(404).json({ error: "Pregunta no encontrada" });
  const wrong = ["a", "b", "c", "d"].filter((l) => l !== row.correct_answer).sort(() => Math.random() - 0.5).slice(0, 2);
  res.json({ remove: wrong });
});

router.post("/answer", async (req, res) => {
  const questionId = Number(req.body?.questionId);
  const answer = String(req.body?.answer || "");
  if (!Number.isInteger(questionId) || !["a", "b", "c", "d"].includes(answer)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const result = await db.execute({
    sql: "SELECT correct_answer FROM duel_questions WHERE id = ?",
    args: [questionId],
  });
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "Pregunta no encontrada" });

  res.json({ correct: row.correct_answer === answer });
});

export default router;
