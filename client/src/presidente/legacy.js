import { ACHIEVEMENTS } from "./engine.js";

// Resumen de la gestión de un presidente al retirarse — mismo espíritu que
// el "legado" de Carrera DT (ver client/src/carrera/utils/legacy.js), pero
// con las métricas propias de este modo (plata, estadio, objetivos de la
// directiva, socios, elecciones y logros) en vez de posiciones jugadas
// cancha adentro.
export function buildPresidenteLegacy(state) {
  const seasons = state.history || [];
  const objectivesMet = seasons.filter((s) => s.objectiveMet).length;
  const best = seasons.reduce((min, s) => (s.position < (min?.position ?? Infinity) ? s : min), null);
  const achievements = (state.achievements || []).length;
  const legacyScore =
    (state.titlesWon || 0) * 100
    + objectivesMet * 40
    + seasons.length * 10
    + state.stadiumTier * 15
    + achievements * 20
    + (state.electionsWon || 0) * 30
    + Math.round((state.prestige || 0) / 5);
  return {
    teamName: state.teamName,
    seasonsCount: seasons.length,
    titlesWon: state.titlesWon || 0,
    objectivesMet,
    best,
    finalStadiumTier: state.stadiumTier,
    finalBudget: state.budget,
    achievements,
    achievementsTotal: ACHIEVEMENTS.length,
    electionsWon: state.electionsWon || 0,
    prestige: state.prestige || 0,
    members: state.members || 0,
    legacyScore,
  };
}
