import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { computeRating, computeScore, isPleno, GAME_LABELS } from "../utils/game-rating.js";

const router = Router();
router.use(requireAuth);

const CLIENT_GAMES = new Set(["escudos", "arbitraje_var", "un_minuto", "quien_es", "tateti", "piramide", "torta", "traspasos", "a_quien_me_compro"]);
const PAGE_SIZE = 20;
const TOP_SIZE = 25;

// Plenos seguidos más recientes de un juego, sobre una lista de partidas de más nueva a más vieja.
function currentStreak(rows) {
  let n = 0;
  for (const r of rows) {
    if (!isPleno(r.performance)) break;
    n += 1;
  }
  return n;
}

// El cliente avisa que terminó una partida con dificultad (1-5), rendimiento (0-1) y,
// si lo sabe, cuántos segundos duró. La puntuación (1-1000) la calcula el server para
// que no se pueda inventar: cuenta dificultad, duración, rendimiento y la racha de plenos.
router.post("/log", async (req, res) => {
  try {
    const gameKey = String(req.body?.gameKey || "");
    if (!CLIENT_GAMES.has(gameKey)) return res.status(400).json({ error: "Juego desconocido" });
    const difficulty = Math.min(5, Math.max(1, Math.round(Number(req.body?.difficulty) || 1)));
    const performance = Math.min(1, Math.max(0, Number(req.body?.performance) || 0));
    const seconds = Math.min(3600, Math.max(0, Math.round(Number(req.body?.seconds) || 0)));
    const detail = String(req.body?.detail || "").slice(0, 120) || null;
    const rating = computeRating(difficulty, performance);

    const prev = (await db.execute({
      sql: "SELECT performance FROM game_history WHERE user_id = ? AND game_key = ? ORDER BY played_at DESC, id DESC LIMIT 60",
      args: [req.userId, gameKey],
    })).rows;
    const streakBefore = currentStreak(prev);
    const score = computeScore(difficulty, performance, seconds, streakBefore);
    const pleno = isPleno(performance) ? 1 : 0;

    await db.execute({
      sql: "INSERT INTO game_history (user_id, game_key, difficulty, performance, rating, detail, score, seconds, pleno) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [req.userId, gameKey, difficulty, performance, rating, detail, score, seconds, pleno],
    });
    res.status(201).json({ rating, score, streak: pleno ? streakBefore + 1 : 0 });
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

// Todas las partidas del usuario, de la más nueva a la más vieja, con su puntuación.
// Las partidas guardadas antes de existir la puntuación se calculan sin racha.
async function allGames(userId) {
  const own = (await db.execute({
    sql: "SELECT id, game_key, difficulty, performance, rating, detail, played_at, score, seconds FROM game_history WHERE user_id = ?",
    args: [userId],
  })).rows;
  return [...own, ...(await derivedGames(userId))]
    .map((g) => ({
      ...g,
      difficulty: Number(g.difficulty),
      performance: Number(g.performance),
      score: g.score != null ? Number(g.score) : computeScore(g.difficulty, g.performance, Number(g.seconds) || 0, 0),
    }))
    .sort((a, b) => String(b.played_at).localeCompare(String(a.played_at)) || Number(b.id || 0) - Number(a.id || 0));
}

const shape = (g) => ({
  game_key: g.game_key,
  label: GAME_LABELS[g.game_key] || g.game_key,
  difficulty: g.difficulty,
  performance: Math.round(g.performance * 100),
  score: g.score,
  pleno: isPleno(g.performance),
  detail: g.detail,
  played_at: g.played_at,
});

// Reciente: las partidas, de la más nueva a la más vieja.
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const all = await allGames(req.userId);
    const games = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(shape);
    const avg = all.length ? Math.round(all.reduce((s, g) => s + g.score, 0) / all.length) : 0;
    res.json({ games, total: all.length, average: avg, totalPages: Math.max(1, Math.ceil(all.length / PAGE_SIZE)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Histórico: por juego, cuántas partidas, el promedio, la mejor puntuación y las rachas de plenos.
router.get("/historic", async (req, res) => {
  try {
    const all = await allGames(req.userId);
    const byGame = new Map();
    for (const g of all) {
      if (!byGame.has(g.game_key)) byGame.set(g.game_key, []);
      byGame.get(g.game_key).push(g);
    }
    const games = [...byGame.entries()].map(([key, rows]) => {
      // rows viene de la más nueva a la más vieja
      let best = 0;
      let run = 0;
      for (const r of [...rows].reverse()) {
        if (isPleno(r.performance)) { run += 1; best = Math.max(best, run); } else run = 0;
      }
      return {
        game_key: key,
        label: GAME_LABELS[key] || key,
        played: rows.length,
        average: Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length),
        best_score: Math.max(...rows.map((r) => r.score)),
        plenos: rows.filter((r) => isPleno(r.performance)).length,
        streak: currentStreak(rows),
        best_streak: best,
      };
    }).sort((a, b) => b.played - a.played);
    res.json({ games });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Tops: tus mejores puntuaciones en una sola partida (de un juego o de todos).
router.get("/tops", async (req, res) => {
  try {
    const game = String(req.query.game || "");
    const all = (await allGames(req.userId)).filter((g) => !game || g.game_key === game);
    const tops = [...all].sort((a, b) => b.score - a.score || String(b.played_at).localeCompare(String(a.played_at))).slice(0, TOP_SIZE).map(shape);
    const available = [...new Set((await allGames(req.userId)).map((g) => g.game_key))].map((key) => ({ key, label: GAME_LABELS[key] || key }));
    res.json({ tops, games: available });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Racha de plenos actual de un juego (se muestra al entrar al juego).
router.get("/streak", async (req, res) => {
  try {
    const game = String(req.query.game || "");
    const rows = (await allGames(req.userId)).filter((g) => g.game_key === game);
    res.json({ game, streak: currentStreak(rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
