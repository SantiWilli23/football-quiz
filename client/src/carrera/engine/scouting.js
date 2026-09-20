import { teamById } from "../data/teams.js";
import { askingPrice } from "./transferMarket.js";

// Sistema de ojeadores: ya no hay un reclutador fijo con un margen de error
// dado — se CONTRATA un ojeador especializado (con contrato de 1 o 2
// temporadas) y se lo manda a investigar a un jugador puntual. El tipo de
// ojeador define qué tan preciso es en cada dato: uno especializado en OVR
// clava el nivel actual pero se equivoca ~10 puntos en el potencial (y
// viceversa); el generalista (más caro) es fino en las dos cosas.
export const SCOUT_SPECIALTIES = {
  ovr: {
    id: "ovr",
    label: "Especialista en Nivel (OVR)",
    desc: "Clava el rango de OVR actual, pero su proyección de potencial pierde precisión (~10 de margen extra).",
  },
  potential: {
    id: "potential",
    label: "Especialista en Potencial",
    desc: "Proyecta el techo del jugador con gran precisión, pero su rango de OVR actual es menos fino (~10 de margen extra).",
  },
  both: {
    id: "both",
    label: "Generalista",
    desc: "Preciso en OVR y en potencial a la vez — por algo cuesta bastante más.",
  },
};

export const MAX_SCOUTS = 3;
export const SPECIALTY_GAP = 10;
// El viaje dura entre 3 y 14 días (cada jornada son 7): cuanto más conocido
// es el jugador pedido, más rápido se lo ubica; a los desconocidos hay que
// ir a buscarlos a canchas chicas. Y cuantos más días se queda el ojeador
// en la liga, más jugadores de ahí trae en el informe.
export const SCOUT_MISSION_MIN_DAYS = 3;
export const SCOUT_MISSION_MAX_DAYS = 14;
export const DAYS_PER_WEEK = 7;

// Los jugadores archiconocidos (Mbappé, Haaland...) ya vienen scouteados de
// entrada: no hace falta mandar a nadie a confirmar que son buenos.
export const FAMOUS_OVR = 86;
export const FAMOUS_VALUE = 60;
export function isFamous(player) {
  return !!player && (player.ovr >= FAMOUS_OVR || player.value >= FAMOUS_VALUE);
}

function costRangeFor(specialty) {
  return specialty === "both" ? [15, 15] : [5, 7];
}

export function rollScoutCost(specialty) {
  const [lo, hi] = costRangeFor(specialty);
  return lo === hi ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function sample(pool, n) {
  const copy = pool.slice();
  const picked = [];
  while (picked.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(i, 1)[0]);
  }
  return picked;
}

// Genera un reporte para un jugador puntual, según la especialidad del
// ojeador contratado (no hace falta pasar el ojeador completo, alcanza con
// su especialidad — así también sirve para re-generar informes viejos).
export function scoutPlayer(specialty, player) {
  if (!player) return null;
  const baseErr = 3; // ojeador de base, sin sesgo
  const ovrErr = specialty === "potential" ? baseErr + SPECIALTY_GAP : baseErr;
  const potErr = specialty === "ovr" ? Math.round(baseErr * 1.4) + SPECIALTY_GAP : Math.round(baseErr * 1.4);

  const potentialEstimate = clamp(player.potential + rnd(-potErr, potErr), player.ovr, 99);
  const sellerTeam = teamById(player.teamId);
  const suggestedOffer = sellerTeam ? askingPrice(player, sellerTeam) : player.value;

  return {
    specialty,
    playerId: player.id,
    ovrRange: [clamp(player.ovr - ovrErr, 30, 99), clamp(player.ovr + ovrErr, 30, 99)],
    potentialEstimate,
    suggestedOffer,
  };
}

export function defaultReportFor(player) {
  const sellerTeam = teamById(player.teamId);
  return {
    specialty: "public",
    isPublic: true,
    playerId: player.id,
    ovrRange: [clamp(player.ovr - 1, 30, 99), clamp(player.ovr + 1, 30, 99)],
    potentialEstimate: player.potential,
    suggestedOffer: sellerTeam ? askingPrice(player, sellerTeam) : player.value,
  };
}

// Informe efectivo de un jugador: el que pidió el DT o, si es una figura
// mundial, el "de dominio público".
export function reportFor(reports, player) {
  if (!player) return null;
  return (reports && reports[player.id]) || (isFamous(player) ? defaultReportFor(player) : null);
}

// Combina reportes previos con uno nuevo: el rango de OVR sólo se angosta,
// el potencial se promedia hacia el nuevo dato.
export function mergeReports(prev, next) {
  if (!prev) return next;
  const potentialEstimate = Number.isFinite(prev.potentialEstimate)
    ? Math.round((prev.potentialEstimate + next.potentialEstimate) / 2)
    : next.potentialEstimate;
  return {
    ...next,
    ovrRange: [Math.max(prev.ovrRange[0], next.ovrRange[0]), Math.min(prev.ovrRange[1], next.ovrRange[1])],
    potentialEstimate,
  };
}

export function formatRange([lo, hi]) {
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

// Arma la misión de scouting: como el ojeador ya viaja hasta la liga del
// jugador pedido, aprovecha para traer informes de varios compañeros de
// liga más. Vuelve pasados los días del viaje: en la próxima jornada, o en
// dos si el viaje pasa de una semana.
function missionDaysFor(target) {
  if (isFamous(target)) return rnd(SCOUT_MISSION_MIN_DAYS, 5);
  if (target.ovr >= 78) return rnd(4, 8);
  if (target.ovr >= 70) return rnd(6, 11);
  return rnd(9, SCOUT_MISSION_MAX_DAYS);
}

export function buildScoutMission(scout, targetPlayer, week, allPlayers) {
  const targetTeam = teamById(targetPlayer.teamId);
  const league = targetTeam?.league;
  const days = missionDaysFor(targetPlayer);
  const count = clamp(Math.round(3 + days * 0.8), 4, 14);
  const leaguemates = league
    ? sample(
        allPlayers.filter((p) => p.id !== targetPlayer.id && teamById(p.teamId)?.league === league),
        count
      )
    : [];
  return {
    id: `mission_${scout.id}_${targetPlayer.id}_${week}_${Date.now()}`,
    scoutId: scout.id,
    scoutSpecialty: scout.specialty,
    targetPlayerId: targetPlayer.id,
    targetPlayerName: targetPlayer.name,
    league,
    days,
    playerIds: [targetPlayer.id, ...leaguemates.map((p) => p.id)],
    requestedWeek: week,
    resolveWeek: week + Math.ceil(days / DAYS_PER_WEEK),
  };
}
