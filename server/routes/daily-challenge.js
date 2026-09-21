import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr } from "../utils/points.js";

const router = Router();
router.use(requireAuth);

// Reto del día: una consigna común para todos, que rota por fecha. Al cumplirla
// se cobra un bonus de puntos UNA vez por día. El bonus se guarda en
// wordle_results con league = 'reto' (UNIQUE user+fecha+league lo hace
// idempotente), así que suma al total del perfil y al ranking sin tocar la
// suma de puntos de stats.js.
const BONUS_POINTS = 5;
const CHALLENGE_LEAGUE = "reto";

const CHALLENGES = [
  { key: "fichado_5", label: "Adiviná el Fichado del día en 5 intentos o menos", to: "/fulbodle" },
  { key: "trivia_2", label: "Acertá al menos 2 de las 3 preguntas de la trivia del día", to: "/trivia" },
  { key: "fichado_win", label: "Resolvé el Fichado del día (sin importar los intentos)", to: "/fulbodle" },
];

function challengeFor(dateStr) {
  const days = Math.floor(new Date(`${dateStr}T12:00:00Z`).getTime() / 86400000);
  return CHALLENGES[((days % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
}

async function isDone(key, userId, today) {
  if (key === "trivia_2") {
    const r = await db.execute({
      sql: `SELECT COALESCE(SUM(a.is_correct), 0) AS ok
            FROM answers a JOIN questions q ON q.id = a.question_id
            WHERE a.user_id = ? AND q.scheduled_date = ?`,
      args: [userId, today],
    });
    return Number(r.rows[0]?.ok || 0) >= 2;
  }
  const g = (await db.execute({
    sql: `SELECT id FROM fichado_games WHERE user_id = ? AND mode = 'daily' AND date = ? AND status = 'won' LIMIT 1`,
    args: [userId, today],
  })).rows[0];
  if (!g) return false;
  if (key === "fichado_win") return true;
  const n = (await db.execute({ sql: "SELECT COUNT(*) AS n FROM fichado_guesses WHERE game_id = ?", args: [g.id] })).rows[0];
  return Number(n.n) <= 5;
}

async function streakOf(userId, today) {
  const rows = (await db.execute({
    sql: "SELECT date FROM wordle_results WHERE user_id = ? AND league = ? ORDER BY date DESC LIMIT 60",
    args: [userId, CHALLENGE_LEAGUE],
  })).rows.map((r) => r.date);
  const set = new Set(rows);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

router.get("/", async (req, res) => {
  try {
    const today = todayStr();
    const challenge = challengeFor(today);
    const claimed = !!(await db.execute({
      sql: "SELECT 1 FROM wordle_results WHERE user_id = ? AND date = ? AND league = ?",
      args: [req.userId, today, CHALLENGE_LEAGUE],
    })).rows[0];
    const done = claimed || (await isDone(challenge.key, req.userId, today));
    res.json({
      challenge: { ...challenge, points: BONUS_POINTS },
      done,
      claimed,
      streak: await streakOf(req.userId, today),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/claim", async (req, res) => {
  try {
    const today = todayStr();
    const challenge = challengeFor(today);
    if (!(await isDone(challenge.key, req.userId, today))) {
      return res.status(400).json({ error: "Todavía no cumpliste el reto de hoy" });
    }
    const ins = await db.execute({
      sql: "INSERT OR IGNORE INTO wordle_results (user_id, date, league, attempts, points) VALUES (?, ?, ?, 0, ?)",
      args: [req.userId, today, CHALLENGE_LEAGUE, BONUS_POINTS],
    });
    res.json({ claimed: true, newly: ins.rowsAffected > 0, points: BONUS_POINTS, streak: await streakOf(req.userId, today) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
