import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { listLegacies } from "../hooks/useCareerSave.js";
import { teamById } from "../data/teams.js";

const ROWS = [
  ["seasonsCount", "Temporadas dirigidas"],
  ["titles", "Objetivos cumplidos"],
  ["copas", "Copas del Rey"],
  ["continental", "Títulos continentales"],
];

// Compara dos fichas de DTs ya retirados (ver saveLegacy en useCareerSave.js
// y retireCareer en CareerContext.jsx, que archiva la ficha antes de borrar
// la carrera). Sólo tiene sentido si hay al menos dos legados guardados.
export default function LegacyCompare() {
  const [legacies, setLegacies] = useState([]);
  const [leftId, setLeftId] = useState(null);
  const [rightId, setRightId] = useState(null);

  useEffect(() => {
    const list = listLegacies();
    setLegacies(list);
    if (list.length >= 2) {
      setLeftId(list[list.length - 2].id);
      setRightId(list[list.length - 1].id);
    }
  }, []);

  if (legacies.length < 2) return null;

  const left = legacies.find((l) => l.id === leftId);
  const right = legacies.find((l) => l.id === rightId);

  return (
    <div className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
        <Scale size={15} />
        Legado cruzado — comparar dos DTs retirados
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={leftId || ""}
          onChange={(e) => setLeftId(e.target.value)}
          className="bg-bg border border-border rounded-card px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
        >
          {legacies.map((l) => (
            <option key={l.id} value={l.id}>{l.teamName} — {new Date(l.retiredAt).toLocaleDateString("es-ES")}</option>
          ))}
        </select>
        <select
          value={rightId || ""}
          onChange={(e) => setRightId(e.target.value)}
          className="bg-bg border border-border rounded-card px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
        >
          {legacies.map((l) => (
            <option key={l.id} value={l.id}>{l.teamName} — {new Date(l.retiredAt).toLocaleDateString("es-ES")}</option>
          ))}
        </select>
      </div>

      {left && right && (
        <div className="bg-panel border border-border rounded-2xl p-4 space-y-2.5">
          {ROWS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className={`font-bold w-14 text-center ${left[key] > right[key] ? "text-accent" : ""}`}>{left[key]}</span>
              <span className="text-gray-500 text-xs flex-1 text-center">{label}</span>
              <span className={`font-bold w-14 text-center ${right[key] > left[key] ? "text-accent" : ""}`}>{right[key]}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-border">
            <span className="w-1/2 text-center truncate">
              {left.best ? `Mejor: ${left.best.position}° (${teamById(left.best.teamId)?.name || left.teamName})` : "Sin mejor temporada"}
            </span>
            <span className="w-1/2 text-center truncate">
              {right.best ? `Mejor: ${right.best.position}° (${teamById(right.best.teamId)?.name || right.teamName})` : "Sin mejor temporada"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
