// Selección Nacional: un modo secundario dentro de Modo DT, no una segunda
// carrera aparte. Aparece como una oferta ocasional (ventana FIFA) si tu
// prestige de DT es alto, y se resuelve con su propio simulador liviano —
// no toca el motor de partidos de club (matchEngine.js) para nada.
export const INTERNATIONAL_WINDOW_WEEKS = [4, 12, 20, 28];
export const NATIONAL_TEAM_PRESTIGE_MIN = 60;

export function countryForLeague(league) {
  if (league === "premier") return "Inglaterra";
  if (league === "laliga") return "España";
  return "tu país";
}

function poisson(lambda) {
  const l = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}

const RIVAL_NATIONS = [
  "Alemania", "Francia", "Brasil", "Argentina", "Países Bajos",
  "Portugal", "Italia", "Croacia", "Uruguay", "Bélgica",
];

function rivalNationName() {
  return RIVAL_NATIONS[Math.floor(Math.random() * RIVAL_NATIONS.length)];
}

// Abstrae la selección como "nivel del combinado bajo tu mando" — no hay un
// plantel de jugadores de selección real en esta app, así que se deriva del
// prestige del DT (mismo espíritu que el resto del juego: pocas variables,
// resultado creíble).
export function simulateNationalMatch(managerPrestige) {
  const myLevel = 65 + ((managerPrestige ?? 50) - 50) * 0.3;
  const rivalLevel = 60 + Math.random() * 25;
  const myGoals = poisson(Math.max(0.4, (myLevel - rivalLevel) / 12 + 1.3));
  const rivalGoals = poisson(Math.max(0.3, (rivalLevel - myLevel) / 14 + 1.1));
  return { myGoals, rivalGoals, rivalName: rivalNationName() };
}
