import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const QUESTIONS_PER_DUEL = 5;

// Tres niveles, con premio acorde al riesgo: en demonio las preguntas son de
// datos que casi nadie tiene, así que ganar vale bastante más.
export const DUEL_DIFFICULTIES = {
  dificil: { label: "Difícil", win: 15, draw: 6 },
  ultra: { label: "Ultra difícil", win: 22, draw: 9 },
  demonio: { label: "Demonio", win: 32, draw: 13 },
};

export const DEFAULT_DIFFICULTY = "dificil";

// Los duelos viejos (anteriores a los niveles) quedaron marcados como
// 'dificil' por la migración, así que siempre hay una entrada válida.
export function duelPointsFor(difficulty, outcome) {
  const tier = DUEL_DIFFICULTIES[difficulty] ?? DUEL_DIFFICULTIES[DEFAULT_DIFFICULTY];
  if (outcome === "win") return tier.win;
  if (outcome === "draw") return tier.draw;
  return 0;
}

async function requireMembership(groupId, userId) {
  const result = await db.execute({
    sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return result.rows.length > 0;
}

function parseQuestionIds(duel) {
  try {
    const ids = JSON.parse(duel.question_ids);
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

async function answersOf(duelId, userId) {
  const result = await db.execute({
    sql: "SELECT question_id, answer, is_correct FROM duel_answers WHERE duel_id = ? AND user_id = ?",
    args: [duelId, userId],
  });
  return result.rows;
}

// Cierra el duelo cuando los dos terminaron sus cinco preguntas.
async function resolveIfComplete(duel) {
  if (duel.status === "terminado") return duel;

  const total = parseQuestionIds(duel).length;
  const challenger = await answersOf(duel.id, duel.challenger_id);
  const opponent = await answersOf(duel.id, duel.opponent_id);
  if (challenger.length < total || opponent.length < total) return duel;

  const challengerCorrect = challenger.filter((a) => a.is_correct).length;
  const opponentCorrect = opponent.filter((a) => a.is_correct).length;
  const winnerId =
    challengerCorrect === opponentCorrect
      ? null
      : challengerCorrect > opponentCorrect
        ? duel.challenger_id
        : duel.opponent_id;

  await db.execute({
    sql: `UPDATE duels SET challenger_correct = ?, opponent_correct = ?, winner_id = ?,
                 status = 'terminado', resolved_at = datetime('now')
          WHERE id = ?`,
    args: [challengerCorrect, opponentCorrect, winnerId, duel.id],
  });

  return {
    ...duel,
    challenger_correct: challengerCorrect,
    opponent_correct: opponentCorrect,
    winner_id: winnerId,
    status: "terminado",
  };
}

function pointsFor(duel, userId) {
  if (duel.status !== "terminado") return 0;
  if (duel.winner_id === null) return duelPointsFor(duel.difficulty, "draw");
  return duel.winner_id === userId ? duelPointsFor(duel.difficulty, "win") : 0;
}

// Desafiar a alguien del grupo.
router.post("/", async (req, res) => {
  const groupId = Number(req.body?.group_id);
  const opponentId = Number(req.body?.opponent_id);
  const difficulty = req.body?.difficulty ?? DEFAULT_DIFFICULTY;

  if (!groupId || !opponentId) return res.status(400).json({ error: "Faltan campos requeridos" });
  if (!DUEL_DIFFICULTIES[difficulty]) return res.status(400).json({ error: "Dificultad inválida" });
  if (opponentId === req.userId) {
    return res.status(400).json({ error: "No podés desafiarte a vos mismo" });
  }

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    if (!(await requireMembership(groupId, opponentId))) {
      return res.status(400).json({ error: "Esa persona no está en el grupo" });
    }

    // Un duelo abierto por par: si no, se acumulan desafíos sin jugar.
    const open = await db.execute({
      sql: `SELECT id FROM duels
            WHERE group_id = ? AND status = 'esperando'
              AND ((challenger_id = ? AND opponent_id = ?) OR (challenger_id = ? AND opponent_id = ?))`,
      args: [groupId, req.userId, opponentId, opponentId, req.userId],
    });
    if (open.rows.length > 0) {
      return res.status(409).json({ error: "Ya tenés un duelo abierto con esa persona" });
    }

    const questions = await db.execute({
      sql: "SELECT id FROM duel_questions WHERE difficulty = ? ORDER BY RANDOM() LIMIT ?",
      args: [difficulty, QUESTIONS_PER_DUEL],
    });
    if (questions.rows.length < QUESTIONS_PER_DUEL) {
      return res.status(503).json({ error: "No hay suficientes preguntas de ese nivel cargadas" });
    }

    const inserted = await db.execute({
      sql: `INSERT INTO duels (group_id, challenger_id, opponent_id, question_ids, difficulty)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        groupId,
        req.userId,
        opponentId,
        JSON.stringify(questions.rows.map((q) => q.id)),
        difficulty,
      ],
    });

    res.status(201).json({ id: Number(inserted.lastInsertRowid) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Mis duelos en el grupo, separados por lo que tengo que hacer con cada uno.
router.get("/", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const result = await db.execute({
      sql: `SELECT d.*, c.username AS challenger_name, c.avatar AS challenger_avatar,
                   c.avatar_config AS challenger_avatar_config,
                   o.username AS opponent_name, o.avatar AS opponent_avatar,
                   o.avatar_config AS opponent_avatar_config
            FROM duels d
            JOIN users c ON c.id = d.challenger_id
            JOIN users o ON o.id = d.opponent_id
            WHERE d.group_id = ? AND (d.challenger_id = ? OR d.opponent_id = ?)
            ORDER BY d.created_at DESC
            LIMIT 40`,
      args: [groupId, req.userId, req.userId],
    });

    const duels = [];
    let record = { won: 0, lost: 0, drawn: 0, points: 0 };

    for (const row of result.rows) {
      const duel = await resolveIfComplete(row);
      const total = parseQuestionIds(duel).length;
      const iAmChallenger = duel.challenger_id === req.userId;
      const rivalId = iAmChallenger ? duel.opponent_id : duel.challenger_id;
      const myAnswers = await answersOf(duel.id, req.userId);
      const rivalAnswers = await answersOf(duel.id, rivalId);

      if (duel.status === "terminado") {
        const points = pointsFor(duel, req.userId);
        record.points += points;
        if (duel.winner_id === null) record.drawn++;
        else if (duel.winner_id === req.userId) record.won++;
        else record.lost++;
      }

      duels.push({
        id: duel.id,
        status: duel.status,
        rival: {
          id: rivalId,
          username: iAmChallenger ? row.opponent_name : row.challenger_name,
          avatar: iAmChallenger ? row.opponent_avatar : row.challenger_avatar,
          avatar_config: iAmChallenger ? row.opponent_avatar_config : row.challenger_avatar_config,
        },
        i_challenged: iAmChallenger,
        difficulty: duel.difficulty ?? DEFAULT_DIFFICULTY,
        difficulty_label: (DUEL_DIFFICULTIES[duel.difficulty] ?? DUEL_DIFFICULTIES[DEFAULT_DIFFICULTY]).label,
        total_questions: total,
        my_answered: myAnswers.length,
        rival_answered: rivalAnswers.length,
        my_turn: myAnswers.length < total,
        my_correct:
          duel.status === "terminado"
            ? iAmChallenger
              ? duel.challenger_correct
              : duel.opponent_correct
            : null,
        rival_correct:
          duel.status === "terminado"
            ? iAmChallenger
              ? duel.opponent_correct
              : duel.challenger_correct
            : null,
        // Antes de terminar no se dice cómo le fue al rival: sabrías cuántas
        // tenés que acertar.
        result:
          duel.status !== "terminado"
            ? null
            : duel.winner_id === null
              ? "empate"
              : duel.winner_id === req.userId
                ? "ganado"
                : "perdido",
        points: duel.status === "terminado" ? pointsFor(duel, req.userId) : null,
        created_at: duel.created_at,
      });
    }

    res.json({ duels, record, difficulties: DUEL_DIFFICULTIES });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Las preguntas de un duelo. Sólo las que todavía no respondí, y sin la
// respuesta correcta hasta que conteste.
router.get("/:id", async (req, res) => {
  const duelId = Number(req.params.id);

  try {
    const result = await db.execute({ sql: "SELECT * FROM duels WHERE id = ?", args: [duelId] });
    const duel = result.rows[0];
    if (!duel) return res.status(404).json({ error: "Duelo no encontrado" });
    if (duel.challenger_id !== req.userId && duel.opponent_id !== req.userId) {
      return res.status(403).json({ error: "Este duelo no es tuyo" });
    }

    const ids = parseQuestionIds(duel);
    const questionsResult = await db.execute({
      sql: `SELECT id, question, option_a, option_b, option_c, option_d
            FROM duel_questions WHERE id IN (${ids.map(() => "?").join(",")})`,
      args: ids,
    });
    const byId = new Map(questionsResult.rows.map((q) => [q.id, q]));

    const mine = await answersOf(duelId, req.userId);
    const answeredIds = new Set(mine.map((a) => a.question_id));

    // Se mantiene el orden sorteado al crear el duelo, para que los dos vean
    // las mismas preguntas en la misma secuencia.
    const questions = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((q, index) => ({
        id: q.id,
        index: index + 1,
        question: q.question,
        options: [
          { value: "a", label: q.option_a },
          { value: "b", label: q.option_b },
          { value: "c", label: q.option_c },
          { value: "d", label: q.option_d },
        ],
        answered: answeredIds.has(q.id),
      }));

    res.json({
      id: duel.id,
      status: duel.status,
      difficulty: duel.difficulty ?? DEFAULT_DIFFICULTY,
      difficulty_label: (DUEL_DIFFICULTIES[duel.difficulty] ?? DUEL_DIFFICULTIES[DEFAULT_DIFFICULTY]).label,
      total_questions: ids.length,
      answered: mine.length,
      questions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/:id/answer", async (req, res) => {
  const duelId = Number(req.params.id);
  const questionId = Number(req.body?.question_id);
  const answer = req.body?.answer;

  if (!questionId || !["a", "b", "c", "d"].includes(answer)) {
    return res.status(400).json({ error: "Respuesta inválida" });
  }

  try {
    const result = await db.execute({ sql: "SELECT * FROM duels WHERE id = ?", args: [duelId] });
    const duel = result.rows[0];
    if (!duel) return res.status(404).json({ error: "Duelo no encontrado" });
    if (duel.challenger_id !== req.userId && duel.opponent_id !== req.userId) {
      return res.status(403).json({ error: "Este duelo no es tuyo" });
    }
    if (!parseQuestionIds(duel).includes(questionId)) {
      return res.status(400).json({ error: "Esa pregunta no es de este duelo" });
    }

    const questionResult = await db.execute({
      sql: "SELECT correct_answer FROM duel_questions WHERE id = ?",
      args: [questionId],
    });
    const question = questionResult.rows[0];
    if (!question) return res.status(404).json({ error: "Pregunta no encontrada" });

    const isCorrect = answer === question.correct_answer;

    try {
      await db.execute({
        sql: `INSERT INTO duel_answers (duel_id, user_id, question_id, answer, is_correct)
              VALUES (?, ?, ?, ?, ?)`,
        args: [duelId, req.userId, questionId, answer, isCorrect ? 1 : 0],
      });
    } catch {
      return res.status(409).json({ error: "Ya respondiste esa pregunta" });
    }

    const after = await resolveIfComplete(duel);
    const mine = await answersOf(duelId, req.userId);

    res.status(201).json({
      is_correct: isCorrect,
      correct_answer: question.correct_answer,
      answered: mine.length,
      total_questions: parseQuestionIds(duel).length,
      duel_status: after.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
