// Penalización por jugar fuera de posición: un lateral no rinde igual de
// central, aunque "sepa defender". Familias cercanas duelen poco; posiciones
// totalmente ajenas (o el arco) duelen mucho.
const NEAR = {
  GK: [],
  CB: ["CDM"],
  LB: ["RB", "CM"],
  RB: ["LB", "CM"],
  CDM: ["CB", "CM"],
  CM: ["CDM", "CAM", "LB", "RB"],
  CAM: ["CM", "LW", "RW"],
  LW: ["RW", "CAM", "ST"],
  RW: ["LW", "CAM", "ST"],
  ST: ["LW", "RW"],
};

export function positionPenalty(naturalPos, slotPos) {
  if (!slotPos || !naturalPos || naturalPos === slotPos) return 0;
  if (naturalPos === "GK" || slotPos === "GK") return 35;
  if ((NEAR[naturalPos] || []).includes(slotPos)) return 6;
  return 14;
}

export function effectiveOvr(player, slotPos) {
  const penalty = positionPenalty(player.position, slotPos);
  return Math.max(30, player.ovr - penalty);
}

export function positionLabel(penalty) {
  if (penalty === 0) return null;
  if (penalty <= 6) return { text: "Posición secundaria", tone: "warn" };
  if (penalty <= 14) return { text: "Fuera de posición", tone: "bad" };
  return { text: "Posición imposible", tone: "critical" };
}

export const ALL_POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

// Reconversión de posición: a diferencia de la penalización de partido (arriba),
// esto mide qué tan sensato es un cambio DEFINITIVO de puesto después de
// entrenarlo unas semanas. Un extremo que se reconvierte a mediocampista
// ofensivo es un cambio lógico (mantiene o mejora); ese mismo extremo de
// central es un disparate (baja el rendimiento).
export const TRAINING_WEEKS = 6;

const TRAINING_TIER = {
  GK: { GK: "same" },
  CB: { CB: "same", CDM: "high", LB: "med", RB: "med", CM: "med", GK: "low", LW: "low", RW: "low", CAM: "low", ST: "low" },
  LB: { LB: "same", RB: "high", CB: "med", CM: "med", LW: "med", CDM: "low", CAM: "low", RW: "low", ST: "low", GK: "low" },
  RB: { RB: "same", LB: "high", CB: "med", CM: "med", RW: "med", CDM: "low", CAM: "low", LW: "low", ST: "low", GK: "low" },
  CDM: { CDM: "same", CB: "high", CM: "high", CAM: "med", LB: "med", RB: "med", LW: "low", RW: "low", ST: "low", GK: "low" },
  CM: { CM: "same", CDM: "high", CAM: "high", LB: "med", RB: "med", LW: "med", RW: "med", CB: "med", ST: "low", GK: "low" },
  CAM: { CAM: "same", CM: "high", LW: "high", RW: "high", ST: "med", CDM: "med", CB: "low", LB: "low", RB: "low", GK: "low" },
  LW: { LW: "same", RW: "high", CAM: "high", ST: "med", CM: "med", CDM: "low", CB: "low", LB: "med", RB: "low", GK: "low" },
  RW: { RW: "same", LW: "high", CAM: "high", ST: "med", CM: "med", CDM: "low", CB: "low", RB: "med", LB: "low", GK: "low" },
  ST: { ST: "same", LW: "med", RW: "med", CAM: "med", CM: "low", CDM: "low", CB: "low", LB: "low", RB: "low", GK: "low" },
};

export function trainingTier(fromPos, toPos) {
  if (!fromPos || !toPos || fromPos === toPos) return "same";
  return TRAINING_TIER[fromPos]?.[toPos] || "low";
}

export function trainingTierLabel(tier) {
  if (tier === "high") return { text: "Recomendado — mantiene o mejora", tone: "good" };
  if (tier === "med") return { text: "Neutral — puede ir para cualquier lado", tone: "warn" };
  if (tier === "same") return null;
  return { text: "No recomendado — probablemente baje el OVR", tone: "bad" };
}

function rndInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

// Resultado real al terminar el entrenamiento: los cambios sensatos mantienen
// o mejoran un poco, los que no tienen ninguna lógica futbolística castigan
// bastante el OVR.
export function resolveTrainingDelta(fromPos, toPos) {
  const tier = trainingTier(fromPos, toPos);
  if (tier === "high") return rndInt(0, 3);
  if (tier === "med") return rndInt(-1, 1);
  return -rndInt(3, 8);
}
