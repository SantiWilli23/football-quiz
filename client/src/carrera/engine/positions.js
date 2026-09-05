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
