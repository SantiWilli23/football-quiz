// Sistema de reclutadores: nadie conoce de memoria el OVR y el potencial
// exactos de un jugador (ni siquiera los propios canteranos). Hay que mandar
// un ojeador a verlo. Cada uno tiene una zona donde es más fiable y un margen
// de error que se reduce en su especialidad.
export const SCOUTS = [
  { id: "s1", name: "Martín Ochoa", region: "laliga", accuracy: 0.9, desc: "Ex-jugador de La Liga, ojo fino para el mediocampo." },
  { id: "s2", name: "Derek Whitmore", region: "premier", accuracy: 0.9, desc: "Veterano de las canteras inglesas, especialista en Premier." },
  { id: "s3", name: "Yuki Tanaka", region: "global", accuracy: 0.75, desc: "Red de contactos en Asia y Oceanía, generalista." },
  { id: "s4", name: "Camila Duarte", region: "global", accuracy: 0.8, desc: "Sudamérica y mercados emergentes, buena para jóvenes." },
  { id: "s5", name: "Klaus Reiter", region: "global", accuracy: 0.85, desc: "Exigente y meticuloso, tarda pero se equivoca poco." },
  { id: "s6", name: "Sofia Bianchi", region: "global", accuracy: 0.7, desc: "Nueva en el oficio, barata pero menos precisa." },
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function regionMatches(scout, player, teamLeague) {
  if (scout.region === "global") return false;
  return scout.region === teamLeague;
}

// Genera un reporte: rango estimado de OVR y potencial. Cuanto más
// especializado el ojeador en esa liga, más angosto (preciso) el rango.
export function scoutPlayer(scoutId, player, teamLeague) {
  const scout = SCOUTS.find((s) => s.id === scoutId);
  if (!scout || !player) return null;
  const specialized = regionMatches(scout, player, teamLeague);
  const acc = clamp(scout.accuracy + (specialized ? 0.12 : 0), 0.5, 0.98);
  const errMargin = Math.round((1 - acc) * 22); // 0.98 acc -> ±1, 0.5 acc -> ±11

  const ovrErr = Math.max(1, errMargin + rnd(-1, 1));
  const potErr = Math.max(1, Math.round(errMargin * 1.4) + rnd(-1, 2));

  return {
    scoutId,
    scoutName: scout.name,
    playerId: player.id,
    ovrRange: [clamp(player.ovr - ovrErr, 30, 99), clamp(player.ovr + ovrErr, 30, 99)],
    potRange: [clamp(player.potential - potErr, player.ovr, 99), clamp(player.potential + potErr, player.ovr, 99)],
    specialized,
    accuracy: acc,
  };
}

// Combina reportes previos con uno nuevo, angostando el rango (nunca lo
// vuelve a ensanchar: la info nueva sólo puede sumar certeza).
export function mergeReports(prev, next) {
  if (!prev) return next;
  return {
    ...next,
    ovrRange: [Math.max(prev.ovrRange[0], next.ovrRange[0]), Math.min(prev.ovrRange[1], next.ovrRange[1])],
    potRange: [Math.max(prev.potRange[0], next.potRange[0]), Math.min(prev.potRange[1], next.potRange[1])],
    history: [...(prev.history || [prev.scoutName]), next.scoutName],
  };
}

export function formatRange([lo, hi]) {
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}
