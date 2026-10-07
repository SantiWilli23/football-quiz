import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr, mondayOf, addDays } from "../utils/points.js";
import { DAILY_GAME_MAX_POINTS, WEEKLY_GAME_RANK_POINTS } from "../utils/points-config.js";
import { DAILY_GAMES, SUBMITTABLE_DAILY, recordDailyResult, weeklyStandings, quinielaDailyRows } from "../utils/daily-games.js";

const router = Router();
router.use(requireAuth);

// Resultado de la primera partida del día de un juego diario. `fraction` es qué
// tan bien salió (0 a 1); el servidor lo convierte en puntos con el tope común.
router.post("/submit", async (req, res) => {
  const gameKey = String(req.body?.gameKey || "");
  if (!SUBMITTABLE_DAILY.has(gameKey)) return res.status(400).json({ error: "Juego diario desconocido" });
  try {
    const out = await recordDailyResult(req.userId, todayStr(), gameKey, req.body?.fraction, req.body?.score);
    res.status(201).json({ ...out, max: DAILY_GAME_MAX_POINTS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Qué se jugó hoy y cuántos puntos dio cada diario.
router.get("/today", async (req, res) => {
  try {
    const today = todayStr();
    const [rows, quiniela, pending] = await Promise.all([
      db.execute({ sql: "SELECT game_key, points FROM daily_game_results WHERE user_id = ? AND date = ?", args: [req.userId, today] }),
      quinielaDailyRows([req.userId], today, today),
      db.execute({ sql: "SELECT COUNT(*) AS n FROM quiniela_predictions WHERE user_id = ? AND fixture_date = ?", args: [req.userId, today] }),
    ]);
    const byKey = new Map(rows.rows.map((r) => [r.game_key, Number(r.points)]));
    const quinielaPoints = quiniela[0]?.points || 0;
    const games = DAILY_GAMES.map((g) => {
      if (g.key === "quiniela") {
        const predicted = Number(pending.rows[0]?.n || 0) > 0;
        return { ...g, done: predicted, points: quinielaPoints };
      }
      return { ...g, done: byKey.has(g.key), points: byKey.get(g.key) || 0 };
    });
    res.json({
      date: today,
      max: DAILY_GAME_MAX_POINTS,
      games,
      total: games.reduce((sum, g) => sum + g.points, 0),
      totalMax: DAILY_GAME_MAX_POINTS * DAILY_GAMES.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Clasificación de ESTA semana en cada juego diario, entre los miembros del grupo.
router.get("/weekly", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  try {
    const members = (await db.execute({
      sql: `SELECT u.id, u.username FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?`,
      args: [groupId],
    })).rows;
    if (!members.some((m) => m.id === req.userId)) return res.status(403).json({ error: "No pertenecés a ese grupo" });

    const today = todayStr();
    const week = mondayOf(today);
    const names = new Map(members.map((m) => [m.id, m.username]));
    const standings = await weeklyStandings(members.map((m) => m.id), week, addDays(week, 6));

    const games = DAILY_GAMES.map((g) => {
      const entry = standings.find((s) => s.game_key === g.key && s.week === week);
      return {
        key: g.key,
        label: g.label,
        standings: (entry?.standings || []).map((s) => ({
          userId: s.user_id,
          username: names.get(s.user_id),
          score: s.score,
          rank: s.rank,
          bonus: s.bonus,
          me: s.user_id === req.userId,
        })),
      };
    });
    const myBonus = games.reduce((sum, g) => sum + (g.standings.find((s) => s.me)?.bonus || 0), 0);
    res.json({ week, podium: WEEKLY_GAME_RANK_POINTS, games, myBonus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
