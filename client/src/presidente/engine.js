// Motor puro de Modo Presidente: un nivel arriba del DT. Acá no se dirige
// la cancha (eso ya lo cubre Modo DT) — se maneja el club: plata, estadio,
// sponsors, plantel, fichajes y la relación con la hinchada, la directiva
// y el propio DT. La liga se juega de verdad: fixture de todos contra
// todos (ida y vuelta) y una tabla que se actualiza fecha a fecha, no un
// cálculo abstracto al cierre de temporada.
import { teamsByLeague, teamById } from "../carrera/data/teams.js";

// Mismos umbrales que usa Carrera DT (CareerContext.jsx evaluateObjective) —
// acá el objetivo lo fija la directiva del club real (team.boardObjective) y
// se evalúa en el cierre de temporada, además del efecto genérico de
// terminar arriba/abajo de la tabla.
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

export const WEEKS_PER_SEASON = 34; // fallback antes de elegir club — la temporada real sale de 2*(equipos-1)
export const TICKET_PRICE_LEVELS = [20, 30, 40, 55, 70];
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
// Academia juvenil: en vez de darle presupuesto de fichajes al DT (efecto
// inmediato y se gasta), invertir acá sube la calidad del plantel de forma
// lenta pero permanente — cantera propia en vez de mercado.
export const ACADEMY_TIERS = [
  { tier: 1, cost: 10, dtQualityPerSeason: 2, label: "Academia regional" },
  { tier: 2, cost: 25, dtQualityPerSeason: 4, label: "Academia nacional" },
  { tier: 3, cost: 50, dtQualityPerSeason: 6, label: "Academia de élite" },
];
// Predio de entrenamiento: tercer eje de inversión, aparte de estadio y
// academia — suma directo a la fuerza del equipo cada partido (mejor
// preparación física/táctica), no al plantel en sí.
export const TRAINING_TIERS = [
  { tier: 1, cost: 15, strengthBoost: 3, label: "Predio regional" },
  { tier: 2, cost: 35, strengthBoost: 6, label: "Predio de alto rendimiento" },
  { tier: 3, cost: 70, strengthBoost: 10, label: "Ciudad deportiva de élite" },
];
// Candidatos a DT: perfiles con estilo y precio distintos, para cuando se
// echa al anterior. La calidad es un piso nuevo, no un delta — cambiar de
// DT es una apuesta, no un ajuste fino.
export const DT_CANDIDATES = [
  { id: "dt_estrella", name: "Diego Ibarra", style: "Estrella mediática", cost: 9, quality: 68, fanBoost: 6 },
  { id: "dt_tactico", name: "Hans Richter", style: "Técnico disciplinado", cost: 5, quality: 58, fanBoost: 0 },
  { id: "dt_formador", name: "Paulo Ferreira", style: "Formador de juveniles", cost: 2, quality: 46, fanBoost: 2 },
  { id: "dt_veterano", name: "Ricardo Suels", style: "Veterano de la casa", cost: 0, quality: 50, fanBoost: 4 },
];
// Por encima de esta deuda la directiva mete un límite salarial de emergencia:
// no se puede invertir en nada nuevo (estadio, sponsor, academia, predio,
// DT) hasta bajarla.
export const DEBT_CEILING = 45;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES = ["Mateo", "Lucas", "Thiago", "Bruno", "Diego", "Iker", "Rodri", "Kevin", "Marco", "Yusuf", "Noah", "Luca", "Enzo", "Tomás", "Adama", "Kian"];
const LAST_NAMES = ["Fernández", "Silva", "Okafor", "Nilsson", "Varela", "Rossi", "Dubois", "Alonso", "Kovač", "Haruna", "Petrov", "Castillo", "Moreau", "Lindqvist"];
const TARGET_POSITIONS = ["Delantero", "Extremo", "Mediocampista", "Defensor central", "Lateral", "Arquero"];

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function buildStaff() {
  return {
    captain: { name: randomName(), role: "Capitán" },
    topScorer: { name: randomName(), role: "Goleador del plantel" },
    wonderkid: { name: randomName(), role: "Joya de la cantera", age: 17 + Math.floor(Math.random() * 3) },
  };
}

// === Fixture real: todos contra todos, ida y vuelta (método del círculo) ===
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
  return sorted.findIndex((r) => r.id === state.teamId) + 1;
}

function teamMatchStrength(state, teamId) {
  if (teamId === state.teamId) {
    const trainingBoost = state.trainingTier ? TRAINING_TIERS[state.trainingTier - 1].strengthBoost : 0;
    return (state.dtBudgetGiven || 0) * 1.2 + state.dtQuality + state.stadiumTier * 3 + trainingBoost;
  }
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

function simulateOneMatch(strengthA, strengthB) {
  const diff = strengthA - strengthB;
  const goalsA = poissonish(clamp(1.3 + diff / 40, 0.2, 4.2));
  const goalsB = poissonish(clamp(1.3 - diff / 40, 0.2, 4.2));
  return [goalsA, goalsB];
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
      ...row,
      pj: row.pj + 1,
      pg: row.pg + (win ? 1 : 0),
      pe: row.pe + (draw ? 1 : 0),
      pp: row.pp + (!win && !draw ? 1 : 0),
      gf: row.gf + gf,
      gc: row.gc + gc,
      pts: row.pts + (win ? 3 : draw ? 1 : 0),
    };
  });
}

// Simula toda la fecha (mi partido + el resto de la liga) y devuelve la
// tabla actualizada + mi resultado, si me tocaba jugar esta semana.
function simulateMatchweek(state) {
  const round = state.fixtures?.[state.week];
  if (!round || !round.length) return { table: state.leagueTable, myResult: null };

  let table = state.leagueTable || [];
  let myResult = null;
  for (const [homeId, awayId] of round) {
    const [gh, ga] = simulateOneMatch(teamMatchStrength(state, homeId), teamMatchStrength(state, awayId));
    table = applyResultToTable(table, homeId, awayId, gh, ga);
    if (homeId === state.teamId || awayId === state.teamId) {
      const isHome = homeId === state.teamId;
      myResult = {
        opponentId: isHome ? awayId : homeId,
        isHome,
        myGoals: isHome ? gh : ga,
        rivalGoals: isHome ? ga : gh,
        isClasico: (isHome ? awayId : homeId) === state.rivalId,
      };
    }
  }
  return { table, myResult };
}

export function initialPresidentState(teamId, teamName, league, prestige) {
  const fixtures = buildFixtures(league);
  const rivals = teamsByLeague(league).filter((t) => t.id !== teamId);
  return {
    version: 2,
    teamId,
    teamName,
    league,
    season: 1,
    week: 0,
    weeksPerSeason: fixtures.length,
    budget: 15,
    debt: 0,
    fanHappiness: 60,
    boardTrust: 60,
    ticketPriceLevel: 1,
    stadiumTier: 1,
    sponsorTier: 0,
    academyTier: 0,
    trainingTier: 0,
    dtBudgetGiven: 0,
    dtQuality: clamp(40 + (prestige || 5) * 2, 30, 75),
    dtName: `Cuerpo técnico de ${teamName}`,
    dtStyle: "Balanceado",
    dtConfidence: 65,
    staff: buildStaff(),
    rivalId: rivals.length ? pick(rivals).id : null,
    transferTargets: [],
    pendingSale: null,
    internationalQualified: false,
    fixtures,
    leagueTable: buildLeagueTable(league),
    leaguePosition: null,
    seasonInvestment: 0,
    history: [],
    titlesWon: 0,
    voteCrisisUsed: false,
    news: [`Asumiste la presidencia de ${teamName}.`],
    gameOver: false,
    currentDecision: null,
    decisionUsed: false,
  };
}

function avgAttendanceRate(fanHappiness) {
  return clamp(0.35 + fanHappiness / 130, 0.35, 1);
}

export function weeklyIncome(state) {
  const stadium = STADIUM_TIERS[state.stadiumTier - 1];
  const ticketPrice = TICKET_PRICE_LEVELS[state.ticketPriceLevel - 1];
  const attendance = Math.round(stadium.capacity * avgAttendanceRate(state.fanHappiness));
  const ticketRevenue = (attendance * ticketPrice) / 1_000_000; // en millones
  const sponsorRevenue = state.sponsorTier > 0 ? SPONSOR_TIERS[state.sponsorTier - 1].weeklyIncome : 0;
  const tvRevenue = 0.15 + state.stadiumTier * 0.05;
  // La tienda oficial y el merchandising no se compran aparte: rinden solo
  // si la hinchada está contenta y el club tiene vitrina — plata pasiva
  // ligada a cómo vas gestionando lo demás, no una inversión más.
  const merchRevenue = 0.04 + state.fanHappiness / 1400 + (state.titlesWon || 0) * 0.03;
  const internationalRevenue = state.internationalQualified ? 0.3 : 0;
  return {
    ticketRevenue, sponsorRevenue, tvRevenue, merchRevenue, internationalRevenue, attendance,
    total: ticketRevenue + sponsorRevenue + tvRevenue + merchRevenue + internationalRevenue,
  };
}

export function weeklyExpenses(state) {
  const wages = 0.25 + (state.dtQuality / 100) * 0.6;
  const upkeep = state.stadiumTier * 0.08;
  const debtInterest = state.debt * (state.debt > DEBT_CEILING ? 0.03 : 0.01);
  return { wages, upkeep, debtInterest, total: wages + upkeep + debtInterest };
}

export const DECISIONS_POOL = [
  {
    id: "p01",
    context: "El área comercial te trae dos propuestas para la próxima campaña de entradas.",
    options: [
      { text: "Subir el precio de las entradas." },
      { text: "Mantener los precios actuales." },
      { text: "Bajar los precios para llenar el estadio." },
    ],
    effects: [
      { ticketPriceDelta: 1, fanHappiness: -8 },
      {},
      { ticketPriceDelta: -1, fanHappiness: 10, boardTrust: -3 },
    ],
  },
  {
    id: "p02",
    context: "Una marca te ofrece renovar el sponsor principal por más plata, pero con exigencias de resultados.",
    options: [
      { text: "Aceptás las condiciones." },
      { text: "Negociás algo más conservador." },
      { text: "Rechazás la oferta." },
    ],
    effects: [
      { budget: 3, boardTrust: 2, special: "sponsor_pressure" },
      { budget: 1.5 },
      { fanHappiness: 2 },
    ],
  },
  {
    id: "p03",
    context: "El DT te pide más presupuesto de fichajes para competir arriba de la tabla.",
    options: [
      { text: "Le das un refuerzo grande al presupuesto." },
      { text: "Le das un aumento moderado." },
      { text: "Le decís que no hay margen este semestre." },
    ],
    effects: [
      { dtBudgetGiven: 8, budget: -8, dtQuality: 6 },
      { dtBudgetGiven: 3, budget: -3, dtQuality: 2 },
      { boardTrust: -4, dtQuality: -3 },
    ],
  },
  {
    id: "p04",
    context: "La hinchada viene reclamando por la comida y los servicios del estadio en los partidos.",
    options: [
      { text: "Invertís en mejorar la experiencia del día de partido." },
      { text: "Hacés mejoras menores." },
      { text: "Lo dejás como está por ahora." },
    ],
    effects: [
      { budget: -2, fanHappiness: 10 },
      { budget: -0.8, fanHappiness: 4 },
      { fanHappiness: -5 },
    ],
  },
  {
    id: "p05",
    context: "El banco te ofrece una línea de crédito para financiar el proyecto deportivo.",
    options: [
      { text: "Tomás un préstamo grande." },
      { text: "Tomás un préstamo chico." },
      { text: "No te endeudás." },
    ],
    effects: [
      { budget: 12, debt: 12, boardTrust: -2 },
      { budget: 5, debt: 5 },
      {},
    ],
  },
  {
    id: "p06",
    context: "La directiva pide una actualización sobre el estado financiero del club.",
    options: [
      { text: "Sos transparente, incluso con las malas noticias." },
      { text: "Presentás un panorama optimista." },
      { text: "Evitás dar detalles." },
    ],
    effects: [
      { boardTrust: 5 },
      { boardTrust: 2, special: "optimism_risk" },
      { boardTrust: -6 },
    ],
  },
  {
    id: "p07",
    context: "Un grupo de hinchas organiza una protesta pacífica por el rumbo del club.",
    options: [
      { text: "Los recibís y escuchás sus reclamos." },
      { text: "Emitís un comunicado institucional." },
      { text: "No respondés públicamente." },
    ],
    effects: [
      { fanHappiness: 8, boardTrust: -1 },
      { fanHappiness: 3 },
      { fanHappiness: -6 },
    ],
  },
  {
    id: "p08",
    context: "Un club rival te ofrece armar un amistoso de pretemporada de alto perfil, con buena bolsa de dinero.",
    options: [
      { text: "Aceptás — la plata sirve, aunque cansa al plantel." },
      { text: "Proponés uno más chico, menos exigente." },
      { text: "Rechazás para cuidar la pretemporada." },
    ],
    effects: [
      { budget: 2.5, dtQuality: -2 },
      { budget: 1 },
      { fanHappiness: -2 },
    ],
  },
  {
    id: "p09",
    context: "Periodistas te preguntan directo si el DT sigue el año que viene.",
    options: [
      { text: "Le das tu respaldo público total." },
      { text: "Contestás con ambigüedad calculada." },
      { text: "Dejás la puerta abierta a un cambio." },
    ],
    effects: [
      { dtQuality: 3, boardTrust: -1 },
      {},
      { fanHappiness: 3, dtQuality: -2 },
    ],
  },
  {
    id: "p10",
    context: "Se abre la chance de renovar el naming rights del estadio por varios años.",
    options: [
      { text: "Firmás un contrato largo y grande." },
      { text: "Firmás algo más corto y modesto." },
      { text: "No tocás el nombre del estadio — pesa la historia." },
    ],
    effects: [
      { budget: 6, fanHappiness: -6, boardTrust: 4 },
      { budget: 2.5 },
      { fanHappiness: 4 },
    ],
  },
  {
    id: "p11",
    context: "El club de al lado te ofrece un canje de socios/beneficios cruzados con la comunidad.",
    options: [
      { text: "Aceptás — buena imagen institucional." },
      { text: "Lo evaluás para más adelante." },
      { text: "No, son rivales históricos." },
    ],
    effects: [
      { fanHappiness: 5, boardTrust: 2 },
      {},
      { fanHappiness: -1 },
    ],
  },
  {
    id: "p12",
    context: "Un fondo de inversión se acerca a comprar un porcentaje minoritario del club.",
    options: [
      { text: "Abrís la negociación en serio." },
      { text: "Escuchás la oferta sin comprometerte." },
      { text: "Cerrás la puerta — el club sigue 100% de los socios." },
    ],
    effects: [
      { budget: 15, boardTrust: -5, special: "fund_pressure" },
      {},
      { boardTrust: 5, fanHappiness: 4 },
    ],
  },
  {
    id: "p13",
    context: "La prensa te tira el micrófono después del clásico: te preguntan por la victoria/derrota frente al rival de siempre.",
    options: [
      { text: "Le bajás el precio: 'un partido más, quedan muchos puntos'." },
      { text: "Le das el gusto al hincha y calentás el clásico para la revancha." },
      { text: "No hacés declaraciones." },
    ],
    effects: [
      { boardTrust: 2 },
      { fanHappiness: 6, boardTrust: -2 },
      {},
    ],
  },
  {
    id: "p14",
    context: "Un periodista te pregunta si el mercado de pases estuvo a la altura de lo que pedía el DT.",
    options: [
      { text: "Reconocés que faltó presupuesto." },
      { text: "Decís que el plantel actual alcanza y sobra." },
      { text: "Cambiás de tema." },
    ],
    effects: [
      { dtQuality: 2, boardTrust: -1 },
      { boardTrust: 2, dtQuality: -1 },
      {},
    ],
  },
];

export function pickDecision(usedIds = []) {
  const pool = DECISIONS_POOL.filter((d) => !usedIds.includes(d.id));
  const list = pool.length ? pool : DECISIONS_POOL;
  return list[Math.floor(Math.random() * list.length)];
}

export function applyDecisionEffects(state, decision, optionIdx) {
  const fx = decision.effects[optionIdx] || {};
  const next = { ...state };
  if (fx.budget) next.budget = Math.round((next.budget + fx.budget) * 20) / 20;
  if (fx.debt) next.debt = Math.max(0, next.debt + fx.debt);
  if (fx.fanHappiness) next.fanHappiness = clamp(next.fanHappiness + fx.fanHappiness, 0, 100);
  if (fx.boardTrust) next.boardTrust = clamp(next.boardTrust + fx.boardTrust, 0, 100);
  if (fx.dtQuality) next.dtQuality = clamp(next.dtQuality + fx.dtQuality, 20, 95);
  if (fx.dtBudgetGiven) next.dtBudgetGiven = (next.dtBudgetGiven || 0) + fx.dtBudgetGiven;
  if (fx.ticketPriceDelta) next.ticketPriceLevel = clamp(next.ticketPriceLevel + fx.ticketPriceDelta, 1, TICKET_PRICE_LEVELS.length);
  return next;
}

function investmentsLocked(state) {
  return state.debt > DEBT_CEILING;
}

export function canUpgradeStadium(state) {
  const next = STADIUM_TIERS[state.stadiumTier];
  return next && !investmentsLocked(state) && state.budget >= next.upgradeCost;
}

export function upgradeStadium(state) {
  const next = STADIUM_TIERS[state.stadiumTier];
  if (!next || investmentsLocked(state) || state.budget < next.upgradeCost) return state;
  return {
    ...state,
    budget: Math.round((state.budget - next.upgradeCost) * 20) / 20,
    stadiumTier: next.tier,
    boardTrust: clamp(state.boardTrust + 4, 0, 100),
    news: [`🏟️ Ampliaste el estadio a ${next.capacity.toLocaleString()} espectadores.`, ...state.news].slice(0, 8),
  };
}

export function hireSponsor(state, tier) {
  const cost = tier * 1.5;
  if (investmentsLocked(state) || state.budget < cost) return state;
  return {
    ...state,
    budget: Math.round((state.budget - cost) * 20) / 20,
    sponsorTier: tier,
    news: [`🤝 Firmaste con un ${SPONSOR_TIERS[tier - 1].label.toLowerCase()}.`, ...state.news].slice(0, 8),
  };
}

export function hireAcademy(state, tier) {
  const cost = ACADEMY_TIERS[tier - 1]?.cost;
  if (cost == null || investmentsLocked(state) || state.academyTier >= tier || state.budget < cost) return state;
  return {
    ...state,
    budget: Math.round((state.budget - cost) * 20) / 20,
    academyTier: tier,
    news: [`🌱 Invertiste en ${ACADEMY_TIERS[tier - 1].label.toLowerCase()} — la cantera va a rendir de a poco.`, ...state.news].slice(0, 8),
  };
}

export function hireTraining(state, tier) {
  const cost = TRAINING_TIERS[tier - 1]?.cost;
  if (cost == null || investmentsLocked(state) || state.trainingTier >= tier || state.budget < cost) return state;
  return {
    ...state,
    budget: Math.round((state.budget - cost) * 20) / 20,
    trainingTier: tier,
    news: [`🏗️ Inauguraste el ${TRAINING_TIERS[tier - 1].label.toLowerCase()} — el equipo rinde mejor cada fecha.`, ...state.news].slice(0, 8),
  };
}

// Echar al DT lo deja vacante — hay que elegir reemplazo antes de poder
// seguir jugando (ver hireDt). La hinchada lo festeja, la directiva no
// tanto, y tu confianza en el próximo arranca de nuevo.
export function fireDt(state) {
  return {
    ...state,
    dtName: null,
    dtStyle: null,
    dtQuality: clamp(state.dtQuality - 5, 20, 95),
    boardTrust: clamp(state.boardTrust - 3, 0, 100),
    fanHappiness: clamp(state.fanHappiness + 5, 0, 100),
    news: [`🔥 Echaste al DT. La hinchada lo pedía, la directiva no tanto.`, ...state.news].slice(0, 8),
  };
}

export function hireDt(state, candidateId) {
  const candidate = DT_CANDIDATES.find((d) => d.id === candidateId);
  if (!candidate || investmentsLocked(state) || state.budget < candidate.cost) return state;
  return {
    ...state,
    budget: Math.round((state.budget - candidate.cost) * 20) / 20,
    dtName: candidate.name,
    dtStyle: candidate.style,
    dtQuality: candidate.quality,
    dtConfidence: 65,
    fanHappiness: clamp(state.fanHappiness + candidate.fanBoost, 0, 100),
    news: [`✍️ Se presentó ${candidate.name} como nuevo DT (perfil: ${candidate.style.toLowerCase()}).`, ...state.news].slice(0, 8),
  };
}

// === Fichajes en mira: el presidente scoutea nombres, marca cuáles son
// prioridad, y el DT los evalúa semana a semana. El DT puede rechazar un
// fichaje marcado como prioridad — pero eso le cuesta la confianza que el
// presidente tiene en él (dtConfidence), no la confianza de la directiva.
export function scoutTarget(state) {
  const target = {
    id: `t${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: randomName(),
    position: pick(TARGET_POSITIONS),
    cost: Math.round((3 + Math.random() * 20) * 2) / 2,
    priority: false,
    status: "watching",
  };
  const list = [target, ...(state.transferTargets || [])].slice(0, 8);
  return {
    ...state,
    transferTargets: list,
    news: [`🔎 Los ojeadores marcaron a ${target.name} (${target.position}, ~€${target.cost}M) en la mira.`, ...state.news].slice(0, 8),
  };
}

export function markTargetPriority(state, targetId) {
  return {
    ...state,
    transferTargets: (state.transferTargets || []).map((t) => (t.id === targetId ? { ...t, priority: true } : t)),
  };
}

function resolveTransferWeek(state) {
  const targets = state.transferTargets || [];
  const pending = targets.find((t) => t.priority && t.status === "watching");
  if (!pending) return state;

  const costPenalty = clamp((pending.cost - state.budget) * 3, 0, 40);
  const rejectChance = clamp(30 - (state.dtConfidence - 50) / 2 + costPenalty, 5, 85);
  const roll = Math.random() * 100;
  const nextTargets = targets.map((t) => ({ ...t }));
  const idx = nextTargets.findIndex((t) => t.id === pending.id);

  let { dtConfidence, budget, dtQuality, news } = state;

  if (roll < rejectChance) {
    nextTargets[idx].status = "rejected";
    dtConfidence = clamp(dtConfidence - 12, 0, 100);
    news = [`🚫 El DT rechazó fichar a ${pending.name} (${pending.position}) pese a que la marcaste como prioridad — tu confianza en él bajó.`, ...news].slice(0, 8);
  } else if (state.budget >= pending.cost) {
    budget = Math.round((state.budget - pending.cost) * 20) / 20;
    dtQuality = clamp(state.dtQuality + 3, 20, 99);
    nextTargets[idx].status = "signed";
    news = [`✅ Fichaje cerrado: ${pending.name} (${pending.position}) se suma al plantel.`, ...news].slice(0, 8);
  } else {
    news = [`💬 El DT aceptó ir por ${pending.name}, pero todavía no alcanza el presupuesto (€${pending.cost}M).`, ...news].slice(0, 8);
  }

  return { ...state, transferTargets: nextTargets, dtConfidence, budget, dtQuality, news };
}

// === Venta de jugador estrella: oferta rara por tu goleador. ===
function maybeTriggerSaleOffer(state) {
  if (state.pendingSale || state.week < 3 || Math.random() > 0.05) return state;
  const amount = Math.round((10 + Math.random() * 25) * 2) / 2;
  return {
    ...state,
    pendingSale: { player: state.staff?.topScorer?.name || "tu goleador", amount },
    news: [`💰 Llegó una oferta de €${amount}M por ${state.staff?.topScorer?.name || "tu goleador"}.`, ...state.news].slice(0, 8),
  };
}

export function resolveSaleOffer(state, accept) {
  if (!state.pendingSale) return state;
  const { player, amount } = state.pendingSale;
  if (accept) {
    return {
      ...state,
      pendingSale: null,
      budget: Math.round((state.budget + amount) * 20) / 20,
      dtQuality: clamp(state.dtQuality - 6, 20, 95),
      fanHappiness: clamp(state.fanHappiness - 8, 0, 100),
      news: [`✈️ Vendiste a ${player} por €${amount}M. La hinchada no lo tomó bien.`, ...state.news].slice(0, 8),
    };
  }
  return {
    ...state,
    pendingSale: null,
    boardTrust: clamp(state.boardTrust + 2, 0, 100),
    news: [`🛡️ Rechazaste la oferta por ${player} — sigue en el plantel.`, ...state.news].slice(0, 8),
  };
}

export function advanceWeek(state) {
  if (!state.dtName) return state; // no se puede avanzar con el banco vacío

  const income = weeklyIncome(state);
  const expenses = weeklyExpenses(state);
  const net = income.total - expenses.total;

  let budget = Math.round((state.budget + net) * 20) / 20;
  let debt = state.debt;
  let boardTrust = state.boardTrust;
  let fanHappiness = state.fanHappiness;

  if (budget < 0) {
    debt += Math.abs(budget);
    budget = 0;
    boardTrust = clamp(boardTrust - 5, 0, 100);
  }

  const { table, myResult } = simulateMatchweek(state);
  let leagueTable = table;
  let news = state.news;
  if (myResult) {
    const { opponentId, myGoals, rivalGoals, isClasico, isHome } = myResult;
    const opponent = teamById(opponentId);
    const win = myGoals > rivalGoals;
    const draw = myGoals === rivalGoals;
    const scoreline = isHome ? `${myGoals}-${rivalGoals}` : `${rivalGoals}-${myGoals}`;
    const tag = isClasico ? "🔥 CLÁSICO — " : "⚽ ";
    news = [`${tag}${win ? "Ganaste" : draw ? "Empataste" : "Perdiste"} ${scoreline} vs ${opponent?.name || "rival"}.`, ...news].slice(0, 8);
    if (isClasico) {
      fanHappiness = clamp(fanHappiness + (win ? 10 : draw ? 0 : -10), 0, 100);
    } else {
      fanHappiness = clamp(fanHappiness + (win ? 2 : draw ? 0 : -2), 0, 100);
    }
  }

  const week = state.week + 1;
  const usedIds = (state._usedDecisions || []).slice();

  let next = {
    ...state,
    budget,
    debt,
    boardTrust,
    fanHappiness,
    leagueTable,
    week,
    news,
    decisionUsed: false,
    currentDecision: pickDecision(usedIds),
    _usedDecisions: [...usedIds].slice(-10),
  };

  next = resolveTransferWeek(next);
  next = maybeTriggerSaleOffer(next);

  // Voto de confianza: la primera vez que la directiva llega a "cero"
  // confianza, en vez de destituirte directo convoca una asamblea de
  // socios — sobrevivís raspando, una sola vez por gestión.
  if (next.boardTrust <= 0 && !next.voteCrisisUsed) {
    next = {
      ...next,
      boardTrust: 15,
      voteCrisisUsed: true,
      news: [`🗳️ La directiva convocó una asamblea de socios por tu gestión — sobreviviste raspando, con el margen mínimo.`, ...next.news].slice(0, 8),
    };
  } else if (next.boardTrust <= 0) {
    next = { ...next, gameOver: true, news: [`❌ La directiva te destituyó como presidente.`, ...next.news].slice(0, 8) };
  }

  if (week >= (state.weeksPerSeason || WEEKS_PER_SEASON)) {
    next = resolveSeason(next);
  }

  return next;
}

// Cierre de temporada: la posición final sale de la tabla real, no de un
// cálculo abstracto — ya viene de simular fecha a fecha en advanceWeek.
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
  let fanHappiness = clamp(state.fanHappiness + (goodSeason ? 12 : badSeason ? -12 : 0), 0, 100);
  // El objetivo de la directiva pesa aparte de "buena/mala temporada" en
  // general — cumplirlo (o no) es lo que de verdad evalúan arriba.
  boardTrust = clamp(boardTrust + (objectiveMet ? 6 : -10), 0, 100);
  const prizeMoney = (goodSeason ? 6 : badSeason ? 0 : 2) + (objectiveMet ? 3 : 0) + (champion ? 5 : 0) + (qualifiesInternational ? 4 : 0);

  const fixtures = buildFixtures(state.league);

  return {
    ...state,
    season: state.season + 1,
    week: 0,
    weeksPerSeason: fixtures.length,
    fixtures,
    leagueTable: buildLeagueTable(state.league),
    leaguePosition: position,
    boardTrust,
    fanHappiness,
    budget: Math.round((state.budget + prizeMoney) * 20) / 20,
    dtBudgetGiven: 0,
    dtQuality: clamp(state.dtQuality + academyBoost, 20, 99),
    dtConfidence: clamp(state.dtConfidence + (objectiveMet ? 5 : -5), 0, 100),
    internationalQualified: qualifiesInternational,
    titlesWon: (state.titlesWon || 0) + (champion ? 1 : 0),
    history: [
      { season: state.season, position, leagueSize, budget: state.budget, stadiumTier: state.stadiumTier, objectiveMet, objectiveLabel: objective.label, champion, qualifiesInternational },
      ...state.history,
    ],
    currentDecision: pickDecision(state._usedDecisions || []),
    decisionUsed: false,
    news: [
      `📊 Temporada ${state.season} cerrada: terminaste ${position}° de ${leagueSize} — objetivo (${objective.label}) ${objectiveMet ? "cumplido ✅" : "no cumplido ❌"}.${qualifiesInternational ? " 🌍 Clasificaron a competencia internacional." : ""} +€${prizeMoney}M de premios.`,
      ...state.news,
    ].slice(0, 8),
  };
}
