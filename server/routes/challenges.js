import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { isoWeekKey, todayKey, rankEntries, LOWER_IS_BETTER } from "../utils/challenges.js";

const router = Router();
router.use(requireAuth);

// Los "retos" semanales que hoy tienen versión especial. Trivia diaria se
// rankea aparte (en vivo, sin submit) porque ya se registra sola en `answers`.
const ALLOWED_GAMES = new Set(["draft_europeo", "cotrero", "fichado", "equipo_jugador"]);

function periodKeyFor(gameKey) {
  return isoWeekKey();
}

async function assertMember(userId, groupId) {
  const result = await db.execute({
    sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, userId],
  });
  return result.rows.length > 0;
}

router.post("/submit", async (req, res) => {
  const gameKey = String(req.body?.gameKey || "");
  const groupId = Number(req.body?.groupId);
  const score = Number(req.body?.score);

  if (!ALLOWED_GAMES.has(gameKey)) return res.status(400).json({ error: "Juego desconocido" });
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!Number.isFinite(score)) return res.status(400).json({ error: "score inválido" });

  if (!(await assertMember(req.userId, groupId))) {
    return res.status(403).json({ error: "No pertenecés a ese grupo" });
  }

  const periodKey = periodKeyFor(gameKey);
  const ascending = LOWER_IS_BETTER.has(gameKey);

  const existing = await db.execute({
    sql: "SELECT id, score FROM challenge_scores WHERE game_key = ? AND period_key = ? AND group_id = ? AND user_id = ?",
    args: [gameKey, periodKey, groupId, req.userId],
  });

  const current = existing.rows[0];
  const isBetter = !current || (ascending ? score < current.score : score > current.score);

  if (!current) {
    await db.execute({
      sql: `INSERT INTO challenge_scores (game_key, period_key, group_id, user_id, score)
            VALUES (?, ?, ?, ?, ?)`,
      args: [gameKey, periodKey, groupId, req.userId, score],
    });
  } else if (isBetter) {
    await db.execute({
      sql: "UPDATE challenge_scores SET score = ?, submitted_at = datetime('now') WHERE id = ?",
      args: [score, current.id],
    });
  }

  res.status(201).json({ saved: true, improved: isBetter, periodKey });
});

router.get("/leaderboard", async (req, res) => {
  const gameKey = String(req.query.gameKey || "");
  const groupId = Number(req.query.groupId);

  if (!ALLOWED_GAMES.has(gameKey)) return res.status(400).json({ error: "Juego desconocido" });
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!(await assertMember(req.userId, groupId))) {
    return res.status(403).json({ error: "No pertenecés a ese grupo" });
  }

  const periodKey = periodKeyFor(gameKey);
  const result = await db.execute({
    sql: `SELECT cs.user_id, u.username, cs.score
          FROM challenge_scores cs JOIN users u ON u.id = cs.user_id
          WHERE cs.game_key = ? AND cs.period_key = ? AND cs.group_id = ?`,
    args: [gameKey, periodKey, groupId],
  });

  res.json({ periodKey, entries: rankEntries(result.rows, gameKey) });
});

// Trivia diaria: no necesita submit propio, se calcula en vivo a partir de
// lo ya guardado en `answers` para hoy — así no hay que tocar el flujo
// existente de responder preguntas.
router.get("/trivia-leaderboard", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  if (!(await assertMember(req.userId, groupId))) {
    return res.status(403).json({ error: "No pertenecés a ese grupo" });
  }

  const today = todayKey();
  const result = await db.execute({
    sql: `SELECT u.id as user_id, u.username, COALESCE(SUM(a.points), 0) as score
          FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          LEFT JOIN answers a ON a.user_id = u.id
            AND a.question_id IN (SELECT id FROM questions WHERE scheduled_date = ?)
          WHERE gm.group_id = ?
          GROUP BY u.id
          HAVING score > 0`,
    args: [today, groupId],
  });

  res.json({ periodKey: today, entries: rankEntries(result.rows, "trivia") });
});

export default router;
