import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr } from "../utils/points.js";
import { DAILY_CHALLENGE_BONUS_POINTS as BONUS_POINTS } from "../utils/points-config.js";

const router = Router();
router.use(requireAuth);

// Reto del día: una consigna común para todos, que rota por fecha. Al cumplirla
// se cobra un bonus de puntos UNA vez por día. El bonus se guarda en
// wordle_results con league = 'reto' (UNIQUE user+fecha+league lo hace
// idempotente), así que suma al total del perfil y al ranking sin tocar la
// suma de puntos de stats.js.
const CHALLENGE_LEAGUE = "reto";

// Los retos ya no dicen "jugá a tal juego": cambian las condiciones. Los de
// Fichado tienen un secreto restringido (solo jóvenes, solo leyendas...) y se
// juegan desde /fulbodle?reto=1; el de trivia usa la trivia del día. Cada reto
// puede ser de cualquier juego activo — sumar uno nuevo es agregarlo acá.
const CHALLENGES = [
  { key: "fichado_jovenes", label: "Adiviná al jugador secreto: hoy son solo jugadores jóvenes (nacidos desde 2003)", to: "/fulbodle?reto=1", fichado: "young" },
  { key: "trivia_2", label: "Acertá al menos 2 de las 3 preguntas de la trivia del día", to: "/trivia" },
  { key: "fichado_leyendas", label: "Adiviná al jugador secreto: hoy son solo leyendas retiradas", to: "/fulbodle?reto=1", fichado: "legends" },
  { key: "fichado_porteros", label: "Adiviná al jugador secreto: hoy son solo porteros", to: "/fulbodle?reto=1", fichado: "keepers" },
  { key: "fichado_premier", label: "Adiviná al jugador secreto: hoy son solo jugadores de la Premier League", to: "/fulbodle?reto=1", fichado: "premier" },
  { key: "fichado_laliga", label: "Adiviná al jugador secreto: hoy son solo jugadores de LaLiga", to: "/fulbodle?reto=1", fichado: "laliga" },
  { key: "fichado_seriea", label: "Adiviná al jugador secreto: hoy son solo jugadores de la Serie A", to: "/fulbodle?reto=1", fichado: "seriea" },
];

export function challengeFor(dateStr) {
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
  // Retos de Fichado: ganar la partida 'reto' de hoy (secreto restringido).
  const g = (await db.execute({
    sql: `SELECT id FROM fichado_games WHERE user_id = ? AND mode = 'reto' AND date = ? AND status = 'won' LIMIT 1`,
    args: [userId, today],
  })).rows[0];
  return !!g;
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
