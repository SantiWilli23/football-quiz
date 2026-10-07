// Lógica pura de los juegos diarios "Tateti" y "Pirámide" (inspirados en la
// mecánica de Grid / Pyramid). No
// toca Express ni la base: recibe datos y devuelve datos, así se testea sola
// (ver test/futgames.test.js). Todo lo "del día" sale de dailySeed(fecha):
// misma fecha => mismo reto para todos.

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

// Un criterio es un club o una selección: { type: "club"|"pais", name }.
export const critKey = (c) => `${c.type}:${c.name}`;

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
    for (const c of p.carrera || []) add(`club:${c.club}`, p.nombre);
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
export function generateGrid({ index, pools, mode, date, maxTries = 4000 }) {
  const rules = GRID_MODES[mode];
  const pool = pools[mode];
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const rand = rng(dailySeed(date, `grid-${mode}-${attempt}`));
    const clubs = shuffle(pool.clubs, rand);
    const countries = shuffle(pool.countries, rand);
    const nCountries = 1 + Math.floor(rand() * 2);
    const cols = clubs.slice(0, 3).map((name) => ({ type: "club", name }));
    const rowClubs = clubs.slice(3, 3 + (3 - nCountries)).map((name) => ({ type: "club", name }));
    const rowCountries = countries.slice(0, nCountries).map((name) => ({ type: "pais", name }));
    const rows = shuffle([...rowCountries, ...rowClubs], rand);
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
