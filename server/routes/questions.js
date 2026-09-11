import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr, settleDailyScoreIfComplete, getCurrentStreak, getBestStreak } from "../utils/points.js";

const router = Router();
router.use(requireAuth);

// Anti-Google casero: cuando alguien pide las preguntas de hoy, anotamos la
// hora. Si una respuesta llega mucho después de esa hora (más tiempo del que
// da el cronómetro de la pantalla + margen de red), se cuenta como
// incorrecta sin importar qué haya marcado — así no alcanza con tenerla
// abierta un rato y googlear la respuesta con calma. Vive en memoria nomás
// (se resetea si el server reinicia): es una traba disuasiva, no una
// auditoría de seguridad, y no vale la pena una tabla nueva para esto.
const firstServedAt = new Map(); // `${userId}:${dateStr}` -> timestamp (ms)
const SECONDS_PER_QUESTION = 20;
const GRACE_SECONDS = 15; // margen por latencia de red + tiempo de lectura del enunciado
const MAX_QUESTIONS_PER_DAY = 3;
const TIME_BUDGET_MS = (SECONDS_PER_QUESTION + GRACE_SECONDS) * MAX_QUESTIONS_PER_DAY * 1000;

function markServed(userId, dateStr) {
  const key = `${userId}:${dateStr}`;
  if (!firstServedAt.has(key)) firstServedAt.set(key, Date.now());
}

function isWithinTimeBudget(userId, dateStr) {
  const key = `${userId}:${dateStr}`;
  const servedAt = firstServedAt.get(key);
  if (!servedAt) return true; // el server se reinició o no pasó por /today: no penalizamos por eso
  return Date.now() - servedAt <= TIME_BUDGET_MS;
}

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

    markServed(req.userId, today);

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

    // Si la respuesta llega pasado el tiempo que tuvo la pregunta en pantalla
    // (cronómetro + margen), se cuenta como incorrecta sin importar qué haya
    // marcado — evita el truco de dejarla abierta y googlear con calma.
    const onTime = isWithinTimeBudget(req.userId, today);
    const is_correct = onTime && answer === question.correct_answer;

    await db.execute({
      sql: `INSERT INTO answers (user_id, question_id, answer, is_correct, points)
            VALUES (?, ?, ?, ?, 0)`,
      args: [req.userId, questionId, answer, is_correct ? 1 : 0],
    });

    // Recién cuando completa las 3 preguntas de hoy se sabe su % de acierto
    // final, así que ahí se calcula el puesto del día y se le suman los
    // puntos correspondientes a ESA respuesta (la que cerró el día).
    const settlement = await settleDailyScoreIfComplete(req.userId, today);
    const points = settlement?.points ?? 0;
    if (settlement) {
      await db.execute({
        sql: "UPDATE answers SET points = ? WHERE user_id = ? AND question_id = ?",
        args: [points, req.userId, questionId],
      });
    }

    const current_streak = await getCurrentStreak(req.userId);

    res.status(201).json({
      is_correct,
      points,
      correct_answer: question.correct_answer,
      current_streak,
      timedOut: !onTime,
      dailyRank: settlement?.rank ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Comodín 50/50: descarta dos opciones incorrectas sin revelar cuál es la
// correcta ni consumir el intento (eso pasa recién al responder).
router.post("/:id/fifty", async (req, res) => {
  const questionId = Number(req.params.id);
  try {
    const qResult = await db.execute({ sql: "SELECT * FROM questions WHERE id = ?", args: [questionId] });
    const question = qResult.rows[0];
    if (!question) return res.status(404).json({ error: "Pregunta no encontrada" });

    const existing = await db.execute({
      sql: "SELECT id FROM answers WHERE user_id = ? AND question_id = ?",
      args: [req.userId, questionId],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Ya respondiste esta pregunta" });
    }

    const wrongKeys = ["a", "b", "c", "d"].filter((k) => k !== question.correct_answer);
    const eliminate = wrongKeys.sort(() => Math.random() - 0.5).slice(0, 2);

    res.json({ eliminate });
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
