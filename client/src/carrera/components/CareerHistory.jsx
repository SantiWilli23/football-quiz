import { useState } from "react";
import { Link } from "react-router-dom";
import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import { buildLegacy } from "../utils/legacy.js";
import LegacyCompare from "./LegacyCompare.jsx";

export default function CareerHistory() {
  const { state, team, retireCareer } = useCareer();
  const history = state.history || [];
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [legacy, setLegacy] = useState(null);

  const openLegacy = () => setLegacy(buildLegacy(history, team));

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
                  <p className="font-semibold">
                    Temporada {h.season} · {t?.name}
                    {h.seasonName && <span className="text-accent font-normal"> — "{h.seasonName}"</span>}
                  </p>
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

      {/* Modo legado: cerrar la carrera para siempre y llevarte la ficha
          resumen. Sólo tiene sentido si ya jugaste algo. */}
      {history.some((h) => !h.note) && (
        <div className="pt-4 border-t border-border">
          {!legacy ? (
            <button
              onClick={openLegacy}
              className="text-sm text-gray-500 hover:text-amber transition-colors"
            >
              🏛 Ver mi legado y retirarme
            </button>
          ) : (
            <div className="bg-panel border border-amber/30 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-lg text-amber">🏛 Tu legado como DT</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-bold">{legacy.seasonsCount}</p>
                  <p className="text-xs text-gray-500">Temporadas dirigidas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald">{legacy.titles}</p>
                  <p className="text-xs text-gray-500">Objetivos cumplidos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber">{legacy.copas}</p>
                  <p className="text-xs text-gray-500">Copas del Rey</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue">{legacy.continental}</p>
                  <p className="text-xs text-gray-500">Títulos continentales</p>
                </div>
              </div>
              {legacy.best && (
                <p className="text-sm text-gray-400">
                  Tu mejor temporada: <span className="text-white font-semibold">{legacy.best.position}°</span> con {teamById(legacy.best.teamId)?.name}
                  {legacy.best.seasonName && <> — "{legacy.best.seasonName}"</>}.
                </p>
              )}
              {legacy.clubsManaged.length > 0 && (
                <p className="text-sm text-gray-400">Clubes dirigidos: {legacy.clubsManaged.join(", ")}.</p>
              )}

              {!confirmRetire ? (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setConfirmRetire(true)}
                    className="text-sm font-semibold px-4 py-2.5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                  >
                    Retirarme para siempre
                  </button>
                  <button
                    onClick={() => setLegacy(null)}
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                  <p className="text-sm mb-3">Esto borra la carrera para siempre. No se puede deshacer.</p>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/panel"
                      onClick={retireCareer}
                      className="text-sm font-semibold px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                    >
                      Sí, retirarme
                    </Link>
                    <button
                      onClick={() => setConfirmRetire(false)}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <LegacyCompare />
    </div>
  );
}
