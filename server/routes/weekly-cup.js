import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr } from "../utils/points.js";

const router = Router();
router.use(requireAuth);

// Copa semanal automática por grupo. Lunes a jueves cada uno se anota (máx. 8).
// Desde el viernes se juega a eliminación directa: la ÚLTIMA ronda es siempre el
// domingo, así que con 8 jugadores hay cuartos el viernes, semis el sábado y final
// el domingo. Cada partido lo gana quien más puntos sumó ESE DÍA (trivia + Fichado
// + reto del día); el empate lo define un sorteo fijo. Todo se resuelve "perezoso":
// al consultar, las rondas cuyo día ya pasó se calculan y se guardan.
const MAX_PLAYERS = 8;
const dow = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const mondayOf = (d) => addDays(d, -((dow(d) + 6) % 7));
const dayIndex = (d) => (dow(d) + 6) % 7; // lunes = 0 ... domingo = 6

async function pointsOnDay(userId, day) {
  const t = Number((await db.execute({
    sql: "SELECT COALESCE(SUM(a.points), 0) AS n FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.user_id = ? AND q.scheduled_date = ?",
    args: [userId, day],
  })).rows[0].n);
  const w = Number((await db.execute({ sql: "SELECT COALESCE(SUM(points), 0) AS n FROM wordle_results WHERE user_id = ? AND date = ?", args: [userId, day] })).rows[0].n);
  return t + w;
}

const coin = (week, a, b) => (((week.charCodeAt(9) || 0) + a * 31 + b * 17) % 2 === 0 ? a : b);

async function sync(week, groupId, today) {
  const signups = (await db.execute({ sql: "SELECT user_id FROM cup_signups WHERE week = ? AND group_id = ? ORDER BY id LIMIT ?", args: [week, groupId, MAX_PLAYERS] })).rows.map((r) => r.user_id);
  if (signups.length < 2 || dayIndex(today) < 4 && today < addDays(week, 4)) return { signups, rounds: 0 };
  const R = Math.ceil(Math.log2(signups.length));
  const size = 2 ** R;
  const dayOf = (r) => addDays(week, 6 - (R - r));
  const existing = (await db.execute({ sql: "SELECT COUNT(*) AS n FROM cup_matches WHERE week = ? AND group_id = ?", args: [week, groupId] })).rows[0].n;
  if (Number(existing) === 0) {
    for (let i = 0; i < size / 2; i++) {
      const a = signups[i];
      const b = signups[size - 1 - i] ?? null;
      await db.execute({ sql: "INSERT INTO cup_matches (week, group_id, round, slot, a, b) VALUES (?, ?, 1, ?, ?, ?)", args: [week, groupId, i, a, b] });
    }
  }
  for (let r = 1; r <= R; r++) {
    const rows = (await db.execute({ sql: "SELECT * FROM cup_matches WHERE week = ? AND group_id = ? AND round = ? ORDER BY slot", args: [week, groupId, r] })).rows;
    for (const m of rows) {
      if (m.winner) continue;
      if (m.b === null) {
        await db.execute({ sql: "UPDATE cup_matches SET winner = ? WHERE id = ?", args: [m.a, m.id] });
      } else if (dayOf(r) < today) {
        const [pa, pb] = [await pointsOnDay(m.a, dayOf(r)), await pointsOnDay(m.b, dayOf(r))];
        const winner = pa === pb ? coin(week, m.a, m.b) : pa > pb ? m.a : m.b;
        await db.execute({ sql: "UPDATE cup_matches SET winner = ?, a_pts = ?, b_pts = ? WHERE id = ?", args: [winner, pa, pb, m.id] });
      }
    }
    const fresh = (await db.execute({ sql: "SELECT slot, winner FROM cup_matches WHERE week = ? AND group_id = ? AND round = ? ORDER BY slot", args: [week, groupId, r] })).rows;
    if (r < R && fresh.length > 0 && fresh.every((m) => m.winner)) {
      const nextCount = (await db.execute({ sql: "SELECT COUNT(*) AS n FROM cup_matches WHERE week = ? AND group_id = ? AND round = ?", args: [week, groupId, r + 1] })).rows[0].n;
      if (Number(nextCount) === 0) {
        for (let i = 0; i < fresh.length / 2; i++) {
          await db.execute({ sql: "INSERT INTO cup_matches (week, group_id, round, slot, a, b) VALUES (?, ?, ?, ?, ?, ?)", args: [week, groupId, r + 1, i, fresh[2 * i].winner, fresh[2 * i + 1].winner] });
        }
      }
    }
  }
  return { signups, rounds: R, dayOf };
}

async function names(ids) {
  if (!ids.length) return new Map();
  const rows = (await db.execute({ sql: `SELECT id, username, avatar, avatar_config FROM users WHERE id IN (${ids.map(() => "?").join(",")})`, args: ids })).rows;
  return new Map(rows.map((u) => [u.id, { id: u.id, username: u.username, avatar: u.avatar, avatar_config: u.avatar_config }]));
}

async function requireMember(req, res) {
  const groupId = Number(req.params.groupId);
  const ok = (await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, req.userId] })).rows[0];
  if (!ok) { res.status(403).json({ error: "No perteneces a este grupo" }); return null; }
  return groupId;
}

router.get("/:groupId", async (req, res) => {
  try {
    const groupId = await requireMember(req, res);
    if (groupId === null) return;
    const today = todayStr();
    const week = mondayOf(today);
    const { signups, rounds, dayOf } = await sync(week, groupId, today);
    const matches = (await db.execute({ sql: "SELECT * FROM cup_matches WHERE week = ? AND group_id = ? ORDER BY round, slot", args: [week, groupId] })).rows;
    const ids = [...new Set([...signups, ...matches.flatMap((m) => [m.a, m.b, m.winner])].filter(Boolean))];
    const who = await names(ids);
    const final = matches.filter((m) => m.round === rounds)[0];
    const signupOpen = dayIndex(today) <= 3;
    res.json({
      week,
      phase: matches.length === 0 ? (signupOpen ? "inscripcion" : "sin_copa") : final?.winner ? "terminada" : "en_juego",
      signupOpen,
      signedUp: signups.includes(req.userId),
      signups: signups.map((id) => who.get(id)).filter(Boolean),
      max: MAX_PLAYERS,
      rounds: Array.from({ length: rounds }, (_, i) => ({
        round: i + 1,
        day: dayOf ? dayOf(i + 1) : null,
        matches: matches.filter((m) => m.round === i + 1).map((m) => ({
          a: who.get(m.a) || null, b: who.get(m.b) || null, winner: m.winner || null, aPts: m.a_pts, bPts: m.b_pts,
        })),
      })),
      champion: final?.winner ? who.get(final.winner) : null,
      me: req.userId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/:groupId/join", async (req, res) => {
  try {
    const groupId = await requireMember(req, res);
    if (groupId === null) return;
    const today = todayStr();
    if (dayIndex(today) > 3) return res.status(400).json({ error: "La inscripción cierra el jueves" });
    const week = mondayOf(today);
    const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM cup_signups WHERE week = ? AND group_id = ?", args: [week, groupId] })).rows[0].n);
    if (n >= MAX_PLAYERS) return res.status(400).json({ error: "La copa ya tiene 8 anotados" });
    await db.execute({ sql: "INSERT OR IGNORE INTO cup_signups (week, group_id, user_id) VALUES (?, ?, ?)", args: [week, groupId, req.userId] });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;

// Solo para pruebas: resolver la copa "como si hoy fuera" otro día.
export const __test = { sync };
