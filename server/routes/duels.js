import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { sendToUser } from "../utils/push.js";

// Un duelo depende de que el otro se entere. Si el aviso falla (no tiene
// notificaciones activadas, se le venció la suscripción) el duelo sigue su
// curso igual: nunca debe romper la jugada.
async function notify(userId, body) {
  try {
    await sendToUser(userId, { title: "Futotal", body, url: "/duelos" });
  } catch (err) {
    console.error("no se pudo avisar del duelo:", err.message);
  }
}

async function usernameOf(userId) {
  const result = await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [userId] });
  return result.rows[0]?.username ?? "Alguien";
}

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

  // El aviso sale una sola vez: el UPDATE de arriba deja el duelo en
  // 'terminado' y esta función corta al principio si ya lo estaba.
  const [challengerName, opponentName] = await Promise.all([
    usernameOf(duel.challenger_id),
    usernameOf(duel.opponent_id),
  ]);
  const resultado = (rival, miScore, suScore) =>
    miScore === suScore
      ? `Empataste ${miScore}-${suScore} con ${rival}.`
      : miScore > suScore
        ? `¡Le ganaste a ${rival} ${miScore}-${suScore}!`
        : `${rival} te ganó ${suScore}-${miScore}.`;

  await Promise.all([
    notify(
      duel.challenger_id,
      `Terminó tu duelo. ${resultado(opponentName, challengerCorrect, opponentCorrect)}`
    ),
    notify(
      duel.opponent_id,
      `Terminó tu duelo. ${resultado(challengerName, opponentCorrect, challengerCorrect)}`
    ),
  ]);

  return {
    ...duel,
    challenger_correct: challengerCorrect,
    opponent_correct: opponentCorrect,
    winner_id: winnerId,
    status: "terminado",
  };
}

// Comodín semanal: "doble o nada". Cada lado del duelo puede jugárselo con
// su propio comodín (uno por persona por semana, en cualquier duelo). Si lo
// activaste y ganás, el doble de puntos; si empatás o perdés, cero — ni
// siquiera el consuelo del empate. Exportada porque stats.js necesita el
// mismo cálculo para el ranking general del grupo, no solo esta pantalla.
export function duelSidePoints(difficulty, outcome, wildcard) {
  if (outcome === "draw") {
    const base = duelPointsFor(difficulty, "draw");
    return wildcard ? 0 : base;
  }
  const won = outcome === "win";
  const base = won ? duelPointsFor(difficulty, "win") : 0;
  return wildcard ? base * 2 : base;
}

function pointsFor(duel, userId) {
  if (duel.status !== "terminado") return 0;
  const iAmChallenger = duel.challenger_id === userId;
  const wildcard = !!(iAmChallenger ? duel.challenger_wildcard : duel.opponent_wildcard);
  const outcome = duel.winner_id === null ? "draw" : duel.winner_id === userId ? "win" : "loss";
  return duelSidePoints(duel.difficulty, outcome, wildcard);
}

function currentWeekKeyOf(userId) {
  return db.execute({
    sql: `SELECT 1 FROM duels
          WHERE ((challenger_id = ? AND challenger_wildcard = 1) OR (opponent_id = ? AND opponent_wildcard = 1))
            AND strftime('%Y-%W', created_at) = strftime('%Y-%W', 'now')
          LIMIT 1`,
    args: [userId, userId],
  });
}

// Un solo comodín por persona por semana (se cuenta por jornada calendaria,
// no por grupo) — cualquiera de los duelos donde ya lo usaste esta semana
// lo consume, sea que lo hayas activado al desafiar o al aceptar.
async function wildcardUsedThisWeek(userId) {
  const result = await currentWeekKeyOf(userId);
  return result.rows.length > 0;
}

// Desafiar a alguien del grupo.
router.post("/", async (req, res) => {
  const groupId = Number(req.body?.group_id);
  const opponentId = Number(req.body?.opponent_id);
  const difficulty = req.body?.difficulty ?? DEFAULT_DIFFICULTY;
  const useWildcard = !!req.body?.use_wildcard;

  if (!groupId || !opponentId) return res.status(400).json({ error: "Faltan campos requeridos" });
  if (!DUEL_DIFFICULTIES[difficulty]) return res.status(400).json({ error: "Dificultad inválida" });
  if (opponentId === req.userId) {
    return res.status(400).json({ error: "No podés desafiarte a vos mismo" });
  }

  try {
    if (useWildcard && (await wildcardUsedThisWeek(req.userId))) {
      return res.status(409).json({ error: "Ya usaste tu comodín de esta semana" });
    }
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
      sql: `INSERT INTO duels (group_id, challenger_id, opponent_id, question_ids, difficulty, challenger_wildcard)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        groupId,
        req.userId,
        opponentId,
        JSON.stringify(questions.rows.map((q) => q.id)),
        difficulty,
        useWildcard ? 1 : 0,
      ],
    });

    await notify(
      opponentId,
      `${await usernameOf(req.userId)} te desafió a un duelo ${DUEL_DIFFICULTIES[difficulty].label}${useWildcard ? " y jugó su comodín (doble o nada)" : ""}.`
    );

    res.status(201).json({ id: Number(inserted.lastInsertRowid) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Activar tu propio comodín sobre un duelo ya creado (típicamente el
// desafiado, que no pudo elegirlo al crear el duelo). Solo antes de empezar
// a responder: una vez que ya viste una pregunta no vale apostar a lo
// seguro con información de más.
router.post("/:id/wildcard", async (req, res) => {
  const duelId = Number(req.params.id);

  try {
    const result = await db.execute({ sql: "SELECT * FROM duels WHERE id = ?", args: [duelId] });
    const duel = result.rows[0];
    if (!duel) return res.status(404).json({ error: "Duelo no encontrado" });
    if (duel.challenger_id !== req.userId && duel.opponent_id !== req.userId) {
      return res.status(403).json({ error: "Este duelo no es tuyo" });
    }
    if (duel.status !== "esperando") return res.status(400).json({ error: "Este duelo ya terminó" });

    const iAmChallenger = duel.challenger_id === req.userId;
    if (iAmChallenger ? duel.challenger_wildcard : duel.opponent_wildcard) {
      return res.status(409).json({ error: "Ya activaste el comodín en este duelo" });
    }

    const mine = await answersOf(duelId, req.userId);
    if (mine.length > 0) return res.status(400).json({ error: "Ya empezaste a responder, es tarde para el comodín" });

    if (await wildcardUsedThisWeek(req.userId)) {
      return res.status(409).json({ error: "Ya usaste tu comodín de esta semana" });
    }

    await db.execute({
      sql: `UPDATE duels SET ${iAmChallenger ? "challenger_wildcard" : "opponent_wildcard"} = 1 WHERE id = ?`,
      args: [duelId],
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Set de preguntas al azar para el modo Supervivencia grupal (juego en vivo,
// no persistido en DB — el anfitrión reparte las preguntas por WebSocket y
// necesita conocer la respuesta correcta para arbitrar en el momento).
router.get("/random-set", async (req, res) => {
  const difficulty = req.query.difficulty ?? DEFAULT_DIFFICULTY;
  const count = Math.max(1, Math.min(30, Number(req.query.count) || 10));

  if (!DUEL_DIFFICULTIES[difficulty]) return res.status(400).json({ error: "Dificultad inválida" });

  try {
    const result = await db.execute({
      sql: `SELECT id, question, option_a, option_b, option_c, option_d, correct_answer
            FROM duel_questions WHERE difficulty = ? ORDER BY RANDOM() LIMIT ?`,
      args: [difficulty, count],
    });
    res.json({ questions: result.rows });
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
    const wildcardAvailable = !(await wildcardUsedThisWeek(req.userId));

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

      const myWildcard = !!(iAmChallenger ? duel.challenger_wildcard : duel.opponent_wildcard);
      const rivalWildcard = !!(iAmChallenger ? duel.opponent_wildcard : duel.challenger_wildcard);

      duels.push({
        id: duel.id,
        status: duel.status,
        my_wildcard: myWildcard,
        rival_wildcard: rivalWildcard,
        can_activate_wildcard: duel.status === "esperando" && !myWildcard && myAnswers.length === 0 && wildcardAvailable,
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

    res.json({ duels, record, difficulties: DUEL_DIFFICULTIES, wildcard_available: wildcardAvailable });
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
