// Simulación liviana de partidos para la Liga Online DT: no hay planteles
// individuales acá (eso es todo el modo Carrera single-player, que vive en
// el cliente), así que cada club se resuelve por su "jerarquía" (tier) +
// la táctica que haya elegido su DT humano. El cálculo de goles en sí
// (Poisson + factor de forma del día) vive en match-engine.js, compartido
// con el resto de los juegos — acá solo se calcula el OVR efectivo de cada
// lado a partir del tier y la táctica.
import { clamp, simulateMatchScore, simulateMatchEvents } from "./match-engine.js";

function tierToOvr(tier) {
  return tier === 1 ? 84 : tier === 2 ? 77 : 70;
}

// Puntos semanales hacia el ranking general del grupo, ajustados por la
// diferencia de nivel entre los dos clubes — no todos parten del mismo
// objetivo: el Barça (tier 1) y la Real Sociedad (tier 2) no valen lo mismo
// si ganan o pierden. Ganarle a un club más grande vale mucho más que
// cumplir con lo esperado, y un club grande que pierde contra uno chico
// resta en vez de simplemente no sumar.
const DT_TIER_WEIGHT = { 1: 3, 2: 2, 3: 1 };

export function dtWeeklyPoints(myTier, oppTier, outcome) {
  const myWeight = DT_TIER_WEIGHT[myTier] ?? 2;
  const oppWeight = DT_TIER_WEIGHT[oppTier] ?? 2;
  const gap = oppWeight - myWeight; // positivo = el rival era más grande que vos

  if (outcome === "win") return 10 + Math.max(0, gap) * 8;
  if (outcome === "draw") return 4 + Math.max(0, gap) * 3;
  // loss: perder contra uno más chico resta (gap negativo), perder contra
  // uno más grande no penaliza — era lo esperable.
  return gap < 0 ? gap * 4 : 0;
}

export function dtOutcomeFor(myGoals, oppGoals) {
  if (myGoals > oppGoals) return "win";
  if (myGoals < oppGoals) return "loss";
  return "draw";
}

// tactics: { mentality: 1-5, pressing: 0-100, tempo: 0-100 } o null (default).
function effectiveRating(tier, tactics) {
  const base = tierToOvr(tier);
  if (!tactics) return base;
  const mentalityMod = (tactics.mentality - 3) * 1.2;
  const pressMod = ((tactics.pressing ?? 50) - 50) / 100 * 2;
  const tempoMod = ((tactics.tempo ?? 50) - 50) / 100 * 1.5;
  return base + mentalityMod + pressMod + tempoMod;
}

// Versión "en vivo" de simulateFixture: usa EXACTAMENTE la misma distribución
// de goles (motor compartido, mismo nivel+táctica) para no desbalancear el
// resultado — lo único que cambia es que a cada gol se le asigna un minuto
// al azar, para poder reproducir el partido en tiempo real entre los dos DTs
// conectados en vez de tirar el marcador final de una.
export function simulateFixtureEvents({ homeTier, awayTier, homeTactics, awayTactics }) {
  const ovrHome = effectiveRating(homeTier, homeTactics);
  const ovrAway = effectiveRating(awayTier, awayTactics);
  return simulateMatchEvents({ ovrHome, ovrAway, homeAdvantage: 2.2 });
}

export function simulateFixture({ homeTier, awayTier, homeTactics, awayTactics }) {
  const ovrHome = effectiveRating(homeTier, homeTactics);
  const ovrAway = effectiveRating(awayTier, awayTactics);
  return simulateMatchScore({ ovrHome, ovrAway, homeAdvantage: 2.2 });
}

// Doble round-robin (ida y vuelta): cada entrada de la lista devuelta es una
// semana, con pares [homeTeamId, awayTeamId]. Si hay número impar de equipos
// se agrega un "bye" (null) que se descarta al armar la fixture real.
export function generateRoundRobin(teamIds) {
  const ids = teamIds.slice();
  if (ids.length % 2 !== 0) ids.push(null);
  const n = ids.length;
  const half = n / 2;
  const rounds = [];
  let arr = ids.slice();

  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== null && b !== null) round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }

  const second = rounds.map((round) => round.map(([a, b]) => [b, a]));
  return [...rounds, ...second];
}
