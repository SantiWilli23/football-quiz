import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";

const router = Router();
router.use(requireAuth);

async function requireMembership(groupId, userId) {
  const membership = await db.execute({
    sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return membership.rows.length > 0;
}

router.get("/today", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    if (!(await requireMembership(groupId, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const today = todayStr();
    const bqResult = await db.execute({
      sql: "SELECT * FROM bonus_questions WHERE scheduled_date = ?",
      args: [today],
    });
    const bonusQuestion = bqResult.rows[0];
    if (!bonusQuestion) {
      return res.status(404).json({ error: "No hay pregunta bonus para hoy" });
    }

    const candidatesResult = await db.execute({
      sql: `SELECT u.id, u.username, u.avatar FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
            ORDER BY u.username`,
      args: [groupId],
    });

    const votesResult = await db.execute({
      sql: "SELECT voter_id, voted_for_id FROM bonus_votes WHERE bonus_question_id = ? AND group_id = ?",
      args: [bonusQuestion.id, groupId],
    });

    const myVote = votesResult.rows.find((v) => v.voter_id === req.userId);
    const tally = new Map();
    for (const v of votesResult.rows) {
      tally.set(v.voted_for_id, (tally.get(v.voted_for_id) || 0) + 1);
    }

    res.json({
      bonus_question: { id: bonusQuestion.id, prompt: bonusQuestion.prompt },
      candidates: candidatesResult.rows,
      voted: !!myVote,
      my_vote: myVote ? myVote.voted_for_id : null,
      total_votes: votesResult.rows.length,
      results: candidatesResult.rows.map((c) => ({
        user_id: c.id,
        username: c.username,
        avatar: c.avatar,
        votes: tally.get(c.id) || 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/:id/vote", async (req, res) => {
  const bonusQuestionId = Number(req.params.id);
  const { group_id, voted_for_id } = req.body || {};

  if (!group_id || !voted_for_id) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    if (!(await requireMembership(group_id, req.userId))) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }
    if (!(await requireMembership(group_id, voted_for_id))) {
      return res.status(400).json({ error: "El jugador votado no pertenece a este grupo" });
    }

    const bqResult = await db.execute({
      sql: "SELECT * FROM bonus_questions WHERE id = ?",
      args: [bonusQuestionId],
    });
    const bonusQuestion = bqResult.rows[0];
    if (!bonusQuestion) return res.status(404).json({ error: "Pregunta bonus no encontrada" });
    if (bonusQuestion.scheduled_date !== todayStr()) {
      return res.status(400).json({ error: "Solo puedes votar la pregunta bonus de hoy" });
    }

    const existing = await db.execute({
      sql: "SELECT id FROM bonus_votes WHERE bonus_question_id = ? AND group_id = ? AND voter_id = ?",
      args: [bonusQuestionId, group_id, req.userId],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Ya votaste en esta pregunta bonus" });
    }

    await db.execute({
      sql: "INSERT INTO bonus_votes (bonus_question_id, group_id, voter_id, voted_for_id) VALUES (?, ?, ?, ?)",
      args: [bonusQuestionId, group_id, req.userId, voted_for_id],
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
