import { useMemo, useState } from "react";
import { attrPairs, attrValuesOf } from "../engine/gkAttributes.js";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { SCOUT_SPECIALTIES, MAX_SCOUTS, formatRange, reportFor, isFamous } from "../engine/scouting.js";

const SPECIALTY_LIST = Object.values(SCOUT_SPECIALTIES);
const LEAGUE_LABEL = { premier: "Premier", laliga: "La Liga", seriea: "Serie A", bundesliga: "Bundesliga" };
const ATTR_LABELS = [["pace", "RIT"], ["shooting", "TIR"], ["passing", "PAS"], ["dribbling", "REG"], ["defending", "DEF"], ["physical", "FIS"]];

function HireAgentCard({ title, description, onHire, disabled }) {
  const [specialty, setSpecialty] = useState("ovr");
  const [seasons, setSeasons] = useState(1);
  const [feedback, setFeedback] = useState(null);

  function handleHire() {
    const res = onHire(specialty, seasons);
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
      <p className="text-xs text-gray-500">{SCOUT_SPECIALTIES[specialty]?.desc}</p>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={seasons} onChange={(e) => setSeasons(Number(e.target.value))} className="bg-bg border border-border rounded-xl px-3 py-2 text-xs">
          <option value={1}>1 temporada</option>
          <option value={2}>2 temporadas</option>
        </select>
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

function WatchButton({ watched, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={watched ? "Quitar de seguimiento" : "Seguir jugador (aparece en Central de Transferencias)"}
      className={`text-lg leading-none shrink-0 ${watched ? "text-amber" : "text-gray-600 hover:text-gray-300"}`}
    >
      {watched ? "★" : "☆"}
    </button>
  );
}

export default function Scouts() {
  const {
    state, team, hireScout, sendScoutMission, toggleWatchlist,
  } = useCareer();
  const [teamId, setTeamId] = useState(team.id);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("scouting"); // scouting | reports
  const [openId, setOpenId] = useState(null); // jugador con las estadísticas desplegadas

  const hiredScouts = state.hiredScouts || [];
  const scoutMissions = state.scoutMissions || [];
  const scoutReports = state.scoutReports || {};
  const watchlist = state.watchlist || [];
  const ownSquadIds = new Set(state.squad.map((p) => p.id));

  const pool = useMemo(
    () => (teamId === team.id ? state.squad : allPlayers.filter((p) => p.teamId === teamId)),
    [teamId, team.id, state.squad]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => b.ovr - a.ovr).slice(0, 40);
  }, [pool, query]);

  const scoutedIds = Object.keys(scoutReports);
  const [reportQuery, setReportQuery] = useState("");
  const scoutedPlayers = useMemo(() => {
    const q = reportQuery.trim().toLowerCase();
    const ids = new Set(scoutedIds);
    allPlayers.forEach((p) => { if (isFamous(p)) ids.add(p.id); });
    return [...ids]
      .map((id) => allPlayers.find((pl) => pl.id === id))
      .filter((p) => p && !ownSquadIds.has(p.id) && (!q || p.name.toLowerCase().includes(q) || (teamById(p.teamId)?.name || "").toLowerCase().includes(q)))
      .sort((x, y) => y.ovr - x.ovr);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoutReports, reportQuery, state.squad.length]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
        Ya no hay un ojeador fijo: contratás agentes especializados (por temporadas) y los mandás a
        investigar. El ojeador viaja a la liga del jugador entre 3 y 14 días (más rápido si es conocido)
        y, cuantos más días se queda, más jugadores de esa liga trae. Las figuras mundiales ya vienen scouteadas.
      </p>

      <div className="flex gap-1 flex-wrap">
        {[
          ["scouting", "Contratar / Pedir informe"],
          ["reports", `Scouteados (${scoutedPlayers.length})`],
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
                    {m.targetPlayerName} · liga {LEAGUE_LABEL[m.league] || "—"} · ~{m.days} días ({m.playerIds.length} jugadores) — vuelve en la jornada {m.resolveWeek}
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
                const report = reportFor(scoutReports, p);
                const pending = scoutMissions.some((m) => m.playerIds.includes(p.id));
                const isOwn = ownSquadIds.has(p.id);
                const open = openId === p.id;
                return (
                  <div key={p.id} className="bg-panel border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03]" onClick={() => setOpenId(open ? null : p.id)}>
                      {!isOwn && <span onClick={(e) => e.stopPropagation()}><WatchButton watched={watchlist.includes(p.id)} onToggle={() => toggleWatchlist(p.id)} /></span>}
                      <div className="w-9 h-9 shrink-0 rounded-card bg-bg border border-border flex items-center justify-center text-xs font-bold text-gray-400">
                        {p.position}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{p.age} años</p>
                      </div>
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
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
                    {open && (
                      <div className="border-t border-border px-4 py-3 space-y-2.5 bg-bg/40">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                          <span>OVR est. <b className="text-white">{report ? formatRange(report.ovrRange) : "—"}</b></span>
                          <span>Potencial <b className="text-white">{report?.potentialEstimate != null ? `~${report.potentialEstimate}` : "—"}</b></span>
                          <span>Valor <b className="text-white">€{p.value}M</b></span>
                        </div>
                        {report ? (
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                            {attrPairs(p, true).map(([key, label]) => (
                              <div key={key} className="bg-bg border border-border rounded-xl px-2 py-1.5 text-center">
                                <p className="text-xs uppercase tracking-wide text-gray-600">{label}</p>
                                <p className="text-sm font-semibold">{attrValuesOf(p)[key] ?? "—"}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600">Sin scoutear: mandá un ojeador para conocer sus estadísticas.</p>
                        )}
                      </div>
                    )}
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
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={reportQuery}
              onChange={(e) => setReportQuery(e.target.value)}
              placeholder="Buscar entre los scouteados (jugador o club)…"
              className="bg-panel border border-border rounded-2xl px-4 py-2.5 text-sm flex-1 min-w-[200px]"
            />
            <p className="text-xs text-gray-600">Incluye a las figuras mundiales, que ya vienen scouteadas.</p>
          </div>
          {!scoutedPlayers.length && (
            <p className="px-4 py-6 text-center text-gray-600 text-sm bg-panel border border-border rounded-2xl">Todavía no scouteaste a nadie.</p>
          )}
          {scoutedPlayers.map((p) => {
            const report = reportFor(scoutReports, p);
            if (!report) return null;
            const t = teamById(p.teamId);
            const inCentral = watchlist.includes(p.id);
            const open = openId === p.id;
            return (
              <div key={p.id} className="bg-panel border border-border rounded-2xl px-4 py-3 space-y-2.5">
                <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => setOpenId(open ? null : p.id)}>
                  <div className="w-9 h-9 shrink-0 rounded-card bg-bg border border-border flex items-center justify-center text-xs font-bold text-gray-400">
                    {p.position}
                  </div>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="text-sm font-semibold truncate">
                      {p.name}
                      {report.isPublic && <span className="ml-1.5 text-xs text-accent">● conocido</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{t?.name} · {LEAGUE_LABEL[t?.league] || ""} · {p.age} años · {p.nationality}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWatchlist(p.id); }}
                    className={`shrink-0 text-xs font-medium px-3 py-2 rounded-full border transition-colors ${
                      inCentral
                        ? "bg-amber/10 text-amber border-amber/40 hover:bg-amber/20"
                        : "bg-accent/10 text-accent border-accent/40 hover:bg-accent/20"
                    }`}
                  >
                    {inCentral ? "★ En la Central (quitar)" : "☆ Poner en la Central"}
                  </button>
                </div>
                {open && (
                  <>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                      <span>OVR act. <b className="text-white">{formatRange(report.ovrRange)}</b></span>
                      <span>OVR pot. <b className="text-white">~{report.potentialEstimate}</b></span>
                      <span>Valor <b className="text-white">€{p.value}M</b></span>
                      <span>Oferta sugerida <b className="text-white">€{report.suggestedOffer}M</b></span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {attrPairs(p, true).map(([key, label]) => (
                        <div key={key} className="bg-bg border border-border rounded-xl px-2 py-1.5 text-center">
                          <p className="text-xs uppercase tracking-wide text-gray-600">{label}</p>
                          <p className="text-sm font-semibold">{attrValuesOf(p)[key] ?? "—"}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
