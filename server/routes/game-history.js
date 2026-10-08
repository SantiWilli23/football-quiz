import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { computeRating, GAME_LABELS } from "../utils/game-rating.js";

const router = Router();
router.use(requireAuth);

const CLIENT_GAMES = new Set(["escudos", "arbitraje_var", "un_minuto", "quien_es", "tateti", "piramide", "torta", "traspasos"]);
const PAGE_SIZE = 20;

// El cliente avisa que terminó una partida con dificultad (1-5) y rendimiento
// (0-1); el puntaje lo calcula el server para que no se pueda inventar.
router.post("/log", async (req, res) => {
  try {
    const gameKey = String(req.body?.gameKey || "");
    if (!CLIENT_GAMES.has(gameKey)) return res.status(400).json({ error: "Juego desconocido" });
    const difficulty = Math.min(5, Math.max(1, Math.round(Number(req.body?.difficulty) || 1)));
    const performance = Math.min(1, Math.max(0, Number(req.body?.performance) || 0));
    const detail = String(req.body?.detail || "").slice(0, 120) || null;
    const rating = computeRating(difficulty, performance);
    await db.execute({
      sql: "INSERT INTO game_history (user_id, game_key, difficulty, performance, rating, detail) VALUES (?, ?, ?, ?, ?, ?)",
      args: [req.userId, gameKey, difficulty, performance, rating, detail],
    });
    res.status(201).json({ rating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

const FICHADO_DIFF = { facil: { level: 1, mult: 1 }, normal: { level: 3, mult: 1.3 }, dificil: { level: 5, mult: 1.6 } };
const DUEL_DIFF = { dificil: 3, ultra: 4, demonio: 5 };

// Fichado y Duelos ya guardan sus partidas en tablas propias: se leen de ahí
// en vez de duplicarlas.
async function derivedGames(userId) {
  const out = [];
  const fichado = (await db.execute({
    sql: "SELECT difficulty, status, points, hints_used, secret_name, created_at FROM fichado_games WHERE user_id = ? AND status != 'playing'",
    args: [userId],
  })).rows;
  for (const g of fichado) {
    const d = FICHADO_DIFF[g.difficulty] || FICHADO_DIFF.normal;
    const won = g.status === "won";
    const eff = Math.min(1, Math.max(0, (Number(g.points) / d.mult - 8) / 10));
    const performance = won ? 0.6 + 0.4 * eff : 0.1;
    out.push({ game_key: "fichado", difficulty: d.level, performance, rating: computeRating(d.level, performance), detail: `${won ? "Adivinado" : "No salió"}: ${g.secret_name}`, played_at: g.created_at });
  }
  const duels = (await db.execute({
    sql: `SELECT difficulty, question_ids, challenger_id, challenger_correct, opponent_correct, winner_id, resolved_at, created_at
          FROM duels WHERE status = 'terminado' AND (challenger_id = ? OR opponent_id = ?)`,
    args: [userId, userId],
  })).rows;
  for (const d of duels) {
    let total = 1;
    try { total = Math.max(1, JSON.parse(d.question_ids).length); } catch { /* sin dato */ }
    const mine = Number(d.challenger_id === userId ? d.challenger_correct : d.opponent_correct) || 0;
    const level = DUEL_DIFF[d.difficulty] || 3;
    const performance = Math.min(1, mine / total);
    const result = d.winner_id == null ? "Empate" : d.winner_id === userId ? "Ganaste" : "Perdiste";
    out.push({ game_key: "duelos", difficulty: level, performance, rating: computeRating(level, performance), detail: `${result} · ${mine}/${total}`, played_at: d.resolved_at || d.created_at });
  }
  return out;
}

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const own = (await db.execute({
      sql: "SELECT game_key, difficulty, performance, rating, detail, played_at FROM game_history WHERE user_id = ?",
      args: [req.userId],
    })).rows;
    const all = [...own, ...(await derivedGames(req.userId))]
      .sort((a, b) => String(b.played_at).localeCompare(String(a.played_at)));
    const games = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((g) => ({
      game_key: g.game_key,
      label: GAME_LABELS[g.game_key] || g.game_key,
      difficulty: Number(g.difficulty),
      performance: Math.round(Number(g.performance) * 100),
      rating: Number(g.rating),
      detail: g.detail,
      played_at: g.played_at,
    }));
    const avg = all.length ? Math.round(all.reduce((s, g) => s + Number(g.rating), 0) / all.length) : 0;
    res.json({ games, total: all.length, average: avg, totalPages: Math.max(1, Math.ceil(all.length / PAGE_SIZE)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
