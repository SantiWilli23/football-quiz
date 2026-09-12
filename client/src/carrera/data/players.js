import { teams } from "./teams.js";

// ============ HELPERS DE GENERACIÓN ============
let uid = 0;
function nextId(teamId) {
  uid += 1;
  return `${teamId}_${uid}`;
}

const POS_ATTR_WEIGHTS = {
  GK: { pace: 0.3, shooting: 0.1, passing: 0.5, dribbling: 0.3, defending: 0.6, physical: 0.7 },
  CB: { pace: 0.6, shooting: 0.2, passing: 0.5, dribbling: 0.3, defending: 1.0, physical: 0.9 },
  LB: { pace: 0.9, shooting: 0.3, passing: 0.7, dribbling: 0.6, defending: 0.8, physical: 0.6 },
  RB: { pace: 0.9, shooting: 0.3, passing: 0.7, dribbling: 0.6, defending: 0.8, physical: 0.6 },
  CDM: { pace: 0.5, shooting: 0.4, passing: 0.8, dribbling: 0.5, defending: 0.9, physical: 0.8 },
  CM: { pace: 0.6, shooting: 0.6, passing: 0.9, dribbling: 0.7, defending: 0.6, physical: 0.7 },
  CAM: { pace: 0.6, shooting: 0.8, passing: 0.9, dribbling: 0.9, defending: 0.3, physical: 0.5 },
  LW: { pace: 1.0, shooting: 0.7, passing: 0.6, dribbling: 1.0, defending: 0.2, physical: 0.5 },
  RW: { pace: 1.0, shooting: 0.7, passing: 0.6, dribbling: 1.0, defending: 0.2, physical: 0.5 },
  ST: { pace: 0.8, shooting: 1.0, passing: 0.5, dribbling: 0.7, defending: 0.1, physical: 0.7 },
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function attributesFor(pos, ovr) {
  const w = POS_ATTR_WEIGHTS[pos] || POS_ATTR_WEIGHTS.CM;
  const out = {};
  Object.keys(w).forEach((k) => {
    const noise = rnd(-6, 6);
    out[k] = clamp(Math.round(ovr * w[k] * 1.05 + noise + ovr * 0.15), 35, 99);
  });
  return out;
}

// Multiplicador de mercado por posición: los equipos pagan de más por
// gente que decide partidos (extremos, "9"), y de menos por perfiles de
// contención — igual que en el mercado real.
const POSITION_VALUE_MULT = {
  GK: 0.7, CB: 0.85, LB: 0.95, RB: 0.95, CDM: 0.9,
  CM: 1.0, CAM: 1.15, LW: 1.3, RW: 1.3, ST: 1.35,
};

// Curva exponencial (como el mercado real: la diferencia entre 85 y 90 OVR
// vale mucho más que entre 65 y 70), con multiplicadores de edad, posición
// y "sueño" (potencial por encima del nivel actual).
export function calculateValue(ovr, age, potential, position = "CM", homegrown = false) {
  if (ovr < 58) return Math.max(0.05, Math.round((ovr - 50) * 0.08 * 20) / 20);
  const base = Math.pow(1.155, ovr - 58) * 0.55;
  const posMult = POSITION_VALUE_MULT[position] || 1;
  const ageMult =
    age <= 19 ? 1.6 : age <= 21 ? 1.4 : age <= 24 ? 1.2 : age <= 27 ? 1.05 : age <= 30 ? 0.82 : age <= 33 ? 0.55 : 0.3;
  const potGap = Math.max(0, (potential ?? ovr) - ovr);
  const potMult = 1 + potGap * 0.07;
  // Un canterano con recorrido (sale de las inferiores del propio club) vale
  // bastante más de lo que dice su OVR de hoy: el club sabe lo que tiene y
  // no lo regala ni cuando todavía no es titular fijo.
  const homegrownMult = homegrown ? 1.6 : 1;
  const value = base * posMult * ageMult * potMult * homegrownMult;
  return Math.round(value * 20) / 20;
}

// Sueldo semanal en miles de € — también exponencial, con techo puesto por
// la edad (un veterano de 34 años ya no negocia como si fuera a mejorar).
function wageFor(ovr, age = 26) {
  const base = Math.pow(1.135, Math.max(ovr - 58, 0)) * 4;
  const ageMult = age <= 30 ? 1 : age <= 33 ? 0.85 : 0.65;
  return Math.max(1, Math.round(base * ageMult));
}

function buildPlayer(team, { name, pos, age, nat, ovr, pot, homegrown }, isYouth = false) {
  const potential = clamp(pot ?? ovr + rnd(0, 6), ovr, 99);
  return {
    id: nextId(team.id),
    name,
    age,
    nationality: nat,
    position: pos,
    ovr,
    potential,
    value: isYouth ? Math.min(3, calculateValue(ovr, age, potential, pos)) : calculateValue(ovr, age, potential, pos, !!homegrown),
    wage: wageFor(ovr, age),
    teamId: team.id,
    attributes: attributesFor(pos, ovr),
    contractYears: isYouth ? rnd(2, 4) : rnd(1, 5),
    isYouth,
    // Canterano: salió de las inferiores de este mismo club — el club se
    // resiste mucho más a venderlo (ver transferMarket.js: askingPrice/clubDecision).
    academyProduct: !!homegrown,
    releaseClause: null,
    transferListed: false,
    loanListed: false,
  };
}

const FIRST_NAMES = {
  premier: ["James", "Harry", "Jack", "Oliver", "Callum", "Ethan", "Tyler", "Reece", "Dominic", "Mason", "Aaron", "Kyle", "Ryan", "Josh", "Ben", "Sam", "Tom", "Luke", "George", "Charlie"],
  laliga: ["Álvaro", "Pablo", "Diego", "Adrián", "Iker", "Mario", "Sergio", "Rubén", "Marc", "Nico", "Hugo", "Javi", "Raúl", "Iván", "Óscar", "Dani", "Guille", "Manu", "Jorge", "Víctor"],
  seriea: ["Matteo", "Francesco", "Lorenzo", "Andrea", "Davide", "Simone", "Riccardo", "Alessandro", "Federico", "Gabriele", "Nicolo", "Giacomo", "Leonardo", "Tommaso", "Mattia", "Edoardo", "Marco", "Luca", "Stefano", "Antonio"],
  bundesliga: ["Lukas", "Maximilian", "Felix", "Jonas", "Niklas", "Leon", "Finn", "Julian", "Tobias", "Philipp", "Moritz", "Elias", "Paul", "Tim", "Fabian", "Jan", "Sebastian", "David", "Erik", "Marvin"],
};
const LAST_NAMES = {
  premier: ["Whitfield", "Sanderson", "Hargreaves", "Osborne", "Kingsley", "Pearce", "Fenwick", "Colton", "Marsh", "Hopwood", "Radley", "Bristow", "Draycott", "Nolan", "Ashworth", "Broughton"],
  laliga: ["Serrano", "Bustos", "Cabañas", "Molinero", "Vallejo", "Cortés", "Herrán", "Peláez", "Escudero", "Marín", "Salcedo", "Bravo", "Cañete", "Roldán", "Zamorano", "Aguirre"],
  seriea: ["Bianchi", "Ricci", "Marino", "Greco", "Conti", "De Luca", "Mancini", "Costa", "Fontana", "Santoro", "Rinaldi", "Barbieri", "Gatti", "Villa", "Caruso", "Moretti"],
  bundesliga: ["Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Schulz", "Krüger", "Zimmermann", "Braun", "Vogel", "Krause", "Lang", "Berger", "Hartmann", "Keller"],
};
const NAT_PREMIER = ["ENG", "SCO", "WAL", "IRL", "FRA", "NED", "BEL"];
const NAT_LALIGA = ["ESP", "ARG", "BRA", "URU", "COL", "POR", "FRA"];
const NAT_SERIEA = ["ITA", "ARG", "BRA", "FRA", "SRB", "ALB"];
const NAT_BUNDESLIGA = ["GER", "AUT", "SUI", "NED", "POL", "TUR"];

function fillerPool(league) {
  if (league === "laliga") return { first: FIRST_NAMES.laliga, last: LAST_NAMES.laliga, nats: NAT_LALIGA };
  if (league === "seriea") return { first: FIRST_NAMES.seriea, last: LAST_NAMES.seriea, nats: NAT_SERIEA };
  if (league === "bundesliga") return { first: FIRST_NAMES.bundesliga, last: LAST_NAMES.bundesliga, nats: NAT_BUNDESLIGA };
  return { first: FIRST_NAMES.premier, last: LAST_NAMES.premier, nats: NAT_PREMIER };
}

function tierRange(tier) {
  if (tier === 1) return { starter: [80, 88], bench: [76, 83], reserve: [68, 79] };
  if (tier === 2) return { starter: [75, 82], bench: [70, 78], reserve: [63, 73] };
  return { starter: [70, 78], bench: [65, 74], reserve: [60, 70] };
}

const POSITIONS_ALL = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

// Completa el plantel de un equipo hasta `target` jugadores, balanceando posiciones
// y respetando rangos de OVR por rol (titular/banca/reserva) según el tier.
function fillSquad(team, existing, target = 22) {
  const pool = fillerPool(team.league);
  const range = tierRange(team.tier);
  const players = existing.slice();

  const countByPos = {};
  POSITIONS_ALL.forEach((p) => { countByPos[p] = players.filter((pl) => pl.position === p).length; });
  const needMin = { GK: 2, CB: 3, LB: 1, RB: 1, CDM: 1, CM: 2, CAM: 1, LW: 1, RW: 1, ST: 2 };

  let youthAdded = 0;
  while (players.length < target) {
    let pos = POSITIONS_ALL.find((p) => (countByPos[p] || 0) < (needMin[p] || 0));
    if (!pos) pos = pick(POSITIONS_ALL.filter((p) => p !== "GK"));
    const isYouth = youthAdded < 3 && players.length > target - 6;
    const [lo, hi] = isYouth ? [58, 68] : players.length < 11 ? range.starter : players.length < 18 ? range.bench : range.reserve;
    const ovr = rnd(lo, hi);
    const age = isYouth ? rnd(17, 20) : rnd(19, 35);
    const pot = isYouth ? rnd(Math.max(ovr + 12, 80), 90) : undefined;
    const name = `${pick(pool.first)} ${pick(pool.last)}`;
    const nat = pick(pool.nats);
    players.push(buildPlayer(team, { name, pos, age, nat, ovr, pot }, isYouth));
    countByPos[pos] = (countByPos[pos] || 0) + 1;
    if (isYouth) youthAdded += 1;
  }
  return players;
}

// ============ PLANTELES DETALLADOS (jugadores reales del prompt) ============
const NAMED = {
  mancity: [
    { name: "Ederson", pos: "GK", age: 29, nat: "BRA", ovr: 88, pot: 89 },
    { name: "Kyle Walker", pos: "RB", age: 34, nat: "ENG", ovr: 83, pot: 83 },
    { name: "Ruben Dias", pos: "CB", age: 27, nat: "POR", ovr: 88, pot: 90 },
    { name: "John Stones", pos: "CB", age: 30, nat: "ENG", ovr: 85, pot: 85 },
    { name: "Manuel Akanji", pos: "CB", age: 29, nat: "SWI", ovr: 84, pot: 85 },
    { name: "Josko Gvardiol", pos: "LB", age: 22, nat: "CRO", ovr: 84, pot: 90 },
    { name: "Rodri", pos: "CDM", age: 28, nat: "ESP", ovr: 91, pot: 92 },
    { name: "Kevin De Bruyne", pos: "CM", age: 33, nat: "BEL", ovr: 90, pot: 90 },
    { name: "Bernardo Silva", pos: "CM", age: 30, nat: "POR", ovr: 88, pot: 89 },
    { name: "Ilkay Gundogan", pos: "CM", age: 33, nat: "GER", ovr: 87, pot: 87 },
    { name: "Phil Foden", pos: "CAM", age: 24, nat: "ENG", ovr: 88, pot: 93 },
    { name: "Jack Grealish", pos: "LW", age: 28, nat: "ENG", ovr: 83, pot: 85 },
    { name: "Erling Haaland", pos: "ST", age: 24, nat: "NOR", ovr: 91, pot: 96 },
    { name: "Jeremy Doku", pos: "RW", age: 22, nat: "BEL", ovr: 82, pot: 89 },
    { name: "Savinho", pos: "RW", age: 20, nat: "BRA", ovr: 79, pot: 89 },
    { name: "Matheus Nunes", pos: "CM", age: 26, nat: "POR", ovr: 80, pot: 84 },
    { name: "Rico Lewis", pos: "RB", age: 19, nat: "ENG", ovr: 79, pot: 87 },
    { name: "Oscar Bobb", pos: "RW", age: 21, nat: "NOR", ovr: 76, pot: 87 },
    { name: "Stefan Ortega", pos: "GK", age: 31, nat: "GER", ovr: 80, pot: 81 },
  ],
  liverpool: [
    { name: "Alisson", pos: "GK", age: 32, nat: "BRA", ovr: 89, pot: 89 },
    { name: "Trent Alexander-Arnold", pos: "RB", age: 26, nat: "ENG", ovr: 86, pot: 88 },
    { name: "Virgil van Dijk", pos: "CB", age: 33, nat: "NED", ovr: 89, pot: 89 },
    { name: "Ibrahima Konaté", pos: "CB", age: 25, nat: "FRA", ovr: 84, pot: 88 },
    { name: "Andy Robertson", pos: "LB", age: 30, nat: "SCO", ovr: 85, pot: 85 },
    { name: "Alexis Mac Allister", pos: "CM", age: 25, nat: "ARG", ovr: 86, pot: 89 },
    { name: "Dominik Szoboszlai", pos: "CM", age: 23, nat: "HUN", ovr: 83, pot: 88 },
    { name: "Mohamed Salah", pos: "RW", age: 32, nat: "EGY", ovr: 89, pot: 89 },
    { name: "Darwin Nunez", pos: "ST", age: 25, nat: "URU", ovr: 83, pot: 89 },
    { name: "Luis Diaz", pos: "LW", age: 27, nat: "COL", ovr: 84, pot: 87 },
    { name: "Cody Gakpo", pos: "LW", age: 25, nat: "NED", ovr: 82, pot: 87 },
    { name: "Harvey Elliott", pos: "CM", age: 21, nat: "ENG", ovr: 79, pot: 87 },
    { name: "Wataru Endo", pos: "CDM", age: 31, nat: "JPN", ovr: 79, pot: 79 },
    { name: "Joe Gomez", pos: "CB", age: 27, nat: "ENG", ovr: 81, pot: 83 },
    { name: "Caoimhin Kelleher", pos: "GK", age: 25, nat: "IRL", ovr: 79, pot: 84 },
    { name: "Konstantinos Tsimikas", pos: "LB", age: 28, nat: "GRE", ovr: 80, pot: 81 },
    { name: "Ben Doak", pos: "RW", age: 18, nat: "SCO", ovr: 70, pot: 85 },
  ],
  arsenal: [
    { name: "David Raya", pos: "GK", age: 29, nat: "ESP", ovr: 85, pot: 87 },
    { name: "Ben White", pos: "RB", age: 27, nat: "ENG", ovr: 82, pot: 85 },
    { name: "William Saliba", pos: "CB", age: 23, nat: "FRA", ovr: 87, pot: 92 },
    { name: "Gabriel Magalhães", pos: "CB", age: 26, nat: "BRA", ovr: 86, pot: 88 },
    { name: "Oleksandr Zinchenko", pos: "LB", age: 27, nat: "UKR", ovr: 81, pot: 83 },
    { name: "Jurrien Timber", pos: "RB", age: 22, nat: "NED", ovr: 81, pot: 88 },
    { name: "Declan Rice", pos: "CDM", age: 25, nat: "ENG", ovr: 87, pot: 90 },
    { name: "Martin Odegaard", pos: "CAM", age: 25, nat: "NOR", ovr: 89, pot: 92 },
    { name: "Bukayo Saka", pos: "RW", age: 23, nat: "ENG", ovr: 87, pot: 93 },
    { name: "Gabriel Martinelli", pos: "LW", age: 23, nat: "BRA", ovr: 83, pot: 89 },
    { name: "Leandro Trossard", pos: "LW", age: 29, nat: "BEL", ovr: 83, pot: 84 },
    { name: "Kai Havertz", pos: "ST", age: 25, nat: "GER", ovr: 82, pot: 87 },
    { name: "Thomas Partey", pos: "CDM", age: 31, nat: "GHA", ovr: 83, pot: 83 },
    { name: "Jakub Kiwior", pos: "CB", age: 24, nat: "POL", ovr: 79, pot: 83 },
    { name: "Emile Smith Rowe", pos: "CAM", age: 24, nat: "ENG", ovr: 78, pot: 84 },
    { name: "Gabriel Nketiah", pos: "ST", age: 25, nat: "ENG", ovr: 78, pot: 83 },
    { name: "Karl Hein", pos: "GK", age: 22, nat: "EST", ovr: 72, pot: 80 },
  ],
  chelsea: [
    { name: "Robert Sanchez", pos: "GK", age: 26, nat: "ESP", ovr: 79, pot: 83 },
    { name: "Filip Jorgensen", pos: "GK", age: 22, nat: "DEN", ovr: 77, pot: 85 },
    { name: "Reece James", pos: "RB", age: 24, nat: "ENG", ovr: 82, pot: 86 },
    { name: "Malo Gusto", pos: "RB", age: 21, nat: "FRA", ovr: 79, pot: 86 },
    { name: "Levi Colwill", pos: "CB", age: 21, nat: "ENG", ovr: 80, pot: 87 },
    { name: "Axel Disasi", pos: "CB", age: 26, nat: "FRA", ovr: 81, pot: 84 },
    { name: "Marc Cucurella", pos: "LB", age: 26, nat: "ESP", ovr: 80, pot: 82 },
    { name: "Ben Chilwell", pos: "LB", age: 27, nat: "ENG", ovr: 80, pot: 82 },
    { name: "Moises Caicedo", pos: "CDM", age: 22, nat: "ECU", ovr: 82, pot: 88 },
    { name: "Romeo Lavia", pos: "CDM", age: 20, nat: "BEL", ovr: 77, pot: 87 },
    { name: "Enzo Fernandez", pos: "CM", age: 23, nat: "ARG", ovr: 82, pot: 88 },
    { name: "Conor Gallagher", pos: "CM", age: 24, nat: "ENG", ovr: 79, pot: 84 },
    { name: "Cole Palmer", pos: "CAM", age: 22, nat: "ENG", ovr: 85, pot: 93 },
    { name: "Noni Madueke", pos: "RW", age: 22, nat: "ENG", ovr: 78, pot: 85 },
    { name: "Mykhaylo Mudryk", pos: "LW", age: 23, nat: "UKR", ovr: 79, pot: 87 },
    { name: "Christopher Nkunku", pos: "LW", age: 27, nat: "FRA", ovr: 83, pot: 86 },
    { name: "Nicolas Jackson", pos: "ST", age: 23, nat: "SEN", ovr: 80, pot: 86 },
  ],
  manutd: [
    { name: "Andre Onana", pos: "GK", age: 28, nat: "CMR", ovr: 83, pot: 85 },
    { name: "Altay Bayindir", pos: "GK", age: 26, nat: "TUR", ovr: 76, pot: 80 },
    { name: "Diogo Dalot", pos: "RB", age: 25, nat: "POR", ovr: 80, pot: 83 },
    { name: "Lisandro Martinez", pos: "CB", age: 26, nat: "ARG", ovr: 86, pot: 88 },
    { name: "Harry Maguire", pos: "CB", age: 31, nat: "ENG", ovr: 81, pot: 81 },
    { name: "Victor Lindelof", pos: "CB", age: 30, nat: "SWE", ovr: 80, pot: 80 },
    { name: "Luke Shaw", pos: "LB", age: 28, nat: "ENG", ovr: 83, pot: 84 },
    { name: "Aaron Wan-Bissaka", pos: "RB", age: 26, nat: "ENG", ovr: 80, pot: 82 },
    { name: "Casemiro", pos: "CDM", age: 32, nat: "BRA", ovr: 84, pot: 84 },
    { name: "Kobbie Mainoo", pos: "CM", age: 19, nat: "ENG", ovr: 78, pot: 88 },
    { name: "Mason Mount", pos: "CM", age: 25, nat: "ENG", ovr: 82, pot: 85 },
    { name: "Bruno Fernandes", pos: "CAM", age: 29, nat: "POR", ovr: 87, pot: 88 },
    { name: "Amad Diallo", pos: "RW", age: 22, nat: "CIV", ovr: 78, pot: 86 },
    { name: "Alejandro Garnacho", pos: "RW", age: 20, nat: "ARG", ovr: 80, pot: 88 },
    { name: "Antony", pos: "RW", age: 24, nat: "BRA", ovr: 79, pot: 83 },
    { name: "Marcus Rashford", pos: "LW", age: 26, nat: "ENG", ovr: 83, pot: 87 },
    { name: "Rasmus Hojlund", pos: "ST", age: 21, nat: "DEN", ovr: 81, pot: 89 },
  ],
  tottenham: [
    { name: "Guglielmo Vicario", pos: "GK", age: 28, nat: "ITA", ovr: 84, pot: 87 },
    { name: "Fraser Forster", pos: "GK", age: 36, nat: "ENG", ovr: 75, pot: 75 },
    { name: "Pedro Porro", pos: "RB", age: 24, nat: "ESP", ovr: 82, pot: 86 },
    { name: "Cristian Romero", pos: "CB", age: 26, nat: "ARG", ovr: 86, pot: 88 },
    { name: "Micky van de Ven", pos: "CB", age: 23, nat: "NED", ovr: 83, pot: 89 },
    { name: "Ben Davies", pos: "LB", age: 31, nat: "WAL", ovr: 79, pot: 79 },
    { name: "Destiny Udogie", pos: "LB", age: 22, nat: "ITA", ovr: 80, pot: 87 },
    { name: "Yves Bissouma", pos: "CDM", age: 28, nat: "MLI", ovr: 81, pot: 83 },
    { name: "Rodrigo Bentancur", pos: "CM", age: 27, nat: "URU", ovr: 81, pot: 83 },
    { name: "Pape Sarr", pos: "CM", age: 21, nat: "SEN", ovr: 76, pot: 85 },
    { name: "Oliver Skipp", pos: "CM", age: 23, nat: "ENG", ovr: 77, pot: 81 },
    { name: "James Maddison", pos: "CAM", age: 27, nat: "ENG", ovr: 84, pot: 86 },
    { name: "Brennan Johnson", pos: "RW", age: 23, nat: "WAL", ovr: 80, pot: 85 },
    { name: "Dejan Kulusevski", pos: "RW", age: 24, nat: "SWE", ovr: 83, pot: 86 },
    { name: "Timo Werner", pos: "LW", age: 28, nat: "GER", ovr: 79, pot: 80 },
    { name: "Son Heung-min", pos: "LW", age: 32, nat: "KOR", ovr: 87, pot: 87 },
    { name: "Richarlison", pos: "ST", age: 27, nat: "BRA", ovr: 82, pot: 83 },
  ],
  newcastle: [
    { name: "Nick Pope", pos: "GK", age: 32, nat: "ENG", ovr: 83, pot: 84 },
    { name: "Martin Dubravka", pos: "GK", age: 35, nat: "SVK", ovr: 79, pot: 79 },
    { name: "Kieran Trippier", pos: "RB", age: 33, nat: "ENG", ovr: 83, pot: 83 },
    { name: "Fabian Schar", pos: "CB", age: 32, nat: "SWI", ovr: 83, pot: 83 },
    { name: "Sven Botman", pos: "CB", age: 24, nat: "NED", ovr: 82, pot: 86 },
    { name: "Dan Burn", pos: "LB", age: 31, nat: "ENG", ovr: 78, pot: 78 },
    { name: "Bruno Guimaraes", pos: "CDM", age: 26, nat: "BRA", ovr: 86, pot: 89 },
    { name: "Joelinton", pos: "CM", age: 27, nat: "BRA", ovr: 82, pot: 83 },
    { name: "Sean Longstaff", pos: "CM", age: 26, nat: "ENG", ovr: 77, pot: 80 },
    { name: "Elliot Anderson", pos: "CM", age: 21, nat: "ENG", ovr: 76, pot: 84 },
    { name: "Miguel Almiron", pos: "RW", age: 30, nat: "PAR", ovr: 79, pot: 79 },
    { name: "Jacob Murphy", pos: "RW", age: 29, nat: "ENG", ovr: 78, pot: 79 },
    { name: "Harvey Barnes", pos: "LW", age: 26, nat: "ENG", ovr: 81, pot: 84 },
    { name: "Anthony Gordon", pos: "LW", age: 23, nat: "ENG", ovr: 82, pot: 88 },
    { name: "Alexander Isak", pos: "ST", age: 24, nat: "SWE", ovr: 85, pot: 92 },
  ],
  astonvilla: [
    { name: "Emiliano Martinez", pos: "GK", age: 31, nat: "ARG", ovr: 87, pot: 87 },
    { name: "Joe Gauci", pos: "GK", age: 24, nat: "AUS", ovr: 72, pot: 79 },
    { name: "Matty Cash", pos: "RB", age: 26, nat: "POL", ovr: 80, pot: 82 },
    { name: "Ezri Konsa", pos: "CB", age: 26, nat: "ENG", ovr: 82, pot: 84 },
    { name: "Pau Torres", pos: "CB", age: 27, nat: "ESP", ovr: 83, pot: 85 },
    { name: "Lucas Digne", pos: "LB", age: 31, nat: "FRA", ovr: 81, pot: 81 },
    { name: "Amadou Onana", pos: "CDM", age: 23, nat: "BEL", ovr: 82, pot: 87 },
    { name: "Boubacar Kamara", pos: "CDM", age: 24, nat: "FRA", ovr: 80, pot: 84 },
    { name: "Youri Tielemans", pos: "CM", age: 27, nat: "BEL", ovr: 82, pot: 84 },
    { name: "John McGinn", pos: "CM", age: 30, nat: "SCO", ovr: 81, pot: 82 },
    { name: "Morgan Rogers", pos: "CAM", age: 21, nat: "ENG", ovr: 78, pot: 86 },
    { name: "Emi Buendia", pos: "CAM", age: 27, nat: "ARG", ovr: 79, pot: 82 },
    { name: "Leon Bailey", pos: "RW", age: 27, nat: "JAM", ovr: 82, pot: 84 },
    { name: "Ollie Watkins", pos: "ST", age: 28, nat: "ENG", ovr: 85, pot: 86 },
  ],
  westham: [
    { name: "Alphonse Areola", pos: "GK", age: 31, nat: "FRA", ovr: 80, pot: 80 },
    { name: "Vladimir Coufal", pos: "RB", age: 32, nat: "CZE", ovr: 78, pot: 78 },
    { name: "Kurt Zouma", pos: "CB", age: 29, nat: "FRA", ovr: 79, pot: 80 },
    { name: "Konstantinos Mavropanos", pos: "CB", age: 26, nat: "GRE", ovr: 79, pot: 82 },
    { name: "Nayef Aguerd", pos: "CB", age: 28, nat: "MAR", ovr: 80, pot: 82 },
    { name: "Aaron Cresswell", pos: "LB", age: 34, nat: "ENG", ovr: 77, pot: 77 },
    { name: "Edson Alvarez", pos: "CDM", age: 26, nat: "MEX", ovr: 82, pot: 84 },
    { name: "Tomas Soucek", pos: "CM", age: 29, nat: "CZE", ovr: 79, pot: 79 },
    { name: "James Ward-Prowse", pos: "CM", age: 29, nat: "ENG", ovr: 82, pot: 83 },
    { name: "Lucas Paqueta", pos: "CAM", age: 27, nat: "BRA", ovr: 84, pot: 85 },
    { name: "Mohammed Kudus", pos: "RW", age: 23, nat: "GHA", ovr: 82, pot: 87 },
    { name: "Jarrod Bowen", pos: "RW", age: 27, nat: "ENG", ovr: 82, pot: 84 },
    { name: "Said Benrahma", pos: "LW", age: 29, nat: "ALG", ovr: 79, pot: 80 },
    { name: "Michail Antonio", pos: "ST", age: 34, nat: "JAM", ovr: 77, pot: 77 },
  ],
  brighton: [
    { name: "Bart Verbruggen", pos: "GK", age: 22, nat: "NED", ovr: 79, pot: 87 },
    { name: "Jan Paul van Hecke", pos: "CB", age: 24, nat: "NED", ovr: 79, pot: 83 },
    { name: "Lewis Dunk", pos: "CB", age: 32, nat: "ENG", ovr: 79, pot: 79 },
    { name: "Tariq Lamptey", pos: "RB", age: 23, nat: "GHA", ovr: 78, pot: 83 },
    { name: "Pervis Estupinan", pos: "LB", age: 26, nat: "ECU", ovr: 80, pot: 83 },
    { name: "Carlos Baleba", pos: "CDM", age: 20, nat: "CMR", ovr: 76, pot: 87 },
    { name: "Billy Gilmour", pos: "CM", age: 23, nat: "SCO", ovr: 77, pot: 82 },
    { name: "Pascal Gross", pos: "CM", age: 33, nat: "GER", ovr: 79, pot: 79 },
    { name: "Jack Hinshelwood", pos: "CM", age: 19, nat: "ENG", ovr: 72, pot: 84 },
    { name: "Yankuba Minteh", pos: "RW", age: 20, nat: "GAM", ovr: 76, pot: 86 },
    { name: "Simon Adingra", pos: "RW", age: 22, nat: "CIV", ovr: 79, pot: 85 },
    { name: "Kaoru Mitoma", pos: "LW", age: 27, nat: "JPN", ovr: 82, pot: 85 },
    { name: "João Pedro", pos: "ST", age: 22, nat: "BRA", ovr: 80, pot: 87 },
    { name: "Evan Ferguson", pos: "ST", age: 19, nat: "IRL", ovr: 77, pot: 87 },
  ],
  fulham: [
    { name: "Bernd Leno", pos: "GK", age: 32, nat: "GER", ovr: 82, pot: 82 },
    { name: "Timothy Castagne", pos: "RB", age: 28, nat: "BEL", ovr: 80, pot: 81 },
    { name: "Kenny Tete", pos: "RB", age: 28, nat: "NED", ovr: 79, pot: 80 },
    { name: "Joachim Andersen", pos: "CB", age: 28, nat: "DEN", ovr: 83, pot: 84 },
    { name: "Calvin Bassey", pos: "CB", age: 24, nat: "NGA", ovr: 80, pot: 83 },
    { name: "Antonee Robinson", pos: "LB", age: 27, nat: "USA", ovr: 80, pot: 83 },
    { name: "Harrison Reed", pos: "CDM", age: 29, nat: "ENG", ovr: 78, pot: 79 },
    { name: "Tom Cairney", pos: "CM", age: 33, nat: "SCO", ovr: 77, pot: 77 },
    { name: "Alex Iwobi", pos: "CM", age: 28, nat: "NGA", ovr: 81, pot: 82 },
    { name: "Andreas Pereira", pos: "CAM", age: 28, nat: "BRA", ovr: 81, pot: 82 },
    { name: "Harry Wilson", pos: "RW", age: 27, nat: "WAL", ovr: 79, pot: 80 },
    { name: "Rodrigo Muniz", pos: "ST", age: 23, nat: "BRA", ovr: 78, pot: 84 },
    { name: "Raul Jimenez", pos: "ST", age: 33, nat: "MEX", ovr: 78, pot: 78 },
  ],
  crystalpalace: [
    { name: "Dean Henderson", pos: "GK", age: 27, nat: "ENG", ovr: 81, pot: 83 },
    { name: "Daniel Munoz", pos: "RB", age: 28, nat: "COL", ovr: 79, pot: 81 },
    { name: "Marc Guehi", pos: "CB", age: 24, nat: "ENG", ovr: 82, pot: 86 },
    { name: "Chris Richards", pos: "CB", age: 24, nat: "USA", ovr: 78, pot: 83 },
    { name: "Tyrick Mitchell", pos: "LB", age: 24, nat: "ENG", ovr: 79, pot: 82 },
    { name: "Cheick Doucoure", pos: "CDM", age: 24, nat: "MLI", ovr: 80, pot: 84 },
    { name: "Will Hughes", pos: "CM", age: 29, nat: "ENG", ovr: 77, pot: 78 },
    { name: "Eberechi Eze", pos: "CAM", age: 26, nat: "NGA", ovr: 83, pot: 86 },
    { name: "Ismaila Sarr", pos: "RW", age: 26, nat: "SEN", ovr: 80, pot: 82 },
    { name: "Jean-Philippe Mateta", pos: "ST", age: 27, nat: "FRA", ovr: 82, pot: 83 },
    { name: "Jordan Ayew", pos: "RW", age: 32, nat: "GHA", ovr: 76, pot: 76 },
    { name: "Odsonne Edouard", pos: "ST", age: 26, nat: "FRA", ovr: 79, pot: 80 },
  ],
  everton: [
    { name: "Jordan Pickford", pos: "GK", age: 30, nat: "ENG", ovr: 83, pot: 84 },
    { name: "James Tarkowski", pos: "CB", age: 31, nat: "ENG", ovr: 81, pot: 81 },
    { name: "Jarrad Branthwaite", pos: "CB", age: 21, nat: "ENG", ovr: 79, pot: 87 },
    { name: "Vitaliy Mykolenko", pos: "LB", age: 24, nat: "UKR", ovr: 78, pot: 83 },
    { name: "Seamus Coleman", pos: "RB", age: 36, nat: "IRL", ovr: 74, pot: 74 },
    { name: "Idrissa Gueye", pos: "CDM", age: 34, nat: "SEN", ovr: 77, pot: 77 },
    { name: "Abdoulaye Doucoure", pos: "CM", age: 31, nat: "FRA", ovr: 79, pot: 79 },
    { name: "Dwight McNeil", pos: "RW", age: 24, nat: "ENG", ovr: 79, pot: 82 },
    { name: "Dominic Calvert-Lewin", pos: "ST", age: 27, nat: "ENG", ovr: 79, pot: 82 },
    { name: "Beto", pos: "ST", age: 25, nat: "POR", ovr: 78, pot: 83 },
    { name: "Jack Harrison", pos: "LW", age: 27, nat: "ENG", ovr: 78, pot: 79 },
    { name: "Ashley Young", pos: "LB", age: 38, nat: "ENG", ovr: 71, pot: 71 },
  ],
  brentford: [
    { name: "Mark Flekken", pos: "GK", age: 30, nat: "NED", ovr: 80, pot: 82 },
    { name: "Aaron Hickey", pos: "RB", age: 22, nat: "SCO", ovr: 78, pot: 84 },
    { name: "Ethan Pinnock", pos: "CB", age: 30, nat: "JAM", ovr: 79, pot: 80 },
    { name: "Kristoffer Ajer", pos: "CB", age: 26, nat: "NOR", ovr: 79, pot: 81 },
    { name: "Ben Mee", pos: "CB", age: 34, nat: "ENG", ovr: 77, pot: 77 },
    { name: "Christian Norgaard", pos: "CDM", age: 30, nat: "DEN", ovr: 79, pot: 80 },
    { name: "Mathias Jensen", pos: "CM", age: 27, nat: "DEN", ovr: 79, pot: 81 },
    { name: "Mikkel Damsgaard", pos: "CM", age: 24, nat: "DEN", ovr: 79, pot: 83 },
    { name: "Bryan Mbeumo", pos: "RW", age: 24, nat: "CMR", ovr: 83, pot: 87 },
    { name: "Kevin Schade", pos: "LW", age: 22, nat: "GER", ovr: 77, pot: 83 },
    { name: "Keane Lewis-Potter", pos: "LW", age: 23, nat: "ENG", ovr: 75, pot: 81 },
    { name: "Yoane Wissa", pos: "ST", age: 27, nat: "COD", ovr: 81, pot: 83 },
    { name: "Ivan Toney", pos: "ST", age: 28, nat: "ENG", ovr: 82, pot: 83 },
  ],
  bournemouth: [
    { name: "Neto", pos: "GK", age: 34, nat: "BRA", ovr: 78, pot: 78 },
    { name: "Adam Smith", pos: "RB", age: 32, nat: "ENG", ovr: 74, pot: 74 },
    { name: "Marcos Senesi", pos: "CB", age: 27, nat: "ARG", ovr: 78, pot: 81 },
    { name: "James Hill", pos: "CB", age: 23, nat: "ENG", ovr: 74, pot: 79 },
    { name: "Milos Kerkez", pos: "LB", age: 21, nat: "HUN", ovr: 77, pot: 85 },
    { name: "Tyler Adams", pos: "CDM", age: 25, nat: "USA", ovr: 79, pot: 83 },
    { name: "Philip Billing", pos: "CM", age: 28, nat: "DEN", ovr: 78, pot: 79 },
    { name: "Ryan Christie", pos: "CM", age: 29, nat: "SCO", ovr: 77, pot: 78 },
    { name: "Antoine Semenyo", pos: "RW", age: 24, nat: "GHA", ovr: 79, pot: 83 },
    { name: "Dango Ouattara", pos: "RW", age: 22, nat: "BFA", ovr: 78, pot: 84 },
    { name: "Justin Kluivert", pos: "LW", age: 25, nat: "NED", ovr: 80, pot: 82 },
    { name: "Evanilson", pos: "ST", age: 25, nat: "BRA", ovr: 79, pot: 84 },
  ],
  nforest: [
    { name: "Matz Sels", pos: "GK", age: 32, nat: "BEL", ovr: 79, pot: 79 },
    { name: "Neco Williams", pos: "RB", age: 23, nat: "WAL", ovr: 77, pot: 82 },
    { name: "Murillo", pos: "CB", age: 21, nat: "BRA", ovr: 81, pot: 88 },
    { name: "Nikola Milenkovic", pos: "CB", age: 26, nat: "SRB", ovr: 80, pot: 82 },
    { name: "Ola Aina", pos: "LB", age: 27, nat: "NGA", ovr: 78, pot: 79 },
    { name: "Ibrahim Sangare", pos: "CDM", age: 26, nat: "CIV", ovr: 82, pot: 84 },
    { name: "Ryan Yates", pos: "CM", age: 26, nat: "ENG", ovr: 76, pot: 79 },
    { name: "Nicolas Dominguez", pos: "CM", age: 25, nat: "ARG", ovr: 76, pot: 80 },
    { name: "Morgan Gibbs-White", pos: "CAM", age: 24, nat: "ENG", ovr: 82, pot: 86 },
    { name: "Callum Hudson-Odoi", pos: "LW", age: 23, nat: "ENG", ovr: 79, pot: 83 },
    { name: "Anthony Elanga", pos: "LW", age: 22, nat: "SWE", ovr: 77, pot: 83 },
    { name: "Taiwo Awoniyi", pos: "ST", age: 26, nat: "NGA", ovr: 77, pot: 80 },
    { name: "Chris Wood", pos: "ST", age: 32, nat: "NZL", ovr: 78, pot: 78 },
  ],
  wolves: [
    { name: "Jose Sa", pos: "GK", age: 31, nat: "POR", ovr: 80, pot: 81 },
    { name: "Nelson Semedo", pos: "RB", age: 30, nat: "POR", ovr: 80, pot: 80 },
    { name: "Matt Doherty", pos: "RB", age: 32, nat: "IRL", ovr: 78, pot: 78 },
    { name: "Santiago Bueno", pos: "CB", age: 25, nat: "URU", ovr: 77, pot: 81 },
    { name: "Craig Dawson", pos: "CB", age: 34, nat: "ENG", ovr: 76, pot: 76 },
    { name: "Rayan Ait-Nouri", pos: "LB", age: 23, nat: "FRA", ovr: 80, pot: 85 },
    { name: "Joao Gomes", pos: "CDM", age: 23, nat: "BRA", ovr: 81, pot: 85 },
    { name: "Mario Lemina", pos: "CDM", age: 30, nat: "GAB", ovr: 79, pot: 80 },
    { name: "Tommy Doyle", pos: "CM", age: 22, nat: "ENG", ovr: 75, pot: 81 },
    { name: "Pablo Sarabia", pos: "RW", age: 32, nat: "ESP", ovr: 79, pot: 79 },
    { name: "Hwang Hee-chan", pos: "RW", age: 28, nat: "KOR", ovr: 79, pot: 80 },
    { name: "Matheus Cunha", pos: "ST", age: 25, nat: "BRA", ovr: 82, pot: 86 },
    { name: "Daniel Podence", pos: "RW", age: 28, nat: "POR", ovr: 78, pot: 79 },
  ],
  southampton: [
    { name: "Gavin Bazunu", pos: "GK", age: 22, nat: "IRL", ovr: 77, pot: 83 },
    { name: "Jan Bednarek", pos: "CB", age: 28, nat: "POL", ovr: 78, pot: 79 },
    { name: "Taylor Harwood-Bellis", pos: "CB", age: 22, nat: "ENG", ovr: 77, pot: 83 },
    { name: "Kyle Walker-Peters", pos: "RB", age: 27, nat: "ENG", ovr: 78, pot: 80 },
    { name: "Liam Delap", pos: "ST", age: 21, nat: "ENG", ovr: 79, pot: 85 },
    { name: "Cameron Archer", pos: "ST", age: 22, nat: "ENG", ovr: 74, pot: 80 },
  ],
  leicester: [
    { name: "Mads Hermansen", pos: "GK", age: 24, nat: "DEN", ovr: 76, pot: 83 },
    { name: "Victor Kristiansen", pos: "LB", age: 22, nat: "DEN", ovr: 77, pot: 84 },
    { name: "Caleb Okoli", pos: "CB", age: 22, nat: "ITA", ovr: 76, pot: 82 },
    { name: "James Justin", pos: "RB", age: 26, nat: "ENG", ovr: 78, pot: 81 },
    { name: "Wilfred Ndidi", pos: "CDM", age: 27, nat: "NGA", ovr: 81, pot: 82 },
    { name: "Boubakary Soumare", pos: "CM", age: 25, nat: "FRA", ovr: 79, pot: 82 },
    { name: "Stephy Mavididi", pos: "LW", age: 26, nat: "ENG", ovr: 78, pot: 81 },
    { name: "Jamie Vardy", pos: "ST", age: 37, nat: "ENG", ovr: 74, pot: 74 },
    { name: "Harry Winks", pos: "CM", age: 28, nat: "ENG", ovr: 78, pot: 79 },
  ],
  ipswich: [
    { name: "Arijanet Muric", pos: "GK", age: 25, nat: "KOS", ovr: 75, pot: 80 },
    { name: "Leif Davis", pos: "LB", age: 24, nat: "ENG", ovr: 76, pot: 80 },
    { name: "Axel Tuanzebe", pos: "CB", age: 27, nat: "ENG", ovr: 74, pot: 76 },
    { name: "Omari Hutchinson", pos: "RW", age: 20, nat: "ENG", ovr: 76, pot: 83 },
    { name: "Sammie Szmodics", pos: "RW", age: 29, nat: "IRL", ovr: 78, pot: 79 },
    { name: "George Hirst", pos: "ST", age: 26, nat: "ENG", ovr: 74, pot: 77 },
  ],

  realmadrid: [
    { name: "Thibaut Courtois", pos: "GK", age: 32, nat: "BEL", ovr: 90, pot: 90 },
    { name: "Andriy Lunin", pos: "GK", age: 25, nat: "UKR", ovr: 82, pot: 85 },
    { name: "Dani Carvajal", pos: "RB", age: 32, nat: "ESP", ovr: 86, pot: 86 },
    { name: "Lucas Vazquez", pos: "RB", age: 32, nat: "ESP", ovr: 79, pot: 79 },
    { name: "Eder Militao", pos: "CB", age: 26, nat: "BRA", ovr: 86, pot: 89 },
    { name: "Antonio Rudiger", pos: "CB", age: 31, nat: "GER", ovr: 85, pot: 85 },
    { name: "David Alaba", pos: "CB", age: 32, nat: "AUT", ovr: 85, pot: 85 },
    { name: "Nacho", pos: "CB", age: 34, nat: "ESP", ovr: 80, pot: 80 },
    { name: "Ferland Mendy", pos: "LB", age: 29, nat: "FRA", ovr: 83, pot: 84 },
    { name: "Aurelien Tchouameni", pos: "CDM", age: 24, nat: "FRA", ovr: 84, pot: 88 },
    { name: "Luka Modric", pos: "CM", age: 38, nat: "CRO", ovr: 86, pot: 86 },
    { name: "Federico Valverde", pos: "CM", age: 26, nat: "URU", ovr: 86, pot: 89 },
    { name: "Eduardo Camavinga", pos: "CM", age: 21, nat: "FRA", ovr: 84, pot: 91 },
    { name: "Jude Bellingham", pos: "CAM", age: 21, nat: "ENG", ovr: 90, pot: 96 },
    { name: "Brahim Diaz", pos: "RW", age: 24, nat: "ESP", ovr: 80, pot: 84 },
    { name: "Vinicius Jr", pos: "LW", age: 24, nat: "BRA", ovr: 90, pot: 94 },
    { name: "Kylian Mbappe", pos: "ST", age: 25, nat: "FRA", ovr: 91, pot: 94 },
    { name: "Rodrygo Goes", pos: "RW", age: 23, nat: "BRA", ovr: 83, pot: 88 },
    { name: "Endrick", pos: "ST", age: 18, nat: "BRA", ovr: 76, pot: 92 },
  ],
  barcelona: [
    { name: "Marc-Andre ter Stegen", pos: "GK", age: 32, nat: "GER", ovr: 87, pot: 87 },
    { name: "Inaki Pena", pos: "GK", age: 25, nat: "ESP", ovr: 76, pot: 81 },
    { name: "Jules Kounde", pos: "RB", age: 25, nat: "FRA", ovr: 84, pot: 87 },
    { name: "Ronald Araujo", pos: "CB", age: 25, nat: "URU", ovr: 85, pot: 88 },
    { name: "Inigo Martinez", pos: "CB", age: 33, nat: "ESP", ovr: 82, pot: 82 },
    { name: "Andreas Christensen", pos: "CB", age: 28, nat: "DEN", ovr: 82, pot: 83 },
    { name: "Eric Garcia", pos: "CB", age: 23, nat: "ESP", ovr: 79, pot: 82 },
    { name: "Pau Cubarsi", pos: "CB", age: 17, nat: "ESP", ovr: 80, pot: 94, homegrown: true },
    { name: "Alejandro Balde", pos: "LB", age: 20, nat: "ESP", ovr: 82, pot: 90 },
    { name: "Frenkie de Jong", pos: "CM", age: 27, nat: "NED", ovr: 85, pot: 87 },
    { name: "Pedri", pos: "CM", age: 22, nat: "ESP", ovr: 87, pot: 93 },
    { name: "Gavi", pos: "CM", age: 20, nat: "ESP", ovr: 86, pot: 92 },
    { name: "Dani Olmo", pos: "CAM", age: 26, nat: "ESP", ovr: 84, pot: 87 },
    { name: "Lamine Yamal", pos: "RW", age: 17, nat: "ESP", ovr: 82, pot: 95 },
    { name: "Raphinha", pos: "RW", age: 27, nat: "BRA", ovr: 86, pot: 87 },
    { name: "Ferran Torres", pos: "LW", age: 24, nat: "ESP", ovr: 80, pot: 83 },
    { name: "Ansu Fati", pos: "LW", age: 22, nat: "ESP", ovr: 78, pot: 87 },
    { name: "Robert Lewandowski", pos: "ST", age: 36, nat: "POL", ovr: 88, pot: 88 },
    { name: "Vitor Roque", pos: "ST", age: 18, nat: "BRA", ovr: 72, pot: 88 },
  ],
  atletico: [
    { name: "Jan Oblak", pos: "GK", age: 31, nat: "SVN", ovr: 87, pot: 87 },
    { name: "Nahuel Molina", pos: "RB", age: 26, nat: "ARG", ovr: 81, pot: 83 },
    { name: "Jose Gimenez", pos: "CB", age: 29, nat: "URU", ovr: 84, pot: 84 },
    { name: "Robin Le Normand", pos: "CB", age: 27, nat: "ESP", ovr: 82, pot: 84 },
    { name: "Reinildo", pos: "LB", age: 30, nat: "MOZ", ovr: 79, pot: 80 },
    { name: "Axel Witsel", pos: "CDM", age: 35, nat: "BEL", ovr: 78, pot: 78 },
    { name: "Koke", pos: "CM", age: 32, nat: "ESP", ovr: 81, pot: 81 },
    { name: "Saul Niguez", pos: "CDM", age: 29, nat: "ESP", ovr: 80, pot: 80 },
    { name: "Pablo Barrios", pos: "CDM", age: 20, nat: "ESP", ovr: 76, pot: 85 },
    { name: "Conor Gallagher", pos: "CM", age: 24, nat: "ENG", ovr: 81, pot: 84 },
    { name: "Thomas Lemar", pos: "LW", age: 28, nat: "FRA", ovr: 80, pot: 81 },
    { name: "Samuel Lino", pos: "LW", age: 24, nat: "POR", ovr: 79, pot: 84 },
    { name: "Angel Correa", pos: "RW", age: 29, nat: "ARG", ovr: 79, pot: 80 },
    { name: "Antoine Griezmann", pos: "CAM", age: 33, nat: "FRA", ovr: 88, pot: 88 },
    { name: "Julian Alvarez", pos: "ST", age: 24, nat: "ARG", ovr: 86, pot: 91 },
    { name: "Alvaro Morata", pos: "ST", age: 31, nat: "ESP", ovr: 82, pot: 82 },
  ],
  athletic: [
    { name: "Unai Simon", pos: "GK", age: 27, nat: "ESP", ovr: 82, pot: 85 },
    { name: "Oscar de Marcos", pos: "RB", age: 35, nat: "ESP", ovr: 75, pot: 75 },
    { name: "Dani Vivian", pos: "CB", age: 24, nat: "ESP", ovr: 80, pot: 84 },
    { name: "Yeray Alvarez", pos: "CB", age: 29, nat: "ESP", ovr: 79, pot: 80 },
    { name: "Yuri Berchiche", pos: "LB", age: 33, nat: "ESP", ovr: 78, pot: 78 },
    { name: "Mikel Vesga", pos: "CDM", age: 30, nat: "ESP", ovr: 77, pot: 77 },
    { name: "Oihan Sancet", pos: "CAM", age: 23, nat: "ESP", ovr: 80, pot: 85 },
    { name: "Mikel Jauregizar", pos: "CM", age: 24, nat: "ESP", ovr: 74, pot: 80 },
    { name: "Alex Berenguer", pos: "RW", age: 29, nat: "ESP", ovr: 78, pot: 79 },
    { name: "Nico Williams", pos: "LW", age: 22, nat: "ESP", ovr: 84, pot: 90 },
    { name: "Inaki Williams", pos: "ST", age: 30, nat: "GHA", ovr: 82, pot: 83 },
    { name: "Gorka Guruzeta", pos: "ST", age: 27, nat: "ESP", ovr: 79, pot: 82 },
    { name: "Unai Gomez", pos: "ST", age: 22, nat: "ESP", ovr: 74, pot: 82 },
  ],
  realsociedad: [
    { name: "Alex Remiro", pos: "GK", age: 29, nat: "ESP", ovr: 82, pot: 84 },
    { name: "Joseba Zaldua", pos: "RB", age: 31, nat: "ESP", ovr: 75, pot: 75 },
    { name: "Aritz Elustondo", pos: "CB", age: 33, nat: "ESP", ovr: 76, pot: 76 },
    { name: "Jon Pacheco", pos: "CB", age: 23, nat: "ESP", ovr: 74, pot: 81 },
    { name: "Aihen Munoz", pos: "LB", age: 26, nat: "ESP", ovr: 76, pot: 79 },
    { name: "Martin Zubimendi", pos: "CDM", age: 25, nat: "ESP", ovr: 83, pot: 87 },
    { name: "Mikel Merino", pos: "CM", age: 28, nat: "ESP", ovr: 83, pot: 85 },
    { name: "Brais Mendez", pos: "CM", age: 27, nat: "ESP", ovr: 80, pot: 82 },
    { name: "Takefusa Kubo", pos: "RW", age: 23, nat: "JPN", ovr: 82, pot: 87 },
    { name: "Sheraldo Becker", pos: "RW", age: 29, nat: "SUR", ovr: 78, pot: 79 },
    { name: "Mikel Oyarzabal", pos: "LW", age: 27, nat: "ESP", ovr: 83, pot: 85 },
    { name: "Andre Silva", pos: "ST", age: 29, nat: "POR", ovr: 79, pot: 80 },
    { name: "Jon Karrikaburu", pos: "ST", age: 20, nat: "ESP", ovr: 72, pot: 83 },
  ],
  realbetis: [
    { name: "Rui Silva", pos: "GK", age: 32, nat: "POR", ovr: 79, pot: 79 },
    { name: "Youssouf Sabaly", pos: "RB", age: 30, nat: "SEN", ovr: 78, pot: 78 },
    { name: "Natan", pos: "CB", age: 22, nat: "BRA", ovr: 75, pot: 82 },
    { name: "German Pezzella", pos: "CB", age: 33, nat: "ARG", ovr: 79, pot: 79 },
    { name: "Adria Pedrosa", pos: "LB", age: 26, nat: "ESP", ovr: 77, pot: 80 },
    { name: "Juan Miranda", pos: "LB", age: 24, nat: "ESP", ovr: 76, pot: 81 },
    { name: "Guido Rodriguez", pos: "CDM", age: 30, nat: "ARG", ovr: 80, pot: 81 },
    { name: "Lo Celso", pos: "CM", age: 28, nat: "ARG", ovr: 80, pot: 82 },
    { name: "Sergio Canales", pos: "CM", age: 33, nat: "ESP", ovr: 79, pot: 79 },
    { name: "Isco", pos: "CAM", age: 32, nat: "ESP", ovr: 81, pot: 81 },
    { name: "Abde Ezzalzouli", pos: "LW", age: 22, nat: "MAR", ovr: 77, pot: 83 },
    { name: "Ayoze Perez", pos: "RW", age: 31, nat: "ESP", ovr: 77, pot: 77 },
    { name: "Borja Iglesias", pos: "ST", age: 31, nat: "ESP", ovr: 78, pot: 78 },
    { name: "Willian Jose", pos: "ST", age: 33, nat: "BRA", ovr: 77, pot: 77 },
  ],
  villarreal: [
    { name: "Diego Conde", pos: "GK", age: 24, nat: "ESP", ovr: 76, pot: 82 },
    { name: "Juan Foyth", pos: "RB", age: 26, nat: "ARG", ovr: 80, pot: 82 },
    { name: "Eric Bailly", pos: "CB", age: 30, nat: "CIV", ovr: 79, pot: 79 },
    { name: "Ramiro Funes Mori", pos: "CB", age: 33, nat: "ARG", ovr: 78, pot: 78 },
    { name: "Alfonso Pedraza", pos: "LB", age: 27, nat: "ESP", ovr: 78, pot: 80 },
    { name: "Denis Suarez", pos: "CDM", age: 30, nat: "ESP", ovr: 76, pot: 76 },
    { name: "Dani Parejo", pos: "CM", age: 35, nat: "ESP", ovr: 81, pot: 81 },
    { name: "Alex Baena", pos: "CAM", age: 23, nat: "ESP", ovr: 79, pot: 85 },
    { name: "Yeremy Pino", pos: "RW", age: 21, nat: "ESP", ovr: 80, pot: 86 },
    { name: "Arnaut Danjuma", pos: "LW", age: 27, nat: "NED", ovr: 80, pot: 82 },
    { name: "Gerard Moreno", pos: "ST", age: 32, nat: "ESP", ovr: 82, pot: 82 },
    { name: "Ilias Akhomach", pos: "LW", age: 19, nat: "ESP", ovr: 72, pot: 84 },
  ],
  sevilla: [
    { name: "Yassine Bounou", pos: "GK", age: 33, nat: "MAR", ovr: 83, pot: 83 },
    { name: "Jesus Navas", pos: "RB", age: 38, nat: "ESP", ovr: 73, pot: 73 },
    { name: "Loic Bade", pos: "CB", age: 24, nat: "FRA", ovr: 80, pot: 84 },
    { name: "Sergio Ramos", pos: "CB", age: 38, nat: "ESP", ovr: 78, pot: 78 },
    { name: "Marcos Acuna", pos: "LB", age: 32, nat: "ARG", ovr: 79, pot: 79 },
    { name: "Nemanja Gudelj", pos: "CDM", age: 32, nat: "SRB", ovr: 78, pot: 78 },
    { name: "Joan Jordan", pos: "CM", age: 29, nat: "ESP", ovr: 76, pot: 77 },
    { name: "Oliver Torres", pos: "CM", age: 29, nat: "ESP", ovr: 76, pot: 77 },
    { name: "Lucas Ocampos", pos: "RW", age: 30, nat: "ARG", ovr: 80, pot: 80 },
    { name: "Suso", pos: "RW", age: 30, nat: "ESP", ovr: 77, pot: 77 },
    { name: "Yousseff En-Nesyri", pos: "ST", age: 27, nat: "MAR", ovr: 80, pot: 82 },
  ],
};

function squadFor(team) {
  const named = (NAMED[team.id] || []).map((tuple) => buildPlayer(team, tuple));
  return fillSquad(team, named, 24);
}

export const players = teams.flatMap((team) => squadFor(team));

export function playersByTeam(teamId) {
  return players.filter((p) => p.teamId === teamId);
}

export function playerById(id) {
  return players.find((p) => p.id === id) || null;
}
