import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { SCOUTS, formatRange } from "../engine/scouting.js";

const MANUAL_SCOUTS = SCOUTS.filter((s) => !s.monthly);

export default function Scouts() {
  const { state, team, sendScout } = useCareer();
  const [scoutId, setScoutId] = useState(MANUAL_SCOUTS[0].id);
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
        <h2 className="text-2xl font-bold mb-2">Departamento de Scouting</h2>
        <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
          No conocés el techo (ni el nivel exacto) de un jugador hasta que uno de tus 4 reclutadores lo va a ver.
          El potencial que te reportan es la cifra más probable — no una garantía, puede que el jugador no llegue del
          todo. El reclutador también te tira una oferta sugerida por el pase.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SCOUTS.map((s) => (
          <button
            key={s.id}
            onClick={() => !s.monthly && setScoutId(s.id)}
            className={`text-left p-4 rounded-2xl border transition-colors ${
              s.monthly
                ? "border-dashed border-gray-600 bg-panel cursor-default"
                : scoutId === s.id
                ? "border-accent bg-accent/10"
                : "border-border bg-panel hover:border-gray-500"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold">{s.name}</p>
              {s.monthly && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber/15 text-amber border border-amber/30">
                  Automático
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">
              {s.region === "premier" ? "Premier League" : s.region === "laliga" ? "La Liga" : "Global"} · precisión {Math.round(s.accuracy * 100)}%
            </p>
            <p className="text-xs text-gray-400 leading-snug">{s.desc}</p>
          </button>
        ))}
      </div>

      {state.monthlyReports?.length > 0 && (
        <div className="bg-panel border border-amber/20 rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber mb-2.5">📋 Último informe mensual de Iker Salgado</p>
          <div className="flex flex-wrap gap-2">
            {state.monthlyReports[0].entries.map((e) => {
              const t = teamById(e.teamId);
              return (
                <span
                  key={e.playerId}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    e.isGem ? "border-amber/50 bg-amber/10 text-amber" : "border-border text-gray-400"
                  }`}
                  title={t ? t.name : ""}
                >
                  {e.isGem && "💎 "}{e.name} (~{e.potentialEstimate}){t ? ` · ${t.name}` : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="bg-panel border border-border rounded-2xl px-4 py-3 text-sm max-w-[220px]">
          <option value={team.id}>Mi plantel ({team.name})</option>
          {teams.filter((t) => t.id !== team.id).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jugador…"
          className="bg-panel border border-border rounded-2xl px-4 py-3 text-sm flex-1 min-w-[160px]"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-panel text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="px-3 py-3">Pos</th>
              <th className="px-3 py-3">Edad</th>
              <th className="px-3 py-3">OVR est.</th>
              <th className="px-3 py-3">Potencial</th>
              <th className="px-3 py-3">Oferta sugerida</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const report = reportedIds[p.id];
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 truncate max-w-[160px]">{p.name}</td>
                  <td className="px-3 py-3 text-center text-gray-400">{p.position}</td>
                  <td className="px-3 py-3 text-center text-gray-400">{p.age}</td>
                  <td className="px-3 py-3 text-center font-semibold">{report ? formatRange(report.ovrRange) : "?"}</td>
                  <td className="px-3 py-3 text-center text-gray-400">{report?.potentialEstimate != null ? `~${report.potentialEstimate}` : "?"}</td>
                  <td className="px-3 py-3 text-center text-gray-400">{report?.suggestedOffer != null ? `€${report.suggestedOffer}M` : "?"}</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => setLastReport(sendScout(scoutId, p.id))}
                      className="text-sm font-medium px-4 py-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors"
                    >
                      Enviar reclutador
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-600 text-sm">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {lastReport && (
        <div className="bg-panel border border-accent/30 rounded-2xl p-4 text-sm">
          <p className="font-semibold mb-1">📋 Informe de {lastReport.scoutName}</p>
          <p className="text-gray-400">
            OVR estimado: <span className="text-white font-medium">{formatRange(lastReport.ovrRange)}</span> · Potencial probable: <span className="text-white font-medium">~{lastReport.potentialEstimate}</span> · Oferta sugerida: <span className="text-white font-medium">€{lastReport.suggestedOffer}M</span>
            {lastReport.specialized && <span className="text-amber ml-2">(zona de especialidad — informe más certero)</span>}
          </p>
          <p className="text-xs text-gray-500 mt-1.5">El potencial es una proyección, no una promesa: capaz llega, capaz se queda un poco corto.</p>
        </div>
      )}
    </div>
  );
}
