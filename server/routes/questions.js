import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr, computePoints, getCurrentStreak, getBestStreak } from "../utils/points.js";

const router = Router();
router.use(requireAuth);

function publicQuestion(q) {
  return {
    id: q.id,
    question: q.question,
    category: q.category,
    difficulty: q.difficulty,
    slot: q.slot,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    scheduled_date: q.scheduled_date,
  };
}

router.get("/today", async (req, res) => {
  try {
    const today = todayStr();
    const qResult = await db.execute({
      sql: "SELECT * FROM questions WHERE scheduled_date = ? ORDER BY slot ASC",
      args: [today],
    });
    if (qResult.rows.length === 0) {
      return res.status(404).json({ error: "No hay preguntas programadas para hoy" });
    }

    const answersResult = await db.execute({
      sql: `SELECT * FROM answers WHERE user_id = ? AND question_id IN (${qResult.rows.map(() => "?").join(",")})`,
      args: [req.userId, ...qResult.rows.map((q) => q.id)],
    });
    const answersByQuestionId = new Map(answersResult.rows.map((a) => [a.question_id, a]));

    const questions = qResult.rows.map((question) => {
      const answered = answersByQuestionId.get(question.id);
      if (answered) {
        return {
          question: publicQuestion(question),
          answered: true,
          result: {
            answer: answered.answer,
            is_correct: !!answered.is_correct,
            points: answered.points,
            correct_answer: question.correct_answer,
          },
        };
      }
      return { question: publicQuestion(question), answered: false };
    });

    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/:id/answer", async (req, res) => {
  const questionId = Number(req.params.id);
  const { answer } = req.body || {};

  if (!["a", "b", "c", "d"].includes(answer)) {
    return res.status(400).json({ error: "Respuesta inválida" });
  }

  try {
    const today = todayStr();
    const qResult = await db.execute({ sql: "SELECT * FROM questions WHERE id = ?", args: [questionId] });
    const question = qResult.rows[0];
    if (!question) return res.status(404).json({ error: "Pregunta no encontrada" });
    if (question.scheduled_date !== today) {
      return res.status(400).json({ error: "Solo puedes responder la pregunta de hoy" });
    }

    const existing = await db.execute({
      sql: "SELECT id FROM answers WHERE user_id = ? AND question_id = ?",
      args: [req.userId, questionId],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Ya respondiste esta pregunta" });
    }

    const is_correct = answer === question.correct_answer;
    const { points } = await computePoints(req.userId, today, is_correct);

    await db.execute({
      sql: `INSERT INTO answers (user_id, question_id, answer, is_correct, points)
            VALUES (?, ?, ?, ?, ?)`,
      args: [req.userId, questionId, answer, is_correct ? 1 : 0, points],
    });

    const current_streak = await getCurrentStreak(req.userId);

    res.status(201).json({
      is_correct,
      points,
      correct_answer: question.correct_answer,
      current_streak,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/streak", async (req, res) => {
  try {
    const [current_streak, best_streak] = await Promise.all([
      getCurrentStreak(req.userId),
      getBestStreak(req.userId),
    ]);
    res.json({ current_streak, best_streak });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const filter = req.query.filter;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    let filterSql = "";
    if (filter === "correct") filterSql = "AND a.is_correct = 1";
    else if (filter === "incorrect") filterSql = "AND a.is_correct = 0";

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM answers a WHERE a.user_id = ? ${filterSql}`,
      args: [req.userId],
    });
    const total = Number(countResult.rows[0].total);

    const rowsResult = await db.execute({
      sql: `SELECT a.answer, a.is_correct, a.points, a.answered_at,
                   q.question, q.category, q.difficulty, q.correct_answer, q.scheduled_date
            FROM answers a
            JOIN questions q ON q.id = a.question_id
            WHERE a.user_id = ? ${filterSql}
            ORDER BY q.scheduled_date DESC, q.slot DESC
            LIMIT ? OFFSET ?`,
      args: [req.userId, pageSize, offset],
    });

    res.json({
      history: rowsResult.rows.map((r) => ({
        question: r.question,
        category: r.category,
        difficulty: r.difficulty,
        your_answer: r.answer,
        correct_answer: r.correct_answer,
        is_correct: !!r.is_correct,
        points: r.points,
        scheduled_date: r.scheduled_date,
        answered_at: r.answered_at,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
