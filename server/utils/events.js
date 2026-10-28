import fs from "node:fs";
import { grant, safely } from "./achievements.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { addDays, mondayOf, todayStr } from "./points.js";
import { normalize, shuffle, rng, dailySeed } from "./futgames.js";

// Partidos temáticos (Futotal 2.0): un clásico o una final real convierte el partido del día
// en un evento con identidad propia. Agregar un evento = llenar un kit (data/events/kits.json).
// Reglas de cuándo hay uno: prioridad 1 clásicos chilenos, 2 grandes clásicos europeos, 3
// finales de Champions; máximo 2 por semana.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const KITS = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/events/kits.json"), "utf-8")).kits;
export const MAX_EVENTS_PER_WEEK = 2;
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer";

const PLAYERS = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;
const ALIASES = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/club-aliases.json"), "utf-8")).alias || {};
    return new Map(Object.entries(raw).map(([k, v]) => [normalize(k), v]));
  } catch { return new Map(); }
})();
// Nombre del club como figura en las carreras de la base.
export const careerName = (name) => ALIASES.get(normalize(name)) || name;

const kitByKey = (key) => KITS.find((k) => k.key === key) || null;
export { kitByKey };

const sameTeam = (kitTeam, name) => {
  const n = normalize(name);
  return [kitTeam.name, ...(kitTeam.aliases || [])].some((a) => normalize(a) === n);
};

const looksLikeFinal = (ev) => {
  const note = (ev?.competitions?.[0]?.notes || []).map((n) => n.headline).join(" ");
  const text = `${ev?.name || ""} ${note} ${ev?.season?.slug || ""}`;
  return /\bfinal\b/i.test(text) && !/semi|quarter|cuartos|round|play-?off|1\/8|group/i.test(text);
};

// ¿Este partido del tablero de ESPN es de algún kit? Devuelve { kit, teams } o null.
export function matchKit(ev, league) {
  const comp = ev?.competitions?.[0];
  const home = comp?.competitors?.find((c) => c.homeAway === "home")?.team;
  const away = comp?.competitors?.find((c) => c.homeAway === "away")?.team;
  if (!home || !away) return null;
  for (const kit of KITS) {
    if (!kit.leagues.includes(league)) continue;
    if (kit.finalOnly) {
      if (looksLikeFinal(ev)) return { kit, home, away };
      continue;
    }
    const [a, b] = kit.teams;
    if (kit.anyOpponent) {
      if (sameTeam(a, home.displayName) || sameTeam(a, away.displayName)) return { kit, home, away };
      continue;
    }
    if ((sameTeam(a, home.displayName) && sameTeam(b, away.displayName)) || (sameTeam(b, home.displayName) && sameTeam(a, away.displayName))) return { kit, home, away };
  }
  return null;
}

async function defaultScoreboard(slug, date) {
  const res = await fetch(`${SCOREBOARD}/${slug}/scoreboard?dates=${date.replace(/-/g, "")}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

export async function eventOn(date) {
  const r = (await db.execute({ sql: "SELECT * FROM events WHERE date = ?", args: [date] })).rows[0];
  return r || null;
}

const weekCount = async (date) => Number((await db.execute({
  sql: "SELECT COUNT(*) AS n FROM events WHERE date BETWEEN ? AND ?",
  args: [mondayOf(date), addDays(mondayOf(date), 6)],
})).rows[0].n);

// Busca partidos temáticos de una fecha y los guarda. Idempotente; respeta el tope semanal y
// la prioridad (si hay dos en un día, queda el de mejor prioridad).
export async function detectEvents(date, { scoreboard = defaultScoreboard } = {}) {
  const found = [];
  const leagues = [...new Set(KITS.flatMap((k) => k.leagues))];
  const boards = await Promise.all(leagues.map(async (slug) => { try { return [slug, await scoreboard(slug, date)]; } catch { return [slug, null]; } }));
  for (const [slug, json] of boards) {
    for (const ev of json?.events || []) {
      const m = matchKit(ev, slug);
      if (m) found.push({ ...m, ev, slug });
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => a.kit.priority - b.kit.priority);
  const best = found[0];
  const existing = await eventOn(date);
  if (existing) return existing;
  if ((await weekCount(date)) >= MAX_EVENTS_PER_WEEK) return null;
  await db.execute({
    sql: `INSERT OR IGNORE INTO events (date, kit_key, league, event_id, home_name, home_id, away_name, away_id, kickoff)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [date, best.kit.key, best.slug, String(best.ev.id), best.home.displayName, String(best.home.id), best.away.displayName, String(best.away.id), best.ev.date || null],
  });
  return eventOn(date);
}

const detected = new Map(); // fecha -> marca de tiempo del último intento
export async function ensureEventsDetected(date, opts = {}) {
  const last = detected.get(date) || 0;
  if (Date.now() - last < 30 * 60_000) return eventOn(date); // como mucho cada 30 min por fecha
  detected.set(date, Date.now());
  try { return await detectEvents(date, opts); } catch { return eventOn(date); }
}
export const resetDetection = () => detected.clear();

// ---------- juego especial del tercer tiempo ----------

const playersWith = (name) => PLAYERS.filter((p) => (p.carrera || []).some((c) => careerName(c.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "")) === name));

// «¿En qué club jugó?»: Colo-Colo, la U o los dos (con los clubes del evento). Sale de las
// carreras de la base, así que sirve para cualquier clásico o final.
export function clubQuestions(clubA, clubB, rand, n) {
  const A = new Set(playersWith(clubA.career).map((p) => p.nombre));
  const B = new Set(playersWith(clubB.career).map((p) => p.nombre));
  const pool = [];
  for (const p of PLAYERS.slice(0, 1200)) {
    const inA = A.has(p.nombre);
    const inB = B.has(p.nombre);
    if (inA || inB) pool.push({ p, answer: inA && inB ? 2 : inA ? 0 : 1 });
  }
  // un poco de cada respuesta para que no siempre sea lo mismo
  const by = [0, 1, 2].map((k) => shuffle(pool.filter((x) => x.answer === k), rand));
  const picks = [];
  for (let i = 0; picks.length < n && i < 200; i++) {
    const k = [0, 1, 2][i % 3];
    if (by[k].length) picks.push(by[k].pop());
  }
  const options = [clubA.name, clubB.name, "Los dos"];
  return picks.map(({ p, answer }) => ({ q: `¿En qué club jugó ${p.nombre}?`, options, answer, key: `club:${p.nombre}` }));
}

// Los 3 ítems del tercer tiempo en un día de evento. `ev` es la fila de events.
export function specialItems(ev, date) {
  const kit = kitByKey(ev.kit_key);
  if (!kit || kit.special?.kind === "none") return null;
  const rand = rng(dailySeed(date, `evento-${ev.kit_key}`));
  const names = { A: { name: kit.teams[0]?.name || ev.home_name, career: kit.teams[0]?.career || careerName(ev.home_name) }, B: { name: kit.teams[1]?.name || ev.away_name, career: kit.teams[1]?.career || careerName(ev.away_name) } };
  const items = [];
  const statics = kit.special?.static ? shuffle(kit.special.static, rand).slice(0, 2) : [];
  for (const s of statics) items.push({ q: s.q, options: s.options, answer: s.answer, key: `static:${s.q}` });
  const club = clubQuestions(names.A, names.B, rand, 3 - items.length);
  items.push(...club);
  if (items.length < 3) return null;
  return items.slice(0, 3).map((it) => {
    // se mezclan las opciones sin perder cuál es la correcta (los dos/ninguno van al final)
    return { kind: "especial", key: it.key, part: 3, area: "leyendas", title: kit.special.title, question: it.q, options: it.options, answer: it.answer, limitMs: 8000 };
  });
}

// ---------- resolución con el resultado real ----------

export async function resolveEvent(date, { getMatch } = {}) {
  const ev = await eventOn(date);
  if (!ev || ev.resolved_at) return ev;
  const fetchMatch = getMatch || (async (league, id) => (await import("./live-feed.js")).getLiveMatch(league, id));
  let m;
  try { m = await fetchMatch(ev.league, ev.event_id); } catch { return ev; }
  if (!m?.finished) return ev;
  const result = { home: m.score.home, away: m.score.away, pens: m.score.pens || null };
  await db.execute({ sql: "UPDATE events SET real_result = ?, resolved_at = datetime('now') WHERE date = ?", args: [JSON.stringify(result), date] });
  // pronóstico: quien acertó el ganador (o el empate) gana un sobre
  const winner = result.home > result.away ? "home" : result.home < result.away ? "away" : "draw";
  const hits = (await db.execute({ sql: "SELECT user_id FROM event_preds WHERE date = ? AND pick = ?", args: [date, winner] })).rows;
  for (const h of hits) {
    await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [h.user_id, date, `evento-pred-${date}`] });
    const won = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND source LIKE 'evento-pred-%'", args: [h.user_id] })).rows[0].n);
    if (won >= 3) await safely(grant(h.user_id, "pronosticador"));
  }
  return eventOn(date);
}

export const publicEvent = (ev) => {
  if (!ev) return null;
  const kit = kitByKey(ev.kit_key);
  return {
    date: ev.date, kit: ev.kit_key, label: kit?.label, entry: kit?.entry, palette: kit?.palette, badge: kit?.badge,
    league: ev.league, eventId: ev.event_id, kickoff: ev.kickoff,
    teams: { home: { id: ev.home_id, name: ev.home_name }, away: { id: ev.away_id, name: ev.away_name } },
    result: ev.real_result ? JSON.parse(ev.real_result) : null,
  };
};

export const relativeDays = (today = todayStr()) => [["yesterday", addDays(today, -1)], ["today", today], ["tomorrow", addDays(today, 1)]];

// ---------- proveedores (se pueden reemplazar en los tests) ----------
let liveProvider = async (league, id) => (await import("./live-feed.js")).getLiveMatch(league, id);
export const liveFor = (league, id) => liveProvider(league, id);
export function setLiveProvider(fn) { liveProvider = fn; }

// Plantel de un equipo (candidatos para «Adivina la alineación»), con caché de 6 horas.
const squadCache = new Map();
async function defaultSquad(league, teamId) {
  const res = await fetch(`${SCOREBOARD}/${league}/teams/${teamId}/roster`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const json = await res.json();
  return (json.athletes || []).map((a) => a.displayName || a.fullName).filter(Boolean);
}
let squadProvider = defaultSquad;
export async function squadFor(league, teamId) {
  const key = `${league}|${teamId}`;
  const hit = squadCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.names;
  const names = await squadProvider(league, teamId);
  squadCache.set(key, { names, at: Date.now() });
  return names;
}
export function setSquadProvider(fn) { squadProvider = fn; squadCache.clear(); }
