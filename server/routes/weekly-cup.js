import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr, mondayOf, dayIndex } from "../utils/points.js";
import { lineupOf, strengthOf } from "./cards.js";
import { simulateMatchEvents } from "../utils/match-engine.js";
import { grantPack } from "../utils/rewards.js";

const router = Router();
router.use(requireAuth);

// Copa semanal automática por grupo. Lunes a jueves cada uno se anota (máx. 8).
// Desde el viernes se juega a eliminación directa: la ÚLTIMA ronda es siempre el
// domingo, así que con 8 jugadores hay cuartos el viernes, semis el sábado y final
// el domingo. Todo se resuelve "perezoso": al consultar, las rondas cuyo día ya
// pasó se calculan y se guardan.
//
// Dos modalidades (la elige quien creó el grupo durante la inscripción):
// - "puntos": gana quien más puntos sumó ESE DÍA (trivia + Fichado + reto del
//   día); el empate lo define un sorteo fijo.
// - "cartas": partido simulado entre los equipos de Cartas guardados de cada
//   uno (mismo motor que los partidos de Cartas); empate = penales. Solo si el
//   grupo tiene Cartas activado. Quien no tenga un once armado pierde por W.O.
const MAX_PLAYERS = 8;
const MODES = ["puntos", "cartas"];

async function modeOf(week, groupId) {
  const row = (await db.execute({ sql: "SELECT mode FROM cup_modes WHERE week = ? AND group_id = ?", args: [week, groupId] })).rows[0];
  return row?.mode === "cartas" ? "cartas" : "puntos";
}

// Partido de cartas: devuelve { winner, aGoals, bGoals, events }. Se juega con
// el once que cada uno tenga guardado al momento de resolverse la ronda.
async function playCardsMatch(a, b) {
  const [la, lb] = await Promise.all([lineupOf(a), lineupOf(b)]);
  const okA = la.length === 11, okB = lb.length === 11;
  if (!okA || !okB) {
    const winner = okA ? a : okB ? b : (Math.random() < 0.5 ? a : b);
    const text = !okA && !okB ? "Ninguno armó su equipo: se sorteó" : "Ganó por W.O. (el rival no tenía equipo armado)";
    return { winner, aGoals: null, bGoals: null, events: [{ min: 0, team: null, type: "wo", text }] };
  }
  const sa = strengthOf(la).total, sb = strengthOf(lb).total;
  const { homeGoals, awayGoals, events } = simulateMatchEvents({ ovrHome: sa / 11, ovrAway: sb / 11, homeAdvantage: 0 });
  let winner = homeGoals > awayGoals ? a : awayGoals > homeGoals ? b : null;
  if (!winner) {
    // Empate: penales, con leve ventaja para el equipo más fuerte.
    winner = Math.random() < sa / (sa + sb) ? a : b;
    events.push({ min: 90, team: winner === a ? "home" : "away", type: "penalties", text: "Definición por penales" });
  }
  return { winner, aGoals: homeGoals, bGoals: awayGoals, events };
}

async function pointsOnDay(userId, day) {
  const t = Number((await db.execute({
    sql: "SELECT COALESCE(SUM(a.points), 0) AS n FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.user_id = ? AND q.scheduled_date = ?",
    args: [userId, day],
  })).rows[0].n);
  const w = Number((await db.execute({ sql: "SELECT COALESCE(SUM(points), 0) AS n FROM wordle_results WHERE user_id = ? AND date = ?", args: [userId, day] })).rows[0].n);
  // Los juegos diarios (Fichado, Escudos, Un Minuto…) también suman al duelo del día.
  const d = Number((await db.execute({ sql: "SELECT COALESCE(SUM(points), 0) AS n FROM daily_game_results WHERE user_id = ? AND date = ?", args: [userId, day] })).rows[0].n);
  return t + w + d;
}

// Recompensa por cada fase ganada de la copa: un sobre de cartas (ver el
// reparto abajo). date = día del partido + UNIQUE(user, date, source) lo hace
// idempotente aunque la copa se consulte varias veces.
async function awardCupPack(userId, day, quality, base) {
  if (!userId) return;
  await grantPack(userId, day, quality, base);
}

const coin = (week, a, b) => (((week.charCodeAt(9) || 0) + a * 31 + b * 17) % 2 === 0 ? a : b);

async function sync(week, groupId, today) {
  const signups = (await db.execute({ sql: "SELECT user_id FROM cup_signups WHERE week = ? AND group_id = ? ORDER BY id LIMIT ?", args: [week, groupId, MAX_PLAYERS] })).rows.map((r) => r.user_id);
  if (signups.length < 2 || dayIndex(today) < 4 && today < addDays(week, 4)) return { signups, rounds: 0 };
  const R = Math.ceil(Math.log2(signups.length));
  const size = 2 ** R;
  const dayOf = (r) => addDays(week, 6 - (R - r));
  const mode = await modeOf(week, groupId);
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
        if (mode === "cartas") {
          const g = await playCardsMatch(m.a, m.b);
          // "AND winner IS NULL": si dos consultas resuelven a la vez, gana la primera y no se re-simula.
          await db.execute({
            sql: "UPDATE cup_matches SET winner = ?, a_pts = ?, b_pts = ?, events = ? WHERE id = ? AND winner IS NULL",
            args: [g.winner, g.aGoals, g.bGoals, JSON.stringify(g.events), m.id],
          });
        } else {
          const [pa, pb] = await Promise.all([pointsOnDay(m.a, dayOf(r)), pointsOnDay(m.b, dayOf(r))]);
          const winner = pa === pb ? coin(week, m.a, m.b) : pa > pb ? m.a : m.b;
          await db.execute({ sql: "UPDATE cup_matches SET winner = ?, a_pts = ?, b_pts = ? WHERE id = ?", args: [winner, pa, pb, m.id] });
        }
      }
    }
    const fresh = (await db.execute({ sql: "SELECT slot, a, b, winner FROM cup_matches WHERE week = ? AND group_id = ? AND round = ? ORDER BY slot", args: [week, groupId, r] })).rows;
    // Puntos por fase ganada (los pases libres, sin rival, no suman).
    for (const m of fresh) {
      if (!m.winner || m.b === null) continue;
      // Fase ganada = sobre de cartas: normal en las primeras, bueno en la
      // semifinal y top para el campeón.
      if (r === R) await awardCupPack(m.winner, dayOf(r), "top", `copa${groupId}campeon`);
      else await awardCupPack(m.winner, dayOf(r), r === R - 1 ? "bueno" : "normal", `copa${groupId}r${r}`);
    }
    if (r < R && fresh.length > 0 && fresh.every((m) => m.winner)) {
      const nextCount = (await db.execute({ sql: "SELECT COUNT(*) AS n FROM cup_matches WHERE week = ? AND group_id = ? AND round = ?", args: [week, groupId, r + 1] })).rows[0].n;
      if (Number(nextCount) === 0) {
        for (let i = 0; i < fresh.length / 2; i++) {
          await db.execute({ sql: "INSERT INTO cup_matches (week, group_id, round, slot, a, b) VALUES (?, ?, ?, ?, ?, ?)", args: [week, groupId, r + 1, i, fresh[2 * i].winner, fresh[2 * i + 1].winner] });
        }
      }
    }
  }
  return { signups, rounds: R, dayOf, mode };
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
    const mode = await modeOf(week, groupId);
    const matches = (await db.execute({ sql: "SELECT * FROM cup_matches WHERE week = ? AND group_id = ? ORDER BY round, slot", args: [week, groupId] })).rows;
    const ids = [...new Set([...signups, ...matches.flatMap((m) => [m.a, m.b, m.winner])].filter(Boolean))];
    const who = await names(ids);
    const final = matches.filter((m) => m.round === rounds)[0];
    const signupOpen = dayIndex(today) <= 3;
    const group = (await db.execute({ sql: "SELECT created_by, cards_enabled FROM groups_t WHERE id = ?", args: [groupId] })).rows[0];
    res.json({
      week,
      mode,
      cardsAvailable: !!group?.cards_enabled,
      canChangeMode: group?.created_by === req.userId && signupOpen && matches.length === 0,
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
          events: m.events ? JSON.parse(m.events) : null,
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
    if ((await modeOf(week, groupId)) === "cartas" && (await lineupOf(req.userId)).length !== 11) {
      return res.status(400).json({ error: "Esta semana la copa es de Cartas: primero armá tu once en Cartas → Mi equipo" });
    }
    await db.execute({ sql: "INSERT OR IGNORE INTO cup_signups (week, group_id, user_id) VALUES (?, ?, ?)", args: [week, groupId, req.userId] });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Elegir la modalidad de la copa de esta semana: solo quien creó el grupo, solo
// durante la inscripción y antes de que se armen los cruces. "cartas" exige que
// el grupo tenga Cartas activado.
router.put("/:groupId/mode", async (req, res) => {
  try {
    const groupId = await requireMember(req, res);
    if (groupId === null) return;
    const mode = String(req.body?.mode || "");
    if (!MODES.includes(mode)) return res.status(400).json({ error: "Modalidad inválida" });
    const today = todayStr();
    if (dayIndex(today) > 3) return res.status(400).json({ error: "La modalidad se elige durante la inscripción (lunes a jueves)" });
    const group = (await db.execute({ sql: "SELECT created_by, cards_enabled FROM groups_t WHERE id = ?", args: [groupId] })).rows[0];
    if (group?.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó el grupo elige la modalidad" });
    if (mode === "cartas" && !group.cards_enabled) return res.status(400).json({ error: "El grupo no tiene Cartas activado" });
    const week = mondayOf(today);
    await db.execute({
      sql: "INSERT INTO cup_modes (week, group_id, mode) VALUES (?, ?, ?) ON CONFLICT(week, group_id) DO UPDATE SET mode = excluded.mode",
      args: [week, groupId, mode],
    });
    res.json({ mode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
