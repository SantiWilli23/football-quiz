import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { formatRange } from "../engine/scouting.js";
import Formation from "./Formation.jsx";

export default function Squad() {
  const { state, moveToBench, moveToReserves } = useCareer();
  const [tab, setTab] = useState("formacion");
  const [filterPos, setFilterPos] = useState("ALL");
  const [sortBy, setSortBy] = useState("ovr");

  const starterIds = new Set(state.lineup.starters.map((s) => s.playerId).filter(Boolean));
  const benchIds = new Set(state.lineup.bench);

  const filtered = useMemo(() => {
    let list = state.squad.slice();
    if (filterPos !== "ALL") list = list.filter((p) => p.position === filterPos);
    list.sort((a, b) => (sortBy === "age" ? a.age - b.age : b[sortBy] - a[sortBy]));
    return list;
  }, [state.squad, filterPos, sortBy]);

  function levelOf(id) {
    if (starterIds.has(id)) return "Titular";
    if (benchIds.has(id)) return "Banca";
    return "Reserva";
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {[["formacion", "Formación"], ["plantilla", "Plantilla"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-card text-sm font-medium ${tab === id ? "bg-accent/15 text-accent border border-accent/30" : "text-gray-400 border border-transparent hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "formacion" && <Formation />}

      {tab === "plantilla" && (
        <div>
          <h2 className="text-lg font-bold mb-3">Plantilla ({state.squad.length})</h2>
          <div className="flex gap-2 mb-3 flex-wrap">
            <select value={filterPos} onChange={(e) => setFilterPos(e.target.value)} className="bg-panel border border-border rounded-card px-2 py-1.5 text-sm">
              <option value="ALL">Todas las posiciones</option>
              {["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-panel border border-border rounded-card px-2 py-1.5 text-sm">
              <option value="ovr">Ordenar por OVR</option>
              <option value="age">Ordenar por edad</option>
              <option value="value">Ordenar por valor</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-sm">
              <thead className="bg-panel text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Nombre</th>
                  <th className="px-2 py-2">Pos</th>
                  <th className="px-2 py-2">Edad</th>
                  <th className="px-2 py-2">OVR</th>
                  <th className="px-2 py-2">POT</th>
                  <th className="px-2 py-2">Valor</th>
                  <th className="px-2 py-2">Nivel</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const report = state.scoutReports[p.id];
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2 truncate max-w-[160px]">{p.name} {p.isYouth && <span className="text-amber text-xs">⭐</span>}</td>
                      <td className="px-2 py-2 text-center text-gray-400">{p.position}</td>
                      <td className="px-2 py-2 text-center text-gray-400">{p.age}</td>
                      <td className="px-2 py-2 text-center font-semibold">{p.ovr}</td>
                      <td className="px-2 py-2 text-center text-gray-400">
                        {report ? <span title={`Reportado por ${report.scoutName}`}>{formatRange(report.potRange)}</span> : <span className="text-gray-600">?</span>}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-400">€{p.value}M</td>
                      <td className="px-2 py-2 text-center text-xs text-gray-400">{levelOf(p.id)}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => moveToBench(p.id)} className="text-[10px] text-gray-500 hover:text-white underline">banca</button>
                          <button onClick={() => moveToReserves(p.id)} className="text-[10px] text-gray-500 hover:text-white underline">reservas</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mt-2">El potencial (POT) es una estimación de tus reclutadores — mandá uno a verlo en la pestaña Scouting para afinar el rango.</p>
        </div>
      )}
    </div>
  );
}
