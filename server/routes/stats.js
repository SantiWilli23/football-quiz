import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, getBestStreak, todayStr } from "../utils/points.js";
import {
  QUESTION_KINDS,
  answersFor,
  getDayQuestions,
  promptOf,
  settleGroup,
  tallyFor,
  winnersOf,
} from "../utils/mode-b.js";

const router = Router();
router.use(requireAuth);

async function requireMembership(groupId, userId) {
  const membership = await db.execute({
    sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return membership.rows.length > 0;
}

async function groupMembers(groupId) {
  const result = await db.execute({
    sql: `SELECT u.id, u.username, u.avatar FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ? ORDER BY u.username`,
    args: [groupId],
  });
  return result.rows;
}

// Todas las respuestas de Modo B del grupo, aplanadas a
// { key, date, kind, user_id, value } para poder cruzarlas en memoria.
// Los grupos son de amigos (pocas personas), así que traerlas enteras es barato.
async function allModeBAnswers(groupId) {
  const specialResult = await db.execute({
    sql: `SELECT sq.type AS kind, sq.scheduled_date AS date, sa.special_question_id AS qid,
                 sa.user_id, sa.answer_value AS value
          FROM special_answers sa
          JOIN special_questions sq ON sq.id = sa.special_question_id
          WHERE sa.group_id = ?`,
    args: [groupId],
  });
  const personalityResult = await db.execute({
    sql: `SELECT 'personalidad' AS kind, pq.scheduled_date AS date, pa.personality_question_id AS qid,
                 pa.user_id, pa.answer AS value
          FROM personality_answers pa
          JOIN personality_questions pq ON pq.id = pa.personality_question_id
          WHERE pa.group_id = ?`,
    args: [groupId],
  });

  const groupResult = await db.execute({
    sql: `SELECT 'grupal' AS kind, gq.scheduled_date AS date, ga.group_question_id AS qid,
                 ga.user_id, ga.answer AS value
          FROM group_question_answers ga
          JOIN group_questions gq ON gq.id = ga.group_question_id
          WHERE ga.group_id = ?`,
    args: [groupId],
  });

  return [...specialResult.rows, ...personalityResult.rows, ...groupResult.rows].map((r) => ({
    key: `${r.kind}:${r.qid}`,
    date: r.date,
    kind: r.kind,
    user_id: r.user_id,
    value: String(r.value),
  }));
}

export function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

// Límites de un mes como texto: las fechas se guardan en ISO (YYYY-MM-DD), así
// que comparar strings alcanza y evita hacer cuentas de calendario.
function monthBounds(month) {
  return { from: `${month}-01`, to: `${month}-31` };
}

// Ranking del grupo acotado a un rango de fechas. Los puntos de trivia son del
// usuario (no del grupo), igual que en el ranking histórico; los de Modo B sí
// son por grupo.
async function rankingBetween(groupId, from, to) {
  const members = await groupMembers(groupId);
  if (members.length === 0) return [];

  const placeholders = members.map(() => "?").join(",");
  const memberIds = members.map((m) => m.id);

  const triviaResult = await db.execute({
    sql: `SELECT a.user_id,
                 COALESCE(SUM(a.points), 0) AS points,
                 COUNT(*) AS answered,
                 COALESCE(SUM(a.is_correct), 0) AS correct
          FROM answers a JOIN questions q ON q.id = a.question_id
          WHERE a.user_id IN (${placeholders})
            AND q.scheduled_date >= ? AND q.scheduled_date <= ?
          GROUP BY a.user_id`,
    args: [...memberIds, from, to],
  });
  const triviaByUser = new Map(triviaResult.rows.map((r) => [r.user_id, r]));

  const modeBResult = await db.execute({
    sql: `SELECT user_id, COALESCE(SUM(points), 0) AS points
          FROM mode_b_scores
          WHERE group_id = ? AND scheduled_date >= ? AND scheduled_date <= ?
          GROUP BY user_id`,
    args: [groupId, from, to],
  });
  const modeBByUser = new Map(modeBResult.rows.map((r) => [r.user_id, Number(r.points)]));

  return members
    .map((m) => {
      const trivia = triviaByUser.get(m.id);
      const trivia_points = trivia ? Number(trivia.points) : 0;
      const mode_b_points = modeBByUser.get(m.id) || 0;
      const answered = trivia ? Number(trivia.answered) : 0;
      const correct = trivia ? Number(trivia.correct) : 0;
      return {
        id: m.id,
        username: m.username,
        avatar: m.avatar,
        trivia_points,
        mode_b_points,
        points: trivia_points + mode_b_points,
        answered,
        correct,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      };
    })
    .sort((a, b) => b.points - a.points || b.correct - a.correct)
    .map((row, idx) => ({ position: idx + 1, ...row }));
}

// Temporada: el ranking del mes. Es el que importa día a día, porque el
// histórico lo gana siempre el que arrancó primero.
router.get("/season", async (req, res) => {
  const groupId = Number(req.query.groupId);
  const month = /^\d{4}-\d{2}$/.test(req.query.month || "") ? req.query.month : monthOf(todayStr());

  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    await settleGroup(groupId);

    const { from, to } = monthBounds(month);
    const ranking = await rankingBetween(groupId, from, to);
    const isCurrent = month === monthOf(todayStr());

    res.json({ month, is_current: isCurrent, ranking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Campeones de los meses ya cerrados, del más reciente al más viejo.
router.get("/champions", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    await settleGroup(groupId);

    // Meses con actividad, de cualquiera de los dos modos.
    const monthsResult = await db.execute({
      sql: `SELECT DISTINCT substr(scheduled_date, 1, 7) AS month FROM mode_b_scores WHERE group_id = ?
            UNION
            SELECT DISTINCT substr(q.scheduled_date, 1, 7) AS month
            FROM answers a
            JOIN questions q ON q.id = a.question_id
            JOIN group_members gm ON gm.user_id = a.user_id
            WHERE gm.group_id = ?
            ORDER BY month DESC`,
      args: [groupId, groupId],
    });

    const currentMonth = monthOf(todayStr());
    const champions = [];
    for (const row of monthsResult.rows) {
      if (row.month >= currentMonth) continue;
      const { from, to } = monthBounds(row.month);
      const ranking = await rankingBetween(groupId, from, to);
      const winner = ranking[0];
      if (!winner || winner.points === 0) continue;
      champions.push({
        month: row.month,
        username: winner.username,
        avatar: winner.avatar,
        points: winner.points,
        // Un empate en el primer puesto es posible: se avisa en vez de
        // inventar un desempate.
        tied: ranking.filter((r) => r.points === winner.points).length > 1,
      });
    }

    res.json({ champions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ranking de Modo B + a quién vota más el grupo en "¿Quién es más?".
router.get("/mode-b", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    await settleGroup(groupId);

    const members = await groupMembers(groupId);

    const scoresResult = await db.execute({
      sql: `SELECT user_id,
                   COALESCE(SUM(points), 0) AS points,
                   COALESCE(SUM(answered_count), 0) AS answered,
                   COALESCE(SUM(correct_predictions), 0) AS correct_predictions,
                   COUNT(DISTINCT scheduled_date) AS days
            FROM mode_b_scores WHERE group_id = ? GROUP BY user_id`,
      args: [groupId],
    });
    const scoreByUser = new Map(scoresResult.rows.map((r) => [r.user_id, r]));

    const predictionsResult = await db.execute({
      sql: "SELECT user_id, COUNT(*) AS total FROM mode_b_predictions WHERE group_id = ? GROUP BY user_id",
      args: [groupId],
    });
    const predictionsByUser = new Map(predictionsResult.rows.map((r) => [r.user_id, Number(r.total)]));

    const leaderboard = members
      .map((m) => {
        const score = scoreByUser.get(m.id);
        const correct = score ? Number(score.correct_predictions) : 0;
        const madePredictions = predictionsByUser.get(m.id) || 0;
        return {
          id: m.id,
          username: m.username,
          avatar: m.avatar,
          points: score ? Number(score.points) : 0,
          answered: score ? Number(score.answered) : 0,
          days: score ? Number(score.days) : 0,
          correct_predictions: correct,
          predictions: madePredictions,
          prediction_accuracy: madePredictions > 0 ? Math.round((correct / madePredictions) * 100) : 0,
        };
      })
      .sort((a, b) => b.points - a.points || b.correct_predictions - a.correct_predictions)
      .map((row, idx) => ({ position: idx + 1, ...row }));

    const votesReceivedResult = await db.execute({
      sql: `SELECT sa.answer_value AS uid, COUNT(*) AS votes
            FROM special_answers sa
            JOIN special_questions sq ON sq.id = sa.special_question_id
            WHERE sa.group_id = ? AND sq.type = 'quien_es_mas'
            GROUP BY sa.answer_value`,
      args: [groupId],
    });
    const votesByUid = new Map(votesReceivedResult.rows.map((r) => [String(r.uid), Number(r.votes)]));

    const most_voted = members
      .map((m) => ({
        id: m.id,
        username: m.username,
        avatar: m.avatar,
        votes: votesByUid.get(String(m.id)) || 0,
      }))
      .sort((a, b) => b.votes - a.votes);

    res.json({ leaderboard, most_voted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Logros: se calculan al vuelo desde los datos, no se guardan. Cada uno lleva
// su progreso para que los que faltan también digan algo.
router.get("/achievements", async (req, res) => {
  const groupId = Number(req.query.groupId) || null;

  try {
    if (groupId && !(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    if (groupId) await settleGroup(groupId);

    const userResult = await db.execute({
      sql: "SELECT username FROM users WHERE id = ?",
      args: [req.userId],
    });
    const username = userResult.rows[0]?.username;

    const triviaResult = await db.execute({
      sql: `SELECT COALESCE(SUM(is_correct), 0) AS correct FROM answers WHERE user_id = ?`,
      args: [req.userId],
    });
    const triviaCorrect = Number(triviaResult.rows[0].correct);

    const perfectDaysResult = await db.execute({
      sql: `SELECT q.scheduled_date AS date, COUNT(*) AS correct
            FROM answers a JOIN questions q ON q.id = a.question_id
            WHERE a.user_id = ? AND a.is_correct = 1
            GROUP BY q.scheduled_date HAVING correct >= 3`,
      args: [req.userId],
    });
    const perfectDays = perfectDaysResult.rows.length;

    const bestStreak = await getBestStreak(req.userId);

    let modeBAnswers = 0;
    let correctPredictions = 0;
    let fullDays = 0;
    let votesReceived = 0;
    let timesProtagonist = 0;
    let authoredQuestions = 0;

    if (groupId) {
      const scoreResult = await db.execute({
        sql: `SELECT COALESCE(SUM(answered_count), 0) AS answered,
                     COALESCE(SUM(correct_predictions), 0) AS correct
              FROM mode_b_scores WHERE group_id = ? AND user_id = ?`,
        args: [groupId, req.userId],
      });
      modeBAnswers = Number(scoreResult.rows[0].answered);
      correctPredictions = Number(scoreResult.rows[0].correct);

      const fullDaysResult = await db.execute({
        sql: `SELECT COUNT(*) AS total FROM mode_b_scores
              WHERE group_id = ? AND user_id = ? AND answered_count >= 3`,
        args: [groupId, req.userId],
      });
      fullDays = Number(fullDaysResult.rows[0].total);

      const votesResult = await db.execute({
        sql: `SELECT COUNT(*) AS votes
              FROM special_answers sa
              JOIN special_questions sq ON sq.id = sa.special_question_id
              WHERE sa.group_id = ? AND sq.type = 'quien_es_mas' AND sa.answer_value = ?`,
        args: [groupId, String(req.userId)],
      });
      votesReceived = Number(votesResult.rows[0].votes);

      const protagonistResult = await db.execute({
        sql: `SELECT COUNT(*) AS total FROM personality_questions
              WHERE group_id = ? AND personality_name = ?`,
        args: [groupId, username],
      });
      timesProtagonist = Number(protagonistResult.rows[0].total);

      const authoredResult = await db.execute({
        sql: "SELECT COUNT(*) AS total FROM group_questions WHERE group_id = ? AND author_id = ?",
        args: [groupId, req.userId],
      });
      authoredQuestions = Number(authoredResult.rows[0].total);
    }

    const achievements = [
      {
        id: "francotirador",
        emoji: "🎯",
        title: "Francotirador",
        description: "Acertá 10 preguntas de trivia",
        current: triviaCorrect,
        target: 10,
      },
      {
        id: "dia-perfecto",
        emoji: "💯",
        title: "Día perfecto",
        description: "Acertá las 3 preguntas de trivia en un mismo día",
        current: perfectDays,
        target: 1,
      },
      {
        id: "en-llamas",
        emoji: "🔥",
        title: "En llamas",
        description: "Llegá a 5 días seguidos de racha",
        current: bestStreak,
        target: 5,
      },
      {
        id: "votante",
        emoji: "🗳️",
        title: "Votante",
        description: "Respondé 20 preguntas del modo especial",
        current: modeBAnswers,
        target: 20,
      },
      {
        id: "adivino",
        emoji: "🔮",
        title: "Adivino",
        description: "Acertá 5 predicciones sobre lo que vota el grupo",
        current: correctPredictions,
        target: 5,
      },
      {
        id: "constante",
        emoji: "📅",
        title: "Constante",
        description: "Respondé al menos 3 especiales en 7 días distintos",
        current: fullDays,
        target: 7,
      },
      {
        id: "pregunton",
        emoji: "✍️",
        title: "Preguntón",
        description: "Escribí 5 veces la pregunta del día del grupo",
        current: authoredQuestions,
        target: 5,
      },
      {
        id: "mas-votado",
        emoji: "🏆",
        title: "El más votado",
        description: "Recibí 10 votos en “¿Quién es más?”",
        current: votesReceived,
        target: 10,
      },
      {
        id: "protagonista",
        emoji: "🌟",
        title: "Protagonista",
        description: "Sé 3 veces el protagonista de la pregunta de personalidad",
        current: timesProtagonist,
        target: 3,
      },
    ].map((a) => ({
      ...a,
      unlocked: a.current >= a.target,
      progress: Math.min(100, Math.round((a.current / a.target) * 100)),
    }));

    res.json({
      achievements,
      unlocked_count: achievements.filter((a) => a.unlocked).length,
      total: achievements.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Resumen de los últimos 7 días cerrados del grupo.
router.get("/weekly", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    await settleGroup(groupId);

    const today = todayStr();
    const since = addDays(today, -7);
    const members = await groupMembers(groupId);
    const usernameById = new Map(members.map((m) => [String(m.id), m.username]));

    const datesResult = await db.execute({
      sql: `SELECT DISTINCT scheduled_date AS date FROM mode_b_scores
            WHERE group_id = ? AND scheduled_date >= ? AND scheduled_date < ?
            ORDER BY scheduled_date DESC`,
      args: [groupId, since, today],
    });
    const dates = datesResult.rows.map((r) => r.date);

    if (dates.length === 0) {
      return res.json({ days: 0, summary: null });
    }

    const scoresResult = await db.execute({
      sql: `SELECT user_id, SUM(points) AS points, SUM(answered_count) AS answered
            FROM mode_b_scores
            WHERE group_id = ? AND scheduled_date >= ? AND scheduled_date < ?
            GROUP BY user_id ORDER BY points DESC`,
      args: [groupId, since, today],
    });
    const topScorerRow = scoresResult.rows[0];
    const answeredTotal = scoresResult.rows.reduce((sum, r) => sum + Number(r.answered), 0);

    const votesReceived = new Map();
    let mostDivisive = null;
    let mostUnanimous = null;
    // La pregunta que escribe el grupo puede faltar algunos días, así que el
    // total posible se cuenta pregunta por pregunta en vez de asumir un fijo.
    let questionsInWeek = 0;

    for (const date of dates) {
      const dayQuestions = await getDayQuestions(groupId, date);
      for (const kind of QUESTION_KINDS) {
        const question = dayQuestions[kind];
        if (!question) continue;
        questionsInWeek++;

        const tally = await tallyFor(kind, question.id, groupId);
        const total = [...tally.values()].reduce((sum, n) => sum + n, 0);
        // Con un solo voto no hay ni división ni unanimidad que medir.
        if (total < 2) continue;

        if (kind === "quien_es_mas") {
          for (const [uid, count] of tally) {
            votesReceived.set(uid, (votesReceived.get(uid) || 0) + count);
          }
        }

        // Cuanto más baja la cuota del más votado, más dividido estuvo el grupo.
        const topShare = Math.max(...tally.values()) / total;
        const prompt = kind === "personalidad" ? question.prompt_template : question.prompt;
        const entry = { date, kind, prompt, share: Math.round(topShare * 100), total_votes: total };

        if (!mostDivisive || topShare < mostDivisive.share / 100) mostDivisive = entry;
        if (!mostUnanimous || topShare > mostUnanimous.share / 100) mostUnanimous = entry;
      }
    }

    const mostVotedEntry = [...votesReceived.entries()].sort((a, b) => b[1] - a[1])[0];
    const possibleAnswers = questionsInWeek * members.length;

    res.json({
      days: dates.length,
      from: dates[dates.length - 1],
      to: dates[0],
      summary: {
        top_scorer: topScorerRow
          ? {
              username: usernameById.get(String(topScorerRow.user_id)) || "—",
              points: Number(topScorerRow.points),
            }
          : null,
        most_voted: mostVotedEntry
          ? { username: usernameById.get(mostVotedEntry[0]) || "—", votes: mostVotedEntry[1] }
          : null,
        most_divisive: mostDivisive,
        most_unanimous: mostUnanimous,
        participation:
          possibleAnswers > 0 ? Math.round((answeredTotal / possibleAnswers) * 100) : 0,
        answers_total: answeredTotal,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Con quién del grupo coincidís más: porcentaje de preguntas de Modo B que
// ambos respondieron igual, contando sólo las que respondieron los dos.
router.get("/compatibility", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const members = await groupMembers(groupId);
    const answers = await allModeBAnswers(groupId);

    const mine = new Map();
    for (const a of answers) {
      if (a.user_id === req.userId) mine.set(a.key, a.value);
    }

    const matches = new Map();
    for (const a of answers) {
      if (a.user_id === req.userId) continue;
      if (!mine.has(a.key)) continue;
      const entry = matches.get(a.user_id) || { shared: 0, same: 0 };
      entry.shared++;
      if (mine.get(a.key) === a.value) entry.same++;
      matches.set(a.user_id, entry);
    }

    const compatibility = members
      .filter((m) => m.id !== req.userId)
      .map((m) => {
        const entry = matches.get(m.id) || { shared: 0, same: 0 };
        return {
          id: m.id,
          username: m.username,
          avatar: m.avatar,
          shared: entry.shared,
          same: entry.same,
          agreement: entry.shared > 0 ? Math.round((entry.same / entry.shared) * 100) : null,
        };
      })
      .sort((a, b) => (b.agreement ?? -1) - (a.agreement ?? -1));

    res.json({ compatibility });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

// Exporta todo lo que respondió el usuario (trivia + Modo B) como CSV.
router.get("/export", async (req, res) => {
  const groupId = Number(req.query.groupId) || null;

  try {
    if (groupId && !(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    if (groupId) await settleGroup(groupId);

    const rows = [
      ["tipo", "fecha", "pregunta", "tu_respuesta", "resultado_grupo", "tu_prediccion", "acerto", "puntos"],
    ];

    const triviaResult = await db.execute({
      sql: `SELECT q.scheduled_date AS date, q.question, q.correct_answer, q.option_a, q.option_b,
                   q.option_c, q.option_d, a.answer, a.is_correct, a.points
            FROM answers a JOIN questions q ON q.id = a.question_id
            WHERE a.user_id = ? ORDER BY q.scheduled_date DESC, q.slot ASC`,
      args: [req.userId],
    });
    for (const r of triviaResult.rows) {
      const labels = { a: r.option_a, b: r.option_b, c: r.option_c, d: r.option_d };
      rows.push([
        "Trivia",
        r.date,
        r.question,
        labels[r.answer],
        labels[r.correct_answer],
        "",
        r.is_correct ? "si" : "no",
        r.points,
      ]);
    }

    if (groupId) {
      const members = await groupMembers(groupId);
      const usernameById = new Map(members.map((m) => [String(m.id), m.username]));
      const kindLabel = {
        quien_es_mas: "¿Quién es más?",
        que_prefieres: "¿Qué prefieres?",
        personalidad: "Personalidad",
        grupal: "Pregunta del grupo",
      };

      const datesResult = await db.execute({
        sql: `SELECT DISTINCT scheduled_date AS date FROM mode_b_scores
              WHERE group_id = ? AND user_id = ? ORDER BY scheduled_date DESC`,
        args: [groupId, req.userId],
      });

      for (const { date } of datesResult.rows) {
        const dayQuestions = await getDayQuestions(groupId, date);
        const scoreResult = await db.execute({
          sql: "SELECT * FROM mode_b_scores WHERE group_id = ? AND user_id = ? AND scheduled_date = ?",
          args: [groupId, req.userId, date],
        });
        const dayPoints = scoreResult.rows[0] ? Number(scoreResult.rows[0].points) : 0;
        // Los puntos de Modo B son del día completo, no por pregunta: se
        // escriben en la primera fila del día y se dejan vacíos en el resto.
        let dayPointsPending = true;

        for (const kind of QUESTION_KINDS) {
          const question = dayQuestions[kind];
          if (!question) continue;

          const labelFor = (value) => {
            if (value === null) return "";
            if (kind === "quien_es_mas") return usernameById.get(String(value)) || "";
            const map = {
              a: question.option_a,
              b: question.option_b,
              c: question.option_c,
              d: question.option_d,
            };
            return map[value] ?? "";
          };

          const mine = (await answersFor(kind, question.id, groupId)).find(
            (a) => a.user_id === req.userId
          );
          if (!mine) continue;

          const predictionResult = await db.execute({
            sql: `SELECT predicted_value FROM mode_b_predictions
                  WHERE question_kind = ? AND question_id = ? AND group_id = ? AND user_id = ?`,
            args: [kind, question.id, groupId, req.userId],
          });
          const prediction =
            predictionResult.rows.length > 0 ? String(predictionResult.rows[0].predicted_value) : null;

          const winners = winnersOf(await tallyFor(kind, question.id, groupId));

          rows.push([
            kindLabel[kind],
            date,
            promptOf(kind, question),
            labelFor(mine.value),
            winners.map(labelFor).join(" / "),
            labelFor(prediction),
            prediction !== null && winners.includes(prediction) ? "si" : "no",
            dayPointsPending ? dayPoints : "",
          ]);
          dayPointsPending = false;
        }
      }
    }

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="football-quiz-${todayStr()}.csv"`);
    // BOM para que Excel abra los acentos bien.
    res.send("﻿" + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
