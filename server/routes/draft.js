import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { redesignOn } from "../utils/clubs.js";
import { todayStr } from "../utils/points.js";
import { FLAT_POINTS, creditPoints } from "../utils/ledger.js";
import { practicePack } from "../utils/daily-games.js";
import * as D from "../utils/draft-engine.js";

// Draft 8a2 (solo) contra el servidor: el servidor guarda la partida, tira el azar y simula la
// Champions. Mismo protocolo por pasos que las carreras de Cotrero (`step` evita el doble toque).
const router = Router();
router.use(requireAuth);
const limiter = rateLimit({ windowMs: 60_000, max: 20 });
const MAX_STARTS_PER_DAY = 12;

const load = async (userId, id) => (await db.execute({ sql: "SELECT * FROM draft_runs WHERE id = ? AND user_id = ?", args: [id, userId] })).rows[0] || null;
const body = (row, st) => ({ id: Number(row.id), step: Number(row.step), draft: D.publicView(st) });

router.post("/start", limiter, async (req, res) => {
  try {
    const recent = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM draft_runs WHERE user_id = ? AND created_at >= datetime('now', '-1 day')", args: [req.userId] })).rows[0].n);
    if (recent >= MAX_STARTS_PER_DAY) return res.status(429).json({ error: "Ya jugaste muchos drafts hoy. Mañana más." });
    const seed = Math.floor(Math.random() * 2 ** 31);
    const st = D.newRun({ formation: String(req.body?.formation || ""), mode: String(req.body?.mode || ""), style: String(req.body?.style || "equilibrado") }, seed);
    if (st.error) return res.status(400).json({ error: st.error });
    await db.execute({ sql: "UPDATE draft_runs SET status = 'abandonada', finished_at = datetime('now') WHERE user_id = ? AND status = 'activa'", args: [req.userId] });
    const r = await db.execute({ sql: "INSERT INTO draft_runs (user_id, seed, state_json) VALUES (?, ?, ?)", args: [req.userId, seed, JSON.stringify(st)] });
    res.status(201).json({ id: Number(r.lastInsertRowid), step: 0, draft: D.publicView(st) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/active", async (req, res) => {
  try {
    const row = (await db.execute({ sql: "SELECT * FROM draft_runs WHERE user_id = ? AND status = 'activa' ORDER BY id DESC LIMIT 1", args: [req.userId] })).rows[0];
    res.json(row ? body(row, JSON.parse(row.state_json)) : { draft: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Todas las jugadas pasan por acá: pick, reroll, move, transfer (abrir), apply (fichar) y cup.
const ACTIONS = {
  pick: (st, b) => D.pick(st, { poolIdx: Number(b.poolIdx), slotIdx: Number(b.slotIdx) }),
  reroll: (st, b) => D.reroll(st, String(b.type || "")),
  move: (st, b) => D.move(st, { from: Number(b.from), to: Number(b.to) }),
  transfer: (st, b) => D.openTransfer(st, Number(b.slotIdx)),
  apply: (st, b) => D.applyTransfer(st, Number(b.optIdx)),
  cup: (st) => D.playCup(st),
};

router.post("/:id/:action", limiter, async (req, res) => {
  try {
    const fn = ACTIONS[req.params.action];
    if (!fn) return res.status(404).json({ error: "Jugada desconocida" });
    const row = await load(req.userId, Number(req.params.id));
    if (!row) return res.status(404).json({ error: "Partida no encontrada" });
    const st = JSON.parse(row.state_json);
    const step = Number(row.step);
    if (row.status !== "activa") return res.status(409).json({ error: "La partida ya terminó", ...body(row, st) });
    if (Number(req.body?.step) !== step) return res.status(409).json({ error: "Esa pantalla ya cambió", ...body(row, st) });
    const next = fn(st, req.body || {});
    if (next.error) return res.status(400).json({ error: next.error });
    let rewards = null;
    if (next.phase === "done") {
      rewards = { club: null, pack: null };
      if (redesignOn() && next.final.champion) rewards.club = await creditPoints(req.userId, todayStr(), "draft", FLAT_POINTS.draft);
      if (redesignOn()) rewards.pack = (await practicePack(req.userId, todayStr(), "draft_europeo", next.final.champion ? 1 : next.final.eliminated === "final" ? 0.7 : 0.4, { mode: "fun" }))?.quality ?? null;
      next.final.rewards = rewards;
      await db.execute({ sql: "UPDATE draft_runs SET status = 'terminada', champion = ?, average = ?, finished_at = datetime('now') WHERE id = ?", args: [next.final.champion ? 1 : 0, next.final.average, row.id] });
    }
    await db.execute({ sql: "UPDATE draft_runs SET state_json = ?, step = ? WHERE id = ?", args: [JSON.stringify(next), step + 1, row.id] });
    res.json({ id: Number(row.id), step: step + 1, draft: D.publicView(next) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
