// Forma, estilo de juego, contrato y progresión de cada jugador.
//
// - FORMA: un número chico (-2..+2 de OVR) que se suma al nivel del jugador en los
//   partidos. Depende de muchas cosas (moral con el DT, si la táctica le conviene, minutos,
//   resultados del equipo, lesiones y edad) y se mueve de a poco hacia ese valor.
// - ESTILO: 3 por posición. Define qué tácticas le convienen. Cambiarlo demora unas
//   semanas; cuando termina, el estilo se cambia y ya, sin secuelas.
// - CONTRATO: el sueldo (comparado con lo que vale su nivel) y la relevancia prometida
//   (titular / rotación / suplente) mueven la moral semana a semana.
// - PROGRESIÓN: los stats y el OVR suben o bajan de a poco cada semana según la edad, el
//   potencial y la forma. Al llegar al potencial se puede seguir subiendo, mucho más lento.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const FORM_MAX = 2;
export const STYLE_CHANGE_WEEKS = 3;

// ---------- Estilos ----------
// prefs: valor ideal (0-100) de cada instrucción táctica; w: cuánto le importa (0-1).
// Un jugador rinde mejor cuanto más cerca está la táctica del equipo de lo que le gusta.
const S = (id, label, desc, prefs) => ({ id, label, desc, prefs });

export const STYLES = {
  GK: [
    S("clasico", "Arquero clásico", "Se queda en el arco y ataja.", { defLine: [30, 0.7], buildUp: [30, 0.4] }),
    S("libero", "Arquero líbero", "Sale lejos del arco y juega con los pies.", { defLine: [80, 1], buildUp: [75, 0.7] }),
    S("reflejos", "Reflejos", "Rinde más cuando el equipo se defiende bajo.", { defLine: [20, 1], pressing: [30, 0.4] }),
  ],
  CB: [
    S("marcador", "Marcador", "Duelo uno contra uno, bloque medio-bajo.", { duels: [75, 1], defLine: [40, 0.6] }),
    S("salida", "Defensor con salida", "Saca el balón jugado desde el fondo.", { buildUp: [75, 1], defLine: [65, 0.6] }),
    S("aereo", "Aéreo y físico", "Fuerte en el juego aéreo, equipo que centra y se planta.", { defLine: [35, 0.8], duels: [65, 0.7] }),
  ],
  LB: [
    S("defensivo", "Lateral defensivo", "Se queda atrás y cierra.", { defLine: [40, 0.8], width: [35, 0.6] }),
    S("carrilero", "Carrilero", "Sube por la banda todo el partido.", { width: [80, 1], tempo: [70, 0.6] }),
    S("interior", "Lateral interior", "Se mete al medio y arma juego.", { buildUp: [75, 1], width: [40, 0.5] }),
  ],
  RB: [
    S("defensivo", "Lateral defensivo", "Se queda atrás y cierra.", { defLine: [40, 0.8], width: [35, 0.6] }),
    S("carrilero", "Carrilero", "Sube por la banda todo el partido.", { width: [80, 1], tempo: [70, 0.6] }),
    S("interior", "Lateral interior", "Se mete al medio y arma juego.", { buildUp: [75, 1], width: [40, 0.5] }),
  ],
  CDM: [
    S("destructor", "Destructor", "Corta juego y gana duelos.", { duels: [80, 1], pressing: [70, 0.6] }),
    S("organizador", "Organizador", "Pivote que reparte desde el fondo.", { buildUp: [75, 1], tempo: [45, 0.4] }),
    S("escudo", "Escudo", "Protege a la defensa con el bloque bajo.", { defLine: [30, 1], duels: [60, 0.5] }),
  ],
  CM: [
    S("boxtobox", "Box to box", "Va y viene, necesita ritmo alto.", { tempo: [75, 1], pressing: [65, 0.7] }),
    S("creador", "Creador", "Maneja los tiempos con pases.", { buildUp: [80, 1], tempo: [45, 0.5] }),
    S("equilibrio", "Equilibrio", "Cumple en defensa y ataque sin extremos.", { pressing: [50, 0.6], tempo: [50, 0.6] }),
  ],
  CAM: [
    S("enganche", "Enganche", "Recibe entre líneas y arma el último pase.", { buildUp: [75, 0.8], offDepth: [45, 0.6] }),
    S("llegador", "Mediapunta llegador", "Se mete al área a rematar.", { offDepth: [80, 1], tempo: [65, 0.5] }),
    S("segundo", "Segundo delantero", "Juega pegado al 9.", { offDepth: [75, 0.8], transition: [65, 0.6] }),
  ],
  LW: [
    S("veloz", "Extremo veloz", "Vive de la velocidad: línea alta y contragolpe.", { defLine: [75, 1], transition: [80, 1] }),
    S("interior", "Extremo interior", "Se cierra al medio a rematar.", { width: [35, 1], offDepth: [70, 0.6] }),
    S("asociativo", "Extremo asociativo", "Combina y juega por dentro y por fuera.", { buildUp: [70, 0.9], tempo: [60, 0.5] }),
  ],
  RW: [
    S("veloz", "Extremo veloz", "Vive de la velocidad: línea alta y contragolpe.", { defLine: [75, 1], transition: [80, 1] }),
    S("interior", "Extremo interior", "Se cierra al medio a rematar.", { width: [35, 1], offDepth: [70, 0.6] }),
    S("asociativo", "Extremo asociativo", "Combina y juega por dentro y por fuera.", { buildUp: [70, 0.9], tempo: [60, 0.5] }),
  ],
  ST: [
    S("rematador", "Rematador", "Vive del área, necesita centros y llegada.", { width: [70, 0.8], offDepth: [70, 0.8] }),
    S("referencia", "Referencia", "Ancla el ataque de espaldas al arco.", { buildUp: [35, 0.7], width: [65, 0.7] }),
    S("movil", "Delantero móvil", "Se mueve y corre al espacio: contragolpe y línea alta.", { transition: [80, 1], defLine: [70, 0.7] }),
  ],
};

export function stylesFor(position) {
  return STYLES[position] || STYLES.CM;
}

// Estilo más parecido a los stats del jugador (cuando todavía no se le asignó uno).
export function inferStyle(p) {
  const list = stylesFor(p.position);
  const a = p.attributes || {};
  const pace = a.pace ?? p.ovr, phys = a.physical ?? p.ovr, pass = a.passing ?? p.ovr, drib = a.dribbling ?? p.ovr, def = a.defending ?? p.ovr, shot = a.shooting ?? p.ovr;
  const pick = (i) => list[Math.min(i, list.length - 1)];
  switch (p.position) {
    case "GK": return pick(pass >= phys ? 1 : 0);
    case "CB": return pick(pass > def - 8 ? 1 : phys > def ? 2 : 0);
    case "LB": case "RB": return pick(pace >= 78 ? 1 : pass > def ? 2 : 0);
    case "CDM": return pick(pass >= def ? 1 : phys > def ? 2 : 0);
    case "CM": return pick(pace >= 75 && phys >= 70 ? 0 : pass >= 78 ? 1 : 2);
    case "CAM": return pick(shot >= pass ? 1 : drib >= 80 ? 2 : 0);
    case "LW": case "RW": return pick(pace >= 85 ? 0 : shot >= drib ? 1 : 2);
    case "ST": return pick(pace >= 84 ? 2 : phys >= 78 ? 1 : 0);
    default: return pick(0);
  }
}

export function styleOf(p) {
  const list = stylesFor(p.position);
  return list.find((s) => s.id === p.style) || inferStyle(p);
}

// ---------- Forma ----------
// Cuánto le conviene la táctica del equipo a este jugador (-1..+1). 0 = neutro.
export function tacticFit(p, sliders = {}) {
  const st = styleOf(p);
  let sum = 0, wsum = 0;
  Object.entries(st.prefs).forEach(([key, [ideal, w]]) => {
    const cur = sliders[key] ?? 50;
    const closeness = 1 - Math.abs(cur - ideal) / 50; // 1 = justo lo que quiere, -1 = lo opuesto
    sum += closeness * w;
    wsum += w;
  });
  let fit = wsum ? sum / wsum : 0;
  // Línea alta + velocidad: un jugador rápido la aprovecha, uno lento la sufre (defensores y extremos).
  const pace = p.attributes?.pace ?? p.ovr;
  const defLine = (sliders.defLine ?? 50) - 50;
  if (defLine > 15 && ["CB", "LB", "RB", "LW", "RW", "ST"].includes(p.position)) {
    fit += clamp((pace - 72) / 20, -0.5, 0.5) * (defLine / 50) * 0.5;
  }
  return clamp(fit, -1, 1);
}

// Los últimos resultados del equipo (-1 derrotas .. +1 victorias), de los 3 últimos partidos jugados.
function teamResultsScore(calendar = []) {
  const played = calendar.filter((c) => c.played && c.result).sort((a, b) => a.week - b.week).slice(-3);
  if (!played.length) return 0;
  const pts = played.reduce((s, c) => s + (c.result.myGoals > c.result.rivalGoals ? 1 : c.result.myGoals < c.result.rivalGoals ? -1 : 0), 0);
  return pts / played.length;
}

// Valor al que tiende la forma de un jugador (-2..+2) con todo lo que lo afecta.
export function formTarget(p, state) {
  const morale = (state.morale || {})[p.id] ?? 70;
  const fit = tacticFit(p, state.sliders || {});
  const inj = (state.injuries || []).find((i) => i.playerId === p.id && i.returnWeek > state.week);
  const recent = (state.minutes || {})[p.id] ?? 0.5; // 0..1: cuánto jugó últimamente
  const youngBoost = p.age <= 21 ? 0.1 : 0;
  const oldDrag = p.age >= 34 ? -0.3 : p.age >= 31 ? -0.15 : 0;
  const parts = {
    moral: clamp((morale - 60) / 40, -1, 1) * 0.7,
    tacticas: fit * 0.9,
    minutos: (recent - 0.5) * 0.6,
    resultados: teamResultsScore(state.calendar) * 0.25,
    lesion: inj ? -0.6 : 0,
    edad: youngBoost + oldDrag,
  };
  const total = clamp(Object.values(parts).reduce((a, b) => a + b, 0), -FORM_MAX, FORM_MAX);
  return { total, parts };
}

export const formOf = (state, id) => (state.form || {})[id] ?? 0;

// Avanza la forma de todo el plantel una semana: se acerca de a poco al objetivo.
export function stepForm(state) {
  const form = { ...(state.form || {}) };
  (state.squad || []).forEach((p) => {
    const target = formTarget(p, state).total;
    const cur = form[p.id] ?? 0;
    const step = clamp(target - cur, -0.3, 0.3);
    form[p.id] = Math.round(clamp(cur + step, -FORM_MAX, FORM_MAX) * 100) / 100;
  });
  return form;
}

export function formArrow(form) {
  if (form >= 1) return { arrow: "▲", label: "En gran forma", tone: "good" };
  if (form >= 0.35) return { arrow: "↗", label: "En buena forma", tone: "good" };
  if (form <= -1) return { arrow: "▼", label: "En mala forma", tone: "bad" };
  if (form <= -0.35) return { arrow: "↘", label: "Flojo de forma", tone: "bad" };
  return { arrow: "→", label: "Forma normal", tone: "neutral" };
}

// ---------- Contrato: sueldo y relevancia ----------
export const ROLES = {
  titular: { id: "titular", label: "Titular", rank: 3 },
  rotacion: { id: "rotacion", label: "Rotación", rank: 2 },
  suplente: { id: "suplente", label: "Suplente", rank: 1 },
};

// Sueldo "justo" para su nivel (miles de € por semana), el mismo que usa el generador de jugadores.
export function fairWage(p) {
  const base = Math.pow(1.135, Math.max(p.ovr - 58, 0)) * 4;
  const ageMult = p.age <= 30 ? 1 : p.age <= 33 ? 0.85 : 0.65;
  return Math.max(1, Math.round(base * ageMult));
}

// Relevancia que espera un jugador en un plantel: top 11 por nivel = titular, siguientes 7 = rotación.
export function expectedRole(player, squad) {
  const better = (squad || []).filter((q) => q.id !== player.id && q.ovr > player.ovr).length;
  return better < 11 ? ROLES.titular : better < 18 ? ROLES.rotacion : ROLES.suplente;
}

export function roleOf(p, squad) {
  return ROLES[p.role] || expectedRole(p, squad);
}

// Cambio semanal de moral por contrato: sueldo vs lo que vale y relevancia que se cumple o no.
export function contractMoraleDelta(p, { squad, starterIds, benchIds, roleMisses }) {
  let delta = 0;
  const ratio = (p.wage || 1) / fairWage(p);
  if (ratio < 0.7) delta -= 1.2;
  else if (ratio < 0.9) delta -= 0.5;
  else if (ratio >= 1.25) delta += 0.5;
  else if (ratio >= 1.05) delta += 0.2;

  const role = roleOf(p, squad);
  const misses = roleMisses[p.id] || 0;
  // La promesa incumplida pesa de a poco: recién molesta cuando se repite.
  if (misses >= 2) delta -= Math.min(2.5, 0.3 * misses);
  else if (role.id !== "suplente" && misses === 0) delta += 0.3;
  return delta;
}

// ¿Se cumplió la relevancia esta semana? Titular = en el once. Rotación = en el once o en el banco.
function roleMet(role, id, starterIds, benchIds) {
  if (role.id === "titular") return starterIds.has(id);
  if (role.id === "rotacion") return starterIds.has(id) || benchIds.has(id);
  return true;
}

// Cierre de semana de los contratos: cuenta las promesas incumplidas, aplica el efecto en la
// moral y guarda cuánto jugó cada uno últimamente.
export function stepContracts(state) {
  const starterIds = new Set((state.lineup?.starters || []).map((s) => s.playerId).filter(Boolean));
  const benchIds = new Set(state.lineup?.bench || []);
  const roleMisses = { ...(state.roleMisses || {}) };
  const morale = { ...(state.morale || {}) };
  const minutes = { ...(state.minutes || {}) };
  (state.squad || []).forEach((p) => {
    const role = roleOf(p, state.squad);
    if (roleMet(role, p.id, starterIds, benchIds)) roleMisses[p.id] = Math.max(0, (roleMisses[p.id] || 0) - 1);
    else roleMisses[p.id] = Math.min(12, (roleMisses[p.id] || 0) + 1);
    const delta = contractMoraleDelta(p, { squad: state.squad, starterIds, benchIds, roleMisses });
    morale[p.id] = clamp(Math.round(((morale[p.id] ?? 70) + delta) * 10) / 10, 0, 100);
    // Promedio móvil de minutos: titular = 1, banco = 0.45, afuera = 0.
    const played = starterIds.has(p.id) ? 1 : benchIds.has(p.id) ? 0.45 : 0;
    minutes[p.id] = Math.round(((minutes[p.id] ?? 0.5) * 0.7 + played * 0.3) * 100) / 100;
  });
  return { roleMisses, morale, minutes };
}

// Explicación en palabras de lo que pesa en la moral de este jugador (para la ficha).
export function contractSummary(p, state) {
  const ratio = (p.wage || 1) / fairWage(p);
  const role = roleOf(p, state.squad);
  const misses = (state.roleMisses || {})[p.id] || 0;
  const wageText = ratio < 0.7 ? "Cobra bastante menos de lo que vale" : ratio < 0.9 ? "Cobra un poco menos de lo que vale" : ratio >= 1.25 ? "Está muy bien pagado" : "Sueldo acorde a su nivel";
  const roleText = misses >= 2 ? `No se le cumple lo prometido (${role.label.toLowerCase()})` : `Relevancia prometida: ${role.label.toLowerCase()}`;
  return { wageText, roleText, wageTone: ratio < 0.9 ? "bad" : ratio >= 1.25 ? "good" : "neutral", roleTone: misses >= 2 ? "bad" : "neutral" };
}

// ---------- Estilo: cambio con demora ----------
export function applyStyleChanges(squad, week) {
  const news = [];
  const out = squad.map((p) => {
    if (!p.styleChange || week < p.styleChange.endWeek) return p;
    const st = stylesFor(p.position).find((s) => s.id === p.styleChange.target);
    news.push(`🎯 ${p.name} ya juega como ${st?.label || "otro estilo"}.`);
    return { ...p, style: p.styleChange.target, styleChange: null };
  });
  return { squad: out, news };
}

// ---------- Progresión semanal ----------
const ATTR_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"];
// Subida de OVR por semana (una temporada son ~38 semanas) según la edad.
function weeklyGrowth(p) {
  if (p.age <= 21) return 0.09;
  if (p.age <= 24) return 0.06;
  if (p.age <= 27) return 0.04;
  if (p.age <= 31) return 0.015;
  return 0;
}
function weeklyDecline(p) {
  if (p.age >= 36) return 0.08;
  if (p.age >= 34) return 0.055;
  if (p.age >= 32) return 0.03;
  return 0;
}

function bumpAttributes(p, dir) {
  const a = { ...(p.attributes || {}) };
  const keys = [...ATTR_KEYS].sort(() => Math.random() - 0.5);
  const moving = dir > 0 ? keys.slice(0, 3) : ["pace", "physical", ...keys.filter((k) => k !== "pace" && k !== "physical").slice(0, 1)];
  moving.forEach((k) => { if (a[k] != null) a[k] = clamp(a[k] + dir, 30, 99); });
  return a;
}

// Cada semana suma una fracción de OVR (xp). Cuando junta 1 sube un punto (y los stats con él).
export function progressSquad(squad, state) {
  const news = [];
  const minutes = state.minutes || {};
  const out = squad.map((p) => {
    const form = formOf(state, p.id);
    const played = minutes[p.id] ?? 0.5;
    const gap = (p.potential ?? p.ovr) - p.ovr;
    let rate = weeklyGrowth(p) * (1 + form * 0.25) * (0.7 + played * 0.6);
    // En el potencial no se frena del todo: sigue creciendo, pero mucho más lento.
    if (gap <= 0) rate *= 0.2;
    rate -= weeklyDecline(p);
    let xp = (p.xp || 0) + rate;
    let { ovr, value, attributes } = p;
    while (xp >= 1 && ovr < 99) {
      xp -= 1; ovr += 1; value = Math.round(value * 1.07 * 20) / 20;
      attributes = bumpAttributes({ ...p, attributes }, 1);
      if (p.age <= 21 && ovr % 3 === 0) news.push(`📈 ${p.name} sube a OVR ${ovr}.`);
    }
    while (xp <= -1 && ovr > 35) {
      xp += 1; ovr -= 1; value = Math.max(0.5, Math.round(value * 0.93 * 20) / 20);
      attributes = bumpAttributes({ ...p, attributes }, -1);
    }
    if (ovr === p.ovr && xp === (p.xp || 0)) return p;
    return { ...p, ovr, xp: Math.round(xp * 1000) / 1000, value, attributes };
  });
  return { squad: out, news: news.slice(0, 2) };
}
