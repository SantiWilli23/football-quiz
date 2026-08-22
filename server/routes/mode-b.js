import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import {
  MODE_B_EMOJIS,
  MODE_B_POINTS,
  QUESTION_KINDS,
  getDayQuestions,
  reactionsFor,
  settleGroup,
  tallyFor,
  winnersOf,
} from "../utils/mode-b.js";

const router = Router();
router.use(requireAuth);

const PERSONALITY_TEMPLATES = [
  {
    prompt: "Si {name} fuera a la cárcel, ¿por qué sería?",
    options: [
      "Por abusar de cebollitas al pedir gol",
      "Por arruinar predicciones con análisis",
      "Por festejar goles como si ganara Libertadores",
      "Por llevar 10 camisetas al partido",
    ],
  },
  {
    prompt: "Si {name} fuera entrenador, ¿cuál sería su estrategia?",
    options: [
      "Todos atacan aunque pierdan 5-0",
      "Todos defienden aunque ganen",
      "Tácticas que solo funcionan en teoría",
      "Cambios cada 5 minutos sin razón",
    ],
  },
  {
    prompt: "Si {name} fuera árbitro, ¿qué pasaría?",
    options: [
      "Expulsaría a quien le reclame",
      "Solo pitaría si come cebollitas",
      "Haría más goles que los jugadores",
      "Se dormiría durante el partido",
    ],
  },
  {
    prompt: "Si {name} ganara la Libertadores, ¿qué haría?",
    options: [
      "Lloraría por 3 días seguidos",
      "Cambiaría su apellido al del club",
      "Se tatúaría la copa en la frente",
      "Renunciaría al fútbol de puro feliz",
    ],
  },
  {
    prompt: "Si {name} fuera comentarista, ¿qué diría?",
    options: [
      "Opiniones controversiales cada 5 segundos",
      "Comparaciones con partidos hace 30 años",
      "Gritos que despertarían al barrio",
      "Análisis que nadie entiende",
    ],
  },
  {
    prompt: "Si {name} fuera presidente del club, ¿qué sería lo primero que haría?",
    options: [
      "Vender a todos y empezar de cero",
      "Fichar a un ídolo retirado hace 10 años",
      "Cambiarle el color a la camiseta",
      "Ponerse a sí mismo de titular",
    ],
  },
  {
    prompt: "Si {name} jugara en tu equipo, ¿en qué puesto lo pondrías?",
    options: [
      "Arquero, porque nadie más quiere",
      "Defensor que solo revienta la pelota",
      "Enganche que nunca pasa",
      "En el banco, dando indicaciones",
    ],
  },
  {
    prompt: "Si {name} fuera relator, ¿cuál sería su marca registrada?",
    options: [
      "Un grito de gol de 40 segundos",
      "Nombrar mal a todos los jugadores",
      "Spoilear el resultado antes de tiempo",
      "Llorar en cada gol importante",
    ],
  },
  {
    prompt: "Si {name} fuera el técnico y van perdiendo 3-0, ¿qué hace?",
    options: [
      "Mete tres delanteros de una",
      "Se queda sentado sin decir nada",
      "Se pelea con el cuarto árbitro",
      "Culpa al campo de juego",
    ],
  },
  {
    prompt: "Si {name} fuera hincha del rival por un día, ¿qué pasaría?",
    options: [
      "Se convierte y no vuelve nunca",
      "Va a la cancha con la camiseta abajo",
      "Lo niega hasta el final de sus días",
      "Aprovecha para hacer sufrir al grupo",
    ],
  },
  {
    prompt: "Si {name} tuviera que elegir entre el fútbol y algo más, ¿qué elegiría?",
    options: [
      "El fútbol, sin pensarlo un segundo",
      "Lo pensaría demasiado tiempo",
      "Diría que el fútbol y mentiría",
      "Elegiría dormir la siesta",
    ],
  },
  {
    prompt: "Si {name} fuera jugador profesional, ¿por qué sería famoso?",
    options: [
      "Por sus festejos exagerados",
      "Por las tarjetas rojas",
      "Por las entrevistas polémicas",
      "Por estar siempre lesionado",
    ],
  },
];

async function requireMembership(groupId, userId) {
  const membership = await db.execute({
    sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return membership.rows.length > 0;
}

// Elige el elemento que hace más tiempo no aparece. `recent` viene ordenado del
// uso más nuevo al más viejo, así que el que nunca salió gana siempre.
function leastRecentlyUsed(candidates, recent, keyOf) {
  let best = candidates[0];
  let bestDistance = -1;
  for (const candidate of candidates) {
    const rank = recent.indexOf(keyOf(candidate));
    const distance = rank === -1 ? Infinity : rank;
    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

// La pregunta de personalidad se fija una vez por grupo y día. El protagonista
// y la plantilla rotan: sale el miembro que hace más tiempo no le toca, en vez
// de sortear al azar y repetir a la misma persona días seguidos.
async function getOrCreatePersonalityQuestion(groupId, today, members) {
  const existing = await db.execute({
    sql: "SELECT * FROM personality_questions WHERE group_id = ? AND scheduled_date = ?",
    args: [groupId, today],
  });
  if (existing.rows.length > 0) return existing.rows[0];

  const historyResult = await db.execute({
    sql: `SELECT personality_name, option_a FROM personality_questions
          WHERE group_id = ? AND scheduled_date < ?
          ORDER BY scheduled_date DESC LIMIT 30`,
    args: [groupId, today],
  });
  const recentNames = historyResult.rows.map((r) => r.personality_name);
  // option_a identifica la plantilla sin tener que guardar un índice aparte.
  const recentTemplates = historyResult.rows.map((r) => r.option_a);

  const member = leastRecentlyUsed(members, recentNames, (m) => m.username);
  const template = leastRecentlyUsed(PERSONALITY_TEMPLATES, recentTemplates, (t) => t.options[0]);
  const prompt = template.prompt.replace("{name}", member.username);

  const insertResult = await db.execute({
    sql: `INSERT INTO personality_questions
      (group_id, personality_name, prompt_template, option_a, option_b, option_c, option_d, scheduled_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      groupId,
      member.username,
      prompt,
      template.options[0],
      template.options[1],
      template.options[2],
      template.options[3],
      today,
    ],
  });

  return {
    id: Number(insertResult.lastInsertRowid),
    group_id: groupId,
    personality_name: member.username,
    prompt_template: prompt,
    option_a: template.options[0],
    option_b: template.options[1],
    option_c: template.options[2],
    option_d: template.options[3],
    scheduled_date: today,
  };
}

async function myAnswerFor(kind, questionId, groupId, userId) {
  const result =
    kind === "personalidad"
      ? await db.execute({
          sql: `SELECT answer AS value FROM personality_answers
                WHERE personality_question_id = ? AND group_id = ? AND user_id = ?`,
          args: [questionId, groupId, userId],
        })
      : await db.execute({
          sql: `SELECT answer_value AS value FROM special_answers
                WHERE special_question_id = ? AND group_id = ? AND user_id = ?`,
          args: [questionId, groupId, userId],
        });
  return result.rows.length > 0 ? String(result.rows[0].value) : null;
}

async function myPredictionFor(kind, questionId, groupId, userId) {
  const result = await db.execute({
    sql: `SELECT predicted_value FROM mode_b_predictions
          WHERE question_kind = ? AND question_id = ? AND group_id = ? AND user_id = ?`,
    args: [kind, questionId, groupId, userId],
  });
  return result.rows.length > 0 ? String(result.rows[0].predicted_value) : null;
}

// Los resultados quedan tapados hasta que votás Y predecís. Si se vieran antes,
// acertar la predicción sería mirar el marcador en vez de jugar.
async function buildQuestionPayload(kind, question, groupId, userId, options) {
  const my_answer = await myAnswerFor(kind, question.id, groupId, userId);
  const my_prediction = await myPredictionFor(kind, question.id, groupId, userId);
  const revealed = !!my_answer && !!my_prediction;

  const payload = {
    kind,
    id: question.id,
    my_answer,
    my_prediction,
    revealed,
    options,
    ...(kind === "personalidad"
      ? { prompt: question.prompt_template, personality: question.personality_name }
      : { prompt: question.prompt }),
  };

  if (revealed) {
    const tally = await tallyFor(kind, question.id, groupId);
    const winners = winnersOf(tally);
    payload.results = options.map((o) => ({
      value: o.value,
      votes: tally.get(String(o.value)) || 0,
    }));
    payload.total_votes = [...tally.values()].reduce((sum, n) => sum + n, 0);
    payload.winners = winners;
    payload.prediction_hit = winners.includes(String(my_prediction));
    payload.reactions = await reactionsFor(kind, question.id, groupId, userId);
  }

  return payload;
}

router.get("/today", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    // Cierra los días pendientes antes de responder, así los puntos y el
    // ranking que se muestran después ya están al día.
    await settleGroup(groupId);

    const today = todayStr();
    const dayQuestions = await getDayQuestions(groupId, today);
    if (!dayQuestions.quien_es_mas || !dayQuestions.que_prefieres) {
      return res.status(404).json({ error: "No hay preguntas especiales para hoy" });
    }

    const membersResult = await db.execute({
      sql: `SELECT u.id, u.username, u.avatar FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
            ORDER BY u.username`,
      args: [groupId],
    });
    const members = membersResult.rows;
    if (members.length === 0) {
      return res.status(400).json({ error: "El grupo no tiene miembros" });
    }

    const personalityQ = await getOrCreatePersonalityQuestion(groupId, today, members);

    const [quien_es_mas, que_prefieres, personalidad] = await Promise.all([
      buildQuestionPayload(
        "quien_es_mas",
        dayQuestions.quien_es_mas,
        groupId,
        req.userId,
        members.map((m) => ({ value: String(m.id), label: m.username, avatar: m.avatar }))
      ),
      buildQuestionPayload("que_prefieres", dayQuestions.que_prefieres, groupId, req.userId, [
        { value: "a", label: dayQuestions.que_prefieres.option_a },
        { value: "b", label: dayQuestions.que_prefieres.option_b },
      ]),
      buildQuestionPayload("personalidad", personalityQ, groupId, req.userId, [
        { value: "a", label: personalityQ.option_a },
        { value: "b", label: personalityQ.option_b },
        { value: "c", label: personalityQ.option_c },
        { value: "d", label: personalityQ.option_d },
      ]),
    ]);

    res.json({ date: today, points_rules: MODE_B_POINTS, quien_es_mas, que_prefieres, personalidad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Carga una pregunta validando que exista, sea del tipo pedido y (para
// personalidad) pertenezca al grupo.
async function loadQuestion(kind, questionId, groupId) {
  if (kind === "personalidad") {
    const result = await db.execute({
      sql: "SELECT * FROM personality_questions WHERE id = ? AND group_id = ?",
      args: [questionId, groupId],
    });
    return result.rows[0] || null;
  }
  const result = await db.execute({
    sql: "SELECT * FROM special_questions WHERE id = ? AND type = ?",
    args: [questionId, kind],
  });
  return result.rows[0] || null;
}

async function isValidValue(kind, groupId, value) {
  if (kind === "quien_es_mas") return requireMembership(groupId, Number(value));
  if (kind === "que_prefieres") return value === "a" || value === "b";
  return ["a", "b", "c", "d"].includes(value);
}

router.post("/answer", async (req, res) => {
  const { question_kind, question_id, group_id, value } = req.body || {};

  if (!QUESTION_KINDS.includes(question_kind) || !question_id || !group_id || !value) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    if (!(await requireMembership(group_id, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const question = await loadQuestion(question_kind, Number(question_id), group_id);
    if (!question) return res.status(404).json({ error: "Pregunta no encontrada" });
    if (question.scheduled_date !== todayStr()) {
      return res.status(400).json({ error: "Solo puedes responder la pregunta de hoy" });
    }
    if (!(await isValidValue(question_kind, group_id, String(value)))) {
      return res.status(400).json({ error: "Respuesta inválida" });
    }
    if (await myAnswerFor(question_kind, question.id, group_id, req.userId)) {
      return res.status(409).json({ error: "Ya respondiste esta pregunta" });
    }

    if (question_kind === "personalidad") {
      await db.execute({
        sql: `INSERT INTO personality_answers (personality_question_id, group_id, user_id, answer)
              VALUES (?, ?, ?, ?)`,
        args: [question.id, group_id, req.userId, String(value)],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO special_answers (special_question_id, group_id, user_id, answer_value)
              VALUES (?, ?, ?, ?)`,
        args: [question.id, group_id, req.userId, String(value)],
      });
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/predict", async (req, res) => {
  const { question_kind, question_id, group_id, value } = req.body || {};

  if (!QUESTION_KINDS.includes(question_kind) || !question_id || !group_id || !value) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    if (!(await requireMembership(group_id, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const question = await loadQuestion(question_kind, Number(question_id), group_id);
    if (!question) return res.status(404).json({ error: "Pregunta no encontrada" });
    if (question.scheduled_date !== todayStr()) {
      return res.status(400).json({ error: "Solo puedes predecir la pregunta de hoy" });
    }
    if (!(await isValidValue(question_kind, group_id, String(value)))) {
      return res.status(400).json({ error: "Predicción inválida" });
    }
    if (!(await myAnswerFor(question_kind, question.id, group_id, req.userId))) {
      return res.status(400).json({ error: "Primero respondé la pregunta" });
    }
    if (await myPredictionFor(question_kind, question.id, group_id, req.userId)) {
      return res.status(409).json({ error: "Ya hiciste tu predicción" });
    }

    await db.execute({
      sql: `INSERT INTO mode_b_predictions (question_kind, question_id, group_id, user_id, predicted_value)
            VALUES (?, ?, ?, ?, ?)`,
      args: [question_kind, question.id, group_id, req.userId, String(value)],
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/react", async (req, res) => {
  const { question_kind, question_id, group_id, emoji } = req.body || {};

  if (!QUESTION_KINDS.includes(question_kind) || !question_id || !group_id) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }
  if (!MODE_B_EMOJIS.includes(emoji)) {
    return res.status(400).json({ error: "Emoji no permitido" });
  }

  try {
    if (!(await requireMembership(group_id, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const question = await loadQuestion(question_kind, Number(question_id), group_id);
    if (!question) return res.status(404).json({ error: "Pregunta no encontrada" });

    const existing = await db.execute({
      sql: `SELECT id FROM mode_b_reactions
            WHERE question_kind = ? AND question_id = ? AND group_id = ? AND user_id = ? AND emoji = ?`,
      args: [question_kind, question.id, group_id, req.userId, emoji],
    });

    if (existing.rows.length > 0) {
      await db.execute({ sql: "DELETE FROM mode_b_reactions WHERE id = ?", args: [existing.rows[0].id] });
    } else {
      await db.execute({
        sql: `INSERT INTO mode_b_reactions (question_kind, question_id, group_id, user_id, emoji)
              VALUES (?, ?, ?, ?, ?)`,
        args: [question_kind, question.id, group_id, req.userId, emoji],
      });
    }

    res.json({ reactions: await reactionsFor(question_kind, question.id, group_id, req.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/history", async (req, res) => {
  const groupId = Number(req.query.groupId);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 7;

  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    await settleGroup(groupId);

    const datesResult = await db.execute({
      sql: `SELECT DISTINCT scheduled_date AS date FROM mode_b_scores
            WHERE group_id = ? AND scheduled_date < ?
            ORDER BY scheduled_date DESC`,
      args: [groupId, todayStr()],
    });
    const allDates = datesResult.rows.map((r) => r.date);
    const pageDates = allDates.slice((page - 1) * pageSize, page * pageSize);

    const membersResult = await db.execute({
      sql: `SELECT u.id, u.username FROM group_members gm
            JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?`,
      args: [groupId],
    });
    const usernameById = new Map(membersResult.rows.map((m) => [String(m.id), m.username]));

    const labelFor = (kind, question, value) => {
      if (value === null || value === undefined) return null;
      if (kind === "quien_es_mas") return usernameById.get(String(value)) || "—";
      const map = { a: question.option_a, b: question.option_b, c: question.option_c, d: question.option_d };
      return map[value] ?? null;
    };

    const days = [];
    for (const date of pageDates) {
      const dayQuestions = await getDayQuestions(groupId, date);
      const scoreResult = await db.execute({
        sql: "SELECT * FROM mode_b_scores WHERE group_id = ? AND scheduled_date = ? AND user_id = ?",
        args: [groupId, date, req.userId],
      });
      const score = scoreResult.rows[0];

      const questions = [];
      for (const kind of QUESTION_KINDS) {
        const question = dayQuestions[kind];
        if (!question) continue;

        const tally = await tallyFor(kind, question.id, groupId);
        const winners = winnersOf(tally);
        const my_answer = await myAnswerFor(kind, question.id, groupId, req.userId);
        const my_prediction = await myPredictionFor(kind, question.id, groupId, req.userId);

        questions.push({
          kind,
          prompt: kind === "personalidad" ? question.prompt_template : question.prompt,
          your_answer: labelFor(kind, question, my_answer),
          your_prediction: labelFor(kind, question, my_prediction),
          winner: winners.length > 0 ? winners.map((w) => labelFor(kind, question, w)).join(" / ") : null,
          prediction_hit: my_prediction !== null && winners.includes(String(my_prediction)),
          total_votes: [...tally.values()].reduce((sum, n) => sum + n, 0),
        });
      }

      days.push({
        date,
        points: score ? Number(score.points) : 0,
        answered_count: score ? Number(score.answered_count) : 0,
        correct_predictions: score ? Number(score.correct_predictions) : 0,
        questions,
      });
    }

    res.json({
      days,
      page,
      pageSize,
      total: allDates.length,
      totalPages: Math.max(1, Math.ceil(allDates.length / pageSize)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
