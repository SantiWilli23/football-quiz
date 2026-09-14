import { teamById } from "../data/teams.js";

// Resumen del paso de un DT por el modo Carrera, a partir de su historial de
// temporadas. Se usa tanto para la ficha que se ve antes de retirarse
// (CareerHistory.jsx) como para las fichas ya archivadas que se comparan en
// "legado cruzado" (LegacyCompare.jsx).
export function buildLegacy(history, team) {
  const seasons = (history || []).filter((h) => !h.note);
  const titles = seasons.filter((h) => h.objectiveMet).length;
  const copas = seasons.filter((h) => h.copaChampion).length;
  const continental = seasons.filter((h) => h.continentalChampion).length;
  const best = seasons.reduce((min, h) => (h.position < (min?.position ?? Infinity) ? h : min), null);
  const clubsManaged = [...new Set(seasons.map((h) => h.teamId))].map((id) => teamById(id)?.name).filter(Boolean);
  const named = seasons.filter((h) => h.seasonName);
  return {
    teamName: team?.name || clubsManaged[0] || "—",
    seasonsCount: seasons.length,
    titles,
    copas,
    continental,
    best,
    clubsManaged,
    named,
  };
}
