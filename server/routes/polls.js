import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

async function assertMember(userId, groupId) {
  const result = await db.execute({
    sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return result.rows.length > 0;
}

async function withResults(poll) {
  const votes = await db.execute({
    sql: "SELECT choice, COUNT(*) AS count FROM poll_votes WHERE poll_id = ? GROUP BY choice",
    args: [poll.id],
  });
  const counts = { a: 0, b: 0 };
  for (const row of votes.rows) counts[row.choice] = Number(row.count);
  return { ...poll, votes_a: counts.a, votes_b: counts.b };
}

// Solo una encuesta abierta por grupo a la vez, para no acumular ruido.
router.get("/active", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!(await assertMember(req.userId, groupId))) {
    return res.status(403).json({ error: "No pertenecés a ese grupo" });
  }

  const result = await db.execute({
    sql: "SELECT * FROM polls WHERE group_id = ? AND status = 'abierta' ORDER BY created_at DESC LIMIT 1",
    args: [groupId],
  });
  const poll = result.rows[0];
  if (!poll) return res.json({ poll: null });

  const myVote = await db.execute({
    sql: "SELECT choice FROM poll_votes WHERE poll_id = ? AND user_id = ?",
    args: [poll.id, req.userId],
  });

  res.json({ poll: await withResults(poll), myChoice: myVote.rows[0]?.choice ?? null });
});

router.post("/", async (req, res) => {
  const groupId = Number(req.body?.groupId);
  const question = String(req.body?.question || "").trim();
  const optionA = String(req.body?.optionA || "").trim();
  const optionB = String(req.body?.optionB || "").trim();

  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!question || question.length > 140) return res.status(400).json({ error: "Pregunta inválida" });
  if (!optionA || !optionB || optionA.length > 40 || optionB.length > 40) {
    return res.status(400).json({ error: "Opciones inválidas" });
  }
  if (!(await assertMember(req.userId, groupId))) {
    return res.status(403).json({ error: "No pertenecés a ese grupo" });
  }

  const existing = await db.execute({
    sql: "SELECT id FROM polls WHERE group_id = ? AND status = 'abierta'",
    args: [groupId],
  });
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "Ya hay una encuesta abierta en este grupo" });
  }

  const inserted = await db.execute({
    sql: `INSERT INTO polls (group_id, created_by, question, option_a, option_b)
          VALUES (?, ?, ?, ?, ?)`,
    args: [groupId, req.userId, question, optionA, optionB],
  });

  const result = await db.execute({ sql: "SELECT * FROM polls WHERE id = ?", args: [Number(inserted.lastInsertRowid)] });
  res.status(201).json({ poll: await withResults(result.rows[0]) });
});

router.post("/:id/vote", async (req, res) => {
  const pollId = Number(req.params.id);
  const choice = String(req.body?.choice || "");
  if (!["a", "b"].includes(choice)) return res.status(400).json({ error: "Opción inválida" });

  const pollResult = await db.execute({ sql: "SELECT * FROM polls WHERE id = ?", args: [pollId] });
  const poll = pollResult.rows[0];
  if (!poll) return res.status(404).json({ error: "Encuesta no encontrada" });
  if (poll.status !== "abierta") return res.status(400).json({ error: "Esta encuesta ya cerró" });
  if (!(await assertMember(req.userId, poll.group_id))) {
    return res.status(403).json({ error: "No pertenecés a ese grupo" });
  }

  const existing = await db.execute({
    sql: "SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ?",
    args: [pollId, req.userId],
  });
  if (existing.rows.length > 0) {
    await db.execute({ sql: "UPDATE poll_votes SET choice = ?, voted_at = datetime('now') WHERE id = ?", args: [choice, existing.rows[0].id] });
  } else {
    await db.execute({
      sql: "INSERT INTO poll_votes (poll_id, user_id, choice) VALUES (?, ?, ?)",
      args: [pollId, req.userId, choice],
    });
  }

  res.json({ poll: await withResults(poll), myChoice: choice });
});

router.post("/:id/close", async (req, res) => {
  const pollId = Number(req.params.id);
  const pollResult = await db.execute({ sql: "SELECT * FROM polls WHERE id = ?", args: [pollId] });
  const poll = pollResult.rows[0];
  if (!poll) return res.status(404).json({ error: "Encuesta no encontrada" });
  if (poll.created_by !== req.userId) return res.status(403).json({ error: "Solo quien la creó puede cerrarla" });

  await db.execute({ sql: "UPDATE polls SET status = 'cerrada' WHERE id = ?", args: [pollId] });
  res.json({ closed: true });
});

export default router;
