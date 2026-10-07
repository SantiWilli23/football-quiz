import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";

// Tipos de carta nuevos para Cartas, aparte de las de jugador de siempre:
//   - Ícono:    versión de leyenda (retirados muy conocidos), más media que la base.
//   - Momento:  una jugada histórica, con media fija y su historia en la nota.
//   - Entrenador (DT): no entra al once; se pone aparte y da bonus al equipo.
//   - Capitán:  uno de los 11; las conexiones de club con él cuentan doble.
//   - Selecciones: bonus por tener jugadores de un plantel histórico en el once.
//   - En forma: +3 de media, hasta que pase una semana, a quien hizo un gol
//     en las ligas reales (datos de ESPN).
// Todo vive acá para tocar lo menos posible routes/cards.js: las cartas nuevas
// tienen la misma forma que las de siempre, así álbum, venta y SBC las manejan solas.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, "../data", file), "utf-8"));

export const normName = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const TIER_LABEL = { estrella: "Estrella", oro: "Oro", plata: "Plata", bronce: "Bronce" };
const tierKeyForOvr = (ovr) => (ovr >= 88 ? "estrella" : ovr >= 78 ? "oro" : ovr >= 65 ? "plata" : "bronce");
const tierFields = (ovr) => {
  const tier = tierKeyForOvr(ovr);
  return { tier, tierLabel: TIER_LABEL[tier] };
};

const ICON_MAX = 70; // cuántas leyendas hay como máximo
const ICON_BONUS = 4; // lo que suma la versión Ícono sobre la carta base
export const FORM_BONUS = 3;
export const CAPTAIN_CHEM_CAP_EXTRA = 5;
const COACH_OVR_CAP = 20;

// ---------- armado de las cartas nuevas ----------
let COACHES = [];
let MOMENTS = [];
let ICONS = [];
let SQUADS = [];
let EXTRA_CARDS = [];
let COACH_BY_NAME = new Map();

// `baseCards` son las cartas de jugador de routes/cards.js (con clubs, nacionalidad, retired...).
export function buildExtraCards(baseCards) {
  const byNorm = new Map(baseCards.map((c) => [normName(c.realName), c]));

  // Íconos: retirados entre los más conocidos (la base viene ordenada por fama).
  ICONS = baseCards
    .filter((c) => c.retired && (c.tier === "estrella" || c.tier === "oro"))
    .slice(0, ICON_MAX)
    .map((c) => {
      const ovr = Math.min(99, c.ovr + ICON_BONUS);
      return {
        name: `${c.realName} · Ícono`, realName: c.realName, special: "Ícono", kind: "icono",
        note: "Versión de leyenda", ovr, ...tierFields(ovr),
        pos: c.pos, nationality: c.nationality, clubs: c.clubs, club: c.club,
      };
    });

  // Momentos: media fija; los clubes y la nacionalidad salen de la carta base del jugador.
  MOMENTS = [];
  try {
    for (const m of readJson("cartas-momentos.json").momentos) {
      const base = byNorm.get(normName(m.jugador));
      if (!base) continue;
      const ovr = Math.max(0, Math.min(98, m.media));
      MOMENTS.push({
        name: `${base.realName} · ${m.titulo}`, realName: base.realName, special: "Momento", kind: "momento",
        note: m.nota, ovr, ...tierFields(ovr),
        pos: base.pos, nationality: base.nationality, clubs: base.clubs, club: base.club,
      });
    }
  } catch { /* sin archivo de momentos: simplemente no hay */ }

  // Entrenadores.
  COACHES = [];
  try {
    for (const c of readJson("cartas-entrenadores.json").entrenadores) {
      const ovr = c.ovr;
      COACHES.push({
        name: `${c.nombre} · DT`, realName: c.nombre, special: "Entrenador", kind: "entrenador",
        note: c.texto, effect: c.effect, ovr, ...tierFields(ovr),
        pos: "DT", nationality: c.nacionalidad, clubs: new Set(), club: "Entrenador",
      });
    }
  } catch { /* idem */ }
  COACH_BY_NAME = new Map(COACHES.map((c) => [c.name, c]));

  // Selecciones: se guardan los nombres normalizados de cada plantel.
  SQUADS = [];
  try {
    for (const s of readJson("cartas-selecciones.json").selecciones) {
      const names = [...new Set(s.jugadores.map(normName))].filter((n) => byNorm.has(n));
      if (names.length >= 6) SQUADS.push({ id: s.id, label: s.label, names: new Set(names), size: names.length });
    }
  } catch { /* idem */ }

  EXTRA_CARDS = [...ICONS, ...MOMENTS, ...COACHES];
  return EXTRA_CARDS;
}

// ---------- cómo salen en los sobres ----------
// Chance por carta de cada sobre. Los sobres de leyendas y estrella tienen más.
const DRAW_CHANCE = {
  normal: { entrenador: 0.015, momento: 0.01, icono: 0 },
  bueno: { entrenador: 0.025, momento: 0.02, icono: 0.004 },
  top: { entrenador: 0.04, momento: 0.035, icono: 0.012 },
  estrella: { entrenador: 0.05, momento: 0.05, icono: 0.03 },
  leyendas: { entrenador: 0.02, momento: 0.05, icono: 0.06 },
  iconos: { entrenador: 0.04, momento: 0.08, icono: 0.1 },
};
const DEFAULT_CHANCE = { entrenador: 0.02, momento: 0.015, icono: 0.002 };
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Sobres nuevos que se suman a PACKS (routes/cards.js).
export const EXTRA_PACKS = {
  iconos: {
    label: "Sobre Íconos",
    desc: "Una leyenda en versión Ícono asegurada, y más chances de Momentos y entrenadores.",
    price: 520,
    weights: { estrella: 20, oro: 35, plata: 30, bronce: 15 },
    guaranteeExtra: "icono",
  },
};

// Devuelve una carta nueva o null (entonces sigue el sorteo normal).
export function drawExtra(packType, index, packDef = null) {
  if (packDef?.guaranteeExtra === "icono" && index === 0 && ICONS.length) return pickOf(ICONS);
  if (packDef?.guarantee && index === 0) return null; // la estrella asegurada del sobre estrella no se pisa
  const chance = DRAW_CHANCE[packType] || DEFAULT_CHANCE;
  const r = Math.random();
  let acc = 0;
  for (const [kind, pool] of [["icono", ICONS], ["momento", MOMENTS], ["entrenador", COACHES]]) {
    acc += chance[kind] ?? 0;
    if (r < acc && pool.length) return pickOf(pool);
  }
  return null;
}

// ---------- capitán, entrenador y selecciones ----------
let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db.execute(
      "CREATE TABLE IF NOT EXISTS card_extras (user_id INTEGER PRIMARY KEY, coach TEXT, captain TEXT, updated_at TEXT)"
    ).catch((err) => { tableReady = null; throw err; });
  }
  return tableReady;
}

// Entrenador y capitán de alguien, ya validados: el DT tiene que ser una carta suya
// y el capitán tiene que estar en el once.
export async function extrasFor(userId, lineupCards) {
  await ensureTable();
  const row = (await db.execute({ sql: "SELECT coach, captain FROM card_extras WHERE user_id = ?", args: [userId] })).rows[0];
  if (!row) return { coach: null, captain: null };
  let coach = null;
  if (row.coach && COACH_BY_NAME.has(row.coach)) {
    const owned = (await db.execute({ sql: "SELECT 1 FROM user_cards WHERE user_id = ? AND player_name = ?", args: [userId, row.coach] })).rows[0];
    if (owned) coach = COACH_BY_NAME.get(row.coach);
  }
  const captain = row.captain && lineupCards.some((c) => c.name === row.captain) ? row.captain : null;
  return { coach, captain };
}

export async function saveExtras(userId, { coach, captain }) {
  await ensureTable();
  await db.execute({
    sql: `INSERT INTO card_extras (user_id, coach, captain, updated_at) VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET coach = excluded.coach, captain = excluded.captain, updated_at = excluded.updated_at`,
    args: [userId, coach ?? null, captain ?? null],
  });
}

export const isCoachCard = (name) => COACH_BY_NAME.has(name);
export const coachCards = () => COACHES;

// Cuántos jugadores de cada selección hay en un once, y el bonus de química que da.
const SQUAD_STEPS = [[10, 14], [8, 9], [6, 5], [4, 2]]; // [jugadores, química]
export const squadChem = (n) => (SQUAD_STEPS.find(([min]) => n >= min) || [0, 0])[1];
export const SQUAD_RULE = "4 jugadores: +2 · 6: +5 · 8: +9 · 10 o más: +14 de química";

export function squadProgress(ownedRealNames, lineupCards) {
  const owned = new Set([...ownedRealNames].map(normName));
  const inLineup = new Set(lineupCards.map((c) => normName(c.realName)));
  return SQUADS.map((s) => {
    const have = [...s.names].filter((n) => owned.has(n)).length;
    const playing = [...s.names].filter((n) => inLineup.has(n)).length;
    return { id: s.id, label: s.label, size: s.size, owned: have, inLineup: playing, chem: squadChem(playing) };
  });
}

// ---------- En forma (goles de la última semana en las ligas reales) ----------
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const FORM_LEAGUES = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "chi.1"];
const FORM_TTL_MS = 3 * 3600 * 1000;
const FORM_DAYS = 7;
let formSet = new Set();
let formNames = []; // para mostrar: [{ name, goals }]
let formUpdatedAt = 0;
let formLoading = null;

const ymd = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;

async function loadForm() {
  const goals = new Map();
  const days = Array.from({ length: FORM_DAYS }, (_, i) => ymd(new Date(Date.now() - i * 86400000)));
  const jobs = [];
  for (const lg of FORM_LEAGUES) for (const d of days) jobs.push([lg, d]);
  // De a tandas, para no abrir 42 conexiones juntas.
  for (let i = 0; i < jobs.length; i += 8) {
    await Promise.all(jobs.slice(i, i + 8).map(async ([lg, d]) => {
      try {
        const res = await fetch(`${ESPN}/${lg}/scoreboard?dates=${d}`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return;
        const json = await res.json();
        for (const ev of json.events || []) {
          for (const det of ev.competitions?.[0]?.details || []) {
            if (!det.scoringPlay || det.ownGoal || det.shootout) continue;
            const name = det.athletesInvolved?.[0]?.displayName;
            if (name) goals.set(normName(name), { name, goals: (goals.get(normName(name))?.goals || 0) + 1 });
          }
        }
      } catch { /* un día que no responde no rompe el resto */ }
    }));
  }
  formSet = new Set(goals.keys());
  formNames = [...goals.values()].sort((a, b) => b.goals - a.goals);
  formUpdatedAt = Date.now();
}

// Se llama en cualquier lugar: si hace falta, arranca la actualización en segundo plano.
export function refreshFormIfStale() {
  if (formLoading || Date.now() - formUpdatedAt < FORM_TTL_MS) return;
  formLoading = loadForm().catch(() => {}).finally(() => { formLoading = null; });
}

// Las cartas especiales y de entrenador no tienen "forma": solo la carta base de jugador.
export const isInForm = (card) => !card.special && card.pos !== "DT" && formSet.has(normName(card.realName));
export const formList = () => formNames;
export const formUpdated = () => formUpdatedAt;

// Lo que se agrega a una carta al mostrarla.
export const extraPub = (card) => ({
  kind: card.kind || null,
  form: isInForm(card),
  ovrBonus: isInForm(card) ? FORM_BONUS : 0,
});

// ---------- efectos sobre la fuerza del once ----------
// `cards` es el once (con `cards.extras = { coach, captain }` si lo tiene).
export function lineupEffects(cards) {
  const ex = cards.extras || {};
  let form = 0, coachOvr = 0, coachChem = 0, setsChem = 0;
  const sets = [];

  for (const c of cards) if (isInForm(c)) form += FORM_BONUS;

  const e = ex.coach?.effect;
  if (e) {
    coachChem = e.chem || 0;
    for (const c of cards) {
      if (e.nations?.includes(c.nationality)) coachOvr += e.nationOvr || 0;
      if (e.pos?.includes(c.pos)) coachOvr += e.posOvr || 0;
      if (e.clubs && [...c.clubs].some((club) => e.clubs.includes(club))) coachOvr += e.clubOvr || 0;
    }
  }

  coachOvr = Math.min(coachOvr, COACH_OVR_CAP); // que un DT de selección no regale un equipo entero

  const inLineup = new Set(cards.map((c) => normName(c.realName)));
  for (const s of SQUADS) {
    const n = [...s.names].filter((x) => inLineup.has(x)).length;
    const chem = squadChem(n);
    if (chem > 0) { sets.push({ id: s.id, label: s.label, players: n, chem }); setsChem += chem; }
  }

  return {
    ovr: form + coachOvr,
    chem: coachChem + setsChem,
    captain: ex.captain || null,
    breakdown: { form, coachOvr, coachChem, setsChem, sets, coach: ex.coach ? ex.coach.realName : null, captain: ex.captain || null },
  };
}
