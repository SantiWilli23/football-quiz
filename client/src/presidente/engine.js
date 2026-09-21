// Motor puro de Modo Presidente. A diferencia de Modo DT (que dirige la
// cancha), acá se maneja el CLUB como institución: la plata (ingresos por
// entradas, socios, sponsors, TV, tienda y palcos; gastos por sueldos,
// mantenimiento e intereses), la infraestructura, la filosofía deportiva,
// los contratos del plantel, la relación con la prensa, los socios y la
// directiva (con una elección cada cuatro temporadas). La liga se juega de
// verdad: fixture todos contra todos y tabla fecha a fecha; el resultado
// deportivo depende del plantel, del DT y de las decisiones que tomes.
import { teamsByLeague, teamById } from "../carrera/data/teams.js";
import { DECISIONS_POOL } from "./decisions.js";

export { DECISIONS_POOL };

// ---------------------------------------------------------------- objetivos
const OBJECTIVE_THRESHOLDS = { ganar_liga: 1, top3: 3, top4: 4, top6: 6, top8: 8, top10: 10, top12: 12, salvarse: 17 };
const OBJECTIVE_LABELS = {
  ganar_liga: "Salir campeón", top3: "Terminar en el top 3", top4: "Clasificar a copas europeas (top 4)",
  top6: "Pelear puestos europeos (top 6)", top8: "Entrar entre los primeros 8", top10: "Entrar entre los primeros 10",
  top12: "Entrar entre los primeros 12", salvarse: "Salvar la categoría",
};

export function objectiveFor(teamId) {
  const team = teamById(teamId);
  const key = team?.boardObjective || "salvarse";
  return { key, label: OBJECTIVE_LABELS[key] || "Salvar la categoría", threshold: OBJECTIVE_THRESHOLDS[key] || 17 };
}

// ---------------------------------------------------------------- constantes
export const WEEKS_PER_SEASON = 34;
export const MANDATE_SEASONS = 4; // una elección cada cuatro temporadas
export const TICKET_PRICE_LEVELS = [20, 30, 40, 55, 70];
const TICKET_DEMAND = [1.08, 1.03, 1, 0.93, 0.85]; // el precio alto espanta gente
export const MEMBER_FEE_LEVELS = [
  { fee: 100, label: "Popular" },
  { fee: 180, label: "Estándar" },
  { fee: 260, label: "Premium" },
  { fee: 350, label: "Élite" },
];
export const STADIUM_TIERS = [
  { tier: 1, capacity: 25000, upgradeCost: 0 },
  { tier: 2, capacity: 38000, upgradeCost: 40 },
  { tier: 3, capacity: 55000, upgradeCost: 90 },
  { tier: 4, capacity: 75000, upgradeCost: 160 },
];
export const SPONSOR_TIERS = [
  { tier: 1, weeklyIncome: 0.3, label: "Sponsor local" },
  { tier: 2, weeklyIncome: 0.7, label: "Sponsor nacional" },
  { tier: 3, weeklyIncome: 1.4, label: "Sponsor internacional" },
];
export const SPONSOR_SLOTS = [
  { key: "shirt", label: "Camiseta (pecho)", needsStadium: 1 },
  { key: "stadium", label: "Nombre del estadio", needsStadium: 2 },
  { key: "kit", label: "Indumentaria", needsStadium: 1 },
];
const BRANDS = [
  "Aerolíneas Boreal", "Banco Meridiano", "Cervezas Tres Ríos", "Nordex Sport", "Turbo Energy", "Telefónica Andina",
  "Seguros Ancla", "Constructora Roca", "Lácteos del Sur", "Motores Vega", "Supermercados Plaza", "Hoteles Cima",
];
const RISKY_BRANDS = ["CriptoVega Exchange", "Apuestas GolFácil", "Casino Royal Night"];

// Infraestructura (aparte del estadio): cada eje rinde distinto.
export const INFRA = [
  { key: "vipTier", label: "Palcos VIP", tiers: [
    { cost: 20, desc: "+€0.12M/sem en días de partido" }, { cost: 45, desc: "+€0.26M/sem" }, { cost: 80, desc: "+€0.45M/sem" },
  ] },
  { key: "trainingTier", label: "Predio de entrenamiento", tiers: [
    { cost: 15, desc: "El equipo rinde +3 cada fecha" }, { cost: 35, desc: "+6 de rendimiento" }, { cost: 70, desc: "+10 de rendimiento" },
  ] },
  { key: "academyTier", label: "Cantera", tiers: [
    { cost: 10, desc: "Juveniles de mejor nivel y +2 al DT cada temporada" }, { cost: 25, desc: "+4 por temporada" }, { cost: 50, desc: "+6 por temporada" },
  ] },
  { key: "medicalTier", label: "Centro médico", tiers: [
    { cost: 12, desc: "Menos lesiones, +1 de rendimiento" }, { cost: 28, desc: "Aún menos lesiones, +2" }, { cost: 55, desc: "Casi sin lesiones, +3" },
  ] },
  { key: "storeTier", label: "Tienda oficial y museo", tiers: [
    { cost: 8, desc: "Merchandising x1.6" }, { cost: 20, desc: "x2.2" }, { cost: 40, desc: "x3 y más prestigio" },
  ] },
];
const VIP_INCOME = [0, 0.12, 0.26, 0.45];
const TRAINING_BOOST = [0, 3, 6, 10];
const MEDICAL_BOOST = [0, 1, 2, 3];
const STORE_MULT = [1, 1.6, 2.2, 3];
export const TRAINING_TIERS = INFRA[1].tiers.map((t, i) => ({ tier: i + 1, cost: t.cost, strengthBoost: TRAINING_BOOST[i + 1], label: `Predio nivel ${i + 1}` }));
export const ACADEMY_TIERS = INFRA[2].tiers.map((t, i) => ({ tier: i + 1, cost: t.cost, dtQualityPerSeason: [2, 4, 6][i], label: `Cantera nivel ${i + 1}` }));

// Filosofía deportiva: la identidad del club. Marca el rumbo de la gestión.
export const PHILOSOPHIES = {
  equilibrado: { label: "Equilibrado", icon: "⚖️", desc: "Sin excesos: un poco de cantera, un poco de figuras.", wage: 1, strength: 0, merch: 1, youth: 0, fan: 0 },
  cantera: { label: "Cantera y proyecto", icon: "🌱", desc: "Sueldos bajos, juveniles que crecen más rápido. Menos brillo hoy, más valor mañana.", wage: 0.85, strength: -2, merch: 0.9, youth: 2, fan: 0 },
  estrellas: { label: "Galácticos", icon: "⭐", desc: "Figuras y marketing: el equipo rinde más y vende más, pero los sueldos se disparan.", wage: 1.25, strength: 4, merch: 1.3, youth: -1, fan: 1 },
  austero: { label: "Austeridad", icon: "🧾", desc: "Cuentas primero: sueldos mínimos y ahorro. El equipo rinde menos, la directiva te ama.", wage: 0.75, strength: -4, merch: 1, youth: 0, fan: -1 },
};
export const WAGE_LEVELS = [
  { level: 1, label: "Recorte", mult: 0.7, strength: -4 },
  { level: 2, label: "Ajustada", mult: 0.85, strength: -2 },
  { level: 3, label: "Normal", mult: 1, strength: 0 },
  { level: 4, label: "Generosa", mult: 1.2, strength: 2 },
  { level: 5, label: "Sin techo", mult: 1.45, strength: 4 },
];
export const CAMPAIGNS = {
  socios: { label: "Campaña de socios", cost: 1.5, desc: "+8% de socios y algo de hinchada", cooldown: 4 },
  prensa: { label: "Ofensiva de prensa", cost: 1, desc: "+12 de relación con la prensa", cooldown: 4 },
  comunidad: { label: "Acción comunitaria", cost: 2, desc: "+6 de hinchada y +2 de directiva", cooldown: 4 },
};
export const LOAN_OPTIONS = [10, 25, 50];
export const DEBT_CEILING = 45;
export const DT_CANDIDATES = [
  { id: "dt_estrella", name: "Diego Ibarra", style: "Estrella mediática", cost: 9, quality: 68, fanBoost: 6 },
  { id: "dt_tactico", name: "Hans Richter", style: "Técnico disciplinado", cost: 5, quality: 58, fanBoost: 0 },
  { id: "dt_formador", name: "Paulo Ferreira", style: "Formador de juveniles", cost: 2, quality: 46, fanBoost: 2 },
  { id: "dt_veterano", name: "Ricardo Suels", style: "Veterano de la casa", cost: 0, quality: 50, fanBoost: 4 },
];
export const ACHIEVEMENTS = [
  { id: "titulo", label: "Primer título", desc: "Salí campeón de liga", test: (s) => s.titlesWon >= 1 },
  { id: "dinastia", label: "Dinastía", desc: "Ganá 3 títulos", test: (s) => s.titlesWon >= 3 },
  { id: "coloso", label: "El coloso", desc: "Estadio al máximo", test: (s) => s.stadiumTier >= 4 },
  { id: "cantera", label: "Cantera de élite", desc: "Cantera nivel 3", test: (s) => s.academyTier >= 3 },
  { id: "cuentas", label: "Cuentas sanas", desc: "Sin deuda y más de €30M en caja (desde la temporada 3)", test: (s) => s.season >= 3 && s.debt === 0 && s.budget >= 30 },
  { id: "socios50", label: "50 mil socios", desc: "Llegá a 50.000 socios", test: (s) => s.members >= 50000 },
  { id: "reelecto", label: "Reelecto", desc: "Ganá una elección", test: (s) => s.electionsWon >= 1 },
  { id: "europa", label: "Noches europeas", desc: "Clasificá a competencia internacional", test: (s) => (s.history || []).some((h) => h.qualifiesInternational) },
  { id: "prestigio", label: "Marca global", desc: "80 de prestigio", test: (s) => s.prestige >= 80 },
  { id: "vip", label: "Palco de oro", desc: "Palcos VIP nivel 3", test: (s) => s.vipTier >= 3 },
  { id: "pueblo", label: "Presidente del pueblo", desc: "Hinchada 90+ y prensa 70+", test: (s) => s.fanHappiness >= 90 && s.press >= 70 },
  { id: "decada", label: "Una década", desc: "Diez temporadas al frente", test: (s) => (s.history || []).length >= 10 },
];

// ------------------------------------------------------------------ helpers
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rint(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}
const r2 = (x) => Math.round(x * 20) / 20; // a múltiplos de 0.05M
const r3 = (x) => Math.round(x * 1000) / 1000;

const FIRST_NAMES = ["Mateo", "Lucas", "Thiago", "Bruno", "Diego", "Iker", "Rodri", "Kevin", "Marco", "Yusuf", "Noah", "Luca", "Enzo", "Tomás", "Adama", "Kian", "Nico", "Álvaro", "Facundo", "Sami"];
const LAST_NAMES = ["Fernández", "Silva", "Okafor", "Nilsson", "Varela", "Rossi", "Dubois", "Alonso", "Kovač", "Haruna", "Petrov", "Castillo", "Moreau", "Lindqvist", "Bianchi", "Ortega", "Mensah", "Koller"];
const TARGET_POSITIONS = ["Delantero", "Extremo", "Mediocampista", "Defensor central", "Lateral", "Arquero"];
const BOARD_ROLES = [
  { role: "Tesorero", interest: "finanzas", wants: "Cuentas ordenadas y poca deuda" },
  { role: "Delegado de la hinchada", interest: "hinchada", wants: "Hinchada contenta" },
  { role: "Director deportivo", interest: "deporte", wants: "Cumplir el objetivo deportivo" },
  { role: "Jefe de prensa", interest: "prensa", wants: "Buena relación con los medios" },
  { role: "Vocal de socios", interest: "socios", wants: "Que crezca la masa societaria" },
];

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function addNews(state, msg) {
  return { ...state, news: [msg, ...state.news].slice(0, 10) };
}

// Ingresos/gastos del período (para el libro contable de la temporada).
function emptyLedger() {
  return {
    income: { tickets: 0, socios: 0, sponsors: 0, tv: 0, merch: 0, vip: 0, intl: 0, premios: 0, ventas: 0, otros: 0 },
    expense: { sueldos: 0, mantenimiento: 0, intereses: 0, inversion: 0, fichajes: 0, otros: 0 },
  };
}
function credit(state, amount, cat) {
  const ledger = state.ledger || emptyLedger();
  return {
    ...state,
    budget: r2(state.budget + amount),
    ledger: { ...ledger, income: { ...ledger.income, [cat]: (ledger.income[cat] || 0) + amount } },
  };
}
function charge(state, amount, cat) {
  const ledger = state.ledger || emptyLedger();
  return {
    ...state,
    budget: r2(state.budget - amount),
    ledger: { ...ledger, expense: { ...ledger.expense, [cat]: (ledger.expense[cat] || 0) + amount } },
  };
}

// -------------------------------------------------------------- plantel
const SQUAD_SHAPE = [["POR", 2], ["DEF", 6], ["MED", 6], ["DEL", 4]];

export function wageFor(ovr) {
  return r3(0.0002 * Math.pow(Math.max(ovr - 35, 1), 1.7));
}

export function playerValue(p) {
  const ageFactor = p.age <= 21 ? 1.3 : p.age <= 26 ? 1.1 : p.age <= 29 ? 0.9 : p.age <= 32 ? 0.6 : 0.3;
  const base = Math.pow(Math.max(p.ovr - 45, 0) / 40, 2.6) * 90 * ageFactor;
  return Math.max(0.5, Math.round(base * 2) / 2);
}

function makePlayer(ovr, age, pos, contract) {
  const o = clamp(Math.round(ovr), 40, 92);
  return {
    id: `pl${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: randomName(),
    pos,
    age,
    ovr: o,
    pot: age < 24 ? clamp(o + rint(2, 9), o, 94) : o,
    contract: contract ?? rint(1, 4),
    wage: wageFor(o),
    injured: 0,
  };
}

function buildSquad(baselineOvr) {
  const squad = [];
  for (const [pos, n] of SQUAD_SHAPE) {
    for (let i = 0; i < n; i++) {
      const young = Math.random() < 0.18;
      squad.push(makePlayer(baselineOvr + rint(-9, 9), young ? rint(17, 20) : rint(21, 34), pos));
    }
  }
  return squad;
}

function youthPlayer(state, pos) {
  const academy = state.academyTier || 0;
  return makePlayer(44 + academy * 3 + rint(0, 8), rint(17, 19), pos || pick(["DEF", "MED", "DEL"]), 3);
}

// Fichajes libres cuando se va alguien por fin de contrato: llegan al nivel
// base del club (un poco menos) — el DT siempre repone, pero sin regalar figuras.
function replacementPlayer(state, pos) {
  return makePlayer(state.baselineOvr - 6 + (state.academyTier || 0) * 2 + rint(-4, 4), rint(19, 29), pos || pick(["DEF", "MED", "DEL"]), 3);
}

export function membersCap(state) {
  return Math.round(15000 + state.prestige * 900 + STADIUM_TIERS[state.stadiumTier - 1].capacity);
}

export function squadAverage(state, topN = 14) {
  const healthy = (state.squad || []).filter((p) => !p.injured).sort((a, b) => b.ovr - a.ovr).slice(0, topN);
  if (!healthy.length) return 40;
  return healthy.reduce((s, p) => s + p.ovr, 0) / healthy.length;
}

export function payroll(state) {
  const wageMult = WAGE_LEVELS[(state.wageLevel || 3) - 1].mult * PHILOSOPHIES[state.philosophy || "equilibrado"].wage;
  return (state.squad || []).reduce((s, p) => s + p.wage, 0) * wageMult;
}

// ------------------------------------------------------------ fuerza / liga
export function teamStrength(state) {
  const t = teamById(state.teamId);
  const base = (t?.budget || 40) * 0.5 + (t?.prestige || 5) * 3;
  const phil = PHILOSOPHIES[state.philosophy || "equilibrado"];
  const wage = WAGE_LEVELS[(state.wageLevel || 3) - 1];
  return (
    base
    + (squadAverage(state) - (state.baselineOvr || 60)) * 2.2
    + ((state.dtQuality || 50) - (state.baselineDt || 50)) * 0.3
    + TRAINING_BOOST[state.trainingTier || 0]
    + MEDICAL_BOOST[state.medicalTier || 0]
    + phil.strength + wage.strength
    + (state.dtBudgetGiven || 0) * 0.6
  );
}

function circleRoundRobin(teamIds) {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push(null);
  const n = ids.length;
  const half = n / 2;
  let arr = ids.slice();
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr = [arr[0], arr[arr.length - 1], ...arr.slice(1, arr.length - 1)];
  }
  return rounds;
}

export function buildFixtures(league) {
  const ids = teamsByLeague(league).map((t) => t.id);
  const firstLeg = circleRoundRobin(ids);
  const secondLeg = firstLeg.map((round) => round.map(([a, b]) => [b, a]));
  return [...firstLeg, ...secondLeg];
}

export function buildLeagueTable(league) {
  return teamsByLeague(league).map((t) => ({ id: t.id, name: t.name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }));
}

export function sortedLeagueTable(table) {
  return [...table].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
}

export function myLeaguePosition(state) {
  const sorted = sortedLeagueTable(state.leagueTable || []);
  const i = sorted.findIndex((r) => r.id === state.teamId);
  return i < 0 ? 0 : i + 1;
}

function matchStrength(state, teamId) {
  if (teamId === state.teamId) return teamStrength(state);
  const t = teamById(teamId);
  return (t?.budget || 40) * 0.5 + (t?.prestige || 5) * 3;
}

function poissonish(lambda) {
  let g = 0;
  let p = Math.exp(-lambda);
  let s = p;
  const u = Math.random();
  while (s < u && g < 8) {
    g++;
    p *= lambda / g;
    s += p;
  }
  return g;
}

function simulateOneMatch(a, b) {
  const diff = a - b;
  return [poissonish(clamp(1.3 + diff / 40, 0.2, 4.2)), poissonish(clamp(1.3 - diff / 40, 0.2, 4.2))];
}

function applyResultToTable(table, homeId, awayId, gh, ga) {
  return table.map((row) => {
    if (row.id !== homeId && row.id !== awayId) return row;
    const isHome = row.id === homeId;
    const gf = isHome ? gh : ga;
    const gc = isHome ? ga : gh;
    const win = gf > gc;
    const draw = gf === gc;
    return {
      ...row, pj: row.pj + 1, pg: row.pg + (win ? 1 : 0), pe: row.pe + (draw ? 1 : 0), pp: row.pp + (!win && !draw ? 1 : 0),
      gf: row.gf + gf, gc: row.gc + gc, pts: row.pts + (win ? 3 : draw ? 1 : 0),
    };
  });
}

function simulateMatchweek(state) {
  const round = state.fixtures?.[state.week];
  if (!round || !round.length) return { table: state.leagueTable, myResult: null };
  let table = state.leagueTable || [];
  let myResult = null;
  const myStrength = teamStrength(state);
  for (const [homeId, awayId] of round) {
    const sh = homeId === state.teamId ? myStrength : matchStrength(state, homeId);
    const sa = awayId === state.teamId ? myStrength : matchStrength(state, awayId);
    // Localía: el que juega en casa suma un poco (y el estadio lleno pesa).
    const [gh, ga] = simulateOneMatch(sh + 2, sa);
    table = applyResultToTable(table, homeId, awayId, gh, ga);
    if (homeId === state.teamId || awayId === state.teamId) {
      const isHome = homeId === state.teamId;
      myResult = {
        opponentId: isHome ? awayId : homeId, isHome,
        myGoals: isHome ? gh : ga, rivalGoals: isHome ? ga : gh,
        isClasico: (isHome ? awayId : homeId) === state.rivalId,
      };
    }
  }
  return { table, myResult };
}

// ------------------------------------------------------------ estado inicial
function buildBoard() {
  return BOARD_ROLES.map((r, i) => ({ id: `b${i}`, name: randomName(), ...r, favor: 0, bias: rint(-6, 6), lastLobby: -99 }));
}

function sponsorBase(slot, prestige) {
  const p = prestige;
  if (slot === "shirt") return 0.13 + p * 0.007;
  if (slot === "stadium") return 0.07 + p * 0.0045;
  return 0.06 + p * 0.004;
}

export function generateSponsorOffers(state) {
  const offers = [];
  for (const slot of SPONSOR_SLOTS) {
    const current = state.sponsors?.[slot.key];
    if (current && current.seasonsLeft > 0) continue;
    if ((state.stadiumTier || 1) < slot.needsStadium) continue;
    const base = sponsorBase(slot.key, state.prestige) * (0.9 + (state.press || 50) / 500);
    const n = state.prestige >= 25 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const seasons = [1, 2, 3][i % 3];
      const risky = i === n - 1 && Math.random() < 0.5;
      const mult = (seasons === 1 ? 1.1 : seasons === 2 ? 1 : 0.92) * (risky ? 1.4 : 1);
      const weekly = r3(base * mult);
      offers.push({
        id: `o${slot.key}${i}${state.season}`,
        slot: slot.key,
        brand: risky ? pick(RISKY_BRANDS) : pick(BRANDS),
        weekly,
        seasons,
        bonus: Math.round(weekly * 8),
        risky,
      });
    }
  }
  return offers;
}

export function tvOptions(state) {
  const base = 0.22 + state.prestige * 0.004;
  return [
    { id: "fija", label: "Contrato fijo", desc: "Plata segura por dos temporadas.", weekly: r3(base), bonusWeekly: 0, seasons: 2 },
    { id: "variable", label: "Variable por rendimiento", desc: "Menos base, pero cobrás un extra semanal si estás en el top 4.", weekly: r3(base * 0.7), bonusWeekly: r3(base * 0.9), seasons: 2 },
    { id: "corto", label: "Acuerdo anual flexible", desc: "Un poco más por semana, pero hay que renegociar cada año.", weekly: r3(base * 1.08), bonusWeekly: 0, seasons: 1 },
  ];
}

export function initialPresidentState(teamId, teamName, league, teamPrestige, philosophy = "equilibrado") {
  const fixtures = buildFixtures(league);
  const rivals = teamsByLeague(league).filter((t) => t.id !== teamId);
  const prestige = clamp((teamPrestige || 5) * 9, 10, 95);
  const baselineOvr = 55 + (teamPrestige || 5) * 2.8;
  const dtQuality = clamp(40 + (teamPrestige || 5) * 2, 30, 75);
  const base = {
    version: 3,
    teamId, teamName, league,
    season: 1, week: 0, turn: 0, weeksPerSeason: fixtures.length,
    budget: 10 + (teamPrestige || 5) * 2, debt: 0,
    fanHappiness: 60, boardTrust: 60, press: 50, prestige,
    philosophy, philosophyChangedSeason: 1,
    wageLevel: 3, ticketPriceLevel: 2, memberFeeLevel: 2,
    members: Math.round(6000 + (teamPrestige || 5) * 2800), baseMembers: Math.round(6000 + (teamPrestige || 5) * 2800),
    stadiumTier: 1, vipTier: 0, trainingTier: 0, academyTier: 0, medicalTier: 0, storeTier: 0,
    sponsors: { shirt: null, stadium: null, kit: null },
    sponsorOffers: [],
    tv: null,
    dtBudgetGiven: 0, dtQuality, baselineDt: dtQuality, dtName: `Cuerpo técnico de ${teamName}`, dtStyle: "Balanceado", dtConfidence: 65, dtContract: 2,
    baselineOvr,
    squad: buildSquad(baselineOvr),
    board: buildBoard(),
    opposition: { name: randomName(), strength: rint(35, 55) },
    electionsWon: 0,
    rivalId: rivals.length ? pick(rivals).id : null,
    transferTargets: [], pendingSale: null, internationalQualified: false,
    fixtures, leagueTable: buildLeagueTable(league), leaguePosition: null,
    ledger: emptyLedger(), lastLedger: null,
    cooldowns: {},
    history: [], titlesWon: 0, achievements: [], voteCrisisUsed: false,
    news: [`Asumiste la presidencia de ${teamName}. Filosofía: ${PHILOSOPHIES[philosophy].label}.`],
    gameOver: false, gameOverReason: null, currentDecision: null, decisionUsed: false, _usedDecisions: [],
  };
  base.tv = { ...tvOptions(base)[0], seasonsLeft: 2 };
  // Arrancás con dos sponsors ya firmados (camiseta e indumentaria): los que
  // heredaste de la gestión anterior. El resto hay que salir a buscarlos.
  base.sponsorOffers = generateSponsorOffers(base);
  for (const slot of ["shirt", "kit"]) {
    const o = base.sponsorOffers.find((x) => x.slot === slot && x.seasons === 2 && !x.risky);
    if (o) base.sponsors[slot] = { brand: o.brand, weekly: o.weekly, seasonsLeft: 2, bonus: o.bonus, risky: false };
  }
  base.sponsorOffers = generateSponsorOffers(base);
  base.currentDecision = pickDecision(base, []);
  return base;
}

// Guardados de versiones anteriores (v1/v2): se completan los campos nuevos
// sin perder la plata, la tabla ni el historial.
export function migrateState(old) {
  if (!old) return old;
  if (old.version >= 3) return old;
  const fresh = initialPresidentState(old.teamId, old.teamName, old.league, teamById(old.teamId)?.prestige || 5);
  const sponsors = { shirt: null, stadium: null, kit: null };
  if (old.sponsorTier > 0) {
    sponsors.shirt = { brand: "Sponsor histórico", weekly: SPONSOR_TIERS[old.sponsorTier - 1].weeklyIncome, seasonsLeft: 2, bonus: 0, risky: false };
  }
  return {
    ...fresh,
    ...old,
    version: 3,
    turn: old.turn || (old.season || 1) * 40 + (old.week || 0),
    press: old.press ?? 50,
    prestige: fresh.prestige + (old.titlesWon || 0) * 4,
    squad: fresh.squad,
    baselineOvr: fresh.baselineOvr,
    baselineDt: fresh.baselineDt,
    board: fresh.board,
    opposition: fresh.opposition,
    sponsors,
    sponsorOffers: fresh.sponsorOffers,
    tv: fresh.tv,
    ledger: emptyLedger(),
    achievements: old.achievements || [],
    cooldowns: {},
    dtContract: old.dtName ? 2 : 0,
    ticketPriceLevel: clamp(old.ticketPriceLevel || 2, 1, 5),
  };
}

// -------------------------------------------------------- finanzas semanales
function attendanceRate(state) {
  const base = clamp(0.3 + state.fanHappiness / 130 + state.prestige / 1000, 0.3, 1);
  return clamp(base * TICKET_DEMAND[state.ticketPriceLevel - 1], 0.25, 1);
}

export function weeklyIncome(state) {
  const stadium = STADIUM_TIERS[state.stadiumTier - 1];
  const rate = attendanceRate(state);
  const attendance = Math.round(stadium.capacity * rate);
  const tickets = (attendance * TICKET_PRICE_LEVELS[state.ticketPriceLevel - 1]) / 1_000_000;
  const socios = (state.members * MEMBER_FEE_LEVELS[state.memberFeeLevel - 1].fee) / 1_000_000 / (state.weeksPerSeason || WEEKS_PER_SEASON);
  const sponsors = Object.values(state.sponsors || {}).reduce((s, d) => s + (d && d.seasonsLeft > 0 ? d.weekly : 0), 0);
  const inTop4 = myLeaguePosition(state) > 0 && myLeaguePosition(state) <= 4 && state.week >= 5;
  const tv = state.tv && state.tv.seasonsLeft > 0 ? state.tv.weekly + (inTop4 ? state.tv.bonusWeekly || 0 : 0) : 0.1;
  const phil = PHILOSOPHIES[state.philosophy || "equilibrado"];
  const merch = (0.04 + state.fanHappiness / 1400 + (state.titlesWon || 0) * 0.03 + state.prestige / 1500) * STORE_MULT[state.storeTier || 0] * phil.merch;
  const vip = VIP_INCOME[state.vipTier || 0] * rate;
  const intl = state.internationalQualified ? 0.3 : 0;
  return { tickets, socios, sponsors, tv, merch, vip, intl, attendance, rate, total: tickets + socios + sponsors + tv + merch + vip + intl };
}

export function weeklyExpenses(state) {
  const sueldos = payroll(state) + 0.04 + (state.dtQuality || 40) * 0.001;
  const infra = (state.vipTier || 0) + (state.trainingTier || 0) + (state.academyTier || 0) + (state.medicalTier || 0) + (state.storeTier || 0);
  const mantenimiento = state.stadiumTier * 0.08 + infra * 0.03;
  const intereses = state.debt * (state.debt > DEBT_CEILING ? 0.012 : 0.004);
  return { sueldos, mantenimiento, intereses, total: sueldos + mantenimiento + intereses };
}

export function investmentsLocked(state) {
  return state.debt > DEBT_CEILING;
}

// --------------------------------------------------------- directiva y voto
export function boardLoyalty(state, m) {
  let v = state.boardTrust + (m.favor || 0) + (m.bias || 0);
  if (m.interest === "finanzas") v += state.debt > 20 ? -12 : state.budget >= 15 ? 6 : 0;
  else if (m.interest === "hinchada") v += (state.fanHappiness - 60) / 5;
  else if (m.interest === "deporte") {
    const pos = myLeaguePosition(state) || 10;
    v += pos <= objectiveFor(state.teamId).threshold ? 6 : -6;
  } else if (m.interest === "prensa") v += ((state.press ?? 50) - 50) / 5;
  else if (m.interest === "socios") v += state.members >= (state.baseMembers || state.members) ? 5 : -3;
  return clamp(Math.round(v), 0, 100);
}

export function projectedVote(state) {
  const objectiveMet = (state.history || [])[0]?.objectiveMet;
  const pct = 30
    + state.boardTrust * 0.22 + state.fanHappiness * 0.2 + (state.press ?? 50) * 0.08
    + Math.min(state.titlesWon || 0, 3) * 3
    + (objectiveMet === undefined ? 0 : objectiveMet ? 4 : -4)
    + (state.board || []).reduce((s, m) => s + (m.favor || 0), 0) / 10
    - (state.opposition?.strength || 45) * 0.15;
  return clamp(Math.round(pct * 10) / 10, 5, 95);
}

export function seasonsToElection(state) {
  return MANDATE_SEASONS - (((state.season - 1) % MANDATE_SEASONS));
}

// -------------------------------------------------------- decisiones y efectos
export function pickDecision(state, usedIds = []) {
  const eligible = DECISIONS_POOL.filter((d) => !usedIds.includes(d.id) && (!d.when || d.when(state)));
  const list = eligible.length ? eligible : DECISIONS_POOL.filter((d) => !d.when);
  const d = list[Math.floor(Math.random() * list.length)];
  // Solo lo serializable queda en el estado (sin la función `when`).
  return { id: d.id, context: d.context, options: d.options, effects: d.effects };
}

function applyScandal(state, msgPrefix = "Se filtró un escándalo") {
  let s = { ...state, prestige: clamp(state.prestige - 4, 0, 100), press: clamp((state.press ?? 50) - 12, 0, 100), fanHappiness: clamp(state.fanHappiness - 6, 0, 100), boardTrust: clamp(state.boardTrust - 4, 0, 100) };
  s = addNews(s, `📰 ${msgPrefix}: la prensa te apunta y baja el prestigio del club.`);
  return s;
}

export function applyDecisionEffects(state, decision, optionIdx) {
  const fx = decision.effects[optionIdx] || {};
  let s = { ...state };
  if (fx.budget) s = fx.budget > 0 ? credit(s, fx.budget, "otros") : charge(s, -fx.budget, "otros");
  if (fx.debt) s.debt = Math.max(0, s.debt + fx.debt);
  if (fx.fanHappiness) s.fanHappiness = clamp(s.fanHappiness + fx.fanHappiness, 0, 100);
  if (fx.boardTrust) s.boardTrust = clamp(s.boardTrust + fx.boardTrust, 0, 100);
  if (fx.press) s.press = clamp((s.press ?? 50) + fx.press, 0, 100);
  if (fx.prestige) s.prestige = clamp(s.prestige + fx.prestige, 0, 100);
  if (fx.dtQuality) s.dtQuality = clamp(s.dtQuality + fx.dtQuality, 20, 95);
  if (fx.dtConfidence) s.dtConfidence = clamp(s.dtConfidence + fx.dtConfidence, 0, 100);
  if (fx.dtBudgetGiven) s.dtBudgetGiven = (s.dtBudgetGiven || 0) + fx.dtBudgetGiven;
  if (fx.ticketPriceDelta) s.ticketPriceLevel = clamp(s.ticketPriceLevel + fx.ticketPriceDelta, 1, TICKET_PRICE_LEVELS.length);
  if (fx.memberFeeDelta) s.memberFeeLevel = clamp(s.memberFeeLevel + fx.memberFeeDelta, 1, MEMBER_FEE_LEVELS.length);
  if (fx.membersPct) s.members = Math.max(1000, Math.round(s.members * (1 + fx.membersPct / 100)));
  if (fx.oppositionDelta) s.opposition = { ...s.opposition, strength: clamp(s.opposition.strength + fx.oppositionDelta, 10, 90) };
  if (fx.starInjury && s.squad.length) {
    const star = [...s.squad].sort((a, b) => b.ovr - a.ovr)[0];
    s.squad = s.squad.map((p) => (p.id === star.id ? { ...p, injured: fx.starInjury } : p));
    s = addNews(s, `🩹 ${star.name} se lesionó y estará ${fx.starInjury} semanas afuera.`);
  }
  if (fx.youthBoost && s.squad.length) {
    const kids = [...s.squad].filter((p) => p.age <= 21).sort((a, b) => b.pot - a.pot);
    if (kids[0]) s.squad = s.squad.map((p) => (p.id === kids[0].id ? { ...p, ovr: Math.min(p.pot, p.ovr + fx.youthBoost) } : p));
  }
  if (fx.sellBackup) {
    const kid = [...s.squad].filter((p) => p.age <= 21).sort((a, b) => b.pot - a.pot)[0];
    if (kid) s.squad = s.squad.map((p) => (p.id === kid.id ? youthPlayer(s, p.pos) : p));
  }
  if (fx.scandal) s = applyScandal(s);
  if (fx.fireDtEffect) s = fireDt(s);
  return s;
}

// -------------------------------------------------------------- acciones
export function setTicketPrice(state, level) {
  return { ...state, ticketPriceLevel: clamp(level, 1, TICKET_PRICE_LEVELS.length) };
}
export function setMemberFee(state, level) {
  return { ...state, memberFeeLevel: clamp(level, 1, MEMBER_FEE_LEVELS.length) };
}
export function setWageLevel(state, level) {
  return { ...state, wageLevel: clamp(level, 1, WAGE_LEVELS.length) };
}
export function setPhilosophy(state, key) {
  if (!PHILOSOPHIES[key] || key === state.philosophy) return state;
  if (state.philosophyChangedSeason === state.season && state.turn > 0) return state; // una vez por temporada
  const s = {
    ...state,
    philosophy: key,
    philosophyChangedSeason: state.season,
    boardTrust: clamp(state.boardTrust - 3, 0, 100),
    fanHappiness: clamp(state.fanHappiness + PHILOSOPHIES[key].fan * 2, 0, 100),
  };
  return addNews(s, `🧭 Cambio de rumbo: el club adopta la filosofía «${PHILOSOPHIES[key].label}».`);
}

export function canUpgradeStadium(state) {
  const next = STADIUM_TIERS[state.stadiumTier];
  return !!next && !investmentsLocked(state) && state.budget >= next.upgradeCost;
}
export function upgradeStadium(state) {
  const next = STADIUM_TIERS[state.stadiumTier];
  if (!next || !canUpgradeStadium(state)) return state;
  let s = charge(state, next.upgradeCost, "inversion");
  s = { ...s, stadiumTier: next.tier, boardTrust: clamp(s.boardTrust + 4, 0, 100), prestige: clamp(s.prestige + 2, 0, 100) };
  s.sponsorOffers = generateSponsorOffers(s);
  return addNews(s, `🏟️ Ampliaste el estadio a ${next.capacity.toLocaleString()} espectadores.`);
}

export function canUpgradeInfra(state, key) {
  const def = INFRA.find((i) => i.key === key);
  const cur = state[key] || 0;
  const next = def?.tiers[cur];
  return !!next && !investmentsLocked(state) && state.budget >= next.cost;
}
export function upgradeInfra(state, key) {
  const def = INFRA.find((i) => i.key === key);
  if (!def || !canUpgradeInfra(state, key)) return state;
  const cur = state[key] || 0;
  let s = charge(state, def.tiers[cur].cost, "inversion");
  s = { ...s, [key]: cur + 1 };
  if (key === "storeTier" && cur + 1 === 3) s.prestige = clamp(s.prestige + 3, 0, 100);
  return addNews(s, `🏗️ ${def.label}: nivel ${cur + 1} inaugurado.`);
}

export function signSponsor(state, offerId) {
  const offer = (state.sponsorOffers || []).find((o) => o.id === offerId);
  if (!offer) return state;
  let s = {
    ...state,
    sponsors: { ...state.sponsors, [offer.slot]: { brand: offer.brand, weekly: offer.weekly, seasonsLeft: offer.seasons, bonus: offer.bonus, risky: offer.risky } },
    sponsorOffers: state.sponsorOffers.filter((o) => o.slot !== offer.slot),
    boardTrust: clamp(state.boardTrust + 1, 0, 100),
  };
  s = addNews(s, `🤝 Firmaste con ${offer.brand} (${offer.seasons} temporada${offer.seasons > 1 ? "s" : ""}, €${offer.weekly}M/sem).`);
  return s;
}

export function negotiateTv(state, optionId) {
  if (state.tv && state.tv.seasonsLeft > 0) return state;
  const opt = tvOptions(state).find((o) => o.id === optionId);
  if (!opt) return state;
  return addNews({ ...state, tv: { ...opt, seasonsLeft: opt.seasons } }, `📺 Nuevo contrato de TV: ${opt.label.toLowerCase()}.`);
}

export function takeLoan(state, amount) {
  if (!LOAN_OPTIONS.includes(amount) || state.debt + amount > 120) return state;
  let s = credit(state, amount, "otros");
  s = { ...s, debt: state.debt + amount, boardTrust: clamp(s.boardTrust - 2, 0, 100) };
  return addNews(s, `🏦 Pediste un préstamo de €${amount}M al banco.`);
}
export function repayDebt(state, amount) {
  const pay = Math.min(amount, state.debt, Math.floor(state.budget));
  if (pay <= 0) return state;
  let s = charge(state, pay, "otros");
  s = { ...s, debt: state.debt - pay, boardTrust: clamp(s.boardTrust + 1, 0, 100) };
  return addNews(s, `💸 Cancelaste €${pay}M de deuda.`);
}

export function runCampaign(state, kind) {
  const c = CAMPAIGNS[kind];
  if (!c || state.budget < c.cost || (state.cooldowns?.[kind] || 0) > state.turn) return state;
  let s = charge(state, c.cost, "otros");
  s = { ...s, cooldowns: { ...s.cooldowns, [kind]: state.turn + c.cooldown } };
  if (kind === "socios") s = { ...s, members: Math.round(s.members * 1.08), fanHappiness: clamp(s.fanHappiness + 2, 0, 100) };
  if (kind === "prensa") s = { ...s, press: clamp((s.press ?? 50) + 12, 0, 100) };
  if (kind === "comunidad") s = { ...s, fanHappiness: clamp(s.fanHappiness + 6, 0, 100), boardTrust: clamp(s.boardTrust + 2, 0, 100) };
  return addNews(s, `📣 ${c.label}: listo.`);
}

export function lobbyMember(state, memberId) {
  const cost = 0.6;
  const m = state.board.find((b) => b.id === memberId);
  if (!m || state.budget < cost || state.turn - m.lastLobby < 6) return state;
  let s = charge(state, cost, "otros");
  s = { ...s, board: s.board.map((b) => (b.id === memberId ? { ...b, favor: clamp((b.favor || 0) + 8, 0, 30), lastLobby: state.turn } : b)) };
  return addNews(s, `🍷 Cenaste con ${m.name} (${m.role.toLowerCase()}): te debe una.`);
}

// Contratos del plantel
export function renewPlayer(state, playerId) {
  const p = state.squad.find((x) => x.id === playerId);
  if (!p) return state;
  const bonus = r2(Math.max(0.3, p.wage * 20));
  if (state.budget < bonus) return state;
  let s = charge(state, bonus, "fichajes");
  s = { ...s, squad: s.squad.map((x) => (x.id === playerId ? { ...x, contract: 3, wage: r3(x.wage * 1.1) } : x)) };
  return addNews(s, `✍️ Renovaste a ${p.name} por 3 temporadas (prima €${bonus}M).`);
}

export function sellPlayer(state, playerId) {
  const p = state.squad.find((x) => x.id === playerId);
  if (!p || state.squad.length <= 14) return state;
  const value = r2(playerValue(p) * 0.92);
  let s = credit(state, value, "ventas");
  const star = p.ovr >= squadAverage(state) + 5;
  s = {
    ...s,
    squad: s.squad.filter((x) => x.id !== playerId).concat(youthPlayer(s, p.pos)),
    fanHappiness: clamp(s.fanHappiness - (star ? 4 : 1), 0, 100),
    dtConfidence: clamp(s.dtConfidence - (star ? 4 : 0), 0, 100),
  };
  return addNews(s, `✈️ Vendiste a ${p.name} (${p.ovr}) por €${value}M.`);
}

export function renewDt(state) {
  const cost = 2;
  if (!state.dtName || state.budget < cost) return state;
  let s = charge(state, cost, "otros");
  return addNews({ ...s, dtContract: 3, dtConfidence: clamp(s.dtConfidence + 8, 0, 100) }, `🖋️ Renovaste a ${state.dtName} por 3 temporadas.`);
}

export function fireDt(state) {
  const s = {
    ...state, dtName: null, dtStyle: null, dtContract: 0,
    dtQuality: clamp(state.dtQuality - 5, 20, 95),
    boardTrust: clamp(state.boardTrust - 3, 0, 100),
    fanHappiness: clamp(state.fanHappiness + 5, 0, 100),
  };
  return addNews(s, "🔥 Echaste al DT. La hinchada lo pedía, la directiva no tanto.");
}

export function hireDt(state, candidateId) {
  const candidate = DT_CANDIDATES.find((d) => d.id === candidateId);
  if (!candidate || investmentsLocked(state) || state.budget < candidate.cost) return state;
  let s = charge(state, candidate.cost, "otros");
  s = {
    ...s, dtName: candidate.name, dtStyle: candidate.style, dtQuality: candidate.quality, dtConfidence: 65, dtContract: 2,
    fanHappiness: clamp(s.fanHappiness + candidate.fanBoost, 0, 100),
  };
  return addNews(s, `✍️ Se presentó ${candidate.name} como nuevo DT (perfil: ${candidate.style.toLowerCase()}).`);
}

// Fichajes en mira: el presidente scoutea, marca prioridad y el DT decide.
// Rechazarlo le cuesta al DT la confianza que el presidente tiene en él.
export function scoutTarget(state) {
  const ovr = Math.round(state.baselineOvr + rint(-2, 12));
  const age = rint(19, 31);
  const player = { ovr, age };
  const target = {
    id: `t${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: randomName(),
    position: pick(TARGET_POSITIONS),
    ovr, age,
    cost: r2(playerValue(player) * (1 + Math.random() * 0.3)),
    priority: false,
    status: "watching",
  };
  const s = { ...state, transferTargets: [target, ...(state.transferTargets || [])].slice(0, 8) };
  return addNews(s, `🔎 Los ojeadores marcaron a ${target.name} (${target.position}, ${target.ovr} de nivel, ${target.age} años, ~€${target.cost}M).`);
}

export function markTargetPriority(state, targetId) {
  return { ...state, transferTargets: (state.transferTargets || []).map((t) => (t.id === targetId ? { ...t, priority: true } : t)) };
}

function resolveTransferWeek(state) {
  const targets = state.transferTargets || [];
  const pending = targets.find((t) => t.priority && t.status === "watching");
  if (!pending) return state;

  const costPenalty = clamp((pending.cost - state.budget) * 3, 0, 40);
  const rejectChance = clamp(30 - (state.dtConfidence - 50) / 2 + costPenalty, 5, 85);
  const nextTargets = targets.map((t) => ({ ...t }));
  const idx = nextTargets.findIndex((t) => t.id === pending.id);

  if (Math.random() * 100 < rejectChance) {
    nextTargets[idx].status = "rejected";
    const s = { ...state, transferTargets: nextTargets, dtConfidence: clamp(state.dtConfidence - 12, 0, 100) };
    return addNews(s, `🚫 El DT rechazó fichar a ${pending.name} (${pending.position}) pese a que lo marcaste como prioridad — tu confianza en él bajó.`);
  }
  if (state.budget >= pending.cost) {
    nextTargets[idx].status = "signed";
    let s = charge(state, pending.cost, "fichajes");
    const worst = [...s.squad].sort((a, b) => a.ovr - b.ovr)[0];
    const posMap = { Delantero: "DEL", Extremo: "DEL", Mediocampista: "MED", "Defensor central": "DEF", Lateral: "DEF", Arquero: "POR" };
    const signed = makePlayer(pending.ovr, pending.age, posMap[pending.position] || "MED", 4);
    signed.name = pending.name;
    s = { ...s, transferTargets: nextTargets, squad: s.squad.filter((p) => p.id !== worst.id).concat(signed) };
    return addNews(s, `✅ Fichaje cerrado: ${pending.name} (${pending.ovr}) se suma al plantel; salió ${worst.name}.`);
  }
  return addNews({ ...state, transferTargets: nextTargets }, `💬 El DT aceptó ir por ${pending.name}, pero todavía no alcanza el presupuesto (€${pending.cost}M).`);
}

function maybeTriggerSaleOffer(state) {
  if (state.pendingSale || state.week < 3 || Math.random() > 0.06) return state;
  const star = [...state.squad].sort((a, b) => b.ovr - a.ovr)[0];
  if (!star) return state;
  const amount = r2(playerValue(star) * (1.15 + Math.random() * 0.35));
  return addNews({ ...state, pendingSale: { playerId: star.id, player: star.name, ovr: star.ovr, amount } }, `💰 Llegó una oferta de €${amount}M por ${star.name}.`);
}

export function resolveSaleOffer(state, accept) {
  if (!state.pendingSale) return state;
  const { playerId, player, amount } = state.pendingSale;
  if (accept) {
    let s = credit(state, amount, "ventas");
    const p = s.squad.find((x) => x.id === playerId);
    s = {
      ...s, pendingSale: null,
      squad: p ? s.squad.filter((x) => x.id !== playerId).concat(youthPlayer(s, p.pos)) : s.squad,
      fanHappiness: clamp(s.fanHappiness - 8, 0, 100),
    };
    return addNews(s, `✈️ Vendiste a ${player} por €${amount}M. La hinchada no lo tomó bien.`);
  }
  return addNews({ ...state, pendingSale: null, boardTrust: clamp(state.boardTrust + 2, 0, 100) }, `🛡️ Rechazaste la oferta por ${player} — sigue en el plantel.`);
}

// --------------------------------------------------------------- semana
export function advanceWeek(state) {
  if (!state.dtName) return state;

  // 1) Caja: ingresos y gastos de la semana.
  const income = weeklyIncome(state);
  const expenses = weeklyExpenses(state);
  let s = { ...state };
  const led = s.ledger || emptyLedger();
  s.ledger = {
    income: {
      ...led.income,
      tickets: led.income.tickets + income.tickets, socios: led.income.socios + income.socios, sponsors: led.income.sponsors + income.sponsors,
      tv: led.income.tv + income.tv, merch: led.income.merch + income.merch, vip: led.income.vip + income.vip, intl: led.income.intl + income.intl,
    },
    expense: { ...led.expense, sueldos: led.expense.sueldos + expenses.sueldos, mantenimiento: led.expense.mantenimiento + expenses.mantenimiento, intereses: led.expense.intereses + expenses.intereses },
  };
  s.budget = r2(s.budget + income.total - expenses.total);
  s.cashHistory = [...(state.cashHistory || []), s.budget].slice(-10);
  if (s.budget < 0) {
    s.debt += Math.abs(s.budget);
    s.budget = 0;
    s.boardTrust = clamp(s.boardTrust - 5, 0, 100);
  }

  // 2) Lesiones: se curan y a veces cae alguien.
  s.squad = s.squad.map((p) => (p.injured > 0 ? { ...p, injured: p.injured - 1 } : p));
  const injuryChance = 0.05 - (s.medicalTier || 0) * 0.011;
  if (Math.random() < injuryChance) {
    const p = pick(s.squad.filter((x) => !x.injured));
    if (p) {
      const weeks = rint(2, 8);
      s.squad = s.squad.map((x) => (x.id === p.id ? { ...x, injured: weeks } : x));
      if (p.ovr >= squadAverage(s) + 4) s = addNews(s, `🩹 Se lesionó ${p.name} (${p.ovr}): ${weeks} semanas afuera.`);
    }
  }

  // 3) Partido de la fecha y toda la liga.
  const { table, myResult } = simulateMatchweek(s);
  s.leagueTable = table;
  let winBonus = 0;
  if (myResult) {
    const { opponentId, myGoals, rivalGoals, isClasico, isHome } = myResult;
    const opponent = teamById(opponentId);
    const win = myGoals > rivalGoals;
    const draw = myGoals === rivalGoals;
    const scoreline = isHome ? `${myGoals}-${rivalGoals}` : `${rivalGoals}-${myGoals}`;
    s = addNews(s, `${isClasico ? "🔥 CLÁSICO — " : "⚽ "}${win ? "Ganaste" : draw ? "Empataste" : "Perdiste"} ${scoreline} vs ${opponent?.name || "rival"}.`);
    s.fanHappiness = clamp(s.fanHappiness + (isClasico ? (win ? 10 : draw ? 0 : -10) : win ? 2 : draw ? 0 : -2), 0, 100);
    s.press = clamp((s.press ?? 50) + (win ? 1 : draw ? 0 : -1), 0, 100);
    winBonus = win ? 0.004 : draw ? 0 : -0.003;
  }

  // 4) Socios, prensa e hinchada: derivas lentas.
  const drift = (s.fanHappiness - 55) / 100 * 0.004 + ((s.press ?? 50) - 50) / 100 * 0.002 - (s.memberFeeLevel - 2) * 0.001 + winBonus;
  const room = Math.max(0, 1 - s.members / membersCap(s));
  s.members = Math.max(1000, Math.round(s.members * (1 + (drift > 0 ? drift * room : drift))));
  s.press = clamp((s.press ?? 50) + ((50 - (s.press ?? 50)) * 0.03), 0, 100);
  s.fanHappiness = Math.round(clamp(s.fanHappiness + (2 - s.ticketPriceLevel) * 0.15 + PHILOSOPHIES[s.philosophy || "equilibrado"].fan * 0.1, 0, 100) * 10) / 10;
  s.press = Math.round(s.press * 10) / 10;

  // 5) Semana siguiente, decisión, fichajes, ofertas.
  const week = s.week + 1;
  const used = (s._usedDecisions || []).slice();
  s = { ...s, week, turn: (s.turn || 0) + 1, decisionUsed: false };
  s.currentDecision = pickDecision(s, used);
  s._usedDecisions = [...used, s.currentDecision.id].slice(-12);
  s = resolveTransferWeek(s);
  s = maybeTriggerSaleOffer(s);

  // 6) Directiva: voto de confianza, moción de censura o destitución.
  const loyalties = (s.board || []).map((m) => boardLoyalty(s, m));
  const angry = loyalties.filter((l) => l < 20).length;
  if (s.boardTrust <= 0 && !s.voteCrisisUsed) {
    s = addNews({ ...s, boardTrust: 15, voteCrisisUsed: true }, "🗳️ La directiva convocó una asamblea de socios por tu gestión — sobreviviste raspando, con el margen mínimo.");
  } else if (s.boardTrust <= 0) {
    s = addNews({ ...s, gameOver: true, gameOverReason: "destituido" }, "❌ La directiva te destituyó como presidente.");
  } else if (angry >= 3) {
    s = addNews({ ...s, gameOver: true, gameOverReason: "mocion" }, "❌ Tres miembros de la directiva impulsaron una moción de censura y perdiste la votación.");
  }

  if (!s.gameOver && week >= (s.weeksPerSeason || WEEKS_PER_SEASON)) s = resolveSeason(s);
  return s;
}

// --------------------------------------------------------- cierre de temporada
export function evaluateAchievements(state) {
  const have = new Set(state.achievements || []);
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(state));
  if (!fresh.length) return state;
  let s = { ...state, achievements: [...have, ...fresh.map((a) => a.id)] };
  for (const a of fresh) s = addNews(s, `🏅 Logro desbloqueado: ${a.label}.`);
  return s;
}

function ageSquad(state) {
  const phil = PHILOSOPHIES[state.philosophy || "equilibrado"];
  const departed = [];
  let squad = state.squad.map((p) => {
    const age = p.age + 1;
    let d;
    if (age <= 22) d = rint(1, 4) + phil.youth;
    else if (age <= 27) d = rint(-1, 2);
    else if (age <= 30) d = rint(-2, 1);
    else d = -rint(1, 3);
    let ovr = clamp(p.ovr + d, 38, 94);
    if (age <= 22) ovr = Math.min(ovr, Math.max(p.pot, p.ovr));
    return { ...p, age, ovr, pot: age < 24 ? Math.max(p.pot, ovr) : ovr, contract: p.contract - 1, wage: wageFor(ovr), injured: 0 };
  });
  squad = squad.filter((p) => {
    const leaves = p.contract <= 0 || p.age >= 37;
    if (leaves) departed.push(p);
    return !leaves;
  });
  while (squad.length < 18) squad.push(replacementPlayer(state, departed[squad.length % Math.max(1, departed.length)]?.pos));
  return { squad, departed };
}

function holdElection(state) {
  const pct = projectedVote(state) + (Math.random() * 6 - 3);
  if (pct >= 50) {
    return addNews(
      {
        ...state,
        electionsWon: (state.electionsWon || 0) + 1,
        boardTrust: clamp(state.boardTrust + 8, 0, 100),
        opposition: { name: randomName(), strength: rint(35, 60) },
        board: state.board.map((m) => ({ ...m, favor: Math.max(0, (m.favor || 0) - 10) })),
      },
      `🗳️ ELECCIONES: ganaste con ${Math.round(pct)}% de los votos. ¡Cuatro años más!`
    );
  }
  return addNews({ ...state, gameOver: true, gameOverReason: "elecciones" }, `🗳️ ELECCIONES: perdiste con ${Math.round(pct)}% de los votos. Termina tu mandato.`);
}

export function resolveSeason(state) {
  const sorted = sortedLeagueTable(state.leagueTable || []);
  const position = sorted.findIndex((r) => r.id === state.teamId) + 1;
  const leagueSize = sorted.length || teamsByLeague(state.league).length;
  const goodSeason = position <= Math.ceil(leagueSize / 3);
  const badSeason = position >= leagueSize - 2;
  const objective = objectiveFor(state.teamId);
  const objectiveMet = position <= objective.threshold;
  const champion = position === 1;
  const qualifiesInternational = position <= 4;
  const academyBoost = state.academyTier > 0 ? ACADEMY_TIERS[state.academyTier - 1].dtQualityPerSeason : 0;

  let boardTrust = clamp(state.boardTrust + (goodSeason ? 10 : badSeason ? -15 : -2), 0, 100);
  boardTrust = clamp(boardTrust + (objectiveMet ? 6 : -10), 0, 100);
  const fanHappiness = clamp(state.fanHappiness + (goodSeason ? 12 : badSeason ? -12 : 0), 0, 100);
  const prizeMoney = (goodSeason ? 6 : badSeason ? 0 : 2) + (objectiveMet ? 3 : 0) + (champion ? 5 : 0) + (qualifiesInternational ? 4 : 0);

  let s = credit({ ...state }, prizeMoney, "premios");

  // Bonus de sponsors por cumplir el objetivo, y vencimiento de contratos.
  const nextSponsors = {};
  for (const [slot, d] of Object.entries(s.sponsors || {})) {
    if (!d) { nextSponsors[slot] = null; continue; }
    if (objectiveMet && d.bonus) s = credit(s, d.bonus, "sponsors");
    if (d.risky && Math.random() < 0.3) s = applyScandal(s, `Un escándalo salpica a tu sponsor ${d.brand}`);
    const left = d.seasonsLeft - 1;
    nextSponsors[slot] = left > 0 ? { ...d, seasonsLeft: left } : { ...d, seasonsLeft: 0 };
  }
  const tv = s.tv ? { ...s.tv, seasonsLeft: s.tv.seasonsLeft - 1 } : null;

  const { squad, departed } = ageSquad(s);
  const dtContract = s.dtName ? (s.dtContract || 1) - 1 : 0;
  const ledger = s.ledger || emptyLedger();
  const income = Object.values(ledger.income).reduce((a, b) => a + b, 0);
  const expense = Object.values(ledger.expense).reduce((a, b) => a + b, 0);

  const fixtures = buildFixtures(s.league);
  s = {
    ...s,
    season: s.season + 1,
    week: 0,
    weeksPerSeason: fixtures.length,
    fixtures,
    leagueTable: buildLeagueTable(s.league),
    leaguePosition: position,
    boardTrust,
    fanHappiness,
    prestige: clamp(s.prestige + (champion ? 4 : goodSeason ? 1 : badSeason ? -2 : 0) + (qualifiesInternational ? 1 : 0), 0, 100),
    press: clamp((s.press ?? 50) + (goodSeason ? 6 : badSeason ? -6 : 0), 0, 100),
    sponsors: nextSponsors,
    tv,
    squad,
    dtBudgetGiven: 0,
    dtQuality: clamp(s.dtQuality + academyBoost, 20, 99),
    dtConfidence: clamp(s.dtConfidence + (objectiveMet ? 5 : -5), 0, 100),
    dtContract,
    internationalQualified: qualifiesInternational,
    titlesWon: (s.titlesWon || 0) + (champion ? 1 : 0),
    members: Math.min(membersCap(s), Math.round(s.members * (1 + (goodSeason ? 0.04 : badSeason ? -0.05 : 0.01)))),
    opposition: { ...s.opposition, strength: clamp(s.opposition.strength + (badSeason ? 6 : goodSeason ? -4 : 1), 10, 90) },
    lastLedger: { season: s.season, income: ledger.income, expense: ledger.expense, total: { income, expense } },
    ledger: emptyLedger(),
    history: [
      {
        season: s.season, position, leagueSize, budget: s.budget, stadiumTier: s.stadiumTier, objectiveMet, objectiveLabel: objective.label,
        champion, qualifiesInternational, income: Math.round(income), expense: Math.round(expense), members: s.members,
      },
      ...s.history,
    ],
    decisionUsed: false,
  };
  s.sponsorOffers = generateSponsorOffers(s);
  s.currentDecision = pickDecision(s, s._usedDecisions || []);
  s = addNews(
    s,
    `📊 Temporada ${state.season} cerrada: ${position}° de ${leagueSize} — objetivo (${objective.label}) ${objectiveMet ? "cumplido ✅" : "no cumplido ❌"}.${qualifiesInternational ? " 🌍 Clasificaron a competencia internacional." : ""} +€${prizeMoney}M de premios. Balance: ingresos €${Math.round(income)}M, gastos €${Math.round(expense)}M.`
  );
  if (departed.length) s = addNews(s, `👋 Se fueron ${departed.length} jugador${departed.length > 1 ? "es" : ""} por fin de contrato o retiro: ${departed.slice(0, 3).map((p) => p.name).join(", ")}${departed.length > 3 ? "…" : ""}.`);
  if (s.dtName && dtContract <= 0) {
    s = addNews({ ...s, dtName: null, dtStyle: null }, `📄 A ${state.dtName} se le venció el contrato y se fue: hay que elegir un nuevo DT.`);
  }
  if (s.tv && s.tv.seasonsLeft <= 0) s = addNews(s, "📺 Se venció el contrato de TV: hay que negociar uno nuevo.");

  // Elecciones cada MANDATE_SEASONS temporadas.
  if (state.season % MANDATE_SEASONS === 0 && !s.gameOver) s = holdElection(s);

  return evaluateAchievements(s);
}
