import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { SCOUTS, formatRange } from "../engine/scouting.js";

export default function Scouts() {
  const { state, team, sendScout } = useCareer();
  const [scoutId, setScoutId] = useState(SCOUTS[0].id);
  const [teamId, setTeamId] = useState(team.id);
  const [query, setQuery] = useState("");
  const [lastReport, setLastReport] = useState(null);

  const pool = useMemo(() => (teamId === team.id ? state.squad : allPlayers.filter((p) => p.teamId === teamId)), [teamId, team.id, state.squad]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => b.ovr - a.ovr).slice(0, 40);
  }, [pool, query]);

  const reportedIds = state.scoutReports;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold mb-1">Departamento de Scouting</h2>
        <p className="text-xs text-gray-500 max-w-lg">
          No conocés el techo (ni el nivel exacto) de un jugador hasta que uno de tus 6 reclutadores lo va a ver.
          Cada uno tiene una zona donde es más certero. Varios informes del mismo jugador angostan el rango.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SCOUTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setScoutId(s.id)}
            className={`text-left p-3 rounded-card border transition-colors ${scoutId === s.id ? "border-accent bg-accent/10" : "border-border bg-panel hover:border-gray-500"}`}
          >
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              {s.region === "premier" ? "Premier League" : s.region === "laliga" ? "La Liga" : "Global"} · precisión {Math.round(s.accuracy * 100)}%
            </p>
            <p className="text-xs text-gray-400 leading-snug">{s.desc}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="bg-panel border border-border rounded-card px-2 py-1.5 text-sm max-w-[220px]">
          <option value={team.id}>Mi plantel ({team.name})</option>
          {teams.filter((t) => t.id !== team.id).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jugador…"
          className="bg-panel border border-border rounded-card px-2 py-1.5 text-sm flex-1 min-w-[160px]"
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-panel text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="px-2 py-2">Pos</th>
              <th className="px-2 py-2">Edad</th>
              <th className="px-2 py-2">OVR est.</th>
              <th className="px-2 py-2">POT est.</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const report = reportedIds[p.id];
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 truncate max-w-[160px]">{p.name}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{p.position}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{p.age}</td>
                  <td className="px-2 py-2 text-center font-semibold">{report ? formatRange(report.ovrRange) : "?"}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{report ? formatRange(report.potRange) : "?"}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => setLastReport(sendScout(scoutId, p.id))}
                      className="text-xs px-2 py-1 rounded-card bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25"
                    >
                      Enviar reclutador
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-600 text-sm">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {lastReport && (
        <div className="bg-panel border border-accent/30 rounded-card p-3 text-sm">
          <p className="font-semibold mb-1">📋 Informe de {lastReport.scoutName}</p>
          <p className="text-gray-400">
            OVR estimado: <span className="text-white font-medium">{formatRange(lastReport.ovrRange)}</span> · Potencial estimado: <span className="text-white font-medium">{formatRange(lastReport.potRange)}</span>
            {lastReport.specialized && <span className="text-amber ml-2">(zona de especialidad — informe más certero)</span>}
          </p>
        </div>
      )}
    </div>
  );
}
