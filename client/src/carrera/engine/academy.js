import { attributesFor } from "../data/players.js";

// Sistema de inferiores: contratás agentes (mismos 3 tipos que en Scouting)
// y los mandás a recorrer un país. Cada 4 semanas ese agente te trae ~7
// chicos nuevos con OVR/potencial ya tasados — no hace falta scoutearlos,
// el agente ya te dice lo que encontró (con el mismo sesgo por especialidad
// que en Scouting: el especialista en OVR trae chicos más hechos pero con
// menos techo, el de potencial trae joyas en bruto, el generalista de los
// dos un poco de cada uno).
export const MAX_ACADEMY_AGENTS = 3;
export const ACADEMY_BATCH_SIZE = 7;
export const ACADEMY_INTERVAL_WEEKS = 4;
export const ACADEMY_SPECIALTY_GAP = 10;

export const ACADEMY_COUNTRIES = [
  "España", "Argentina", "Brasil", "Francia", "Inglaterra", "Portugal",
  "Países Bajos", "Alemania", "Italia", "Uruguay", "Colombia", "Croacia", "Bélgica",
];

const NAT_BY_COUNTRY = {
  "España": "ESP", "Argentina": "ARG", "Brasil": "BRA", "Francia": "FRA",
  "Inglaterra": "ENG", "Portugal": "POR", "Países Bajos": "NED", "Alemania": "GER",
  "Italia": "ITA", "Uruguay": "URU", "Colombia": "COL", "Croacia": "CRO", "Bélgica": "BEL",
};

const FIRST_BY_NAT = {
  ESP: ["Iker", "Pau", "Marc", "Nico", "Hugo", "Adrián"], ARG: ["Franco", "Thiago", "Valentín", "Bautista"],
  BRA: ["Kaique", "Gabriel", "Lucas", "Matheus"], FRA: ["Malo", "Enzo", "Nathan", "Yanis"],
  ENG: ["Archie", "Freddie", "Alfie", "Leo"], POR: ["Rafael", "Duarte", "Gonçalo", "Afonso"],
  NED: ["Sven", "Daan", "Bram", "Milan"], GER: ["Finn", "Luca", "Noah", "Elias"],
  ITA: ["Gianluca", "Samuele", "Pietro", "Cristian"], URU: ["Facundo", "Agustín", "Bruno", "Nahuel"],
  COL: ["Santiago", "Juan José", "Kevin", "Yeison"], CRO: ["Luka", "Josip", "Ante", "Marko"],
  BEL: ["Loïc", "Thibo", "Amir", "Noa"],
};
const LAST_BY_NAT = {
  ESP: ["Ferrán", "Roig", "Camps", "Solé"], ARG: ["Ibarra", "Coria", "Funes", "Ledesma"],
  BRA: ["Souza", "Pereira", "Lima", "Farias"], FRA: ["Girard", "Fontaine", "Rousseau", "Perrin"],
  ENG: ["Barlow", "Cotton", "Higgs", "Wren"], POR: ["Cardoso", "Neves", "Teixeira", "Lopes"],
  NED: ["de Boer", "Bakker", "Visser", "Mulder"], GER: ["Richter", "Neumann", "Schwarz", "Vogt"],
  ITA: ["Esposito", "Romano", "Ferrari", "Colombo"], URU: ["Silveira", "Techera", "Recoba", "Pintos"],
  COL: ["Muriel", "Zapata", "Restrepo", "Cárdenas"], CRO: ["Kramarić", "Vrsaljko", "Pašalić", "Šimić"],
  BEL: ["Van Damme", "Peeters", "Willems", "Maes"],
};

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function youthName(nat) {
  const first = FIRST_BY_NAT[nat] || FIRST_BY_NAT.ESP;
  const last = LAST_BY_NAT[nat] || LAST_BY_NAT.ESP;
  return `${pick(first)} ${pick(last)}`;
}

export function countryNationality(country) {
  return NAT_BY_COUNTRY[country] || "ESP";
}

function costRangeFor(specialty) {
  return specialty === "both" ? [15, 15] : [5, 7];
}

export function rollAcademyCost(specialty) {
  const [lo, hi] = costRangeFor(specialty);
  return lo === hi ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Arma el lote mensual que trae un agente de inferiores. `seedKey` sólo se
// usa para generar ids únicos y estables dentro del lote.
export function generateAcademyBatch(agent, week, seedKey) {
  const nat = countryNationality(agent.country);
  const out = [];
  for (let i = 0; i < ACADEMY_BATCH_SIZE; i++) {
    const age = rnd(15, 18);
    let ovr = rnd(52, 64);
    let potential = clamp(ovr + rnd(15, 28), ovr, 99);

    if (agent.specialty === "ovr") {
      ovr = clamp(ovr + rnd(4, 8), 45, 75);
      potential = clamp(potential - ACADEMY_SPECIALTY_GAP, ovr, 99);
    } else if (agent.specialty === "potential") {
      potential = clamp(potential + ACADEMY_SPECIALTY_GAP, ovr, 99);
    }

    const position = pick(POSITIONS);
    out.push({
      id: `academy_${agent.id}_${week}_${seedKey}_${i}`,
      name: youthName(nat),
      age,
      position,
      nationality: nat,
      ovr,
      potential,
      value: 0,
      wage: 1,
      contractYears: 3,
      isYouth: true,
      isAcademyProspect: true,
      foundByAgentId: agent.id,
      foundWeek: week,
      country: agent.country,
      attributes: attributesFor(position, ovr),
    });
  }
  return out;
}
