import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr } from "../utils/points.js";
import { redesignOn } from "../utils/clubs.js";
import { rng, dailySeed, shuffle } from "../utils/futgames.js";
import { checkAlerts, runJobs } from "../utils/jobs.js";
import { matchFor, quienItems, masMenosItems, penalItems } from "../utils/daily-match.js";
import { KITS, eventOn } from "../utils/events.js";

// Panel del dueño de la app (Futotal 2.0, V1). El dueño es el usuario cuyo nombre está en la
// variable OWNER_USERNAME del servidor; si no está configurada, el panel queda apagado.
export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.use(async (req, res, next) => {
  const owner = String(process.env.OWNER_USERNAME || "").trim().toLowerCase();
  if (!owner) return res.status(503).json({ error: "El panel está apagado: falta configurar OWNER_USERNAME en el servidor." });
  const me = (await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [req.userId] })).rows[0];
  if (!me || String(me.username).toLowerCase() !== owner) return res.status(403).json({ error: "Solo el dueño de la app" });
  next();
});

const count = async (sql, args = []) => Number((await db.execute({ sql, args })).rows[0]?.n || 0);

// Métricas simples: si la gente vuelve y qué parte del club juega el partido del día.
export async function metrics(today = todayStr()) {
  const users = await count("SELECT COUNT(*) AS n FROM users");
  const week = addDays(today, -7);
  const newWeek = await count("SELECT COUNT(*) AS n FROM users WHERE created_at >= ?", [week]);
  const playedToday = await count("SELECT COUNT(*) AS n FROM daily_match_results WHERE date = ?", [today]);
  const active7 = await count("SELECT COUNT(DISTINCT user_id) AS n FROM daily_match_results WHERE date >= ?", [week]);
  // retención: de quien se registró hace al menos N días, cuántos jugaron un partido ese día N o después
  const retention = async (n) => {
    const cohort = await count("SELECT COUNT(*) AS n FROM users WHERE date(created_at) <= ?", [addDays(today, -n)]);
    if (!cohort) return null;
    const back = await count(
      `SELECT COUNT(DISTINCT u.id) AS n FROM users u JOIN daily_match_results r ON r.user_id = u.id
       WHERE date(u.created_at) <= ? AND r.date >= date(u.created_at, '+' || ? || ' day')`,
      [addDays(today, -n), n],
    );
    return { cohort, back, pct: Math.round((100 * back) / cohort) };
  };
  const inClub = await count("SELECT COUNT(DISTINCT m.user_id) AS n FROM group_members m JOIN groups_t g ON g.id = m.group_id WHERE g.season_started_at IS NOT NULL");
  return {
    users, newWeek, playedToday, active7,
    pctPlayedToday: active7 ? Math.round((100 * playedToday) / active7) : null,
    d1: await retention(1), d7: await retention(7),
    pctInStartedClub: users ? Math.round((100 * inClub) / users) : null,
    clubs: { total: await count("SELECT COUNT(*) AS n FROM groups_t"), started: await count("SELECT COUNT(*) AS n FROM groups_t WHERE season_started_at IS NOT NULL") },
    events: (await db.execute({ sql: "SELECT name, COUNT(*) AS n FROM analytics_events WHERE at >= datetime('now', '-7 day') GROUP BY name ORDER BY n DESC LIMIT 12" })).rows.map((r) => ({ name: r.name, n: Number(r.n) })),
  };
}

adminRouter.get("/summary", async (req, res) => {
  try {
    const errors = (await db.execute("SELECT source, message, count, last_at FROM app_errors ORDER BY last_at DESC LIMIT 20")).rows;
    const jobs = (await db.execute("SELECT at, result_json FROM job_runs ORDER BY id DESC LIMIT 5")).rows.map((r) => ({ at: r.at, result: JSON.parse(r.result_json) }));
    const kitList = KITS.map((k) => ({ key: k.key, label: k.label, priority: k.priority }));
    const upcoming = (await db.execute({ sql: "SELECT date, kit_key, home_name, away_name FROM events WHERE date >= ? ORDER BY date LIMIT 10", args: [todayStr()] })).rows;
    res.json({ flag: redesignOn(), metrics: await metrics(), errors, jobs, alerts: (await checkAlerts()).alerts, kits: kitList, upcoming });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Partido de un día (de hoy a una semana adelante) con sus respuestas, para revisarlo antes de
// que se juegue. Se puede cambiar cualquier pregunta que nadie haya respondido todavía.
adminRouter.get("/match/:date", async (req, res) => {
  try {
    const date = String(req.params.date);
    const today = todayStr();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, 7)) return res.status(400).json({ error: "Fecha fuera de la semana" });
    const items = await matchFor(date);
    const answered = await count("SELECT COUNT(*) AS n FROM daily_match_answers WHERE date = ?", [date]);
    res.json({ date, locked: answered > 0, event: await eventOn(date), items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

adminRouter.post("/match/:date/reroll", async (req, res) => {
  try {
    const date = String(req.params.date);
    const idx = Number(req.body?.idx);
    const today = todayStr();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, 7)) return res.status(400).json({ error: "Fecha fuera de la semana" });
    if (await count("SELECT COUNT(*) AS n FROM daily_match_answers WHERE date = ?", [date])) return res.status(409).json({ error: "Ya hay respuestas de ese día: no se puede cambiar" });
    const items = await matchFor(date);
    const old = items[idx];
    if (!old) return res.status(400).json({ error: "Pregunta inexistente" });
    if (old.kind === "especial") return res.status(409).json({ error: "El juego especial del evento sale del kit: se cambia en data/events/kits.json" });
    const rand = rng(dailySeed(`${date}|${Date.now()}`, `reroll-${idx}`));
    const taken = new Set(items.map((i) => i.key));
    let fresh = null;
    for (let tries = 0; tries < 20 && !fresh; tries++) {
      const pool = old.kind === "quien" ? quienItems(rand, 6) : old.kind === "mas_menos" ? masMenosItems(rand, 8) : await penalItems(rand, 6);
      fresh = shuffle(pool, rand).find((c) => !taken.has(c.key)) || null;
    }
    if (!fresh) return res.status(409).json({ error: "No se encontró otra pregunta distinta" });
    items[idx] = fresh;
    await db.execute({ sql: "UPDATE daily_matches SET items_json = ? WHERE date = ?", args: [JSON.stringify(items), date] });
    res.json({ ok: true, idx, item: fresh });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Disparador de las tareas para un cron externo (Render free duerme sin tráfico).
export const jobsRouter = Router();
jobsRouter.post("/run", async (req, res) => {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret) return res.status(503).json({ error: "Falta configurar PUSH_CRON_SECRET" });
  if (req.get("x-cron-secret") !== secret) return res.status(401).json({ error: "No autorizado" });
  try { res.json(await runJobs()); } catch (err) { console.error(err); res.status(500).json({ error: "Error del servidor" }); }
});
