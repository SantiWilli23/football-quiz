import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";

export default function Squad() {
  const { state, setLineup } = useCareer();
  const [filterPos, setFilterPos] = useState("ALL");
  const [sortBy, setSortBy] = useState("ovr");

  const byId = useMemo(() => Object.fromEntries(state.squad.map((p) => [p.id, p])), [state.squad]);
  const { starters, bench, reserves } = state.lineup;

  const filtered = useMemo(() => {
    let list = state.squad.slice();
    if (filterPos !== "ALL") list = list.filter((p) => p.position === filterPos);
    list.sort((a, b) => (sortBy === "age" ? a.age - b.age : b[sortBy] - a[sortBy]));
    return list;
  }, [state.squad, filterPos, sortBy]);

  function levelOf(id) {
    if (starters.includes(id)) return "starters";
    if (bench.includes(id)) return "bench";
    return "reserves";
  }

  function moveTo(id, level) {
    const s = starters.filter((x) => x !== id);
    const b = bench.filter((x) => x !== id);
    const r = reserves.filter((x) => x !== id);
    if (level === "starters") { if (s.length >= 11) return; s.push(id); }
    if (level === "bench") { if (b.length >= 9) return; b.push(id); }
    if (level === "reserves") r.push(id);
    setLineup({ starters: s, bench: b, reserves: r });
  }

  return (
    <div className="space-y-5">
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
            <option value="potential">Ordenar por potencial</option>
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 truncate max-w-[160px]">{p.name} {p.isYouth && <span className="text-amber text-xs">⭐</span>}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{p.position}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{p.age}</td>
                  <td className="px-2 py-2 text-center font-semibold">{p.ovr}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{p.potential}</td>
                  <td className="px-2 py-2 text-center text-gray-400">€{p.value}M</td>
                  <td className="px-2 py-2">
                    <select
                      value={levelOf(p.id)}
                      onChange={(e) => moveTo(p.id, e.target.value)}
                      className="bg-bg border border-border rounded px-1 py-0.5 text-xs"
                    >
                      <option value="starters">Titular</option>
                      <option value="bench">Banca</option>
                      <option value="reserves">Reservas</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SquadLevel title={`Titulares (${starters.length}/11)`} ids={starters} byId={byId} />
        <SquadLevel title={`Banca (${bench.length}/9)`} ids={bench} byId={byId} />
        <SquadLevel title={`Reservas (${reserves.length})`} ids={reserves} byId={byId} />
      </div>
    </div>
  );
}

function SquadLevel({ title, ids, byId }) {
  return (
    <div className="bg-panel border border-border rounded-card p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1">
        {ids.map((id) => {
          const p = byId[id];
          if (!p) return null;
          return (
            <div key={id} className="flex items-center justify-between text-sm">
              <span className="truncate">[{p.position}] {p.name}</span>
              <span className="text-gray-400 shrink-0 ml-2">{p.ovr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
