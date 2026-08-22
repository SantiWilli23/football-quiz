import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `FUTBOL-${code}`;
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const existing = await db.execute({
      sql: "SELECT id FROM groups_t WHERE invite_code = ?",
      args: [code],
    });
    if (existing.rows.length === 0) return code;
  }
  throw new Error("No se pudo generar un código único");
}

router.get("/", async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT g.*, COUNT(gm2.id) AS member_count
            FROM groups_t g
            JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
            LEFT JOIN group_members gm2 ON gm2.group_id = g.id
            GROUP BY g.id
            ORDER BY g.created_at DESC`,
      args: [req.userId],
    });
    res.json({ groups: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/", async (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "El nombre del grupo es requerido" });
  }

  try {
    const invite_code = await uniqueInviteCode();
    const result = await db.execute({
      sql: `INSERT INTO groups_t (name, description, invite_code, created_by) VALUES (?, ?, ?, ?)`,
      args: [name.trim(), description || null, invite_code, req.userId],
    });
    const groupId = Number(result.lastInsertRowid);

    await db.execute({
      sql: "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
      args: [groupId, req.userId],
    });

    const groupRow = await db.execute({ sql: "SELECT * FROM groups_t WHERE id = ?", args: [groupId] });
    res.status(201).json({ group: groupRow.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/join", async (req, res) => {
  const { invite_code } = req.body || {};
  if (!invite_code) {
    return res.status(400).json({ error: "El código de invitación es requerido" });
  }

  try {
    const groupResult = await db.execute({
      sql: "SELECT * FROM groups_t WHERE invite_code = ?",
      args: [invite_code.trim().toUpperCase()],
    });
    const group = groupResult.rows[0];
    if (!group) {
      return res.status(404).json({ error: "Código de invitación inválido" });
    }

    const existing = await db.execute({
      sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
      args: [group.id, req.userId],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Ya eres miembro de este grupo" });
    }

    await db.execute({
      sql: "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
      args: [group.id, req.userId],
    });

    res.status(201).json({ group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Salir de un grupo. Las respuestas que ya diste quedan donde están: borrarlas
// cambiaría los resultados de días ya cerrados para todos los demás.
router.post("/:id/leave", async (req, res) => {
  const groupId = Number(req.params.id);

  try {
    const membership = await db.execute({
      sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
      args: [groupId, req.userId],
    });
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    await db.execute({
      sql: "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
      args: [groupId, req.userId],
    });

    // Si te ibas último, el grupo queda vacío y ya no lo puede ver nadie:
    // se borra junto con lo que sólo tenía sentido dentro de él.
    const remaining = await db.execute({
      sql: "SELECT COUNT(*) AS total FROM group_members WHERE group_id = ?",
      args: [groupId],
    });

    if (Number(remaining.rows[0].total) === 0) {
      for (const sql of [
        "DELETE FROM mode_b_reactions WHERE group_id = ?",
        "DELETE FROM mode_b_predictions WHERE group_id = ?",
        "DELETE FROM mode_b_scores WHERE group_id = ?",
        "DELETE FROM special_answers WHERE group_id = ?",
        "DELETE FROM personality_answers WHERE group_id = ?",
        "DELETE FROM group_question_answers WHERE group_id = ?",
        "DELETE FROM personality_questions WHERE group_id = ?",
        "DELETE FROM group_questions WHERE group_id = ?",
        "DELETE FROM bonus_votes WHERE group_id = ?",
        "DELETE FROM groups_t WHERE id = ?",
      ]) {
        await db.execute({ sql, args: [groupId] });
      }
      return res.json({ ok: true, group_deleted: true });
    }

    res.json({ ok: true, group_deleted: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/:id", async (req, res) => {
  const groupId = Number(req.params.id);

  try {
    const membership = await db.execute({
      sql: "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
      args: [groupId, req.userId],
    });
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "No perteneces a este grupo" });
    }

    const groupResult = await db.execute({ sql: "SELECT * FROM groups_t WHERE id = ?", args: [groupId] });
    const group = groupResult.rows[0];
    if (!group) return res.status(404).json({ error: "Grupo no encontrado" });

    const rankingResult = await db.execute({
      sql: `SELECT
              u.id, u.username, u.avatar, u.avatar_config,
              COALESCE(SUM(a.points), 0) AS points,
              COUNT(a.id) AS answered,
              COALESCE(SUM(a.is_correct), 0) AS correct
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            LEFT JOIN answers a ON a.user_id = u.id
            WHERE gm.group_id = ?
            GROUP BY u.id
            ORDER BY points DESC, correct DESC`,
      args: [groupId],
    });

    // Los puntos de Modo B viven en otra tabla; se traen aparte y se suman en
    // JS para no multiplicar filas con un segundo JOIN sobre el ranking.
    const modeBResult = await db.execute({
      sql: `SELECT user_id, COALESCE(SUM(points), 0) AS points
            FROM mode_b_scores WHERE group_id = ? GROUP BY user_id`,
      args: [groupId],
    });
    const modeBByUser = new Map(modeBResult.rows.map((r) => [r.user_id, Number(r.points)]));

    const ranking = rankingResult.rows
      .map((r) => {
        const trivia_points = Number(r.points);
        const mode_b_points = modeBByUser.get(r.id) || 0;
        return {
          id: r.id,
          username: r.username,
          avatar: r.avatar,
          avatar_config: r.avatar_config,
          trivia_points,
          mode_b_points,
          points: trivia_points + mode_b_points,
          answered: Number(r.answered),
          correct: Number(r.correct),
          accuracy: Number(r.answered) > 0 ? Math.round((Number(r.correct) / Number(r.answered)) * 100) : 0,
        };
      })
      .sort((a, b) => b.points - a.points || b.correct - a.correct)
      .map((row, idx) => ({ position: idx + 1, ...row }));

    res.json({ group, ranking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
