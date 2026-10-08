// Ventana de vacaciones de verano. Campeón y descenso y Mercado de pases solo
// aparecen y se pueden jugar dentro de ella, por región:
//   - Europa: 1 jul–31 ago (mercado de verano).
//   - Chile: 15 dic–15 feb (vacaciones de la liga, antes de arrancar).
// Fechas como [mes, día], inclusivas. Una ventana puede cruzar el año.
export const WINDOWS = {
  europa: {
    label: "Europa",
    inicio: { from: [7, 1], to: [8, 31] },
  },
  chile: {
    label: "Chile",
    inicio: { from: [12, 15], to: [2, 15] },
  },
};

export const PHASE_LABEL = { inicio: "vacaciones de verano" };
const PHASES = ["inicio"];

export const regionOfLeague = (leagueKey) => (leagueKey === "chile" ? "chile" : "europa");

const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();
const val = ([m, day]) => m * 100 + day;

function inRange(d, { from, to }) {
  const x = md(d);
  return val(from) <= val(to) ? x >= val(from) && x <= val(to) : x >= val(from) || x <= val(to);
}

function nextOpening(region, now) {
  let best = null;
  for (const phase of PHASES) {
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
  for (const phase of PHASES) {
    if (inRange(now, w[phase])) {
      return { region, label: w.label, open: true, phase, phaseLabel: PHASE_LABEL[phase], closes: iso(now.getFullYear(), w[phase].to), next: null };
    }
  }
  return { region, label: w.label, open: false, phase: null, phaseLabel: null, closes: null, next: nextOpening(region, now) };
}

export const allWindows = (now = new Date()) => Object.keys(WINDOWS).map((r) => windowStatus(r, now));
