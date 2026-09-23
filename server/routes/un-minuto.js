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

router.get("/question", async (req, res) => {
  const difficulty = difficultyOf(req.query.difficulty);
  const exclude = String(req.query.exclude || "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));

  const placeholders = exclude.map(() => "?").join(",");
  const sql = exclude.length > 0
    ? `SELECT id, question, option_a, option_b, option_c, option_d FROM duel_questions WHERE difficulty = ? AND id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`
    : `SELECT id, question, option_a, option_b, option_c, option_d FROM duel_questions WHERE difficulty = ? ORDER BY RANDOM() LIMIT 1`;

  const result = await db.execute({ sql, args: [difficulty, ...exclude] });
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "No hay más preguntas disponibles en esta dificultad" });
  res.json({ question: row });
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
