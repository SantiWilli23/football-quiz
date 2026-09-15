// Motor puro de Modo Presidente: un nivel arriba del DT. Acá no se dirige
// la cancha (eso ya lo cubre Modo DT) — se maneja el club: plata, estadio,
// sponsors y la relación con la hinchada y la directiva. Los resultados
// deportivos se resuelven de forma abstracta al cierre de temporada, según
// cuánto invertiste en el proyecto comparado con el resto de la liga.
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

export const WEEKS_PER_SEASON = 34;
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

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function initialPresidentState(teamId, teamName, league, prestige) {
  return {
    version: 1,
    teamId,
    teamName,
    league,
    season: 1,
    week: 0,
    budget: 15,
    debt: 0,
    fanHappiness: 60,
    boardTrust: 60,
    ticketPriceLevel: 1,
    stadiumTier: 1,
    sponsorTier: 0,
    academyTier: 0,
    dtBudgetGiven: 0,
    dtQuality: clamp(40 + (prestige || 5) * 2, 30, 75),
    leaguePosition: null,
    seasonInvestment: 0,
    history: [],
    titlesWon: 0,
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
  return { ticketRevenue, sponsorRevenue, tvRevenue, attendance, total: ticketRevenue + sponsorRevenue + tvRevenue };
}

export function weeklyExpenses(state) {
  const wages = 0.25 + state.dtQuality / 100 * 0.6;
  const upkeep = state.stadiumTier * 0.08;
  const debtInterest = state.debt * 0.01;
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

export function canUpgradeStadium(state) {
  const next = STADIUM_TIERS[state.stadiumTier];
  return next && state.budget >= next.upgradeCost;
}

export function upgradeStadium(state) {
  const next = STADIUM_TIERS[state.stadiumTier];
  if (!next || state.budget < next.upgradeCost) return state;
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
  if (state.budget < cost) return state;
  return {
    ...state,
    budget: Math.round((state.budget - cost) * 20) / 20,
    sponsorTier: tier,
    news: [`🤝 Firmaste con un ${SPONSOR_TIERS[tier - 1].label.toLowerCase()}.`, ...state.news].slice(0, 8),
  };
}

export function hireAcademy(state, tier) {
  const cost = ACADEMY_TIERS[tier - 1]?.cost;
  if (cost == null || state.academyTier >= tier || state.budget < cost) return state;
  return {
    ...state,
    budget: Math.round((state.budget - cost) * 20) / 20,
    academyTier: tier,
    news: [`🌱 Invertiste en ${ACADEMY_TIERS[tier - 1].label.toLowerCase()} — la cantera va a rendir de a poco.`, ...state.news].slice(0, 8),
  };
}

export function fireDt(state) {
  return {
    ...state,
    dtQuality: clamp(state.dtQuality - 5, 20, 95),
    boardTrust: clamp(state.boardTrust - 3, 0, 100),
    fanHappiness: clamp(state.fanHappiness + 5, 0, 100),
    news: [`🔥 Echaste al DT. La hinchada lo pedía, la directiva no tanto.`, ...state.news].slice(0, 8),
  };
}

export function advanceWeek(state) {
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

  const week = state.week + 1;
  const seasonInvestment = (state.seasonInvestment || 0) + (state.dtBudgetGiven || 0) * 0 + net * 0; // placeholder, se recalcula abajo
  const usedIds = (state._usedDecisions || []).slice();

  let next = {
    ...state,
    budget,
    debt,
    boardTrust,
    fanHappiness,
    week,
    decisionUsed: false,
    currentDecision: pickDecision(usedIds),
    _usedDecisions: [...usedIds].slice(-10),
  };

  const gameOver = boardTrust <= 0;
  if (gameOver) {
    next = { ...next, gameOver: true, news: [`❌ La directiva te destituyó como presidente.`, ...next.news].slice(0, 8) };
  }

  if (week >= WEEKS_PER_SEASON) {
    next = resolveSeason(next);
  }

  return next;
}

// Cierre de temporada: la posición final sale de comparar tu "inversión
// deportiva" (presupuesto que le diste al DT + calidad del DT + prestigio
// del estadio) contra el resto de los clubes de tu liga.
export function resolveSeason(state) {
  const rivals = teamsByLeague(state.league).filter((t) => t.id !== state.teamId);
  const academyBoost = state.academyTier > 0 ? ACADEMY_TIERS[state.academyTier - 1].dtQualityPerSeason : 0;
  const myStrength = (state.dtBudgetGiven || 0) * 1.5 + state.dtQuality + state.stadiumTier * 4;
  const table = [
    { id: state.teamId, name: state.teamName, strength: myStrength + (Math.random() * 20 - 10) },
    ...rivals.map((t) => ({ id: t.id, name: t.name, strength: (t.budget || 40) * 0.6 + (t.prestige || 5) * 3 + Math.random() * 20 })),
  ].sort((a, b) => b.strength - a.strength);

  const position = table.findIndex((r) => r.id === state.teamId) + 1;
  const leagueSize = table.length;
  const goodSeason = position <= Math.ceil(leagueSize / 3);
  const badSeason = position >= leagueSize - 2;

  const objective = objectiveFor(state.teamId);
  const objectiveMet = position <= objective.threshold;
  const champion = position === 1;

  let boardTrust = clamp(state.boardTrust + (goodSeason ? 10 : badSeason ? -15 : -2), 0, 100);
  let fanHappiness = clamp(state.fanHappiness + (goodSeason ? 12 : badSeason ? -12 : 0), 0, 100);
  // El objetivo de la directiva pesa aparte de "buena/mala temporada" en
  // general — cumplirlo (o no) es lo que de verdad evalúan arriba.
  boardTrust = clamp(boardTrust + (objectiveMet ? 6 : -10), 0, 100);
  const prizeMoney = (goodSeason ? 6 : badSeason ? 0 : 2) + (objectiveMet ? 3 : 0) + (champion ? 5 : 0);

  return {
    ...state,
    season: state.season + 1,
    week: 0,
    leaguePosition: position,
    boardTrust,
    fanHappiness,
    budget: Math.round((state.budget + prizeMoney) * 20) / 20,
    dtBudgetGiven: 0,
    dtQuality: clamp(state.dtQuality + academyBoost, 20, 99),
    titlesWon: (state.titlesWon || 0) + (champion ? 1 : 0),
    history: [
      { season: state.season, position, leagueSize, budget: state.budget, stadiumTier: state.stadiumTier, objectiveMet, objectiveLabel: objective.label, champion },
      ...state.history,
    ],
    currentDecision: pickDecision(state._usedDecisions || []),
    decisionUsed: false,
    news: [
      `📊 Temporada ${state.season} cerrada: terminaste ${position}° de ${leagueSize} — objetivo (${objective.label}) ${objectiveMet ? "cumplido ✅" : "no cumplido ❌"}. +€${prizeMoney}M de premios.`,
      ...state.news,
    ].slice(0, 8),
  };
}
