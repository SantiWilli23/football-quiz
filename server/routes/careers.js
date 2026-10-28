import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { grant, safely } from "../utils/achievements.js";
import { redesignOn } from "../utils/clubs.js";
import { todayStr } from "../utils/points.js";
import { FLAT_POINTS, creditPoints } from "../utils/ledger.js";
import { practicePack } from "../utils/daily-games.js";
import * as engine from "../utils/career-engine.js";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

// Carreras de Cotrero (Futotal 2.0). Dos caminos:
//  · Carrera jugada contra el servidor (/start, /active, /:id/act): el servidor guarda el estado,
//    tira el azar con una semilla y calcula el puntaje. Es la que cuenta como «verificada».
//  · /score (heredado): las páginas estáticas viejas mandan un resumen acotado desde el teléfono.
//    Se guarda como «sin verificar» y nunca pisa una carrera verificada.
const router = Router();
router.use(requireAuth);
const limiter = rateLimit({ windowMs: 60_000, max: 10 });

const GAMES = new Set(["cotrero", "cotrero_medio"]);
const LABELS = new Set(["Promesa", "Jugador de paso", "Jugador correcto", "Crack", "Jugador de Primera", "Ídolo", "Leyenda"]);
export const MAX_CAREER_SCORE = 3000;

router.post("/score", limiter, async (req, res) => {
  const game = String(req.body?.game || "");
  const score = Math.round(Number(req.body?.score));
  const label = String(req.body?.label || "").slice(0, 30);
  if (!GAMES.has(game) || !Number.isFinite(score) || score < 0) return res.status(400).json({ error: "Carrera inválida" });
  try {
    const name = String(req.body?.name || "").replace(/[<>]/g, "").slice(0, 40);
    const pos = String(req.body?.position || "").replace(/[<>]/g, "").slice(0, 24);
    await db.execute({
      sql: `INSERT INTO career_scores (user_id, game, score, label, pos, name) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, game) DO UPDATE SET score = excluded.score, label = excluded.label, pos = excluded.pos, name = excluded.name, created_at = datetime('now')
            WHERE excluded.score > career_scores.score AND career_scores.verified = 0`,
      args: [req.userId, game, Math.min(score, MAX_CAREER_SCORE), LABELS.has(label) ? label : null, pos || null, name || null],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

const FIGURES = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/figuras_historicas.json"), "utf-8"));
const MAX_STARTS_PER_DAY = 10;

async function loadActive(userId, id) {
  const row = (await db.execute({ sql: "SELECT * FROM careers WHERE id = ? AND user_id = ?", args: [id, userId] })).rows[0];
  return row || null;
}

// Cierra la carrera: puntaje y etiqueta del servidor, Leyendas del club, puntos (Total), sobre y logro.
async function settle(userId, row, state) {
  const today = todayStr();
  const final = state.final;
  await db.execute({ sql: "UPDATE careers SET status = 'terminada', score = ?, label = ?, finished_at = datetime('now') WHERE id = ?", args: [final.score, final.label, row.id] });
  const name = `${state.player.surname} #${state.player.number}`;
  await db.execute({
    sql: `INSERT INTO career_scores (user_id, game, score, label, pos, name, verified) VALUES (?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(user_id, game) DO UPDATE SET score = excluded.score, label = excluded.label, pos = excluded.pos, name = excluded.name, verified = 1, created_at = datetime('now')
          WHERE excluded.score > career_scores.score`,
    args: [userId, row.game, final.score, final.label, engine.POS_LABEL[state.player.pos], name],
  });
  const all = (await db.execute({ sql: "SELECT score FROM career_scores WHERE game = ? AND verified = 1", args: [row.game] })).rows.map((r) => Number(r.score));
  const below = all.filter((v) => v < final.score).length;
  const rewards = { club: null, pack: null };
  if (redesignOn()) {
    rewards.club = await creditPoints(userId, today, "carrera", FLAT_POINTS.carrera);
    rewards.pack = (await practicePack(userId, today, row.game === "cotrero" ? "cotrero" : "cotrero_medio", Math.min(1, final.score / 1400), { mode: "fun" }))?.quality ?? null;
  }
  if (final.label === "Leyenda") await safely(grant(userId, "leyenda_cotrero"));
  return { ...final, percentile: all.length > 1 ? Math.round((100 * below) / all.length) : null, figure: row.game === "cotrero_medio" ? engine.closestFigure(state, FIGURES) : null, rewards };
}

router.post("/start", limiter, async (req, res) => {
  try {
    const game = String(req.body?.game || "");
    if (!GAMES.has(game)) return res.status(400).json({ error: "Carrera inválida" });
    const mode = game === "cotrero" ? String(req.body?.mode || "normal") : "normal";
    if (!engine.MODES[mode]) return res.status(400).json({ error: "Ritmo inválido" });
    const v = engine.validatePlayer(game, req.body?.player);
    if (v.error) return res.status(400).json({ error: v.error });
    const recent = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM careers WHERE user_id = ? AND created_at >= datetime('now', '-1 day')", args: [req.userId] })).rows[0].n);
    if (recent >= MAX_STARTS_PER_DAY) return res.status(429).json({ error: "Ya empezaste 10 carreras hoy. Mañana más." });
    await db.execute({ sql: "UPDATE careers SET status = 'abandonada', finished_at = datetime('now') WHERE user_id = ? AND game = ? AND status = 'activa'", args: [req.userId, game] });
    const seed = Math.floor(Math.random() * 2 ** 31);
    const state = engine.newCareer(game, mode, v.player, seed);
    const r = await db.execute({ sql: "INSERT INTO careers (user_id, game, mode, seed, state_json) VALUES (?, ?, ?, ?, ?)", args: [req.userId, game, mode, seed, JSON.stringify(state)] });
    res.status(201).json({ id: Number(r.lastInsertRowid), step: 0, career: engine.publicView(state) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Continuar desde cualquier teléfono: la carrera activa del juego, si hay.
router.get("/active", async (req, res) => {
  try {
    const game = String(req.query.game || "");
    if (!GAMES.has(game)) return res.status(400).json({ error: "Carrera inválida" });
    const row = (await db.execute({ sql: "SELECT * FROM careers WHERE user_id = ? AND game = ? AND status = 'activa' ORDER BY id DESC LIMIT 1", args: [req.userId, game] })).rows[0];
    if (!row) return res.json({ career: null });
    res.json({ id: Number(row.id), step: Number(row.step), career: engine.publicView(JSON.parse(row.state_json)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/:id/act", async (req, res) => {
  try {
    const row = await loadActive(req.userId, Number(req.params.id));
    if (!row) return res.status(404).json({ error: "Carrera no encontrada" });
    const state = JSON.parse(row.state_json);
    const step = Number(row.step);
    const choice = String(req.body?.choice ?? "");
    // Reenviar el último paso con la misma elección (doble toque) devuelve lo mismo, sin avanzar.
    if (Number(req.body?.step) === step - 1 && state._last && state._last.choice === choice) {
      return res.json({ id: row.id, step, career: engine.publicView(state), repeated: true });
    }
    if (row.status !== "activa") return res.status(409).json({ error: "La carrera ya terminó", step, career: engine.publicView(state) });
    if (Number(req.body?.step) !== step) return res.status(409).json({ error: "Esa pantalla ya cambió", step, career: engine.publicView(state) });
    const next = engine.act(state, { choice });
    if (next.error) return res.status(400).json({ error: next.error });
    next._last = { choice };
    if (next.retired) next.final = await settle(req.userId, row, next);
    await db.execute({ sql: "UPDATE careers SET state_json = ?, step = ? WHERE id = ?", args: [JSON.stringify(next), step + 1, row.id] });
    res.json({ id: Number(row.id), step: step + 1, career: engine.publicView(next) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
