import { db } from "./../db/client.js";
import { todayStr } from "./points.js";

// Modo B no tiene respuesta "correcta": los puntos salen de participar y de
// predecir qué va a votar la mayoría del grupo.
export const MODE_B_POINTS = { answer: 5, prediction: 15 };

export const MODE_B_EMOJIS = ["👍", "😂", "❤️", "😱", "🔥"];

export const QUESTION_KINDS = ["quien_es_mas", "que_prefieres", "personalidad", "grupal"];

// Dónde vive la respuesta de cada tipo de pregunta. Tenerlo en un solo lugar
// evita repartir el mismo `if kind === ...` por media docena de consultas
// (y que sumar un tipo nuevo obligue a acordarse de todas).
const ANSWER_SOURCE = {
  quien_es_mas: { table: "special_answers", fk: "special_question_id", column: "answer_value" },
  que_prefieres: { table: "special_answers", fk: "special_question_id", column: "answer_value" },
  personalidad: { table: "personality_answers", fk: "personality_question_id", column: "answer" },
  grupal: { table: "group_question_answers", fk: "group_question_id", column: "answer" },
};

export function answerSourceFor(kind) {
  return ANSWER_SOURCE[kind];
}

// El texto de la consigna según el tipo (personalidad guarda la suya en otra
// columna porque lleva el nombre del protagonista ya reemplazado).
export function promptOf(kind, question) {
  return kind === "personalidad" ? question.prompt_template : question.prompt;
}

// Las preguntas de un día para un grupo. "¿Quién es más?" y "¿Qué prefieres?"
// son comunes a todos los grupos; la de personalidad y la que escribe el propio
// grupo son por grupo, y esta última puede no existir si nadie la creó.
export async function getDayQuestions(groupId, date) {
  const specialResult = await db.execute({
    sql: "SELECT * FROM special_questions WHERE scheduled_date = ?",
    args: [date],
  });
  const personalityResult = await db.execute({
    sql: "SELECT * FROM personality_questions WHERE group_id = ? AND scheduled_date = ?",
    args: [groupId, date],
  });
  const groupResult = await db.execute({
    sql: "SELECT * FROM group_questions WHERE group_id = ? AND scheduled_date = ?",
    args: [groupId, date],
  });

  return {
    quien_es_mas: specialResult.rows.find((q) => q.type === "quien_es_mas") || null,
    que_prefieres: specialResult.rows.find((q) => q.type === "que_prefieres") || null,
    personalidad: personalityResult.rows[0] || null,
    grupal: groupResult.rows[0] || null,
  };
}

// Filas { user_id, value } de quienes respondieron esa pregunta en el grupo.
export async function answersFor(kind, questionId, groupId) {
  const source = ANSWER_SOURCE[kind];
  const result = await db.execute({
    sql: `SELECT user_id, ${source.column} AS value FROM ${source.table}
          WHERE ${source.fk} = ? AND group_id = ?`,
    args: [questionId, groupId],
  });
  return result.rows.map((r) => ({ user_id: r.user_id, value: String(r.value) }));
}

// Votos de una pregunta dentro de un grupo, como Map<valor, cantidad>.
export async function tallyFor(kind, questionId, groupId) {
  const tally = new Map();
  for (const row of await answersFor(kind, questionId, groupId)) {
    tally.set(row.value, (tally.get(row.value) || 0) + 1);
  }
  return tally;
}

// Opciones más votadas. Un empate deja ganar a todas las empatadas, así nadie
// pierde la predicción por un desempate arbitrario.
export function winnersOf(tally) {
  if (tally.size === 0) return [];
  const max = Math.max(...tally.values());
  return [...tally.entries()].filter(([, count]) => count === max).map(([value]) => value);
}

async function isSettled(groupId, date) {
  const result = await db.execute({
    sql: "SELECT id FROM mode_b_scores WHERE group_id = ? AND scheduled_date = ? LIMIT 1",
    args: [groupId, date],
  });
  return result.rows.length > 0;
}

// Fechas pasadas en las que el grupo tuvo actividad de Modo B.
async function activeDatesBefore(groupId, date) {
  const sources = [
    `SELECT DISTINCT sq.scheduled_date AS date FROM special_answers sa
     JOIN special_questions sq ON sq.id = sa.special_question_id
     WHERE sa.group_id = ? AND sq.scheduled_date < ?`,
    `SELECT DISTINCT pq.scheduled_date AS date FROM personality_answers pa
     JOIN personality_questions pq ON pq.id = pa.personality_question_id
     WHERE pa.group_id = ? AND pq.scheduled_date < ?`,
    `SELECT DISTINCT gq.scheduled_date AS date FROM group_question_answers ga
     JOIN group_questions gq ON gq.id = ga.group_question_id
     WHERE ga.group_id = ? AND gq.scheduled_date < ?`,
  ];

  const dates = new Set();
  for (const sql of sources) {
    const result = await db.execute({ sql, args: [groupId, date] });
    for (const row of result.rows) dates.add(row.date);
  }
  return [...dates].sort();
}

// Cierra un día ya pasado: calcula qué ganó cada pregunta y cuántos puntos
// sacó cada miembro. Un día cerrado nunca cambia (las rutas sólo aceptan votos
// del día de hoy), así que se liquida una sola vez.
export async function settleGroupDay(groupId, date) {
  if (await isSettled(groupId, date)) return;

  const questions = await getDayQuestions(groupId, date);
  const membersResult = await db.execute({
    sql: "SELECT user_id FROM group_members WHERE group_id = ?",
    args: [groupId],
  });
  const memberIds = membersResult.rows.map((r) => r.user_id);
  if (memberIds.length === 0) return;

  const perUser = new Map(memberIds.map((id) => [id, { answered: 0, correctPredictions: 0 }]));

  for (const kind of QUESTION_KINDS) {
    const question = questions[kind];
    if (!question) continue;

    const answers = await answersFor(kind, question.id, groupId);
    const tally = new Map();
    for (const row of answers) {
      tally.set(row.value, (tally.get(row.value) || 0) + 1);
      const entry = perUser.get(row.user_id);
      if (entry) entry.answered++;
    }
    const winners = new Set(winnersOf(tally));

    const predictionsResult = await db.execute({
      sql: `SELECT user_id, predicted_value FROM mode_b_predictions
            WHERE question_kind = ? AND question_id = ? AND group_id = ?`,
      args: [kind, question.id, groupId],
    });
    for (const row of predictionsResult.rows) {
      const entry = perUser.get(row.user_id);
      if (entry && winners.has(String(row.predicted_value))) entry.correctPredictions++;
    }
  }

  for (const [userId, entry] of perUser) {
    const points =
      entry.answered * MODE_B_POINTS.answer + entry.correctPredictions * MODE_B_POINTS.prediction;
    await db.execute({
      sql: `INSERT INTO mode_b_scores
              (user_id, group_id, scheduled_date, answered_count, correct_predictions, points)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, groupId, date, entry.answered, entry.correctPredictions, points],
    });
  }
}

// Liquida todos los días pasados del grupo que todavía no se hayan cerrado.
// El dashboard llama a esto cada 15 segundos, así que en el caso normal (nada
// pendiente) tiene que costar un puñado de consultas fijas y no una por día
// jugado: los días ya cerrados se traen de una y se descartan en memoria.
export async function settleGroup(groupId) {
  const dates = await activeDatesBefore(groupId, todayStr());
  if (dates.length === 0) return;

  const settledResult = await db.execute({
    sql: "SELECT DISTINCT scheduled_date AS date FROM mode_b_scores WHERE group_id = ?",
    args: [groupId],
  });
  const settled = new Set(settledResult.rows.map((r) => r.date));

  for (const date of dates) {
    if (!settled.has(date)) await settleGroupDay(groupId, date);
  }
}

// Puntos de Modo B acumulados por usuario en un grupo: Map<user_id, {...}>.
export async function modeBTotalsByUser(groupId) {
  const result = await db.execute({
    sql: `SELECT user_id,
                 COALESCE(SUM(points), 0) AS points,
                 COALESCE(SUM(answered_count), 0) AS answered,
                 COALESCE(SUM(correct_predictions), 0) AS correct_predictions
          FROM mode_b_scores WHERE group_id = ? GROUP BY user_id`,
    args: [groupId],
  });

  return new Map(
    result.rows.map((r) => [
      r.user_id,
      {
        points: Number(r.points),
        answered: Number(r.answered),
        correct_predictions: Number(r.correct_predictions),
      },
    ])
  );
}

// Reacciones de una pregunta: conteo por emoji + los que puso el usuario.
export async function reactionsFor(kind, questionId, groupId, userId) {
  const result = await db.execute({
    sql: `SELECT emoji, user_id FROM mode_b_reactions
          WHERE question_kind = ? AND question_id = ? AND group_id = ?`,
    args: [kind, questionId, groupId],
  });

  const counts = new Map();
  const mine = new Set();
  for (const row of result.rows) {
    counts.set(row.emoji, (counts.get(row.emoji) || 0) + 1);
    if (row.user_id === userId) mine.add(row.emoji);
  }

  return MODE_B_EMOJIS.map((emoji) => ({
    emoji,
    count: counts.get(emoji) || 0,
    mine: mine.has(emoji),
  }));
}
