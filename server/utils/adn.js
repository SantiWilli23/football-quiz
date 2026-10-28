import { db } from "../db/client.js";
import { addDays, mondayOf, monthOf, todayStr } from "./points.js";

// ADN futbolero (Futotal 2.0): seis áreas, de 0 a 99, comparadas con el resto de los jugadores.
// Cinco salen de qué tan bien respondes las preguntas de cada tema (Chile, Europa, Leyendas,
// Actualidad, Mercado) y la sexta, Velocidad, de qué tan rápido respondes. Un área solo se
// muestra con 15 respuestas o más: antes, «faltan datos».
export const AREAS = ["chile", "europa", "leyendas", "actualidad", "mercado", "velocidad"];
export const AREA_LABEL = { chile: "Chile", europa: "Europa", leyendas: "Leyendas", actualidad: "Actualidad", mercado: "Mercado", velocidad: "Velocidad" };
export const MIN_ANSWERS = 15;
// Con pocos jugadores, un percentil no significa nada: se usa el rendimiento propio.
const MIN_PLAYERS_FOR_PERCENTILE = 10;
const MAX_SCORE = 99;

export function rangeFor(range, today = todayStr()) {
  if (range === "week") return { from: mondayOf(today), to: today };
  if (range === "month") return { from: `${monthOf(today)}-01`, to: today };
  return { from: "0000-01-01", to: today };
}

export function previousRange(range, today = todayStr()) {
  if (range === "week") { const m = addDays(mondayOf(today), -7); return { from: m, to: addDays(m, 6) }; }
  if (range === "month") {
    const first = `${monthOf(today)}-01`;
    const last = addDays(first, -1);
    return { from: `${monthOf(last)}-01`, to: last };
  }
  return null;
}

// Una fila por jugador y área en el período: respuestas, aciertos y rapidez media.
async function rows(from, to, userId = null) {
  return (await db.execute({
    sql: `SELECT user_id, area, COUNT(*) AS n, SUM(ok) AS hits, AVG(speed) AS speed
          FROM daily_match_answers WHERE date BETWEEN ? AND ? AND area IS NOT NULL ${userId ? "AND user_id = ?" : ""}
          GROUP BY user_id, area`,
    args: userId ? [from, to, userId] : [from, to],
  })).rows.map((r) => ({ userId: r.user_id, area: r.area, n: Number(r.n), hits: Number(r.hits), speed: r.speed == null ? null : Number(r.speed) }));
}

// Por jugador: porcentaje de aciertos por área y rapidez general (todas las respuestas).
function metrics(list) {
  const byUser = new Map();
  for (const r of list) {
    const u = byUser.get(r.userId) || { areas: {}, speedSum: 0, speedN: 0 };
    u.areas[r.area] = { n: r.n, acc: r.n ? r.hits / r.n : 0 };
    if (r.speed != null) { u.speedSum += r.speed * r.n; u.speedN += r.n; }
    byUser.set(r.userId, u);
  }
  for (const u of byUser.values()) u.velocidad = u.speedN ? { n: u.speedN, acc: u.speedSum / u.speedN } : { n: 0, acc: 0 };
  return byUser;
}

const valueOf = (u, area) => (area === "velocidad" ? u.velocidad : u.areas[area] || { n: 0, acc: 0 });

// Percentil de `value` entre quienes tienen datos suficientes (0 a 1).
export function percentile(value, others) {
  if (!others.length) return null;
  const below = others.filter((v) => v < value).length;
  const equal = others.filter((v) => v === value).length;
  return (below + equal / 2) / others.length;
}

// Calcula el ADN de un usuario en un período. `population` es el resto de los jugadores del mismo período.
export async function computeAdn(userId, range = "month", today = todayStr()) {
  const { from, to } = rangeFor(range, today);
  const all = metrics(await rows(from, to));
  const mine = all.get(userId) || { areas: {}, velocidad: { n: 0, acc: 0 } };
  const out = {};
  for (const area of AREAS) {
    const m = valueOf(mine, area);
    if (m.n < MIN_ANSWERS) { out[area] = { label: AREA_LABEL[area], answers: m.n, score: null, pct: null }; continue; }
    const qualified = [...all.entries()].filter(([id, u]) => id !== userId && valueOf(u, area).n >= MIN_ANSWERS).map(([, u]) => valueOf(u, area).acc);
    const score = qualified.length + 1 >= MIN_PLAYERS_FOR_PERCENTILE
      ? Math.round(percentile(m.acc, qualified) * MAX_SCORE)
      : Math.round(m.acc * MAX_SCORE);
    out[area] = { label: AREA_LABEL[area], answers: m.n, score, pct: Math.round(m.acc * 100) };
  }
  return { range, from, to, areas: out, answers: Object.values(mine.areas).reduce((n, a) => n + a.n, 0) };
}

export function strongestAndWeakest(areas) {
  const scored = AREAS.filter((a) => areas[a].score !== null).map((a) => [a, areas[a].score]);
  if (scored.length < 2) return { best: scored[0]?.[0] || null, worst: null };
  scored.sort((x, y) => y[1] - x[1]);
  return { best: scored[0][0], worst: scored[scored.length - 1][0] };
}

// Arquetipo: se decide por la combinación de áreas, no por una sola.
export function archetypeOf(areas) {
  const s = (a) => areas[a]?.score;
  const scored = AREAS.filter((a) => s(a) != null);
  if (scored.length < 3) return null;
  const top = [...scored].sort((a, b) => s(b) - s(a))[0];
  const avg = scored.reduce((n, a) => n + s(a), 0) / scored.length;
  if (scored.length === AREAS.length && AREAS.every((a) => s(a) >= 60)) return "Enciclopedia";
  const byTop = { leyendas: "Nostálgico", mercado: "Mercadero", chile: "Hincha local", europa: "Europeo", velocidad: "Relámpago", actualidad: "Al día" };
  return top && s(top) >= avg ? byTop[top] : null;
}

const SUGGESTION = {
  chile: { text: "Practica preguntas de la liga chilena y la Roja.", game: "/club" },
  europa: { text: "Mira los partidos de las grandes ligas y practica Champions.", game: "/futbol" },
  leyendas: { text: "Prueba «¿Quién es?» con jugadores retirados y las partidas de Cotrero.", game: "/fulbodle" },
  actualidad: { text: "Sigue los resultados de la semana y los fichajes.", game: "/futbol" },
  mercado: { text: "Entrená con «Más o menos»: cuánto vale cada jugador.", game: "/a-quien-me-compro" },
  velocidad: { text: "Responde sin pensarlo de más: la rapidez pesa el 20% de cada pregunta.", game: "/partido" },
};

// Análisis semanal o mensual: mejor y peor área, cuánto subiste o bajaste, sugerencia concreta
// y comparación con el promedio de tu club.
export async function analysis(userId, range = "week", { groupId = null, today = todayStr() } = {}) {
  const current = await computeAdn(userId, range, today);
  const prevRange = previousRange(range, today);
  const prev = prevRange ? await computeAdn(userId, range, addDays(prevRange.to, 0)) : null;
  const { best, worst } = strongestAndWeakest(current.areas);
  const deltas = {};
  for (const a of AREAS) {
    const c = current.areas[a].score;
    const p = prev?.areas[a].score;
    deltas[a] = c != null && p != null ? c - p : null;
  }
  let club = null;
  if (groupId) {
    const members = (await db.execute({ sql: "SELECT user_id FROM group_members WHERE group_id = ?", args: [groupId] })).rows.map((r) => r.user_id);
    const scores = {};
    for (const a of AREAS) scores[a] = [];
    for (const id of members) {
      if (id === userId) continue;
      const adn = await computeAdn(id, range, today);
      for (const a of AREAS) if (adn.areas[a].score != null) scores[a].push(adn.areas[a].score);
    }
    club = Object.fromEntries(AREAS.map((a) => [a, scores[a].length ? Math.round(scores[a].reduce((n, v) => n + v, 0) / scores[a].length) : null]));
  }
  return {
    ...current, previous: prev?.areas || null, deltas, best, worst,
    suggestion: worst ? { area: worst, ...SUGGESTION[worst] } : null,
    archetype: archetypeOf(current.areas), specialty: range === "month" ? best : null, club,
  };
}

// ---------- carta Futotal ----------
// Su media es el promedio de tus últimos 30 partidos del día: bronce < 60, plata 60–74,
// oro 75–84, especial 85 o más.
export function tierOfMedia(media) {
  if (media >= 85) return "especial";
  if (media >= 75) return "oro";
  if (media >= 60) return "plata";
  return "bronce";
}

export async function futotalCard(userId) {
  const rows = (await db.execute({ sql: "SELECT total FROM daily_match_results WHERE user_id = ? ORDER BY date DESC LIMIT 30", args: [userId] })).rows;
  if (!rows.length) return { played: 0, media: null, tier: null };
  const media = Math.round(rows.reduce((n, r) => n + Number(r.total), 0) / rows.length);
  return { played: rows.length, media, tier: tierOfMedia(media) };
}
