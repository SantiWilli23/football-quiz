import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";

export default function CareerHistory() {
  const { state, team } = useCareer();
  const history = state.history || [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Historial de carrera</h2>
        <p className="text-sm text-gray-500 mt-1">Todas las temporadas que dirigiste, en {team.name} y en cualquier otro club.</p>
      </div>

      {!history.length && (
        <p className="text-sm text-gray-500">Todavía no completaste ninguna temporada. Volvé cuando termine la primera.</p>
      )}

      <div className="space-y-3">
        {[...history].reverse().map((h, i) => {
          if (h.note) {
            return (
              <div key={i} className="bg-panel border border-amber/30 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">🤝</span>
                <div>
                  <p className="text-sm font-semibold text-amber">Cambio de club</p>
                  <p className="text-xs text-gray-400 mt-0.5">Temporada {h.season} · {h.note}</p>
                </div>
              </div>
            );
          }
          const t = teamById(h.teamId) || team;
          return (
            <div key={i} className="bg-panel border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold">Temporada {h.season} · {t?.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{h.points} puntos</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-accent">{h.position}°</span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${h.objectiveMet ? "bg-emerald/15 text-emerald border-emerald/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
                    {h.objectiveMet ? "Objetivo cumplido" : "Objetivo fallado"}
                  </span>
                </div>
              </div>
              {(h.copaChampion || h.continentalChampion) && (
                <div className="flex gap-2 mt-3">
                  {h.copaChampion && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber/15 text-amber border border-amber/30">🏆 Copa del Rey</span>
                  )}
                  {h.continentalChampion && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue/15 text-blue border border-blue/30">🏆 Título continental</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
