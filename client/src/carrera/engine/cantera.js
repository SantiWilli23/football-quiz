import { attributesFor } from "../data/players.js";
import {
  ACADEMY_COUNTRIES, POSITIONS, countryNationality, rollAcademyCost, youthName,
} from "./academy.js";
import { SCOUT_SPECIALTIES } from "./scouting.js";

// Cantera del Modo DT.
//
//  - Ojeadores de cantera: gente contratada por temporadas. Sin al menos uno no se puede
//    fichar a ningún chico.
//  - Redes en países: abrir una red exige mandar un ojeador a ese país (queda asignado) y
//    cada red tiene nivel 1 a 3. Cada mes, cada red te entrega un informe con jóvenes de ese
//    país; a más nivel, más chicos y mejores. Tenés una semana para fichar a cada uno: el que
//    no ficha en ese plazo desaparece y no vuelve.
//  - Rango de potencial: lo que se ve del potencial de un chico es un rango. De joven es
//    muy ancho y optimista (alto); a medida que crece se achica y baja hacia su potencial
//    real.
//  - Salida: un chico de 20 años o más que no subís al primer equipo se puede ir a otro
//    club. Se avisa varios meses antes de que termine la temporada.

export const MAX_CANTERA_SCOUTS = 6;
// Cada informe mensual de una red vale 7 días: el joven que no se ficha en ese plazo desaparece.
export const PROSPECT_WINDOW_DAYS = 7;
// En la liga online todos los managers con red en el mismo país ven los mismos jóvenes del mes (misma semilla)
// y el primero que ficha se lo lleva. El contexto fija acá el código de la liga.
export const shared = { seed: null };
export const MAX_NETWORKS = 6;
export const MAX_NETWORK_LEVEL = 3;
export const NETWORK_COSTS = [3, 6, 10]; // costo (M€) de pasar a nivel 1, 2 y 3
export const MAX_PROSPECTS = 40;
export const MAX_YOUTH = 25;
export const LEAVE_AGE = 20;
// Se avisa cuando faltan estas jornadas para cerrar la temporada (~4 meses).
export const LEAVE_WARNING_WEEKS = 16;
export const SEASON_WEEKS = 38;

export const SPECIALTY_GAP = 8;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function emptyCantera() {
  return { scouts: [], networks: [], prospects: [], youth: [], lastMonth: null };
}

// Guardados anteriores al sistema: pasan los agentes de inferiores y los chicos ya
// encontrados a la cantera nueva. Nada se pierde.
// Las redes viejas no tenían ojeador asignado: se reparten entre los que ya hay.
function withScoutIds(cantera) {
  if (!cantera.networks.some((n) => !n.scoutId) || !cantera.scouts.length) return cantera;
  const taken = new Set(cantera.networks.map((n) => n.scoutId).filter(Boolean));
  const free = cantera.scouts.filter((sc) => !taken.has(sc.id));
  const networks = cantera.networks.map((n) => {
    if (n.scoutId) return n;
    const sc = free.shift() || cantera.scouts[0];
    return { ...n, scoutId: sc.id };
  });
  return { ...cantera, networks };
}

export function ensureCantera(s) {
  if (s.cantera) {
    const fixed = withScoutIds(s.cantera);
    return fixed === s.cantera ? s : { ...s, cantera: fixed };
  }
  const cantera = emptyCantera();
  (s.academyAgents || []).forEach((a) => {
    cantera.scouts.push({ id: a.id, specialty: a.specialty, seasonsLeft: a.seasonsLeft, cost: a.cost, hiredWeek: a.hiredWeek || 0 });
    if (a.country && !cantera.networks.some((n) => n.country === a.country)) {
      cantera.networks.push({ id: `net_${a.country}`, country: a.country, level: 1 });
    }
  });
  cantera.prospects = (s.academyPool || []).map((p) => ({ ...p, signCost: signCostOf(p), foundMonth: null }));
  return { ...s, cantera: withScoutIds(cantera), academyAgents: [], academyPool: [] };
}

export function signCostOf(p) {
  return Math.round((0.1 + Math.max(0, p.potential - 60) * 0.06) * 10) / 10;
}

// Valor de mercado aproximado (M€) de un chico: sale de su nivel y su techo.
export function youthValue(p) {
  return Math.max(0.2, Math.round((((p.ovr + p.potential) / 2 - 48) / 4) * 10) / 10);
}

// ---------- Rango de potencial ----------
const SPREAD_BY_AGE = { 15: 14, 16: 12, 17: 10, 18: 8, 19: 6, 20: 4, 21: 3 };

function noiseOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000; // 0..1, fijo para ese chico
}

// Rango [mín, máx] que ve el DT. Cuanto más joven, más ancho y más alto (optimista);
// con los años se achica y converge al potencial real.
export function potentialRange(p, specialty = null) {
  const spread0 = SPREAD_BY_AGE[p.age] ?? 2;
  const factor = specialty === "ovr" ? 1.25 : specialty === "potential" || specialty === "both" ? 0.7 : 1;
  const spread = spread0 * factor;
  const optimism = Math.max(0, 21 - p.age) * 1.0; // se infla el techo de los más chicos
  const bias = noiseOf(p.id) * spread * 0.6;
  const lo = clamp(Math.round(p.potential - spread * 0.7 + optimism * 0.5 + bias * 0.3), p.ovr, 99);
  const hi = clamp(Math.round(p.potential + spread * 0.6 + optimism + bias * 0.4), lo, 99);
  return [lo, hi];
}

export function formatPotentialRange(range) {
  return range[0] === range[1] ? `${range[0]}` : `${range[0]}–${range[1]}`;
}

// ---------- Generación mensual ----------
// `rand`: en la liga online es un generador con semilla compartida, así todos los managers con red en el
// país ven a los mismos chicos (y con el mismo id, para que el primero que ficha se lo lleve).
function generateProspect({ scout, network, monthKey, i, day, rand = null }) {
  const R = rand || Math.random;
  const rn = (a, b) => a + Math.floor(R() * (b - a + 1));
  const nat = countryNationality(network.country);
  const age = rn(15, 18);
  const lvl = network.level;
  let ovr = rn(42, 58) + lvl * 2;
  let potential = clamp(ovr + rn(14, 28) + lvl * 2, ovr + 6, 97);
  // la especialidad del ojeador solo cambia al chico en el modo solo (compartido, todos ven lo mismo)
  if (!rand && scout.specialty === "ovr") {
    ovr = clamp(ovr + rn(3, 6), 40, 72);
    potential = clamp(potential - SPECIALTY_GAP, ovr + 2, 97);
  } else if (!rand && scout.specialty === "potential") {
    potential = clamp(potential + SPECIALTY_GAP, ovr + 2, 99);
  }
  const position = POSITIONS[Math.floor(R() * POSITIONS.length)];
  const p = {
    id: rand ? `cantera_${network.country}_${monthKey}_${i}` : `cantera_${network.id}_${monthKey}_${scout.id.slice(-4)}_${i}_${Math.floor(Math.random() * 9999)}`,
    foundDay: day,
    expiresDay: day + PROSPECT_WINDOW_DAYS,
    name: youthName(nat, R),
    age, position, nationality: nat, country: network.country,
    ovr, potential,
    value: 0, wage: 1, contractYears: 3,
    isYouth: true, isAcademyProspect: true,
    foundMonth: monthKey,
    foundBy: scout.specialty,
    attributes: attributesFor(position, ovr),
  };
  return { ...p, signCost: signCostOf(p) };
}

// Semilla estable a partir de un texto (para los jóvenes compartidos).
function seededRand(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Trae el informe del mes: una tanda por red, armada por el ojeador que mandaste a ese país. Reemplaza a los
// chicos del informe anterior que no se ficharon. `day` es el día de la carrera (semana * 7 + día).
export function rollMonthlyProspects(cantera, monthKey, day = 0) {
  const active = cantera.networks.filter((n) => cantera.scouts.some((sc) => sc.id === n.scoutId));
  if (!active.length) return { cantera: { ...cantera, prospects: [], lastMonth: monthKey }, found: 0 };
  const fresh = [];
  active.forEach((network) => {
    const scout = cantera.scouts.find((sc) => sc.id === network.scoutId);
    const rand = shared.seed ? seededRand(`${shared.seed}|${monthKey}|${network.country}`) : null;
    const count = 2 + network.level;
    for (let i = 0; i < count; i++) fresh.push(generateProspect({ scout, network, monthKey, i, day, rand }));
  });
  return { cantera: { ...cantera, prospects: fresh.slice(0, MAX_PROSPECTS), lastMonth: monthKey }, found: fresh.length };
}

// Los jóvenes que no se ficharon en el plazo de una semana desaparecen y no vuelven.
export function expireProspects(cantera, day) {
  const keep = cantera.prospects.filter((p) => p.expiresDay == null || p.expiresDay >= day);
  return keep.length === cantera.prospects.length ? cantera : { ...cantera, prospects: keep };
}

// Crecimiento mensual de los chicos ya fichados: se acercan de a poco a su potencial.
export function growYouthMonthly(youth) {
  return youth.map((y) => {
    if (y.ovr >= y.potential) return y;
    const monthsLeft = Math.max(6, (23 - y.age) * 10);
    const chance = Math.min(0.6, (y.potential - y.ovr) / monthsLeft);
    return Math.random() < chance ? { ...y, ovr: y.ovr + 1, attributes: attributesFor(y.position, y.ovr + 1) } : y;
  });
}

// ---------- Salidas ----------
// Avisa (con meses de anticipación) quiénes se van a otro club al cerrar la temporada.
export function announceDepartures(cantera, week, clubNames) {
  if (week < SEASON_WEEKS - LEAVE_WARNING_WEEKS) return { cantera, announced: [] };
  const announced = [];
  const youth = cantera.youth.map((y) => {
    if (y.age < LEAVE_AGE || y.leaving) return y;
    const club = pick(clubNames);
    announced.push({ name: y.name, club });
    return { ...y, leaving: { club, announcedWeek: week } };
  });
  return { cantera: announced.length ? { ...cantera, youth } : cantera, announced };
}

// Meses que faltan para que se vaya (la temporada cierra en la jornada 38).
export function monthsUntilLeaving(week) {
  return Math.max(0, Math.ceil((SEASON_WEEKS - week) / 4));
}

// Cierre de temporada: cumplen un año, dan un salto de nivel y se van los que lo
// tenían avisado. También vencen los contratos de ojeadores.
export function seasonRollCantera(cantera) {
  const left = cantera.youth.filter((y) => y.leaving);
  const youth = cantera.youth
    .filter((y) => !y.leaving)
    .map((y) => {
      const jump = Math.round((y.potential - y.ovr) * 0.25);
      const ovr = clamp(y.ovr + jump, 0, y.potential);
      return { ...y, age: y.age + 1, ovr, attributes: attributesFor(y.position, ovr) };
    });
  // Los chicos sin fichar también cumplen años: los de 19 o más se pierden de vista.
  const prospects = cantera.prospects.map((p) => ({ ...p, age: p.age + 1 })).filter((p) => p.age <= 18);
  const scouts = cantera.scouts
    .map((sc) => ({ ...sc, seasonsLeft: sc.seasonsLeft - 1 }))
    .filter((sc) => sc.seasonsLeft > 0);
  return { cantera: { ...cantera, youth, prospects, scouts }, left };
}

// ---------- Acciones (devuelven el estado nuevo o { error }) ----------
export function hireCanteraScout(s, specialty, seasons) {
  const c = s.cantera;
  if (c.scouts.length >= MAX_CANTERA_SCOUTS) return { error: "max_scouts" };
  const cost = rollAcademyCost(specialty);
  if (s.budget < cost) return { error: "insufficient_budget", cost };
  const scout = { id: `cs_${Date.now()}_${Math.floor(Math.random() * 9999)}`, specialty, seasonsLeft: seasons, cost, hiredWeek: s.week };
  return {
    state: {
      ...s,
      budget: Math.round((s.budget - cost) * 20) / 20,
      cantera: { ...c, scouts: [...c.scouts, scout] },
      news: [`🌱 Contrataste un ojeador de cantera ${SCOUT_SPECIALTIES[specialty]?.label || ""} (€${cost}M, ${seasons} temporada${seasons === 1 ? "" : "s"}).`, ...s.news].slice(0, 8),
    },
    cost,
  };
}

// Abrir una red exige mandar un ojeador libre a ese país (queda asignado). Subir de nivel una red ya
// abierta usa a su ojeador. Más nivel = más jóvenes en el informe de cada mes.
export function buildNetwork(s, country, scoutId = null) {
  const c = s.cantera;
  const existing = c.networks.find((n) => n.country === country);
  if (!existing && c.networks.length >= MAX_NETWORKS) return { error: "max_networks" };
  const level = (existing?.level || 0) + 1;
  if (level > MAX_NETWORK_LEVEL) return { error: "max_level" };
  const assigned = existing && c.scouts.some((sc) => sc.id === existing.scoutId);
  let sendScout = existing?.scoutId || null;
  if (!assigned) {
    const busy = new Set(c.networks.filter((n) => n.country !== country).map((n) => n.scoutId));
    const scout = c.scouts.find((sc) => sc.id === scoutId && !busy.has(sc.id));
    if (!scout) return { error: "need_scout" };
    sendScout = scout.id;
  }
  const cost = NETWORK_COSTS[level - 1];
  if (s.budget < cost) return { error: "insufficient_budget", cost };
  const networks = existing
    ? c.networks.map((n) => (n.country === country ? { ...n, level, scoutId: sendScout } : n))
    : [...c.networks, { id: `net_${country}`, country, level, scoutId: sendScout }];
  return {
    state: {
      ...s,
      budget: Math.round((s.budget - cost) * 20) / 20,
      cantera: { ...c, networks },
      news: [existing ? `🌍 Ampliaste tu red en ${country} al nivel ${level} (€${cost}M).` : `🌍 Abriste una red de cantera en ${country} (€${cost}M).`, ...s.news].slice(0, 8),
    },
    cost,
  };
}

export function signProspect(s, id) {
  const c = s.cantera;
  const p = c.prospects.find((x) => x.id === id);
  if (!p) return { error: "not_found" };
  if (p.expiresDay != null && p.expiresDay < s.week * 7 + (s.day || 0)) return { error: "expired" };
  if (!c.scouts.length) return { error: "no_scouts" };
  if (c.youth.length >= MAX_YOUTH) return { error: "full" };
  if (s.budget < p.signCost) return { error: "insufficient_budget", cost: p.signCost };
  const youth = { ...p, signedWeek: s.week, signedSeason: s.season, scoutSpecialty: p.foundBy };
  return {
    state: {
      ...s,
      budget: Math.round((s.budget - p.signCost) * 20) / 20,
      cantera: { ...c, prospects: c.prospects.filter((x) => x.id !== id), youth: [...c.youth, youth] },
      news: [`🌱 Sumaste a ${p.name} (${p.age} años) a la cantera.`, ...s.news].slice(0, 8),
    },
  };
}

export function releaseYouth(s, id) {
  const c = s.cantera;
  const y = c.youth.find((x) => x.id === id);
  if (!y) return { error: "not_found" };
  return {
    state: {
      ...s,
      cantera: { ...c, youth: c.youth.filter((x) => x.id !== id) },
      news: [`👋 ${y.name} dejó la cantera.`, ...s.news].slice(0, 8),
    },
  };
}

export { ACADEMY_COUNTRIES };
