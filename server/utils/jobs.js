import { db } from "../db/client.js";
import { addDays, chileHour, todayStr } from "./points.js";
import { redesignOn } from "./clubs.js";
import { ensureEventsDetected, eventOn, resolveEvent, kitByKey, resetDetection, liveFor } from "./events.js";
import { settleLastCup } from "./cup.js";
import { closeDueMonths } from "./month.js";
import { closeDueFriendlies } from "./friendly.js";
import { clubTable } from "./ledger.js";
import { sendToUser } from "./push.js";

// Tareas programadas (Futotal 2.0, V3) y registro de errores (V4). Todo corre en este mismo
// proceso cada pocos minutos y también se puede disparar desde un cron externo (Render free
// duerme el servicio sin tráfico): POST /api/jobs/run con el encabezado x-cron-secret.
export const JOB_EVERY_MS = 10 * 60_000;
export const MAX_PUSH_PER_DAY = 3;

export async function logError(source, err) {
  const message = String(err?.message || err).slice(0, 300);
  try {
    await db.execute({
      sql: `INSERT INTO app_errors (source, message, count, last_at) VALUES (?, ?, 1, datetime('now'))
            ON CONFLICT(source, message) DO UPDATE SET count = count + 1, last_at = datetime('now')`,
      args: [source, message],
    });
  } catch { /* el registro de errores nunca rompe nada */ }
  console.error(`[${source}]`, message);
}

async function step(name, fn, out) {
  const t0 = Date.now();
  try {
    out[name] = { ok: true, ms: 0, ...(await fn()) };
    out[name].ms = Date.now() - t0;
  } catch (err) {
    out[name] = { ok: false, error: String(err?.message || err), ms: Date.now() - t0 };
    await logError(`job:${name}`, err);
  }
}

export async function runJobs({ today = todayStr(), send = sendToUser, now = new Date() } = {}) {
  const out = {};
  await step("eventos", async () => {
    if (!redesignOn()) return { skipped: true };
    resetDetection();
    const t = await ensureEventsDetected(today);
    const m = await ensureEventsDetected(addDays(today, 1));
    for (const d of [addDays(today, -1), today]) if (await eventOn(d)) await resolveEvent(d);
    return { hoy: !!t, manana: !!m };
  }, out);
  await step("copas", async () => {
    const clubs = (await db.execute("SELECT id FROM groups_t WHERE season_started_at IS NOT NULL")).rows;
    let settled = 0;
    for (const c of clubs) if ((await settleLastCup(c.id)).settled) settled += 1;
    return { clubs: clubs.length, repartidas: settled };
  }, out);
  await step("meses", async () => ({ cerrados: (await closeDueMonths(today)).length }), out);
  await step("amistosos", async () => ({ cerrados: (await closeDueFriendlies(today)).length }), out);
  await step("goles", async () => notifyGoals({ today, send }), out);
  await step("avisos", async () => sendSmartReminders({ today, now, send }), out);
  await step("alertas", async () => checkAlerts(today), out);
  try { await db.execute({ sql: "INSERT INTO job_runs (at, result_json) VALUES (datetime('now'), ?)", args: [JSON.stringify(out)] }); } catch { /* sin registro */ }
  return out;
}

// ---------- avisos con motivo, «a tu hora» ----------

// La hora del día (en Chile) en que más sueles jugar, mirando tus últimos 14 días de partidos.
export async function usualHour(userId) {
  const rows = (await db.execute({ sql: "SELECT last_at FROM daily_match_runs WHERE user_id = ? ORDER BY date DESC LIMIT 14", args: [userId] })).rows;
  if (rows.length < 3) return null;
  const counts = new Map();
  for (const r of rows) {
    const h = chileHour(new Date(Number(r.last_at)));
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

// El motivo concreto del aviso (nunca un «vuelve» genérico): alguien te pasó en la tabla, quedan
// pocas horas, o mañana hay un partido temático.
export async function reminderFor(userId, today, hour) {
  const clubs = (await db.execute({
    sql: `SELECT g.id, g.name FROM group_members m JOIN groups_t g ON g.id = m.group_id
          WHERE m.user_id = ? AND g.season_started_at IS NOT NULL`,
    args: [userId],
  })).rows;
  for (const c of clubs) {
    const table = await clubTable(c.id, "hoy", today);
    const played = table.find((r) => r.userId !== userId && r.points > 0);
    if (played) return { title: "Futotal", body: `${played.username} ya sacó ${played.points} en ${c.name}. ¿Lo pasás?`, url: "/partido", reason: "paso" };
  }
  const tomorrow = await eventOn(addDays(today, 1));
  if (tomorrow) return { title: "Futotal", body: `Mañana es ${kitByKey(tomorrow.kit_key)?.label || "un partido especial"}: ${tomorrow.home_name} vs ${tomorrow.away_name}. Deja tu pronóstico.`, url: "/hoy", reason: "evento" };
  if (hour >= 21) return { title: "Futotal", body: "Quedan pocas horas para el partido de hoy.", url: "/partido", reason: "tiempo" };
  return { title: "Futotal", body: "Ya está el partido de hoy. Igual para todo tu club.", url: "/partido", reason: "diario" };
}

export async function sendSmartReminders({ today = todayStr(), now = new Date(), send = sendToUser } = {}) {
  const hour = chileHour(now);
  const users = (await db.execute({
    sql: `SELECT DISTINCT s.user_id FROM push_subscriptions s
          WHERE s.user_id NOT IN (SELECT user_id FROM daily_match_results WHERE date = ?)`,
    args: [today],
  })).rows;
  let sent = 0;
  let considered = 0;
  for (const u of users) {
    const usual = await usualHour(u.user_id);
    if (usual === null || usual !== hour) continue; // sin hábito conocido no se manda: no se inventa una hora
    considered += 1;
    const used = Number((await db.execute({ sql: "SELECT n FROM push_day WHERE user_id = ? AND date = ?", args: [u.user_id, today] })).rows[0]?.n || 0);
    if (used >= MAX_PUSH_PER_DAY) continue;
    const msg = await reminderFor(u.user_id, today, hour);
    const n = await send(u.user_id, { title: msg.title, body: msg.body, url: msg.url });
    if (n > 0) {
      sent += 1;
      await db.execute({ sql: `INSERT INTO push_day (user_id, date, n) VALUES (?, ?, 1) ON CONFLICT(user_id, date) DO UPDATE SET n = n + 1`, args: [u.user_id, today] });
    }
  }
  return { considered, sent, hour };
}

// ---------- aviso de gol ----------
// En un partido temático en juego, cada vez que cambia el marcador se avisa a quienes lo siguen
// (pronosticaron o eligieron hinchada). Cuenta dentro del tope de 3 avisos por día.
export async function notifyGoals({ today = todayStr(), send = sendToUser, getMatch = liveFor } = {}) {
  const evs = (await db.execute({ sql: "SELECT * FROM events WHERE date = ?", args: [today] })).rows;
  let goals = 0;
  let sent = 0;
  for (const ev of evs) {
    let m;
    try { m = await getMatch(ev.league, ev.event_id); } catch (err) { await logError("live", err); continue; }
    if (!m || (!m.live && !m.finished)) continue;
    const score = `${m.score.home ?? 0}-${m.score.away ?? 0}`;
    const prev = ev.last_score;
    if (score === prev) continue;
    await db.execute({ sql: "UPDATE events SET last_score = ? WHERE date = ?", args: [score, today] });
    if (prev === null || prev === undefined || m.finished) continue; // la primera lectura o el final no avisan
    const [ph, pa] = prev.split("-").map(Number);
    if ((m.score.home ?? 0) + (m.score.away ?? 0) <= ph + pa) continue; // un VAR que anula un gol no es un gol
    goals += 1;
    const side = (m.score.home ?? 0) > ph ? "home" : "away";
    const scorer = [...m.events].reverse().find((e) => e.type === "goal" || e.type === "pen_goal" || e.type === "own_goal");
    const followers = (await db.execute({
      sql: `SELECT DISTINCT user_id FROM (SELECT user_id FROM event_preds WHERE date = ? UNION SELECT user_id FROM event_sides WHERE date = ?)`,
      args: [today, today],
    })).rows;
    for (const f of followers) {
      const used = Number((await db.execute({ sql: "SELECT n FROM push_day WHERE user_id = ? AND date = ?", args: [f.user_id, today] })).rows[0]?.n || 0);
      if (used >= MAX_PUSH_PER_DAY) continue;
      const body = `¡Gol de ${m.teams[side]?.name}! ${scorer?.player ? `${scorer.player} ` : ""}${m.teams.home?.name} ${score} ${m.teams.away?.name}`.replace(/\s+/g, " ");
      const n = await send(f.user_id, { title: "Futotal", body, url: `/vivo/${ev.league}/${ev.event_id}` });
      if (n > 0) {
        sent += 1;
        await db.execute({ sql: "INSERT INTO push_day (user_id, date, n) VALUES (?, ?, 1) ON CONFLICT(user_id, date) DO UPDATE SET n = n + 1", args: [f.user_id, today] });
      }
    }
  }
  return { goals, sent };
}

// ---------- alertas (V4) ----------
// Avisan si no se generó el partido del día, si la fuente de partidos en vivo viene fallando o si
// alguna tarea programada falló. Quedan registradas y el panel del dueño las muestra.
export async function checkAlerts(today = todayStr()) {
  const alerts = [];
  const match = (await db.execute({ sql: "SELECT 1 FROM daily_matches WHERE date = ?", args: [today] })).rows[0];
  if (!match && chileHour() >= 6) alerts.push("El partido de hoy todavía no se generó (nadie lo abrió o falló la generación).");
  const live = (await db.execute({ sql: "SELECT count, last_at FROM app_errors WHERE source = 'live' ORDER BY last_at DESC LIMIT 1" })).rows[0];
  if (live && Number(live.count) >= 5) alerts.push(`La fuente de partidos en vivo falló ${live.count} veces (último: ${live.last_at}).`);
  const failed = (await db.execute("SELECT source, last_at FROM app_errors WHERE source LIKE 'job:%' AND last_at > datetime('now', '-1 day')")).rows;
  for (const f of failed) alerts.push(`Falló la tarea ${f.source.slice(4)} (${f.last_at}).`);
  return { alerts };
}

let timer = null;
export function startJobs() {
  if (timer || !redesignOn()) return;
  const tick = () => runJobs().catch((e) => logError("jobs", e));
  timer = setInterval(tick, JOB_EVERY_MS);
  timer.unref();
  setTimeout(tick, 15_000).unref();
}
