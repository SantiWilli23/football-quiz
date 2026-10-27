import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { dailySeed, rng, shuffle } from "./futgames.js";
import { POOL as VALUE_POOL } from "../routes/a-quien-me-compro.js";
import { eventOn, specialItems } from "./events.js";
import { leagueForClub } from "../data/league-clubs.js";

// Partido del día (Futotal 2.0): tres partes de ~1 minuto, iguales para todo el mundo.
//   1T  ¿Quién es?   — 6 jugadores por su carrera (4 opciones)
//   2T  Más o menos  — 8 duelos de valor de mercado
//   3T  Penales      — 3 preguntas rápidas: acertar es gol, fallar es atajado
// Marcador 0–100 (33 + 33 + 34). El 80% de cada pregunta es por acertar y el 20% por
// la rapidez, así gana el que sabe y no el que tiene mejor internet.
// Las respuestas correctas viven SOLO en el servidor (publicView las saca).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;

export const PART_WEIGHTS = [33, 33, 34];
export const PART_ITEMS = [6, 8, 3];
export const LIMIT_MS = { quien: 12000, mas_menos: 8000, penal: 6000 };
const TIME_SHARE = 0.2; // el tiempo pesa 20% de cada pregunta
const SERVER_GRACE_MS = 3000; // margen por latencia al contrastar el tiempo del cliente

// Áreas del ADN futbolero (cada pregunta cuenta para una; la velocidad sale de los tiempos).
export const AREAS = ["chile", "europa", "leyendas", "actualidad", "mercado", "velocidad"];
const TRIVIA_AREA = {
  "Liga Chilena": "chile", "Copa América": "chile", Libertadores: "chile",
  Europa: "europa", "Champions League": "europa", Eurocopa: "europa",
  Historia: "leyendas", Mundiales: "leyendas", Individuales: "leyendas", Reglas: "leyendas",
};
const isEuropean = (club) => !!club && !!leagueForClub(club);
export function areaOfPlayer(p) {
  const current = (p.carrera || []).find((c) => c.fin === null || c.fin === undefined);
  if (!current) return "leyendas";
  if (p.nacionalidad === "Chile" || /colo-colo|universidad (de chile|catolica)|palestino|cobreloa|union espanola/i.test(current.club)) return "chile";
  return isEuropean(current.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "")) ? "europa" : "actualidad";
}

const FAMOUS = PLAYERS.slice(0, 700).filter((p) => (p.carrera || []).length >= 4 && p.posicion);

export function quienItems(rand, n, filter = () => true) {
  const order = shuffle(FAMOUS, rand);
  const items = [];
  for (const p of order) {
    if (items.length >= n) break;
    if (!filter(p)) continue;
    const same = order.filter((o) => o.nombre !== p.nombre && o.posicion === p.posicion);
    if (same.length < 3) continue;
    const distractors = shuffle(same, rand).slice(0, 3).map((o) => o.nombre);
    const options = shuffle([p.nombre, ...distractors], rand);
    items.push({
      kind: "quien", key: `q:${p.nombre}`, part: 1, area: areaOfPlayer(p),
      clues: p.carrera.map((c) => ({ club: c.club.replace(/\s*\((cedido|cantera)\)\s*$/i, ""), from: c.inicio, to: c.fin ?? null })),
      position: p.posicion, options, answer: options.indexOf(p.nombre), limitMs: LIMIT_MS.quien,
    });
  }
  return items;
}

export function masMenosItems(rand, n) {
  const order = shuffle(VALUE_POOL, rand);
  const used = new Set();
  const items = [];
  let left = order[0];
  used.add(left.name);
  for (let guard = 0; items.length < n && guard < 400; guard++) {
    const candidates = order.filter((r) => !used.has(r.name) && r.value !== left.value && Math.max(r.value, left.value) / Math.min(r.value, left.value) <= 3);
    const right = candidates[Math.floor(rand() * candidates.length)];
    if (!right) { left = order[(guard + 1) % order.length]; continue; }
    used.add(right.name);
    items.push({
      kind: "mas_menos", key: `m:${left.name}|${right.name}`, part: 2, area: "mercado",
      left: { name: left.name, club: left.club, position: left.position, value: left.value },
      right: { name: right.name, club: right.club, position: right.position },
      options: ["Vale más", "Vale menos"], answer: right.value > left.value ? 0 : 1, rightValue: right.value, limitMs: LIMIT_MS.mas_menos,
    });
    left = right;
  }
  return items;
}

export async function penalItems(rand, n, area = null) {
  const a = (await db.execute("SELECT id, question, category, option_a, option_b, option_c, option_d, correct_answer FROM questions")).rows.map((r) => ({ ...r, src: "t" }));
  const b = (await db.execute("SELECT id, question, option_a, option_b, option_c, option_d, correct_answer FROM duel_questions")).rows.map((r) => ({ ...r, src: "d" }));
  // Calibración: con 20 respuestas o más, una pregunta que acierta casi todo el mundo (95%+) o casi
  // nadie (10% o menos) se saca de la tanda para que el partido salga parejo todos los días.
  const stats = new Map((await db.execute("SELECT question_key, shown, correct FROM question_stats WHERE shown >= 20")).rows.map((r) => [r.question_key, Number(r.correct) / Number(r.shown)]));
  const calibrated = (r) => { const p = stats.get(`${r.src}:${r.id}`); return p === undefined || (p < 0.95 && p > 0.1); };
  const tagged = [...a, ...b].filter(calibrated).filter((r) => !area || (r.src === "t" ? TRIVIA_AREA[r.category] || "actualidad" : "leyendas") === area);
  const bank = shuffle(tagged, rand).slice(0, n);
  return bank.map((r) => {
    const opts = [r.option_a, r.option_b, r.option_c, r.option_d];
    const correct = opts["abcd".indexOf(r.correct_answer)];
    const options = shuffle(opts, rand);
    return { kind: "penal", key: `${r.src}:${r.id}`, part: 3, area: r.src === "t" ? TRIVIA_AREA[r.category] || "actualidad" : "leyendas", question: r.question, options, answer: options.indexOf(correct), limitMs: LIMIT_MS.penal };
  });
}

// Sesión de entrenamiento de ~2 minutos sobre un área (del ADN): 6 preguntas, sin puntos.
// Se corrige en el teléfono, así que viajan con respuestas.
export async function trainingItems(area, seed) {
  const rand = rng(dailySeed(seed, `entreno-${area}`));
  if (area === "mercado") return masMenosItems(rand, 6);
  if (area === "velocidad") return penalItems(rand, 6);
  const players = quienItems(rand, 3, (p) => areaOfPlayer(p) === area);
  const trivia = await penalItems(rand, 6 - players.length, area);
  const items = [...players, ...trivia];
  if (items.length < 6) items.push(...(await penalItems(rand, 6 - items.length)));
  return items.slice(0, 6);
}

// Genera (o recupera) el partido de una fecha. Es determinista por fecha, así que
// dos servidores o un reinicio dan lo mismo; se guarda para fijarlo.
export async function matchFor(date) {
  const saved = (await db.execute({ sql: "SELECT items_json FROM daily_matches WHERE date = ?", args: [date] })).rows[0];
  if (saved) return JSON.parse(saved.items_json);
  const rand = rng(dailySeed(date, "partido-del-dia"));
  let items = [...quienItems(rand, PART_ITEMS[0]), ...masMenosItems(rand, PART_ITEMS[1]), ...(await penalItems(rand, PART_ITEMS[2]))];
  // Día de partido temático: el tercer tiempo es el juego especial del evento (en vez de los penales).
  const ev = await eventOn(date);
  const special = ev ? specialItems(ev, date) : null;
  if (special) items = [...items.filter((i) => i.part !== 3), ...special];
  await db.execute({ sql: "INSERT OR IGNORE INTO daily_matches (date, items_json) VALUES (?, ?)", args: [date, JSON.stringify(items)] });
  return items;
}

// Lo que ve el cliente antes de responder: sin la respuesta correcta ni el valor oculto.
export function publicView(items) {
  return items.map(({ answer, rightValue, ...rest }, idx) => ({ idx, ...rest }));
}

export function itemPoints(item, ok, ms) {
  if (!ok) return 0;
  const max = PART_WEIGHTS[item.part - 1] / PART_ITEMS[item.part - 1];
  const speed = Math.max(0, Math.min(1, 1 - ms / item.limitMs));
  return max * ((1 - TIME_SHARE) + TIME_SHARE * speed);
}

// El tiempo que cuenta es el mayor entre lo que dice el cliente y lo que el servidor
// vio pasar desde la respuesta anterior (menos un margen): mentir sobre el tiempo no sirve.
export function trustedMs(clientMs, serverElapsedMs, limitMs) {
  const c = Math.max(0, Math.min(Number(clientMs) || limitMs, limitMs));
  const s = Math.max(0, serverElapsedMs - SERVER_GRACE_MS);
  return Math.min(limitMs, Math.max(c, s));
}

// El total es la suma real redondeada, y las partes se reparten ese total por resto mayor:
// así las tres partes siempre suman exactamente el marcador que se muestra.
export function partTotals(rows) {
  const sums = [0, 0, 0];
  for (const r of rows) sums[r.part - 1] += r.points;
  const total = Math.round(sums[0] + sums[1] + sums[2]);
  const parts = sums.map(Math.floor);
  let missing = total - parts.reduce((a, b) => a + b, 0);
  const byRemainder = [0, 1, 2].sort((i, j) => (sums[j] - parts[j]) - (sums[i] - parts[i]));
  for (const i of byRemainder) {
    if (missing <= 0) break;
    parts[i] += 1;
    missing -= 1;
  }
  return { parts, total };
}

// Sobre del partido: ≥80 top, ≥50 bueno, si no normal (0 no da).
export function packQualityForTotal(total) {
  if (total >= 80) return "top";
  if (total >= 50) return "bueno";
  return total > 0 ? "normal" : null;
}
