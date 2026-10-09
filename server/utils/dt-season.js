// Reglas puras (sin base de datos) de la temporada de la Liga Online DT: niveles de club,
// puntaje de los humanos, copas, torneos europeos, mercados y multas. Todo lo que toca la
// base vive en dt-league-core.js; acá solo hay cuentas, para poder probarlas.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Niveles de club (10 por dentro, 3 tiers a la vista) ----------
export const LEVEL_COUNT = 10;
export const RATING_MIN = 62;
export const RATING_MAX = 88;

// 1 = el más fuerte, 10 = el más flojo. Sale del promedio de OVR del once.
export function levelFromRating(rating) {
  const r = Number.isFinite(Number(rating)) ? Number(rating) : 75;
  const step = (RATING_MAX - RATING_MIN) / LEVEL_COUNT;
  return clamp(LEVEL_COUNT - Math.floor((r - RATING_MIN) / step), 1, LEVEL_COUNT);
}

// Los 3 tiers que se muestran agrupan los 10 niveles: 3 / 4 / 3.
export function tierFromLevel(level) {
  return level <= 3 ? 1 : level <= 7 ? 2 : 3;
}
export const tierFromRating = (rating) => tierFromLevel(levelFromRating(rating));

// Rating inicial de un club CPU según el tier que traía el archivo de equipos.
const BASE_RATING = { 1: 84, 2: 77, 3: 68 };
export function baseRatingForTier(tier, teamId = "") {
  let h = 0;
  for (const c of String(teamId)) h = (h * 31 + c.charCodeAt(0)) % 997;
  const jitter = ((h % 31) - 15) / 10; // -1.5 .. +1.5, siempre el mismo para el mismo club
  return Math.round((BASE_RATING[tier] ?? 77) + jitter);
}

// Presupuesto inicial (M€) según el nivel: un grande y un chico no parten del mismo lugar.
const BUDGET_BY_LEVEL = [200, 165, 130, 100, 78, 58, 42, 30, 21, 14];
export const initialBudget = (level) => BUDGET_BY_LEVEL[clamp(level, 1, LEVEL_COUNT) - 1];

// Sube o baja con el rendimiento de la temporada: terminar mejor de lo esperado paga.
export function budgetAfterSeason(budget, level, position, teams = 20) {
  const delta = expectedPosition(level, teams) - position; // positivo = rindió más de lo esperado
  return Math.max(5, Math.round((budget + delta * 2.5) * 10) / 10);
}

// ---------- Exigencias y puntaje de los humanos ----------
// Posición que se espera de un club de cierto nivel en una liga de N equipos.
export function expectedPosition(level, teams = 20) {
  return clamp(Math.round(((level - 0.5) / LEVEL_COUNT) * teams + 0.5), 1, teams);
}

// Puntos por un partido de liga: ganarle a alguien de mejor nivel vale mucho más que
// cumplir; un grande que pierde contra un chico resta. (Cuanto menor el número, mejor el club.)
export function matchPoints(myLevel, oppLevel, outcome) {
  const gap = myLevel - oppLevel; // positivo = el rival es de mejor nivel que yo
  if (outcome === "win") return Math.round(10 + Math.max(0, gap) * 3);
  if (outcome === "draw") return Math.round(4 + Math.max(0, gap) * 1.2);
  return gap < 0 ? Math.round(gap * 1.6) : 0;
}

export const outcomeOf = (mine, theirs) => (mine > theirs ? "win" : mine < theirs ? "loss" : "draw");

// Ajuste por la posición en la tabla frente a lo que se esperaba de ese club.
// Recién cuenta con unas cuantas jornadas jugadas.
export function positionPoints(level, position, played, teams = 20) {
  if (played < 3) return 0;
  const delta = expectedPosition(level, teams) - position;
  return clamp(Math.round(delta * 0.5), -4, 6);
}

// Cuánto cuenta cada ronda de las copas: llegar lejos con un club chico vale más.
export const COMP_WEIGHT = { liga: 1, copa: 1.2, supercopa: 0.8, champions: 2.2, europa: 1.6 };
export function cupRoundPoints(comp, roundIdx, outcome, myLevel, oppLevel) {
  const w = COMP_WEIGHT[comp] ?? 1;
  const gap = Math.max(0, myLevel - oppLevel);
  if (outcome === "win") return Math.round((6 + roundIdx * 3 + gap * 2) * w);
  if (outcome === "draw") return Math.round(2 * w);
  return myLevel < oppLevel ? Math.round(-3 * w) : 0; // un grande que cae contra uno chico resta
}

// Clasificar a Europa pesa más en las ligas con más clubes peleando por pocos cupos.
export const QUALIFY_WEIGHT = { premier: 1.4, laliga: 1.2, seriea: 1.1, bundesliga: 1.0 };
export function qualificationPoints(leagueKey, comp, position) {
  const w = QUALIFY_WEIGHT[leagueKey] ?? 1;
  if (comp === "champions") return Math.round((26 - position * 3) * w);
  if (comp === "europa") return Math.round(8 * w);
  return 0;
}

// Cupos europeos por posición final: 4 a la Champions, 5° y 6° a la Europa League.
export const CHAMPIONS_SPOTS = 4;
export const EUROPA_SPOTS = 2;

// ---------- Copas ----------
// Copas nacionales de cada liga (formato de eliminación directa con los clubes de la liga).
export const NATIONAL_COMPS = {
  premier: [
    { key: "fa_cup", label: "FA Cup", kind: "copa", teams: 20, weeks: [6, 12, 20, 30, 36] },
    { key: "league_cup", label: "Copa de la Liga", kind: "copa", teams: 16, weeks: [8, 16, 26, 34] },
  ],
  laliga: [
    { key: "supercopa", label: "Supercopa de España", kind: "supercopa", teams: 4, weeks: [2, 3] },
    { key: "copa_rey", label: "Copa del Rey", kind: "copa", teams: 20, weeks: [6, 12, 20, 30, 36] },
  ],
  seriea: [
    { key: "supercoppa", label: "Supercoppa Italiana", kind: "supercopa", teams: 4, weeks: [2, 3] },
    { key: "coppa_italia", label: "Coppa Italia", kind: "copa", teams: 20, weeks: [6, 12, 20, 30, 36] },
  ],
  bundesliga: [
    { key: "supercup", label: "Supercopa de Alemania", kind: "supercopa", teams: 2, weeks: [2] },
    { key: "dfb_pokal", label: "DFB-Pokal", kind: "copa", teams: 16, weeks: [6, 12, 20, 30] },
  ],
};

export const EURO_COMPS = [
  { key: "champions", label: "Champions League", kind: "champions", teams: 16, weeks: [7, 15, 24, 33, 38] },
  { key: "europa", label: "Europa League", kind: "europa", teams: 8, weeks: [15, 24, 33, 38] },
];

export function roundName(teams, roundIdx) {
  // teams = equipos que arrancan la competición; cada ronda divide por 2.
  const left = teams / Math.pow(2, roundIdx);
  if (left <= 2) return "Final";
  if (left === 4) return "Semifinal";
  if (left === 8) return "Cuartos de final";
  if (left === 16) return "Octavos de final";
  return `Ronda de ${left}`;
}

// Arma la primera ronda de una llave: los mejores sembrados pasan directo si no alcanza para
// completar la potencia de 2; el resto se cruza fuerte contra flojo. Devuelve { pairs, byes }.
export function firstRound(teamIds, ratingOf = () => 75) {
  const sorted = [...teamIds].sort((a, b) => ratingOf(b) - ratingOf(a));
  let size = 1;
  while (size < sorted.length) size *= 2;
  const byesCount = size - sorted.length;
  const byes = sorted.slice(0, byesCount);
  const rest = sorted.slice(byesCount);
  const pairs = [];
  for (let i = 0; i < Math.floor(rest.length / 2); i++) pairs.push([rest[i], rest[rest.length - 1 - i]]);
  return { pairs, byes };
}

// Cruza a los ganadores de una ronda: 1º con el último, 2º con el anteúltimo… (por orden de aparición).
export function nextRoundPairs(winners) {
  const pairs = [];
  for (let i = 0; i < Math.floor(winners.length / 2); i++) pairs.push([winners[i], winners[winners.length - 1 - i]]);
  return pairs;
}

// ---------- Mercados ----------
// Mercado de verano: las primeras 8 jornadas (julio-agosto). De invierno: 4 jornadas (enero).
export const SUMMER_WINDOW = [0, 7];
export const WINTER_WINDOW = [20, 23];

export function windowAt(week) {
  if (week >= SUMMER_WINDOW[0] && week <= SUMMER_WINDOW[1]) return "summer";
  if (week >= WINTER_WINDOW[0] && week <= WINTER_WINDOW[1]) return "winter";
  return null;
}
export const WINDOW_LABEL = { summer: "Mercado de verano", winter: "Mercado de invierno" };

// Un club CPU ficha a un jugador: su rating se acerca al del jugador (pesa 1/22 del once).
export function ratingAfterSigning(rating, playerOvr) {
  return Math.round((rating + (playerOvr - rating) / 22) * 100) / 100;
}
// El que vende pierde esa pieza y la reemplaza por una un poco peor.
export function ratingAfterSelling(rating, playerOvr) {
  return Math.round((rating - Math.max(0, playerOvr - (rating - 4)) / 30) * 100) / 100;
}

// ---------- Multas y expulsión ----------
export const FINE_PER_DAY = 5; // M€
export const EXPEL_AFTER_DAYS = 3;

// Días de atraso (enteros) desde un instante, tope EXPEL_AFTER_DAYS.
export function overdueDays(sinceMs, nowMs) {
  return clamp(Math.floor((nowMs - sinceMs) / 86400000), 0, EXPEL_AFTER_DAYS);
}
