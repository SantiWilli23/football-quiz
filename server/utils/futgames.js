// Lógica pura de los tres juegos diarios "Tateti", "Pirámide" y "Torta de
// plantel" (inspirados en la mecánica de Grid / Pyramid / SquadSlice). No
// toca Express ni la base: recibe datos y devuelve datos, así se testea sola
// (ver test/futgames.test.js). Todo lo "del día" sale de dailySeed(fecha):
// misma fecha => mismo reto para todos.

import { leagueForClub } from "../data/league-clubs.js";

// ---------- Utilidades ----------

export function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Hash FNV-1a de "YYYY-MM-DD" (+ sal opcional) a entero de 32 bits.
export function dailySeed(date, salt = "") {
  let h = 2166136261;
  for (const ch of `${date}|${salt}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// PRNG determinista (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Tateti (Grid) ----------

// Un criterio es un club, una selección o una categoría:
// { type: "club"|"pais"|"cat", name }. Las categorías (type "cat") salen de la
// carrera del jugador: "champions" y las cuatro ligas grandes.
export const critKey = (c) => `${c.type}:${c.name}`;

export const CATEGORIES = {
  champions: "Ganó la Champions",
  premier: "Jugó en la Premier",
  laliga: "Jugó en LaLiga",
  seriea: "Jugó en la Serie A",
  bundesliga: "Jugó en la Bundesliga",
  balon: "Ganó el Balón de Oro",
};

// Ganadores del Balón de Oro (con los nombres tal cual figuran en la base de jugadores).
export const BALON_DE_ORO = [
  "Lionel Messi", "Cristiano Ronaldo", "Karim Benzema", "Luka Modric", "Rodri", "Kaka", "Ronaldinho", "Zinedine Zidane",
  "Ronaldo Nazário", "Fabio Cannavaro", "Pavel Nedved", "Andriy Shevchenko", "Michael Owen", "Luis Figo", "Rivaldo",
  "George Weah", "Hristo Stoichkov", "Roberto Baggio", "Jean-Pierre Papin", "Ousmane Dembélé", "Ousmane Dembele",
  "Lothar Matthaus", "Ruud Gullit", "Marco van Basten", "Michel Platini", "Gerd Muller", "Franz Beckenbauer",
  "Johan Cruyff", "Alfredo Di Stefano", "Eusebio", "George Best", "Bobby Charlton", "Paolo Rossi", "Oleg Blokhin",
  "Raymond Kopa",
];

// Campeones de Europa por año en que terminó la temporada (final en mayo).
export const CHAMPIONS_WINNERS = {
  1992: "Barcelona", 1993: "Marseille", 1994: "AC Milan", 1995: "Ajax", 1996: "Juventus", 1997: "Borussia Dortmund",
  1998: "Real Madrid", 1999: "Manchester United", 2000: "Real Madrid", 2001: "Bayern Munich", 2002: "Real Madrid",
  2003: "AC Milan", 2004: "Porto", 2005: "Liverpool", 2006: "Barcelona", 2007: "AC Milan", 2008: "Manchester United",
  2009: "Barcelona", 2010: "Inter Milan", 2011: "Barcelona", 2012: "Chelsea", 2013: "Bayern Munich", 2014: "Real Madrid",
  2015: "Barcelona", 2016: "Real Madrid", 2017: "Real Madrid", 2018: "Real Madrid", 2019: "Liverpool", 2020: "Bayern Munich",
  2021: "Chelsea", 2022: "Real Madrid", 2023: "Manchester City", 2024: "Real Madrid", 2025: "Paris Saint-Germain",
};

// Aproximación: estuvo en el plantel de un campeón si su etapa en el club
// (inicio→fin, años de verano) abarca el año en que ese club ganó la copa.
export function wonChampions(player) {
  return (player.carrera || []).some((c) =>
    Object.entries(CHAMPIONS_WINNERS).some(([year, club]) => club === c.club && Number(year) > c.inicio && Number(year) <= (c.fin ?? 2026)));
}

// Índice criterio -> Set de nombres de jugadores que lo cumplen. Un jugador
// cuenta para un club si figura en su carrera (pasado o presente) y para una
// selección por su nacionalidad.
export function buildIndex(players) {
  const index = new Map();
  const add = (key, name) => {
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(name);
  };
  for (const p of players) {
    add(`pais:${p.nacionalidad}`, p.nombre);
    for (const c of p.carrera || []) {
      add(`club:${c.club}`, p.nombre);
      const lg = leagueForClub(c.club);
      if (lg) add(`cat:${lg}`, p.nombre);
    }
    if (wonChampions(p)) add("cat:champions", p.nombre);
    if (BALON_DE_ORO.includes(p.nombre)) add("cat:balon", p.nombre);
  }
  return index;
}

export function validFor(index, a, b) {
  const A = index.get(critKey(a)) || new Set();
  const B = index.get(critKey(b)) || new Set();
  const out = [];
  for (const n of A) if (B.has(n)) out.push(n);
  return out;
}

// Reglas por dificultad. Fácil: clubes y selecciones conocidos y al menos 4
// jugadores válidos por casilla. Medio: criterios menos obvios y entre 1 y 3
// válidos por casilla (no alcanza con nombrar estrellas).
export const GRID_MODES = {
  facil: { minValid: 4, maxValid: Infinity, maxErrors: null },
  medio: { minValid: 1, maxValid: 3, maxErrors: 3 },
};

// Las columnas son siempre clubes; las filas mezclan 1-2 selecciones con
// clubes. Dos selecciones nunca se cruzan porque la base guarda una sola
// nacionalidad por jugador (esa casilla quedaría vacía siempre).
// Si con las reglas normales no sale un tablero (pasaba en el modo medio, donde casi toda casilla
// con categoría tiene más de 3 respuestas), se reintenta sin categorías y, por último, con un
// tope de respuestas más alto. Así el tablero del día nunca queda sin generar.
export function generateGrid(args) {
  return generateGridWith(args);
}

export function generateGridSafe(args) {
  try {
    return generateGridWith(args);
  } catch {
    try {
      return generateGridWith({ ...args, noCats: true });
    } catch {
      return generateGridWith({ ...args, noCats: true, maxValidOverride: 8, maxTries: 8000 });
    }
  }
}

function generateGridWith({ index, pools, mode, date, maxTries = 4000, noCats = false, maxValidOverride = null }) {
  const rules = { ...GRID_MODES[mode], ...(maxValidOverride ? { maxValid: maxValidOverride } : {}) };
  const pool = pools[mode];
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const rand = rng(dailySeed(date, `grid-${mode}-${attempt}`));
    const clubs = shuffle(pool.clubs, rand);
    const countries = shuffle(pool.countries, rand);
    // Casi siempre una fila es una categoría (ganó la Champions, jugó en tal liga…).
    const cats = shuffle(noCats ? [] : pool.cats || [], rand);
    const nCats = cats.length && rand() < 0.85 ? 1 : 0;
    const nCountries = Math.min(1 + Math.floor(rand() * 2), 3 - nCats);
    const cols = clubs.slice(0, 3).map((name) => ({ type: "club", name }));
    const rowClubs = clubs.slice(3, 3 + (3 - nCountries - nCats)).map((name) => ({ type: "club", name }));
    const rowCats = cats.slice(0, nCats).map((name) => ({ type: "cat", name }));
    const rowCountries = countries.slice(0, nCountries).map((name) => ({ type: "pais", name }));
    const rows = shuffle([...rowCountries, ...rowCats, ...rowClubs], rand);
    const counts = [];
    let ok = true;
    for (const r of rows) {
      for (const c of cols) {
        const n = validFor(index, r, c).length;
        if (n < Math.max(1, rules.minValid) || n > rules.maxValid) ok = false;
        counts.push(n);
      }
    }
    if (ok) return { date, mode, rows, cols, counts };
  }
  throw new Error(`No se pudo generar el tateti ${mode} para ${date}`);
}

// Celdas (0..8, fila por fila) donde encaja un jugador, excluyendo las ya
// llenas. El cliente decide: 0 = no hay lugar, 1 = se coloca sola, 2+ = elige.
export function cellsForPlayer(index, grid, name, filled = []) {
  const taken = new Set(filled);
  const cells = [];
  grid.rows.forEach((r, ri) => {
    grid.cols.forEach((c, ci) => {
      const i = ri * 3 + ci;
      if (taken.has(i)) return;
      const R = index.get(critKey(r));
      const C = index.get(critKey(c));
      if (R?.has(name) && C?.has(name)) cells.push(i);
    });
  });
  return cells;
}

// ---------- Pirámide (Pyramid) ----------

// Casilla 1 = valor más alto. Filas: 1 | 2-3 | 4-6 | 7-10.
export function tierOfRank(rank) {
  if (rank <= 1) return 1;
  if (rank <= 3) return 2;
  if (rank <= 6) return 3;
  return 4;
}

// Rango (1..10) de cada jugador: posición en el orden descendente. Con
// empates, cada jugador acepta cualquier casilla entre el primer y el último
// puesto de su grupo de empatados.
export function rankRanges(entries) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const ranges = {};
  for (const e of entries) {
    const first = sorted.findIndex((s) => s.value === e.value) + 1;
    const last = sorted.length - [...sorted].reverse().findIndex((s) => s.value === e.value);
    ranges[e.id] = { first, last };
  }
  return ranges;
}

// placement: array de 10 ids (o null) — placement[0] es la casilla 1.
export function scorePyramid(entries, placement) {
  const ranges = rankRanges(entries);
  const slots = placement.map((id, i) => {
    if (id == null || !ranges[id]) return { id, correct: false };
    const slot = i + 1;
    const { first, last } = ranges[id];
    return { id, correct: slot >= first && slot <= last, first, last };
  });
  return { correct: slots.filter((s) => s.correct).length, slots };
}

// Orden en que aparecen los 10 jugadores (determinista por fecha).
export function pyramidOrder(entries, date) {
  return shuffle(entries.map((e) => e.id), rng(dailySeed(date, "pyramid-order")));
}

// ---------- Torta de plantel (SquadSlice) ----------

export const REVEAL_STEPS = [0.3, 0.6, 1];

// countries: [{ country, count }] ya ordenados por count desc (así se dibuja
// la torta, en sentido horario). order: índices en el orden en que se van
// destapando. Devuelve, para cada intento, los índices visibles: se suman
// porciones ENTERAS hasta llegar al umbral (30% / 60% / 100%).
export function revealSets(countries, order, steps = REVEAL_STEPS) {
  const total = countries.reduce((s, c) => s + c.count, 0);
  return steps.map((pct) => {
    const visible = [];
    let acc = 0;
    for (const i of order) {
      if (acc >= pct * total && visible.length > 0) break;
      visible.push(i);
      acc += countries[i].count;
    }
    return visible.sort((a, b) => a - b);
  });
}

export function squadRevealOrders(countries, date) {
  const clockwise = countries.map((_, i) => i);
  const random = shuffle(clockwise, rng(dailySeed(date, "squad-random")));
  return {
    clockwise: revealSets(countries, clockwise),
    random: revealSets(countries, random),
  };
}

// Plantel histórico de un club según la base: nacionalidades de todos los
// jugadores que lo vistieron, agrupadas y ordenadas por cantidad.
export function squadOf(players, club) {
  const byCountry = new Map();
  for (const p of players) {
    if (!(p.carrera || []).some((c) => c.club === club)) continue;
    if (!byCountry.has(p.nacionalidad)) byCountry.set(p.nacionalidad, []);
    byCountry.get(p.nacionalidad).push(p.nombre);
  }
  return [...byCountry.entries()]
    .map(([country, names]) => ({ country, count: names.length, players: names.sort() }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

// Club del día entre los candidatos (con suficientes jugadores y países).
export function pickSquadClub(candidates, date) {
  const rand = rng(dailySeed(date, "squad-club"));
  return candidates[Math.floor(rand() * candidates.length)];
}
