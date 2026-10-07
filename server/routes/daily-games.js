import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr, mondayOf, addDays } from "../utils/points.js";
import { DAILY_GAME_MAX_POINTS, WEEKLY_GAME_RANK_POINTS } from "../utils/points-config.js";
import { WEEKLY_PODIUM_PACKS } from "../utils/rewards.js";
import { DAILY_GAMES, SUBMITTABLE_DAILY, dailyGameKeyFor, recordDailyResult, weeklyStandings, quinielaDailyRows } from "../utils/daily-games.js";

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

// El juego diario de hoy y cuántos puntos dio.
router.get("/today", async (req, res) => {
  try {
    const today = todayStr();
    const key = dailyGameKeyFor(today);
    const def = DAILY_GAMES.find((g) => g.key === key);
    let done = false;
    let points = 0;
    if (key === "quiniela") {
      const [rows, pending] = await Promise.all([
        quinielaDailyRows([req.userId], today, today),
        db.execute({ sql: "SELECT COUNT(*) AS n FROM quiniela_predictions WHERE user_id = ? AND fixture_date = ?", args: [req.userId, today] }),
      ]);
      done = Number(pending.rows[0]?.n || 0) > 0;
      points = rows[0]?.points || 0;
    } else {
      const row = (await db.execute({ sql: "SELECT points FROM daily_game_results WHERE user_id = ? AND date = ? AND game_key = ?", args: [req.userId, today, key] })).rows[0];
      done = !!row;
      points = row ? Number(row.points) : 0;
    }
    res.json({ date: today, max: DAILY_GAME_MAX_POINTS, game: { ...def, done, points } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Clasificación de ESTA semana entre los miembros del grupo: suma de los
// puntos de los juegos diarios de la semana. 1° suma 30 al ranking semanal.
router.get("/weekly", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId requerido" });
  try {
    const members = (await db.execute({
      sql: `SELECT u.id, u.username FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?`,
      args: [groupId],
    })).rows;
    if (!members.some((m) => m.id === req.userId)) return res.status(403).json({ error: "No pertenecés a ese grupo" });

    const week = mondayOf(todayStr());
    const names = new Map(members.map((m) => [m.id, m.username]));
    const entry = (await weeklyStandings(members.map((m) => m.id), week, addDays(week, 6))).find((s) => s.week === week);
    const standings = (entry?.standings || []).map((s) => ({
      userId: s.user_id,
      username: names.get(s.user_id),
      score: s.score,
      rank: s.rank,
      bonus: s.bonus,
      pack: s.pack,
      me: s.user_id === req.userId,
    }));
    const me = standings.find((s) => s.me);
    res.json({ week, podium: WEEKLY_PODIUM_PACKS, podiumPoints: WEEKLY_GAME_RANK_POINTS, standings, myPack: me?.pack || null, myBonus: me?.bonus || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
