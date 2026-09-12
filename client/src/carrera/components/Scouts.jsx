import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { SCOUT_SPECIALTIES, MAX_SCOUTS, formatRange } from "../engine/scouting.js";
import { ACADEMY_COUNTRIES, MAX_ACADEMY_AGENTS } from "../engine/academy.js";

const SPECIALTY_LIST = Object.values(SCOUT_SPECIALTIES);

function HireAgentCard({ title, description, onHire, cost, disabled, extraField }) {
  const [specialty, setSpecialty] = useState("ovr");
  const [seasons, setSeasons] = useState(1);
  const [country, setCountry] = useState(ACADEMY_COUNTRIES[0]);
  const [feedback, setFeedback] = useState(null);

  function handleHire() {
    const res = extraField ? onHire(specialty, seasons, country) : onHire(specialty, seasons);
    if (res?.error === "insufficient_budget") setFeedback(`No te alcanza el presupuesto (cuesta €${res.cost}M).`);
    else if (res?.error === "max_scouts" || res?.error === "max_agents") setFeedback("Ya tenés el máximo de 3 contratados.");
    else if (res?.success) setFeedback(`✅ Contratado por €${res.scout?.cost ?? res.agent?.cost}M.`);
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {SPECIALTY_LIST.map((s) => (
          <button
            key={s.id}
            onClick={() => setSpecialty(s.id)}
            className={`text-left p-2.5 rounded-xl border text-xs transition-colors ${
              specialty === s.id ? "border-accent bg-accent/10" : "border-border hover:border-gray-500"
            }`}
          >
            <p className="font-semibold">{s.label}</p>
            <p className="text-gray-500 mt-0.5">{s.id === "both" ? "€15M" : "€5-7M"}</p>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-500">{SCOUT_SPECIALTIES[specialty]?.desc}</p>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={seasons} onChange={(e) => setSeasons(Number(e.target.value))} className="bg-bg border border-border rounded-xl px-3 py-2 text-xs">
          <option value={1}>1 temporada</option>
          <option value={2}>2 temporadas</option>
        </select>
        {extraField && (
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="bg-bg border border-border rounded-xl px-3 py-2 text-xs">
            {ACADEMY_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button
          onClick={handleHire}
          disabled={disabled}
          className="ml-auto text-xs font-medium px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 disabled:opacity-40 transition-colors"
        >
          Contratar
        </button>
      </div>
      {feedback && <p className="text-xs text-amber">{feedback}</p>}
    </div>
  );
}

export default function Scouts() {
  const {
    state, team, hireScout, sendScoutMission, hireAcademyAgent, signAcademyProspect,
  } = useCareer();
  const [teamId, setTeamId] = useState(team.id);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("scouting"); // scouting | reports | academy

  const hiredScouts = state.hiredScouts || [];
  const scoutMissions = state.scoutMissions || [];
  const academyAgents = state.academyAgents || [];
  const academyPool = state.academyPool || [];
  const scoutReports = state.scoutReports || {};

  const pool = useMemo(
    () => (teamId === team.id ? state.squad : allPlayers.filter((p) => p.teamId === teamId)),
    [teamId, team.id, state.squad]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => b.ovr - a.ovr).slice(0, 40);
  }, [pool, query]);

  const scoutedIds = Object.keys(scoutReports);

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
        Ya no hay un ojeador fijo: contratás agentes especializados (por temporadas) y los mandás a
        investigar. Un informe tarda 1-3 semanas en volver, y de paso trae datos de varios compañeros
        de liga del jugador pedido.
      </p>

      <div className="flex gap-1 flex-wrap">
        {[
          ["scouting", "Contratar / Pedir informe"],
          ["reports", `Ya scouteados (${scoutedIds.length})`],
          ["academy", `Inferiores (${academyPool.length})`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`px-3 py-1.5 rounded-card text-sm font-medium ${section === id ? "bg-accent/15 text-accent border border-accent/30" : "text-gray-400 border border-transparent hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "scouting" && (
        <div className="space-y-5">
          <HireAgentCard
            title={`Contratar ojeador (${hiredScouts.length}/${MAX_SCOUTS})`}
            description="Cada ojeador es fiel a su especialidad: preciso en lo suyo, ~10 puntos de margen extra en lo otro."
            onHire={hireScout}
            disabled={hiredScouts.length >= MAX_SCOUTS}
          />

          {!!hiredScouts.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tus ojeadores contratados</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {hiredScouts.map((sc) => (
                  <div key={sc.id} className="bg-panel border border-border rounded-2xl px-4 py-3">
                    <p className="text-sm font-semibold">{SCOUT_SPECIALTIES[sc.specialty]?.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Quedan {sc.seasonsLeft} temporada{sc.seasonsLeft === 1 ? "" : "s"} de contrato</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!scoutMissions.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Informes en camino</p>
              <div className="flex flex-wrap gap-2">
                {scoutMissions.map((m) => (
                  <span key={m.id} className="text-xs px-3 py-1.5 rounded-full border border-border text-gray-400">
                    {m.targetPlayerName} — llega en jornada {m.resolveWeek}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Elegí a quién investigar</p>
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
                const report = scoutReports[p.id];
                const pending = scoutMissions.some((m) => m.playerIds.includes(p.id));
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
                      <div className="shrink-0">
                        {pending ? (
                          <span className="text-xs text-gray-600 px-3 py-2.5 inline-block">En camino…</span>
                        ) : !hiredScouts.length ? (
                          <span className="text-xs text-gray-600 px-3 py-2.5 inline-block" title="Contratá un ojeador primero">Contratá un ojeador</span>
                        ) : (
                          <select
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) sendScoutMission(e.target.value, p.id); e.target.value = ""; }}
                            className="text-sm font-medium px-3 py-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors"
                          >
                            <option value="">Mandar ojeador…</option>
                            {hiredScouts.map((sc) => (
                              <option key={sc.id} value={sc.id}>{SCOUT_SPECIALTIES[sc.specialty]?.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!filtered.length && (
                <p className="px-4 py-6 text-center text-gray-600 text-sm bg-panel border border-border rounded-2xl">Sin resultados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {section === "reports" && (
        <div className="space-y-2">
          {!scoutedIds.length && (
            <p className="px-4 py-6 text-center text-gray-600 text-sm bg-panel border border-border rounded-2xl">Todavía no scouteaste a nadie.</p>
          )}
          {scoutedIds.map((id) => {
            const p = allPlayers.find((pl) => pl.id === id) || state.squad.find((pl) => pl.id === id);
            if (!p) return null;
            const report = scoutReports[id];
            const t = teamById(p.teamId);
            return (
              <div key={id} className="bg-panel border border-border rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t?.name} · {p.age} años</p>
                </div>
                <div className="flex flex-col items-center w-20 shrink-0">
                  <span className="text-[10px] uppercase tracking-wide text-gray-600">OVR est.</span>
                  <span className="text-sm font-semibold">{formatRange(report.ovrRange)}</span>
                </div>
                <div className="flex flex-col items-center w-24 shrink-0">
                  <span className="text-[10px] uppercase tracking-wide text-gray-600">Potencial</span>
                  <span className="text-sm text-gray-300">~{report.potentialEstimate}</span>
                </div>
                <div className="flex flex-col items-center w-24 shrink-0">
                  <span className="text-[10px] uppercase tracking-wide text-gray-600">Oferta sugerida</span>
                  <span className="text-sm text-gray-300">€{report.suggestedOffer}M</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {section === "academy" && (
        <div className="space-y-5">
          <HireAgentCard
            title={`Contratar agente de inferiores (${academyAgents.length}/${MAX_ACADEMY_AGENTS})`}
            description="Lo mandás a recorrer un país: cada 4 semanas trae ~7 chicos nuevos de 15-18 años ya tasados."
            onHire={hireAcademyAgent}
            disabled={academyAgents.length >= MAX_ACADEMY_AGENTS}
            extraField
          />

          {!!academyAgents.length && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tus agentes activos</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {academyAgents.map((a) => (
                  <div key={a.id} className="bg-panel border border-border rounded-2xl px-4 py-3">
                    <p className="text-sm font-semibold">{SCOUT_SPECIALTIES[a.specialty]?.label} · {a.country}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Quedan {a.seasonsLeft} temporada{a.seasonsLeft === 1 ? "" : "s"} de contrato</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Chicos disponibles para sumar</p>
            <div className="space-y-2">
              {academyPool.map((p) => (
                <div key={p.id} className="bg-panel border border-border rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="w-9 h-9 shrink-0 rounded-card bg-bg border border-border flex items-center justify-center text-[11px] font-bold text-gray-400">
                    {p.position}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.age} años · {p.nationality} · desde {p.country}</p>
                  </div>
                  <div className="flex flex-col items-center w-16 shrink-0">
                    <span className="text-[10px] uppercase tracking-wide text-gray-600">OVR</span>
                    <span className="text-sm font-semibold">{p.ovr}</span>
                  </div>
                  <div className="flex flex-col items-center w-20 shrink-0">
                    <span className="text-[10px] uppercase tracking-wide text-gray-600">Potencial</span>
                    <span className="text-sm text-gray-300">{p.potential}</span>
                  </div>
                  <button
                    onClick={() => signAcademyProspect(p.id)}
                    className="text-sm font-medium px-4 py-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors whitespace-nowrap"
                  >
                    Sumar al plantel
                  </button>
                </div>
              ))}
              {!academyPool.length && (
                <p className="px-4 py-6 text-center text-gray-600 text-sm bg-panel border border-border rounded-2xl">
                  Todavía no llegó nadie de la cantera — contratá un agente arriba.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
