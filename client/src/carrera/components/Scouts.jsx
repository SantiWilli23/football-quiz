import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { SCOUTS, formatRange } from "../engine/scouting.js";

const MANUAL_SCOUTS = SCOUTS.filter((s) => !s.monthly);
const AUTO_SCOUT = SCOUTS.find((s) => s.monthly);

function regionLabel(region) {
  if (region === "premier") return "Premier League";
  if (region === "laliga") return "La Liga";
  return "Global";
}

export default function Scouts() {
  const { state, team, sendScout, isScoutOnCooldown, weeksUntilScoutAvailable } = useCareer();
  const [scoutId, setScoutId] = useState(MANUAL_SCOUTS[0].id);
  const [teamId, setTeamId] = useState(team.id);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState(null); // { type: "ok"|"cooldown", ...report }

  const scout = SCOUTS.find((s) => s.id === scoutId);

  const pool = useMemo(
    () => (teamId === team.id ? state.squad : allPlayers.filter((p) => p.teamId === teamId)),
    [teamId, team.id, state.squad]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => b.ovr - a.ovr).slice(0, 40);
  }, [pool, query]);

  const reportedIds = state.scoutReports;

  function handleSend(playerId) {
    const res = sendScout(scoutId, playerId);
    if (res?.error === "cooldown") {
      setFeedback({ type: "cooldown", playerId, weeksLeft: res.weeksLeft });
    } else if (res) {
      setFeedback({ type: "ok", playerId, ...res });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold mb-2">Departamento de Scouting</h2>
        <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
          No conocés el nivel exacto ni el techo de un rival hasta que un reclutador lo va a ver. El informe da un
          <span className="text-gray-300"> rango de OVR</span> y una <span className="text-gray-300">proyección de potencial</span> — no es garantía.
          Cada reclutador puede volver a ver al mismo jugador recién a los 3 semanas.
        </p>
      </div>

      {/* Paso 1: elegir reclutador */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">1. Elegí tu reclutador</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {MANUAL_SCOUTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScoutId(s.id)}
              className={`text-left p-4 rounded-2xl border transition-colors ${
                scoutId === s.id ? "border-accent bg-accent/10" : "border-border bg-panel hover:border-gray-500"
              }`}
            >
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 mb-1.5">
                {regionLabel(s.region)} · precisión {Math.round(s.accuracy * 100)}%
              </p>
              <p className="text-xs text-gray-400 leading-snug">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Reclutador automático — informativo, no seleccionable */}
      {state.monthlyReports?.length > 0 && (
        <div className="bg-panel border border-dashed border-amber/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber">📋 {AUTO_SCOUT.name} · informe automático</p>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber/15 text-amber border border-amber/30">Cada 4 semanas</span>
          </div>
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

      {/* Paso 2: elegir a quién scoutear */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">2. Elegí a quién mandarlo a ver</p>
        <div className="flex flex-wrap gap-3 items-center mb-3">
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

        <div className="space-y-2">
          {filtered.map((p) => {
            const report = reportedIds[p.id];
            const onCooldown = isScoutOnCooldown(scoutId, p.id);
            const weeksLeft = weeksUntilScoutAvailable(scoutId, p.id);
            const justScouted = feedback?.type === "ok" && feedback.playerId === p.id;

            return (
              <div key={p.id} className="bg-panel border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 shrink-0 rounded-card bg-bg border border-border flex items-center justify-center text-[11px] font-bold text-gray-400">
                    {p.position}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.age} años</p>
                  </div>

                  <div className="hidden sm:flex flex-col items-center w-20 shrink-0">
                    <span className="text-[10px] uppercase tracking-wide text-gray-600">OVR est.</span>
                    <span className="text-sm font-semibold">{report ? formatRange(report.ovrRange) : "—"}</span>
                  </div>
                  <div className="hidden sm:flex flex-col items-center w-20 shrink-0">
                    <span className="text-[10px] uppercase tracking-wide text-gray-600">Potencial</span>
                    <span className="text-sm text-gray-300">{report?.potentialEstimate != null ? `~${report.potentialEstimate}` : "—"}</span>
                  </div>
                  <div className="hidden sm:flex flex-col items-center w-24 shrink-0">
                    <span className="text-[10px] uppercase tracking-wide text-gray-600">Oferta sugerida</span>
                    <span className="text-sm text-gray-300">{report?.suggestedOffer != null ? `€${report.suggestedOffer}M` : "—"}</span>
                  </div>

                  <div className="shrink-0">
                    {onCooldown ? (
                      <span className="text-xs text-gray-600 px-3 py-2.5 inline-block" title={`${scout.name} ya lo vio recientemente`}>
                        Vuelve en {weeksLeft} sem.
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSend(p.id)}
                        className="text-sm font-medium px-4 py-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors whitespace-nowrap"
                      >
                        {report ? "Volver a ver" : "Enviar reclutador"}
                      </button>
                    )}
                  </div>
                </div>

                {justScouted && (
                  <div className="bg-accent/5 border-t border-accent/20 px-4 py-2.5 text-xs">
                    <span className="font-semibold text-accent">📋 {feedback.scoutName}: </span>
                    <span className="text-gray-300">
                      OVR {formatRange(feedback.ovrRange)} · Potencial ~{feedback.potentialEstimate} · Oferta sugerida €{feedback.suggestedOffer}M
                    </span>
                    {feedback.specialized && <span className="text-amber ml-1.5">(especialidad — más certero)</span>}
                  </div>
                )}
              </div>
            );
          })}
          {!filtered.length && (
            <p className="px-4 py-6 text-center text-gray-600 text-sm bg-panel border border-border rounded-2xl">Sin resultados.</p>
          )}
        </div>

        <p className="text-xs text-gray-600 mt-3">
          El potencial es una proyección de tu reclutador, no una promesa: capaz el jugador llega a ese nivel, capaz se queda un poco corto.
        </p>
      </div>
    </div>
  );
}
