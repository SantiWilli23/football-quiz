import { teamById } from "../data/teams.js";
import { askingPrice } from "./transferMarket.js";

// Sistema de reclutadores: nadie conoce de memoria el OVR exacto de un
// jugador (ni siquiera los propios canteranos), y mucho menos su techo. Hay
// que mandar un ojeador a verlo. Cada uno tiene una zona donde es más
// fiable y un margen de error que se reduce en su especialidad.
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

// Genera un reporte: rango estimado de OVR (todavía incierto), una única
// cifra de potencial ("probablemente llegue a esto", no una garantía) y una
// oferta sugerida para el pase. Cuanto más especializado el ojeador en esa
// liga, más angosto (preciso) el margen de error.
export function scoutPlayer(scoutId, player, teamLeague) {
  const scout = SCOUTS.find((s) => s.id === scoutId);
  if (!scout || !player) return null;
  const specialized = regionMatches(scout, player, teamLeague);
  const acc = clamp(scout.accuracy + (specialized ? 0.12 : 0), 0.5, 0.98);
  const errMargin = Math.round((1 - acc) * 22); // 0.98 acc -> ±1, 0.5 acc -> ±11

  const ovrErr = Math.max(1, errMargin + rnd(-1, 1));
  const potErr = Math.max(1, Math.round(errMargin * 1.4) + rnd(-1, 2));
  const potentialEstimate = clamp(player.potential + rnd(-potErr, potErr), player.ovr, 99);

  const sellerTeam = teamById(player.teamId);
  const suggestedOffer = sellerTeam ? askingPrice(player, sellerTeam) : player.value;

  return {
    scoutId,
    scoutName: scout.name,
    playerId: player.id,
    ovrRange: [clamp(player.ovr - ovrErr, 30, 99), clamp(player.ovr + ovrErr, 30, 99)],
    potentialEstimate,
    suggestedOffer,
    specialized,
    accuracy: acc,
  };
}

// Combina reportes previos con uno nuevo. El rango de OVR sólo se angosta
// (la info nueva suma certeza); el potencial se promedia hacia el nuevo dato,
// así varios informes convergen en una cifra más confiable sin fingir que
// ahora es un número exacto y garantizado.
export function mergeReports(prev, next) {
  if (!prev) return next;
  // prev puede venir de un informe guardado con el formato viejo (sin
  // potentialEstimate) — en ese caso no hay nada que promediar, se usa el
  // nuevo tal cual en vez de contaminar la cuenta con NaN.
  const potentialEstimate = Number.isFinite(prev.potentialEstimate)
    ? Math.round((prev.potentialEstimate + next.potentialEstimate) / 2)
    : next.potentialEstimate;
  return {
    ...next,
    ovrRange: [Math.max(prev.ovrRange[0], next.ovrRange[0]), Math.min(prev.ovrRange[1], next.ovrRange[1])],
    potentialEstimate,
    history: [...(prev.history || [prev.scoutName]), next.scoutName],
  };
}

export function formatRange([lo, hi]) {
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}
