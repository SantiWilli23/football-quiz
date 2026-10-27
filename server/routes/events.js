import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr, addDays } from "../utils/points.js";
import { redesignOn } from "../utils/clubs.js";
import { normalize, shuffle, rng, dailySeed } from "../utils/futgames.js";
import { ensureEventsDetected, eventOn, kitByKey, publicEvent, relativeDays, resolveEvent, liveFor, squadFor } from "../utils/events.js";

// Partidos temáticos (Futotal 2.0): previa con pronóstico, hinchadas, adivinar la alineación,
// figura del partido y «el día después». Nada de esto da puntos: da sobres e insignias.
const router = Router();
router.use(requireAuth);

const PICKS = ["home", "draw", "away"];
const LINEUP_PACK_MIN_HITS = 8;

async function memberOf(groupId, userId) {
  return Number.isInteger(groupId) && !!(await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, userId] })).rows[0];
}

const startedAlready = (ev, now = Date.now()) => !!ev.kickoff && new Date(ev.kickoff).getTime() <= now;

router.get("/current", async (req, res) => {
  try {
    const today = todayStr();
    if (redesignOn()) { await ensureEventsDetected(today); await ensureEventsDetected(addDays(today, 1)); }
    const days = [];
    for (const [rel, date] of relativeDays(today)) {
      let ev = await eventOn(date);
      if (!ev) continue;
      if (rel !== "tomorrow") ev = await resolveEvent(date) || ev;
      const pred = (await db.execute({ sql: "SELECT pick FROM event_preds WHERE user_id = ? AND date = ?", args: [req.userId, date] })).rows[0];
      const side = (await db.execute({ sql: "SELECT side FROM event_sides WHERE user_id = ? AND date = ?", args: [req.userId, date] })).rows[0];
      const guess = (await db.execute({ sql: "SELECT team, hits, revealed_at FROM line_guesses WHERE user_id = ? AND event_date = ?", args: [req.userId, date] })).rows[0];
      const badges = (await db.execute({ sql: "SELECT kind FROM event_badges WHERE user_id = ? AND date = ?", args: [req.userId, date] })).rows.map((r) => r.kind);
      days.push({
        rel, event: publicEvent(ev), started: startedAlready(ev),
        mine: { pred: pred?.pick || null, side: side?.side || null, lineupGuess: guess ? { team: guess.team, hits: guess.hits, revealed: !!guess.revealed_at } : null, badges },
      });
    }
    res.json({ days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Pronóstico de un toque: no da puntos, da un sobre si acertás cómo terminó.
router.post("/pred", async (req, res) => {
  try {
    const date = String(req.body?.date || "");
    const pick = String(req.body?.pick || "");
    const ev = await eventOn(date);
    if (!ev || !PICKS.includes(pick)) return res.status(400).json({ error: "Pronóstico inválido" });
    if (startedAlready(ev)) return res.status(409).json({ error: "El partido ya empezó" });
    await db.execute({ sql: "INSERT INTO event_preds (user_id, date, pick) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET pick = excluded.pick", args: [req.userId, date, pick] });
    res.json({ ok: true, pick });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ¿Con quién vas? No cambia los puntos de nadie: sirve para el duelo de hinchadas del club.
router.post("/side", async (req, res) => {
  try {
    const date = String(req.body?.date || "");
    const side = String(req.body?.side || "");
    const ev = await eventOn(date);
    if (!ev || !["home", "away"].includes(side)) return res.status(400).json({ error: "Equipo inválido" });
    const played = (await db.execute({ sql: "SELECT 1 FROM daily_match_results WHERE user_id = ? AND date = ?", args: [req.userId, date] })).rows[0];
    if (played) return res.status(409).json({ error: "Ya jugaste el partido: la hinchada no se cambia" });
    await db.execute({ sql: "INSERT INTO event_sides (user_id, date, side) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET side = excluded.side", args: [req.userId, date, side] });
    res.json({ ok: true, side });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Duelo de hinchadas del club: gana la hinchada con más puntos del partido del día entre
// quienes jugaron. Empate = empate.
export async function fansFor(groupId, date) {
  const rows = (await db.execute({
    sql: `SELECT s.side, COUNT(*) AS fans, COALESCE(SUM(r.total), 0) AS points
          FROM event_sides s JOIN group_members m ON m.user_id = s.user_id AND m.group_id = ?
          LEFT JOIN daily_match_results r ON r.user_id = s.user_id AND r.date = s.date
          WHERE s.date = ? GROUP BY s.side`,
    args: [groupId, date],
  })).rows;
  const by = Object.fromEntries(rows.map((r) => [r.side, { fans: Number(r.fans), points: Number(r.points) }]));
  const home = by.home || { fans: 0, points: 0 };
  const away = by.away || { fans: 0, points: 0 };
  const winner = home.points === away.points ? null : home.points > away.points ? "home" : "away";
  return { home, away, winner };
}

router.get("/fans", async (req, res) => {
  try {
    const groupId = Number(req.query.groupId);
    const date = String(req.query.date || todayStr());
    if (!(await memberOf(groupId, req.userId))) return res.status(403).json({ error: "No pertenecés a ese club" });
    const ev = await eventOn(date);
    if (!ev) return res.status(404).json({ error: "Ese día no hubo partido temático" });
    res.json({ event: publicEvent(ev), ...(await fansFor(groupId, date)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Historial de clásicos del club.
router.get("/history", async (req, res) => {
  try {
    const groupId = Number(req.query.groupId);
    if (!(await memberOf(groupId, req.userId))) return res.status(403).json({ error: "No pertenecés a ese club" });
    const rows = (await db.execute({ sql: "SELECT * FROM events WHERE date <= ? ORDER BY date DESC LIMIT 20", args: [todayStr()] })).rows;
    const out = [];
    for (const ev of rows) {
      const fans = await fansFor(groupId, ev.date);
      if (!fans.home.fans && !fans.away.fans) continue;
      out.push({ event: publicEvent(ev), ...fans });
    }
    res.json({ history: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ---------- El día después ----------
// Una pregunta sin puntos sobre cómo terminó el partido real de ayer; si acertás, insignia.
function dayAfterQuestion(ev) {
  const r = JSON.parse(ev.real_result);
  const real = `${r.home}-${r.away}`;
  const rand = rng(dailySeed(ev.date, "dia-despues"));
  const fakes = new Set();
  while (fakes.size < 3) {
    const h = Math.floor(rand() * 5);
    const a = Math.floor(rand() * 5);
    const s = `${h}-${a}`;
    if (s !== real) fakes.add(s);
  }
  const options = shuffle([real, ...fakes], rand);
  return { question: `¿Cómo terminó ${ev.home_name} vs ${ev.away_name}?`, options, answer: options.indexOf(real) };
}

router.get("/day-after", async (req, res) => {
  try {
    const date = addDays(todayStr(), -1);
    let ev = await eventOn(date);
    if (!ev) return res.json({ available: false });
    ev = (await resolveEvent(date)) || ev;
    if (!ev.real_result) return res.json({ available: false });
    const done = (await db.execute({ sql: "SELECT kind FROM event_badges WHERE user_id = ? AND date = ? AND kind IN ('dia_despues', 'dia_despues_x')", args: [req.userId, date] })).rows[0];
    const q = dayAfterQuestion(ev);
    res.json({ available: true, date, question: q.question, options: q.options, done: !!done, won: done?.kind === "dia_despues" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/day-after", async (req, res) => {
  try {
    const date = addDays(todayStr(), -1);
    const ev = await eventOn(date);
    if (!ev?.real_result) return res.status(404).json({ error: "No hay pregunta para hoy" });
    const prev = (await db.execute({ sql: "SELECT 1 FROM event_badges WHERE user_id = ? AND date = ? AND kind IN ('dia_despues', 'dia_despues_x')", args: [req.userId, date] })).rows[0];
    if (prev) return res.status(409).json({ error: "Ya respondiste" });
    const q = dayAfterQuestion(ev);
    const choice = Number(req.body?.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return res.status(400).json({ error: "Opción inválida" });
    const ok = choice === q.answer;
    await db.execute({ sql: "INSERT INTO event_badges (user_id, date, kit_key, kind) VALUES (?, ?, ?, ?)", args: [req.userId, date, ev.kit_key, ok ? "dia_despues" : "dia_despues_x"] });
    res.json({ ok, correct: q.options[q.answer] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ---------- W1 · Adivina la alineación ----------
// En la previa elegís equipo y armás el once. Cuando sale la alineación real, cada ficha se
// da vuelta (verde si estaba, roja si no). 8 aciertos o más = sobre del evento. No da puntos.
router.get("/lineup", async (req, res) => {
  try {
    const date = String(req.query.date || "");
    const ev = await eventOn(date);
    if (!ev) return res.status(404).json({ error: "Ese día no hay partido temático" });
    const team = req.query.team === "away" ? "away" : "home";
    const guess = (await db.execute({ sql: "SELECT team, xi_json, hits, revealed_at FROM line_guesses WHERE user_id = ? AND event_date = ?", args: [req.userId, date] })).rows[0];
    const out = { event: publicEvent(ev), candidates: {}, guess: null, reveal: null };
    const tid = (side) => (side === "home" ? ev.home_id : ev.away_id);
    out.candidates = { [team]: await squadFor(ev.league, tid(team)).catch(() => []) };
    if (guess) {
      const xi = JSON.parse(guess.xi_json);
      out.guess = { team: guess.team, xi, hits: guess.hits, revealed: !!guess.revealed_at };
      const m = await liveFor(ev.league, ev.event_id).catch(() => null);
      const real = m?.lineups?.[guess.team];
      if (real && real.starters.length === 11 && !real.probable) {
        const realNames = real.starters.map((p) => p.name);
        const realSet = new Set(realNames.map(normalize));
        const marks = xi.map((n) => ({ name: n, hit: realSet.has(normalize(n)) }));
        const hits = marks.filter((x) => x.hit).length;
        if (!guess.revealed_at) {
          await db.execute({ sql: "UPDATE line_guesses SET hits = ?, revealed_at = datetime('now') WHERE user_id = ? AND event_date = ?", args: [hits, req.userId, date] });
          if (hits >= LINEUP_PACK_MIN_HITS) {
            const kit = kitByKey(ev.kit_key);
            await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source, theme) VALUES (?, ?, ?, ?)", args: [req.userId, date, `bueno-evento-alineacion-${date}`, kit?.sbcTheme || null] });
          }
        }
        out.guess.hits = hits;
        out.guess.revealed = true;
        out.reveal = { team: guess.team, marks, real: realNames, pack: hits >= LINEUP_PACK_MIN_HITS };
      }
    }
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/lineup-guess", async (req, res) => {
  try {
    const date = String(req.body?.date || "");
    const team = req.body?.team === "away" ? "away" : req.body?.team === "home" ? "home" : null;
    const ev = await eventOn(date);
    if (!ev || !team) return res.status(400).json({ error: "Elegí un equipo" });
    const players = Array.isArray(req.body?.players) ? [...new Set(req.body.players.map(String))] : [];
    if (players.length !== 11) return res.status(400).json({ error: "El once necesita 11 jugadores distintos" });
    const old = (await db.execute({ sql: "SELECT revealed_at FROM line_guesses WHERE user_id = ? AND event_date = ?", args: [req.userId, date] })).rows[0];
    if (old?.revealed_at) return res.status(409).json({ error: "La alineación real ya salió" });
    const squad = await squadFor(ev.league, team === "home" ? ev.home_id : ev.away_id).catch(() => []);
    const known = new Set(squad.map(normalize));
    if (!players.every((p) => known.has(normalize(p)))) return res.status(400).json({ error: "Elegí jugadores del plantel de ese equipo" });
    await db.execute({
      sql: `INSERT INTO line_guesses (user_id, event_date, team, xi_json) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, event_date) DO UPDATE SET team = excluded.team, xi_json = excluded.xi_json`,
      args: [req.userId, date, team, JSON.stringify(players)],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ---------- W2 · Figura del partido ----------
// El club vota entre 5 jugadores destacados (salen de los goles y asistencias del partido real).
async function figureCandidates(ev) {
  const m = await liveFor(ev.league, ev.event_id).catch(() => null);
  if (!m) return [];
  const names = [];
  const push = (n) => { if (n && !names.includes(n)) names.push(n); };
  for (const e of m.events) if (e.type === "goal" || e.type === "pen_goal") { push(e.player); push(e.assist); }
  const starters = ["home", "away"].flatMap((s) => (m.lineups[s]?.starters || []).filter((p) => p.line === "F" || p.line === "M").map((p) => p.name));
  for (const n of starters) { if (names.length >= 5) break; push(n); }
  return names.slice(0, 5);
}

router.get("/figure", async (req, res) => {
  try {
    const groupId = Number(req.query.groupId);
    const date = String(req.query.date || "");
    if (!(await memberOf(groupId, req.userId))) return res.status(403).json({ error: "No pertenecés a ese club" });
    const ev = await eventOn(date);
    if (!ev) return res.status(404).json({ error: "Ese día no hubo partido temático" });
    const candidates = await figureCandidates(ev);
    const rows = (await db.execute({ sql: "SELECT player, COUNT(*) AS n FROM figure_votes WHERE group_id = ? AND event_date = ? GROUP BY player", args: [groupId, date] })).rows;
    const tally = Object.fromEntries(rows.map((r) => [r.player, Number(r.n)]));
    const mine = (await db.execute({ sql: "SELECT player FROM figure_votes WHERE user_id = ? AND group_id = ? AND event_date = ?", args: [req.userId, groupId, date] })).rows[0];
    res.json({ candidates: candidates.map((p) => ({ player: p, votes: tally[p] || 0 })), mine: mine?.player || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/figure", async (req, res) => {
  try {
    const groupId = Number(req.body?.groupId);
    const date = String(req.body?.date || "");
    const player = String(req.body?.player || "");
    if (!(await memberOf(groupId, req.userId))) return res.status(403).json({ error: "No pertenecés a ese club" });
    const ev = await eventOn(date);
    if (!ev) return res.status(404).json({ error: "Ese día no hubo partido temático" });
    const candidates = await figureCandidates(ev);
    if (!candidates.includes(player)) return res.status(400).json({ error: "Ese jugador no está entre los destacados" });
    const ins = await db.execute({ sql: "INSERT OR IGNORE INTO figure_votes (user_id, group_id, event_date, player) VALUES (?, ?, ?, ?)", args: [req.userId, groupId, date, player] });
    if (ins.rowsAffected === 0) return res.status(409).json({ error: "Ya votaste en este club" });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
