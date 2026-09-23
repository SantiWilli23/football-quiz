import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { todayStr } from "../utils/points.js";

const predictLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: "Muchos cambios seguidos, esperá un momento." });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;

const router = Router();

// Mercado: cada ventana hay "rumores" — una figura y 4 destinos posibles (uno es
// quedarse donde está). Cada persona elige uno; cuando el mercado se cierra se
// carga el resultado real (POST /resolve, protegido con un secreto de admin) y
// cada acierto suma 10 puntos. Los puntos se guardan en wordle_results con
// league 'tp<id>' para que sumen al total del perfil y al ranking sin tocar
// la suma de puntos de stats.js.
const HIT_POINTS = 10;
const RUMORS_PER_WINDOW = 12;
const DESTINATIONS = ["Real Madrid", "Barcelona", "Manchester City", "Manchester United", "Liverpool", "Arsenal", "Chelsea", "Bayern Munich", "Paris Saint-Germain", "Inter Milan", "Juventus", "AC Milan", "Atletico Madrid", "Tottenham Hotspur", "Napoli", "Borussia Dortmund", "Al Hilal", "Al Nassr"];

function windowKey(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  // Sep-Dic apunta al mercado de enero; Ene-May al de verano; Jun-Ago al de verano del mismo año.
  if (m >= 9) return { key: `${y + 1}-invierno`, label: `Mercado de invierno ${y + 1}` };
  if (m <= 1) return { key: `${y}-invierno`, label: `Mercado de invierno ${y}` };
  return { key: `${y}-verano`, label: `Mercado de verano ${y}` };
}

function seeded(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const currentClub = (p) => {
  const open = (p.carrera || []).find((c) => c.fin === null);
  return (open || [...p.carrera].sort((a, b) => (b.inicio || 0) - (a.inicio || 0))[0])?.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "");
};

async function ensureRumors(win) {
  const have = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM transfer_rumors WHERE window = ?", args: [win.key] })).rows[0].n);
  if (have > 0) return;
  const rnd = seeded(win.key);
  // Figuras (la base viene de más a menos conocido) que hoy están en un club de nivel para tener destino.
  const stars = ALL.slice(0, 220).filter((p) => currentClub(p) && p.carrera.some((c) => c.fin === null));
  const pool = [...stars];
  for (let i = 0; i < RUMORS_PER_WINDOW && pool.length; i++) {
    const p = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const club = currentClub(p);
    const others = DESTINATIONS.filter((d) => d !== club);
    const picks = [];
    while (picks.length < 3) picks.push(...others.splice(Math.floor(rnd() * others.length), 1));
    const options = [`Se queda en ${club}`, ...picks];
    await db.execute({
      sql: "INSERT INTO transfer_rumors (window, player_name, options) VALUES (?, ?, ?)",
      args: [win.key, p.nombre, JSON.stringify(options)],
    });
  }
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const win = windowKey(todayStr());
    await ensureRumors(win);
    const rumors = (await db.execute({ sql: "SELECT id, player_name, options, answer FROM transfer_rumors WHERE window = ? ORDER BY id", args: [win.key] })).rows;
    const mine = new Map((await db.execute({ sql: "SELECT rumor_id, pick FROM transfer_predictions WHERE user_id = ?", args: [req.userId] })).rows.map((r) => [r.rumor_id, r.pick]));
    res.json({
      window: win.label,
      points: HIT_POINTS,
      rumors: rumors.map((r) => ({ id: r.id, player: r.player_name, options: JSON.parse(r.options), answer: r.answer, pick: mine.get(r.id) || null })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/predict", requireAuth, predictLimiter, async (req, res) => {
  try {
    const id = Number(req.body?.rumorId);
    const pick = String(req.body?.pick || "");
    const r = (await db.execute({ sql: "SELECT options, answer FROM transfer_rumors WHERE id = ?", args: [id] })).rows[0];
    if (!r) return res.status(404).json({ error: "Rumor inexistente" });
    if (r.answer) return res.status(400).json({ error: "Este mercado ya se resolvió" });
    if (!JSON.parse(r.options).includes(pick)) return res.status(400).json({ error: "Opción inválida" });
    await db.execute({
      sql: "INSERT INTO transfer_predictions (user_id, rumor_id, pick) VALUES (?, ?, ?) ON CONFLICT(user_id, rumor_id) DO UPDATE SET pick = excluded.pick",
      args: [req.userId, id, pick],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Carga el destino real y reparte los puntos. Solo con el secreto de admin.
router.post("/resolve", async (req, res) => {
  const secret = process.env.ADMIN_SECRET || process.env.PUSH_CRON_SECRET;
  if (!secret || req.headers["x-admin-secret"] !== secret) return res.status(403).json({ error: "No autorizado" });
  try {
    const id = Number(req.body?.rumorId);
    const answer = String(req.body?.answer || "");
    const r = (await db.execute({ sql: "SELECT options, answer FROM transfer_rumors WHERE id = ?", args: [id] })).rows[0];
    if (!r || r.answer) return res.status(400).json({ error: "Rumor inexistente o ya resuelto" });
    if (!JSON.parse(r.options).includes(answer)) return res.status(400).json({ error: "La respuesta debe ser una de las opciones" });
    await db.execute({ sql: "UPDATE transfer_rumors SET answer = ? WHERE id = ?", args: [answer, id] });
    const hits = (await db.execute({ sql: "SELECT user_id FROM transfer_predictions WHERE rumor_id = ? AND pick = ?", args: [id, answer] })).rows;
    for (const h of hits) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO wordle_results (user_id, date, league, attempts, points) VALUES (?, ?, ?, 0, ?)",
        args: [h.user_id, todayStr(), `tp${id}`, HIT_POINTS],
      });
    }
    res.json({ ok: true, hits: hits.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
