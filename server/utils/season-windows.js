// Ventanas de inicio y final de temporada. Campeón y descenso y Mercado de
// pases solo se pueden jugar dentro de estas ventanas, por región:
//   - Europa (temporada ago→may): inicio 1 jul–31 ago (mercado de verano),
//     final 1 abr–31 may (últimas fechas).
//   - Chile (temporada feb→dic): inicio 1 ene–28 feb (antes de arrancar),
//     final 1 oct–15 dic (últimas ~7 fechas).
// Fechas como [mes, día], inclusivas. Una ventana puede cruzar el año.
export const WINDOWS = {
  europa: {
    label: "Europa",
    inicio: { from: [7, 1], to: [8, 31] },
    final: { from: [4, 1], to: [5, 31] },
  },
  chile: {
    label: "Chile",
    inicio: { from: [1, 1], to: [2, 28] },
    final: { from: [10, 1], to: [12, 15] },
  },
};

export const PHASE_LABEL = { inicio: "inicio de temporada", final: "final de temporada" };

export const regionOfLeague = (leagueKey) => (leagueKey === "chile" ? "chile" : "europa");

const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();
const val = ([m, day]) => m * 100 + day;

function inRange(d, { from, to }) {
  const x = md(d);
  return val(from) <= val(to) ? x >= val(from) && x <= val(to) : x >= val(from) || x <= val(to);
}

function nextOpening(region, now) {
  let best = null;
  for (const phase of ["inicio", "final"]) {
    const [m, day] = WINDOWS[region][phase].from;
    let d = new Date(now.getFullYear(), m - 1, day);
    if (d <= now) d = new Date(now.getFullYear() + 1, m - 1, day);
    if (!best || d < best.date) best = { phase, date: d };
  }
  return { phase: best.phase, date: best.date.toISOString().slice(0, 10) };
}

const iso = (y, [m, d]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// { region, label, open, phase, closes, next } para hoy.
export function windowStatus(region, now = new Date()) {
  const w = WINDOWS[region];
  for (const phase of ["inicio", "final"]) {
    if (inRange(now, w[phase])) {
      return { region, label: w.label, open: true, phase, phaseLabel: PHASE_LABEL[phase], closes: iso(now.getFullYear(), w[phase].to), next: null };
    }
  }
  return { region, label: w.label, open: false, phase: null, phaseLabel: null, closes: null, next: nextOpening(region, now) };
}

export const allWindows = (now = new Date()) => Object.keys(WINDOWS).map((r) => windowStatus(r, now));
