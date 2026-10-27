import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr, addDays } from "../utils/points.js";
import { creditPoints, clubTable } from "../utils/ledger.js";
import { grantPack } from "../utils/rewards.js";
import { grantClubStreakPacks } from "../utils/clubs.js";
import { matchFor, publicView, itemPoints, trustedMs, partTotals, packQualityForTotal } from "../utils/daily-match.js";

// Partido del día (Futotal 2.0). El cliente solo manda respuestas y el servidor calcula
// el puntaje con las respuestas correctas, que nunca salen en /today.
const router = Router();
router.use(requireAuth);

const ARCHIVE_DAYS = 60;

async function answersOf(userId, date) {
  return (await db.execute({
    sql: "SELECT idx, answer, ms, ok, points FROM daily_match_answers WHERE user_id = ? AND date = ? ORDER BY idx",
    args: [userId, date],
  })).rows.map((r) => ({ idx: Number(r.idx), answer: r.answer == null ? null : Number(r.answer), ms: Number(r.ms), ok: !!r.ok, points: Number(r.points) }));
}

async function resultOf(userId, date) {
  const r = (await db.execute({ sql: "SELECT p1, p2, p3, total FROM daily_match_results WHERE user_id = ? AND date = ?", args: [userId, date] })).rows[0];
  return r ? { parts: [Number(r.p1), Number(r.p2), Number(r.p3)], total: Number(r.total) } : null;
}

// Lo ya respondido vuelve con la respuesta correcta (ya no es secreta) para poder retomar.
function reveal(items, answered) {
  return answered.map((a) => ({ ...a, correct: items[a.idx].answer, rightValue: items[a.idx].rightValue ?? null }));
}

async function memberOf(groupId, userId) {
  return Number.isInteger(groupId) && !!(await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, userId] })).rows[0];
}

router.get("/today", async (req, res) => {
  try {
    const date = todayStr();
    const items = await matchFor(date);
    const answered = await answersOf(req.userId, date);
    res.json({ date, items: publicView(items), answered: reveal(items, answered), result: await resultOf(req.userId, date) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/answer", async (req, res) => {
  try {
    const date = todayStr();
    const idx = Number(req.body?.idx);
    const items = await matchFor(date);
    const answered = await answersOf(req.userId, date);
    if (await resultOf(req.userId, date)) return res.status(409).json({ error: "Ya jugaste el partido de hoy" });
    if (!Number.isInteger(idx) || idx !== answered.length || idx >= items.length) {
      return res.status(409).json({ error: "Respuesta fuera de orden", next: answered.length });
    }
    const item = items[idx];
    const raw = req.body?.answer;
    const answer = Number.isInteger(raw) && raw >= 0 && raw < item.options.length ? raw : null;
    const ok = answer !== null && answer === item.answer;
    const now = Date.now();
    const run = (await db.execute({ sql: "SELECT last_at FROM daily_match_runs WHERE user_id = ? AND date = ?", args: [req.userId, date] })).rows[0];
    // La primera pregunta no tiene una respuesta anterior contra la cual medir: cuenta lo del cliente.
    const elapsed = run && idx > 0 ? now - Number(run.last_at) : 0;
    const ms = answer === null ? item.limitMs : trustedMs(req.body?.ms, elapsed, item.limitMs);
    const points = itemPoints(item, ok, ms);
    const ins = await db.execute({
      sql: "INSERT OR IGNORE INTO daily_match_answers (user_id, date, idx, answer, ms, ok, points) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [req.userId, date, idx, answer, Math.round(ms), ok ? 1 : 0, points],
    });
    if (ins.rowsAffected === 0) return res.status(409).json({ error: "Esa pregunta ya se respondió" });
    await db.execute({
      sql: `INSERT INTO daily_match_runs (user_id, date, started_at, last_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, date) DO UPDATE SET last_at = excluded.last_at`,
      args: [req.userId, date, now, now],
    });
    // Calibración liviana: cuánta gente acierta cada pregunta y en cuánto tiempo.
    await db.execute({
      sql: `INSERT INTO question_stats (question_key, kind, shown, correct, total_ms) VALUES (?, ?, 1, ?, ?)
            ON CONFLICT(question_key) DO UPDATE SET shown = shown + 1, correct = correct + excluded.correct, total_ms = total_ms + excluded.total_ms`,
      args: [item.key, item.kind, ok ? 1 : 0, Math.round(ms)],
    });
    res.json({ ok, correct: item.answer, rightValue: item.rightValue ?? null, points: Math.round(points * 10) / 10, ms: Math.round(ms), done: idx + 1 === items.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Cierra el partido de una fecha: arma el marcador por partes y lo suma al instante a los
// clubes. Idempotente: si ya estaba cerrado devuelve el resultado guardado.
async function closeMatch(userId, date) {
  const items = await matchFor(date);
  const prev = await resultOf(userId, date);
  if (prev) return { status: 200, body: { ...prev, already: true } };
  const answered = await answersOf(userId, date);
  if (answered.length < items.length) return { status: 409, body: { error: "Faltan preguntas por responder", answered: answered.length } };
  const { parts, total } = partTotals(answered.map((a) => ({ part: items[a.idx].part, points: a.points })));
  const ins = await db.execute({
    sql: "INSERT OR IGNORE INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, ?, ?, ?, ?)",
    args: [userId, date, parts[0], parts[1], parts[2], total],
  });
  if (ins.rowsAffected === 0) return { status: 200, body: { ...(await resultOf(userId, date)), already: true } };
  const club = await creditPoints(userId, date, "partido_dia", total);
  const quality = packQualityForTotal(total);
  await grantPack(userId, date, quality, `partido-${date}`);
  // Si con este partido jugaron todos los miembros de algún club, el club gana un sobre extra.
  const clubIds = (await db.execute({ sql: "SELECT group_id FROM group_members WHERE user_id = ?", args: [userId] })).rows;
  let clubPack = false;
  for (const c of clubIds) if ((await grantClubStreakPacks(c.group_id, date)) > 0) clubPack = true;
  return { status: 200, body: { parts, total, club, pack: quality, clubPack, already: false } };
}

router.post("/finish", async (req, res) => {
  try {
    const out = await closeMatch(req.userId, todayStr());
    res.status(out.status).json(out.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Partida jugada sin señal: el teléfono guarda lo que elegiste y lo manda al volver la
// conexión. Sin las respuestas correctas en el teléfono, no hay forma de mejorar el
// puntaje; el tiempo no se puede contrastar, así que la rapidez cuenta con un piso.
// Se acepta la fecha de hoy, o la de ayer hasta las 06:00 de Chile.
export const OFFLINE_MIN_MS_SHARE = 0.3;
router.post("/sync", async (req, res) => {
  try {
    const date = String(req.body?.date || "");
    const today = todayStr();
    const allowed = date === today || (date === addDays(today, -1) && chileHour() < 6);
    if (!allowed) return res.status(400).json({ error: "Esa partida ya no se puede enviar: venció el plazo." });
    const items = await matchFor(date);
    const sent = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (sent.length !== items.length) return res.status(400).json({ error: "La partida está incompleta" });
    if (await resultOf(req.userId, date)) return res.json({ ...(await resultOf(req.userId, date)), already: true });
    const existing = await answersOf(req.userId, date);
    for (let idx = existing.length; idx < items.length; idx++) {
      const item = items[idx];
      const raw = sent[idx]?.answer;
      const answer = Number.isInteger(raw) && raw >= 0 && raw < item.options.length ? raw : null;
      const ok = answer !== null && answer === item.answer;
      const claimed = Math.max(0, Math.min(Number(sent[idx]?.ms) || item.limitMs, item.limitMs));
      const ms = answer === null ? item.limitMs : Math.max(claimed, item.limitMs * OFFLINE_MIN_MS_SHARE);
      await db.execute({
        sql: "INSERT OR IGNORE INTO daily_match_answers (user_id, date, idx, answer, ms, ok, points) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [req.userId, date, idx, answer, Math.round(ms), ok ? 1 : 0, itemPoints(item, ok, ms)],
      });
    }
    const out = await closeMatch(req.userId, date);
    res.status(out.status).json({ ...out.body, synced: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Así respondió el club: % de acierto por pregunta entre quienes ya jugaron hoy.
// Solo se ve después de jugar (para no regalar respuestas).
router.get("/club-stats", async (req, res) => {
  try {
    const groupId = Number(req.query.groupId);
    const date = todayStr();
    if (!(await memberOf(groupId, req.userId))) return res.status(403).json({ error: "No pertenecés a ese club" });
    if (!(await resultOf(req.userId, date))) return res.status(409).json({ error: "Jugá el partido para ver cómo respondió el club" });
    const rows = (await db.execute({
      sql: `SELECT a.idx, COUNT(*) AS n, SUM(a.ok) AS hits FROM daily_match_answers a
            JOIN group_members m ON m.user_id = a.user_id AND m.group_id = ?
            WHERE a.date = ? GROUP BY a.idx ORDER BY a.idx`,
      args: [groupId, date],
    })).rows;
    res.json({ date, questions: rows.map((r) => ({ idx: Number(r.idx), players: Number(r.n), pct: Math.round((100 * Number(r.hits)) / Number(r.n)) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Rival de la semana: el que está justo arriba en la tabla del mes (el de abajo si
// eres primero). Es automático: reemplaza al «archienemigo» manual.
export async function rivalFor(groupId, userId, date) {
  const table = await clubTable(groupId, "mes", date);
  const i = table.findIndex((r) => r.userId === userId);
  if (i < 0 || table.length < 2) return null;
  const other = i > 0 ? table[i - 1] : table[1];
  return { userId: other.userId, username: other.username, points: other.points, rank: other.rank };
}

router.get("/rival", async (req, res) => {
  try {
    const groupId = Number(req.query.groupId);
    if (!(await memberOf(groupId, req.userId))) return res.status(403).json({ error: "No pertenecés a ese club" });
    res.json({ rival: await rivalFor(groupId, req.userId, todayStr()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Fantasma del rival: cuánto tardó y si acertó en la pregunta `idx`. Solo se entrega
// cuando ya respondiste esa pregunta (no sirve para hacer trampa).
router.get("/ghost", async (req, res) => {
  try {
    const groupId = Number(req.query.groupId);
    const idx = Number(req.query.idx);
    const date = todayStr();
    if (!(await memberOf(groupId, req.userId))) return res.status(403).json({ error: "No pertenecés a ese club" });
    const mine = (await db.execute({ sql: "SELECT 1 FROM daily_match_answers WHERE user_id = ? AND date = ? AND idx = ?", args: [req.userId, date, idx] })).rows[0];
    if (!mine) return res.json({ ghost: null });
    const rival = await rivalFor(groupId, req.userId, date);
    if (!rival) return res.json({ ghost: null });
    const row = (await db.execute({ sql: "SELECT ms, ok FROM daily_match_answers WHERE user_id = ? AND date = ? AND idx = ?", args: [rival.userId, date, idx] })).rows[0];
    res.json({ ghost: row ? { username: rival.username, ms: Number(row.ms), ok: !!row.ok } : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Partidos pasados: se juegan sin puntos ni sobre, así que acá sí viajan las respuestas.
router.get("/archive", async (req, res) => {
  try {
    const today = todayStr();
    const days = [];
    for (let i = 1; i <= ARCHIVE_DAYS; i++) days.push(addDays(today, -i));
    const done = new Set((await db.execute({ sql: "SELECT date FROM daily_match_results WHERE user_id = ?", args: [req.userId] })).rows.map((r) => r.date));
    const have = new Set((await db.execute("SELECT date FROM daily_matches")).rows.map((r) => r.date));
    res.json({ days: days.filter((d) => have.has(d)).map((d) => ({ date: d, played: done.has(d) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/archive/:date", async (req, res) => {
  try {
    const date = String(req.params.date);
    const today = todayStr();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= today || date < addDays(today, -ARCHIVE_DAYS)) return res.status(400).json({ error: "Fecha fuera del archivo" });
    const saved = (await db.execute({ sql: "SELECT 1 FROM daily_matches WHERE date = ?", args: [date] })).rows[0];
    if (!saved) return res.status(404).json({ error: "No hubo partido ese día" });
    res.json({ date, practice: true, items: await matchFor(date) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
