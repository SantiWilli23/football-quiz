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
    const row = (await db.execute({ sql: "SELECT * FROM draft_runs WHERE user_id = ? AND status = 'activa' AND state_json NOT LIKE '%\"room\":\"%' ORDER BY id DESC LIMIT 1", args: [req.userId] })).rows[0];
    res.json(row ? body(row, JSON.parse(row.state_json)) : { draft: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});


// ---------- contra un amigo ----------
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const nameOf = async (id) => (await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [id] })).rows[0]?.username || "Rival";

async function runInRoom(userId, code) {
  return (await db.execute({ sql: "SELECT * FROM draft_runs WHERE user_id = ? AND status = 'activa' AND state_json LIKE ? ORDER BY id DESC LIMIT 1", args: [userId, `%"room":"${code}"%`] })).rows[0] || null;
}

router.post("/room", limiter, async (req, res) => {
  try {
    const cfg = { formation: String(req.body?.formation || ""), mode: String(req.body?.mode || ""), style: String(req.body?.style || "equilibrado") };
    const seed = Math.floor(Math.random() * 2 ** 31);
    const st = D.newRun(cfg, seed);
    if (st.error) return res.status(400).json({ error: st.error });
    await db.execute({ sql: "UPDATE draft_runs SET status = 'abandonada', finished_at = datetime('now') WHERE user_id = ? AND status = 'activa'", args: [req.userId] });
    let code; do { code = newCode(); } while ((await db.execute({ sql: "SELECT 1 FROM draft_rooms WHERE code = ?", args: [code] })).rows[0]);
    st.room = code; st.side = "A";
    const r = await db.execute({ sql: "INSERT INTO draft_runs (user_id, seed, state_json) VALUES (?, ?, ?)", args: [req.userId, seed, JSON.stringify(st)] });
    await db.execute({ sql: "INSERT INTO draft_rooms (code, creator_id, formation, mode, style, run_a) VALUES (?, ?, ?, ?, ?, ?)", args: [code, req.userId, cfg.formation, cfg.mode, cfg.style, Number(r.lastInsertRowid)] });
    res.status(201).json({ code, id: Number(r.lastInsertRowid), step: 0, draft: D.publicView(st) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/room/join", limiter, async (req, res) => {
  try {
    const code = String(req.body?.code || "").toUpperCase().trim();
    const room = (await db.execute({ sql: "SELECT * FROM draft_rooms WHERE code = ?", args: [code] })).rows[0];
    if (!room) return res.status(404).json({ error: "Sala no encontrada" });
    if (Number(room.creator_id) === req.userId) return res.status(400).json({ error: "Esa sala es tuya: compártele el código a tu amigo" });
    if (room.guest_id && Number(room.guest_id) !== req.userId) return res.status(409).json({ error: "La sala ya está completa" });
    if (room.status === "done") return res.status(409).json({ error: "Ese duelo ya terminó" });
    const mine = await runInRoom(req.userId, code);
    if (mine) return res.json({ code, id: Number(mine.id), step: Number(mine.step), draft: D.publicView(JSON.parse(mine.state_json)) });
    const seed = Math.floor(Math.random() * 2 ** 31);
    const st = D.newRun({ formation: room.formation, mode: room.mode, style: room.style }, seed);
    await db.execute({ sql: "UPDATE draft_runs SET status = 'abandonada', finished_at = datetime('now') WHERE user_id = ? AND status = 'activa'", args: [req.userId] });
    st.room = code; st.side = "B";
    const r = await db.execute({ sql: "INSERT INTO draft_runs (user_id, seed, state_json) VALUES (?, ?, ?)", args: [req.userId, seed, JSON.stringify(st)] });
    await db.execute({ sql: "UPDATE draft_rooms SET guest_id = ?, run_b = ?, status = 'playing' WHERE code = ?", args: [req.userId, Number(r.lastInsertRowid), code] });
    res.status(201).json({ code, id: Number(r.lastInsertRowid), step: 0, draft: D.publicView(st) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Estado de la sala (se consulta cada pocos segundos mientras se espera) con mi partida al día.
router.get("/room/:code", async (req, res) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const room = (await db.execute({ sql: "SELECT * FROM draft_rooms WHERE code = ?", args: [code] })).rows[0];
    if (!room || ![Number(room.creator_id), Number(room.guest_id)].includes(req.userId)) return res.status(404).json({ error: "Sala no encontrada" });
    const runId = Number(room.creator_id) === req.userId ? room.run_a : room.run_b;
    const row = runId ? (await db.execute({ sql: "SELECT * FROM draft_runs WHERE id = ?", args: [runId] })).rows[0] : null;
    res.json({ code, status: room.status, hasGuest: !!room.guest_id, opponent: Number(room.creator_id) === req.userId ? (room.guest_id ? await nameOf(room.guest_id) : null) : await nameOf(room.creator_id), hasGuest2: !!room.guest_id, id: row ? Number(row.id) : null, step: row ? Number(row.step) : 0, draft: row ? D.publicView(JSON.parse(row.state_json)) : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Mi sala activa, para retomarla desde otro teléfono.
router.get("/room-active", async (req, res) => {
  try {
    const room = (await db.execute({ sql: "SELECT * FROM draft_rooms WHERE (creator_id = ? OR guest_id = ?) AND status != 'done' ORDER BY created_at DESC LIMIT 1", args: [req.userId, req.userId] })).rows[0];
    res.json({ code: room?.code || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Cuando los dos terminaron su equipo: partido único, ganador decidido por el servidor.
async function settleRoom(code) {
  const room = (await db.execute({ sql: "SELECT * FROM draft_rooms WHERE code = ?", args: [code] })).rows[0];
  if (!room || room.status === "done" || !room.run_a || !room.run_b) return null;
  const [ra, rb] = [await db.execute({ sql: "SELECT * FROM draft_runs WHERE id = ?", args: [room.run_a] }), await db.execute({ sql: "SELECT * FROM draft_runs WHERE id = ?", args: [room.run_b] })].map((x) => x.rows[0]);
  const [sa, sb] = [JSON.parse(ra.state_json), JSON.parse(rb.state_json)];
  if (sa.phase !== "ready" || sb.phase !== "ready") return null;
  const [na, nb] = [await nameOf(room.creator_id), await nameOf(room.guest_id)];
  const out = D.playVersus(sa, sb, na, nb);
  const winnerId = out.winner === "A" ? Number(room.creator_id) : Number(room.guest_id);
  for (const [row, st, side, uid, rival] of [[ra, sa, "A", Number(room.creator_id), nb], [rb, sb, "B", Number(room.guest_id), na]]) {
    const won = uid === winnerId;
    const rewards = { club: null, pack: null };
    if (redesignOn() && won) rewards.club = await creditPoints(uid, todayStr(), "draft", FLAT_POINTS.draft);
    if (redesignOn()) rewards.pack = (await practicePack(uid, todayStr(), "draft_europeo", won ? 1 : 0.5, { mode: "fun" }))?.quality ?? null;
    st.phase = "done";
    st.cup = { rounds: [{ name: "duelo", matches: [D.viewFor(out.entry, side)] }], eliminated: won ? null : "duelo", champion: won ? "you" : rival };
    st.final = { average: side === "A" ? out.avgA : out.avgB, rivalAverage: side === "A" ? out.avgB : out.avgA, champion: won, eliminated: won ? null : "duelo", championName: won ? "Tu selección" : rival, versus: true, rival, rewards };
    await db.execute({ sql: "UPDATE draft_runs SET state_json = ?, step = step + 1, status = 'terminada', champion = ?, average = ?, finished_at = datetime('now') WHERE id = ?", args: [JSON.stringify(st), won ? 1 : 0, st.final.average, row.id] });
  }
  await db.execute({ sql: "UPDATE draft_rooms SET status = 'done', winner_id = ? WHERE code = ?", args: [winnerId, code] });
  return winnerId;
}

// Todas las jugadas pasan por acá: pick, reroll, move, transfer (abrir), apply (fichar) y cup.
const ACTIONS = {
  pick: (st, b) => D.pick(st, { poolIdx: Number(b.poolIdx), slotIdx: Number(b.slotIdx) }),
  reroll: (st, b) => D.reroll(st, String(b.type || "")),
  move: (st, b) => D.move(st, { from: Number(b.from), to: Number(b.to) }),
  transfer: (st, b) => D.openTransfer(st, Number(b.slotIdx)),
  apply: (st, b) => D.applyTransfer(st, Number(b.optIdx)),
  cup: (st) => (st.room ? { error: "En un duelo con un amigo se confirma con «Estoy listo»" } : D.playCup(st)),
  ready: (st) => (st.room && st.phase === "result" ? Object.assign(structuredClone(st), { phase: "ready" }) : { error: "Todavía no puedes confirmar" }),
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
    if (next.phase === "ready") {
      await db.execute({ sql: "UPDATE draft_runs SET state_json = ?, step = ? WHERE id = ?", args: [JSON.stringify(next), step + 1, row.id] });
      await settleRoom(next.room);
      const fresh = await load(req.userId, row.id);
      return res.json(body(fresh, JSON.parse(fresh.state_json)));
    }
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
