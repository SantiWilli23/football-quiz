import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";

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
];

async function requireMembership(groupId, userId) {
  const membership = await db.execute({
    sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return membership.rows.length > 0;
}

async function getOrCreatePersonalityQuestion(groupId, today, members) {
  const existing = await db.execute({
    sql: "SELECT * FROM personality_questions WHERE group_id = ? AND scheduled_date = ?",
    args: [groupId, today],
  });
  if (existing.rows.length > 0) return existing.rows[0];

  const member = members[Math.floor(Math.random() * members.length)];
  const template = PERSONALITY_TEMPLATES[Math.floor(Math.random() * PERSONALITY_TEMPLATES.length)];
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

router.get("/today", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const today = todayStr();

    const specialResult = await db.execute({
      sql: "SELECT * FROM special_questions WHERE scheduled_date = ?",
      args: [today],
    });
    const quienEsMasQ = specialResult.rows.find((q) => q.type === "quien_es_mas");
    const quePrefieresQ = specialResult.rows.find((q) => q.type === "que_prefieres");

    if (!quienEsMasQ || !quePrefieresQ) {
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

    // Respuestas de "quién es más": voto por un miembro del grupo.
    const quienEsMasVotes = await db.execute({
      sql: "SELECT user_id, answer_value FROM special_answers WHERE special_question_id = ? AND group_id = ?",
      args: [quienEsMasQ.id, groupId],
    });
    const myQuienEsMas = quienEsMasVotes.rows.find((v) => v.user_id === req.userId);
    const quienEsMasTally = new Map();
    for (const v of quienEsMasVotes.rows) {
      quienEsMasTally.set(v.answer_value, (quienEsMasTally.get(v.answer_value) || 0) + 1);
    }

    // Respuestas de "qué prefieres": 'a' o 'b'.
    const quePrefieresVotes = await db.execute({
      sql: "SELECT user_id, answer_value FROM special_answers WHERE special_question_id = ? AND group_id = ?",
      args: [quePrefieresQ.id, groupId],
    });
    const myQuePrefieres = quePrefieresVotes.rows.find((v) => v.user_id === req.userId);
    const votesA = quePrefieresVotes.rows.filter((v) => v.answer_value === "a").length;
    const votesB = quePrefieresVotes.rows.filter((v) => v.answer_value === "b").length;

    // Respuestas de personalidad: 'a'/'b'/'c'/'d'.
    const personalityVotes = await db.execute({
      sql: "SELECT user_id, answer FROM personality_answers WHERE personality_question_id = ? AND group_id = ?",
      args: [personalityQ.id, groupId],
    });
    const myPersonality = personalityVotes.rows.find((v) => v.user_id === req.userId);
    const personalityTally = { a: 0, b: 0, c: 0, d: 0 };
    for (const v of personalityVotes.rows) personalityTally[v.answer]++;

    res.json({
      quien_es_mas: {
        id: quienEsMasQ.id,
        prompt: quienEsMasQ.prompt,
        candidates: members,
        my_answer: myQuienEsMas ? myQuienEsMas.answer_value : null,
        results: members.map((m) => ({
          user_id: m.id,
          username: m.username,
          votes: quienEsMasTally.get(String(m.id)) || 0,
        })),
        total_votes: quienEsMasVotes.rows.length,
      },
      que_prefieres: {
        id: quePrefieresQ.id,
        prompt: quePrefieresQ.prompt,
        option_a: quePrefieresQ.option_a,
        option_b: quePrefieresQ.option_b,
        my_answer: myQuePrefieres ? myQuePrefieres.answer_value : null,
        votes_a: votesA,
        votes_b: votesB,
        total_votes: quePrefieresVotes.rows.length,
      },
      personalidad: {
        id: personalityQ.id,
        prompt: personalityQ.prompt_template,
        personality: personalityQ.personality_name,
        options: [personalityQ.option_a, personalityQ.option_b, personalityQ.option_c, personalityQ.option_d],
        my_answer: myPersonality ? myPersonality.answer : null,
        results: ["a", "b", "c", "d"].map((k) => ({ option: k, votes: personalityTally[k] })),
        total_votes: personalityVotes.rows.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/special/:id/answer", async (req, res) => {
  const specialQuestionId = Number(req.params.id);
  const { group_id, answer_value } = req.body || {};

  if (!group_id || !answer_value) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    if (!(await requireMembership(group_id, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const sqResult = await db.execute({
      sql: "SELECT * FROM special_questions WHERE id = ?",
      args: [specialQuestionId],
    });
    const specialQuestion = sqResult.rows[0];
    if (!specialQuestion) return res.status(404).json({ error: "Pregunta no encontrada" });
    if (specialQuestion.scheduled_date !== todayStr()) {
      return res.status(400).json({ error: "Solo puedes responder la pregunta de hoy" });
    }

    if (specialQuestion.type === "quien_es_mas") {
      if (!(await requireMembership(group_id, Number(answer_value)))) {
        return res.status(400).json({ error: "El jugador votado no pertenece a este grupo" });
      }
    } else if (specialQuestion.type === "que_prefieres") {
      if (answer_value !== "a" && answer_value !== "b") {
        return res.status(400).json({ error: "Respuesta inválida" });
      }
    }

    const existing = await db.execute({
      sql: "SELECT id FROM special_answers WHERE special_question_id = ? AND group_id = ? AND user_id = ?",
      args: [specialQuestionId, group_id, req.userId],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Ya respondiste esta pregunta" });
    }

    await db.execute({
      sql: "INSERT INTO special_answers (special_question_id, group_id, user_id, answer_value) VALUES (?, ?, ?, ?)",
      args: [specialQuestionId, group_id, req.userId, String(answer_value)],
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/personality/:id/answer", async (req, res) => {
  const personalityQuestionId = Number(req.params.id);
  const { group_id, answer } = req.body || {};

  if (!group_id || !["a", "b", "c", "d"].includes(answer)) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    if (!(await requireMembership(group_id, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const pqResult = await db.execute({
      sql: "SELECT * FROM personality_questions WHERE id = ?",
      args: [personalityQuestionId],
    });
    const personalityQuestion = pqResult.rows[0];
    if (!personalityQuestion) return res.status(404).json({ error: "Pregunta no encontrada" });
    if (personalityQuestion.scheduled_date !== todayStr()) {
      return res.status(400).json({ error: "Solo puedes responder la pregunta de hoy" });
    }

    const existing = await db.execute({
      sql: "SELECT id FROM personality_answers WHERE personality_question_id = ? AND group_id = ? AND user_id = ?",
      args: [personalityQuestionId, group_id, req.userId],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Ya respondiste esta pregunta" });
    }

    await db.execute({
      sql: "INSERT INTO personality_answers (personality_question_id, group_id, user_id, answer) VALUES (?, ?, ?, ?)",
      args: [personalityQuestionId, group_id, req.userId, answer],
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
