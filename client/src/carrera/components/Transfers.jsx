import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { formatRange, reportFor } from "../engine/scouting.js";
import { HINT_LABEL } from "../engine/transferMarket.js";
import Scouts from "./Scouts.jsx";

function findAnyPlayer(state, playerId) {
  return state.squad.find((p) => p.id === playerId) || allPlayers.find((p) => p.id === playerId);
}

const LEAGUE_OPTIONS = [["premier", "Premier League"], ["laliga", "La Liga"], ["seriea", "Serie A"], ["bundesliga", "Bundesliga"]];
const ALL_POSITIONS = [...new Set(allPlayers.map((p) => p.position))].sort();

export default function Transfers() {
  const {
    state, team, offerForPlayer, offerContractTo, completeTransfer,
    isOnOfferCooldown, weeksUntilCanOffer, isTransferWindowOpen,
    toggleWatchlist, respondToIncomingOffer, sendScoutMission,
  } = useCareer();
  const [subTab, setSubTab] = useState("mercado");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [teamId, setTeamId] = useState("");
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [ovrMin, setOvrMin] = useState("");
  const [ovrMax, setOvrMax] = useState("");
  const [availability, setAvailability] = useState(""); // "" | contract | scouted
  const [target, setTarget] = useState(null);

  const windowOpen = isTransferWindowOpen();
  const ownedIds      = new Set([
    ...state.squad.map((p) => p.id),
    ...(state.acquired || []),
    ...Object.keys(state.stolenByAI || {}).map(Number),
  ]);
  const watchlist     = state.watchlist || [];
  const sentOffers    = state.sentOffers || [];
  const incomingOffers = state.incomingOffers || [];
  const pendingIncoming = incomingOffers.filter((o) => o.status === "pending");
  const releaseClauses = state.releaseClauses || {};

  // Buscador de jugadores: filtra por liga, club, edad, OVR (solo entre los
  // scouteados — al resto no se le conoce el nivel) y disponibilidad. Sin
  // filtros muestra los mejores del mundo.
  const pool = useMemo(
    () => allPlayers.filter((p) => !ownedIds.has(p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(state.acquired || []).length, state.squad.length]
  );
  const clubsForLeague = useMemo(
    () => teams.filter((t) => t.id !== team.id && (!leagueFilter || t.league === leagueFilter)),
    [leagueFilter, team.id]
  );
  const scoutReports = state.scoutReports || {};
  const { filtered, totalMatches } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const aMin = ageMin === "" ? null : Number(ageMin);
    const aMax = ageMax === "" ? null : Number(ageMax);
    const oMin = ovrMin === "" ? null : Number(ovrMin);
    const oMax = ovrMax === "" ? null : Number(ovrMax);
    const list = pool
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .filter((p) => !posFilter || p.position === posFilter)
      .filter((p) => !teamId || p.teamId === teamId)
      .filter((p) => !leagueFilter || teamById(p.teamId)?.league === leagueFilter)
      .filter((p) => aMin == null || p.age >= aMin)
      .filter((p) => aMax == null || p.age <= aMax)
      .filter((p) => {
        if (oMin == null && oMax == null) return true;
        const r = reportFor(scoutReports, p);
        if (!r) return false; // sin scoutear no se le conoce el OVR
        const mid = (r.ovrRange[0] + r.ovrRange[1]) / 2;
        return (oMin == null || mid >= oMin) && (oMax == null || mid <= oMax);
      })
      .filter((p) => availability !== "contract" || p.contractYears <= 1)
      .filter((p) => availability !== "scouted" || !!reportFor(scoutReports, p))
      .sort((a, b) => b.ovr - a.ovr);
    return { filtered: list.slice(0, 50), totalMatches: list.length };
  }, [pool, query, posFilter, teamId, leagueFilter, ageMin, ageMax, ovrMin, ovrMax, availability, scoutReports]);

  const hiredScouts = state.hiredScouts || [];
  const scoutMissions = state.scoutMissions || [];

  return (
    <div className="space-y-5">
      {/* Banner ventana cerrada */}
      {!windowOpen && (
        <div className="bg-amber/10 border border-amber/30 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber text-lg shrink-0">🔒</span>
          <div>
            <p className="text-sm font-semibold text-amber">Ventana de transferencias cerrada</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Podés negociar y explorar el mercado, pero no podés cerrar fichajes hasta la ventana de invierno (jornada 20-24) o el próximo verano.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold mb-1">Fichajes</h2>
          <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
            Primero le ofertás al club por el pase. Si acepta, recién ahí le ofrecés contrato al jugador.
          </p>
        </div>
        <div className="bg-panel border border-border rounded-2xl px-4 py-2.5 text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">Presupuesto</p>
          <p className="text-lg font-bold text-accent leading-none">€{state.budget}M</p>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {[
          ["mercado", "Mercado"],
          ["scouting", "Scouting"],
          ["central", `Central de Transferencias${pendingIncoming.length ? ` (${pendingIncoming.length})` : ""}`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`px-3 py-1.5 rounded-card text-sm font-medium ${subTab === id ? "bg-accent/15 text-accent border border-accent/30" : "text-gray-400 border border-transparent hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "mercado" && (
        <>
          <div className="bg-panel border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">🔍 Buscar jugadores</p>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre del jugador…"
                className="bg-bg border border-border rounded-2xl px-4 py-2.5 text-sm flex-1 min-w-[160px]"
              />
              <select
                value={leagueFilter}
                onChange={(e) => { setLeagueFilter(e.target.value); setTeamId(""); }}
                className="bg-bg border border-border rounded-2xl px-3 py-2.5 text-sm"
              >
                <option value="">Todas las ligas</option>
                {LEAGUE_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="bg-bg border border-border rounded-2xl px-3 py-2.5 text-sm max-w-[200px]">
                <option value="">Todos los clubes</option>
                {clubsForLeague.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="bg-bg border border-border rounded-2xl px-3 py-2.5 text-sm">
                <option value="">Cualquier posición</option>
                {ALL_POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-3 items-center text-xs text-gray-400">
              <span>Edad</span>
              <input type="number" min={15} max={45} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="mín" className="w-16 bg-bg border border-border rounded-xl px-2 py-2 text-sm" />
              <span>a</span>
              <input type="number" min={15} max={45} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="máx" className="w-16 bg-bg border border-border rounded-xl px-2 py-2 text-sm" />
              <span className="ml-2" title="Solo filtra entre los jugadores scouteados">OVR (scouteados)</span>
              <input type="number" min={30} max={99} value={ovrMin} onChange={(e) => setOvrMin(e.target.value)} placeholder="mín" className="w-16 bg-bg border border-border rounded-xl px-2 py-2 text-sm" />
              <span>a</span>
              <input type="number" min={30} max={99} value={ovrMax} onChange={(e) => setOvrMax(e.target.value)} placeholder="máx" className="w-16 bg-bg border border-border rounded-xl px-2 py-2 text-sm" />
              <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="ml-auto bg-bg border border-border rounded-2xl px-3 py-2 text-sm text-gray-300">
                <option value="">Mercado: todos</option>
                <option value="contract">Último año de contrato</option>
                <option value="scouted">Solo scouteados</option>
              </select>
            </div>
            <p className="text-[11px] text-gray-600">{totalMatches} jugador{totalMatches === 1 ? "" : "es"} — mostrando los {filtered.length} de mayor OVR.</p>
          </div>

          <div className="hidden md:flex items-center gap-3 px-4 text-[10px] uppercase tracking-wide text-gray-600">
            <span className="w-5" />
            <span className="w-9" />
            <span className="flex-1">Jugador</span>
            <span className="w-16 text-center">OVR act.</span>
            <span className="w-16 text-center">OVR pot.</span>
            <span className="w-20 text-center">Valor</span>
            <span className="w-[170px]" />
          </div>

          <div className="space-y-2">
            {filtered.map((p) => {
              const report = reportFor(scoutReports, p);
              const cooling = isOnOfferCooldown(p.id);
              const watched = watchlist.includes(p.id);
              const clause = releaseClauses[p.id];
              const scouting = scoutMissions.some((m) => m.playerIds.includes(p.id));
              return (
                <div key={p.id} className="bg-panel border border-border rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={() => toggleWatchlist(p.id)}
                    title={watched ? "Quitar de la Central de Transferencias" : "Poner en la Central de Transferencias"}
                    className={`text-lg leading-none shrink-0 w-5 ${watched ? "text-amber" : "text-gray-600 hover:text-gray-300"}`}
                  >
                    {watched ? "★" : "☆"}
                  </button>

                  <div className="w-9 h-9 shrink-0 rounded-card bg-bg border border-border flex items-center justify-center text-[11px] font-bold text-gray-400">
                    {p.position}
                  </div>

                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <p className="text-sm font-semibold truncate">{p.name}{report?.isPublic && <span className="ml-1.5 text-[10px] text-accent" title="Figura mundial: ya viene scouteado">● conocido</span>}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {teamById(p.teamId)?.name} · {p.age} años
                      {clause != null && <span className="text-amber ml-1.5">· cláusula €{clause}M</span>}
                      {p.contractYears <= 1 && <span className="text-amber ml-1.5">· último año de contrato</span>}
                    </p>
                  </div>

                  <div className="flex flex-col items-center w-16 shrink-0">
                    <span className="md:hidden text-[10px] uppercase tracking-wide text-gray-600">OVR act.</span>
                    <span className="text-sm font-semibold">{report ? formatRange(report.ovrRange) : <span className="text-gray-600">—</span>}</span>
                  </div>

                  <div className="flex flex-col items-center w-16 shrink-0">
                    <span className="md:hidden text-[10px] uppercase tracking-wide text-gray-600">OVR pot.</span>
                    <span className="text-sm text-gray-300">{report?.potentialEstimate != null ? `~${report.potentialEstimate}` : <span className="text-gray-600">—</span>}</span>
                  </div>

                  <div className="flex flex-col items-center w-20 shrink-0">
                    <span className="md:hidden text-[10px] uppercase tracking-wide text-gray-600">Valor</span>
                    <span className="text-sm font-semibold">€{p.value}M</span>
                  </div>

                  <div className="shrink-0 ml-auto sm:ml-0 flex items-center gap-1.5 sm:w-[170px] justify-end">
                    {!report && !scouting && (
                      hiredScouts.length ? (
                        <select
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) sendScoutMission(e.target.value, p.id); e.target.value = ""; }}
                          title="Mandar a un ojeador a la liga de este jugador"
                          className="text-sm font-medium px-3 py-2.5 rounded-2xl bg-panel border border-border text-gray-300 hover:border-gray-500 transition-colors"
                        >
                          <option value="">🔎 Scoutear…</option>
                          {hiredScouts.map((sc) => (
                            <option key={sc.id} value={sc.id}>{sc.specialty === "ovr" ? "OVR" : sc.specialty === "potential" ? "Potencial" : "Generalista"}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-600" title="Contratá un ojeador en la pestaña Scouting">🔎 sin ojeadores</span>
                      )
                    )}
                    {scouting && <span className="text-xs text-gray-600 px-2">🔎 en camino…</span>}
                    {cooling ? (
                      <span className="text-xs text-gray-600 px-3 py-2.5 inline-block" title="Te rechazaron hace poco">
                        Esperá {weeksUntilCanOffer(p.id)} sem.
                      </span>
                    ) : (
                      <button
                        onClick={() => setTarget(p)}
                        className="text-sm font-medium px-4 py-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors whitespace-nowrap"
                      >
                        Fichar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!filtered.length && (
              <p className="px-4 py-6 text-center text-gray-600 text-sm bg-panel border border-border rounded-2xl">Sin resultados con esos filtros.</p>
            )}
          </div>

          <p className="text-xs text-gray-600">
            Las figuras mundiales (●) ya vienen scouteadas. Para el resto, el OVR es un "—" hasta que mandes un ojeador: viaja a la liga del jugador entre 3 y 14 días (más rápido cuanto más conocido) y trae informes de varios jugadores de esa liga. La estrella lo suma a la Central de Transferencias.
          </p>
        </>
      )}

      {subTab === "scouting" && <Scouts />}

      {subTab === "central" && (
        <TransferHub
          state={state}
          watchlist={watchlist}
          sentOffers={sentOffers}
          incomingOffers={incomingOffers}
          onUnwatch={toggleWatchlist}
          onOffer={(p) => setTarget(p)}
          onRespond={respondToIncomingOffer}
        />
      )}

      {target && (
        <OfferFlow
          player={target}
          budget={state.budget}
          report={reportFor(state.scoutReports, target)}
          releaseClause={releaseClauses[target.id]}
          windowOpen={windowOpen}
          isOnOfferCooldown={isOnOfferCooldown}
          weeksUntilCanOffer={weeksUntilCanOffer}
          onOfferForPlayer={offerForPlayer}
          onOfferContractTo={offerContractTo}
          onComplete={completeTransfer}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

function TransferHub({ state, watchlist, sentOffers, incomingOffers, onUnwatch, onOffer, onRespond }) {
  const pending  = incomingOffers.filter((o) => o.status === "pending");
  const resolved = incomingOffers.filter((o) => o.status !== "pending");

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2.5">📨 Ofertas recibidas por tus jugadores</h3>
        {!pending.length && <p className="text-xs text-gray-600">Ninguna oferta pendiente por ahora.</p>}
        <div className="space-y-2">
          {pending.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 bg-panel border border-border rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{o.playerName}</p>
                <p className="text-xs text-gray-500">{o.teamName} ofrece {o.isLoan ? "un préstamo" : `€${o.amount}M por el pase`}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onRespond(o.id, true)} className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald/15 text-emerald border border-emerald/40 hover:bg-emerald/25 transition-colors">
                  Aceptar
                </button>
                <button onClick={() => onRespond(o.id, false)} className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors">
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
        {!!resolved.length && (
          <details className="mt-2.5">
            <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">Historial de ofertas recibidas ({resolved.length})</summary>
            <div className="mt-2 space-y-1.5">
              {resolved.slice(0, 10).map((o) => (
                <p key={o.id} className="text-xs text-gray-500">
                  {o.teamName} por {o.playerName} — {o.isLoan ? "préstamo" : `€${o.amount}M`} · <span className={o.status === "accepted" ? "text-emerald" : "text-red-400"}>{o.status === "accepted" ? "aceptada" : "rechazada"}</span>
                </p>
              ))}
            </div>
          </details>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2.5">☆ Jugadores que seguís</h3>
        {!watchlist.length && <p className="text-xs text-gray-600">Marcá jugadores con la estrella en el Mercado o en Scouting para seguirlos acá.</p>}
        <div className="grid sm:grid-cols-2 gap-2.5">
          {watchlist.map((id) => {
            const p = findAnyPlayer(state, id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center justify-between gap-2 bg-panel border border-border rounded-2xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.position} · {p.age} años · €{p.value}M · {teamById(p.teamId)?.name}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => onOffer(p)} className="text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors">
                    Fichar
                  </button>
                  <button onClick={() => onUnwatch(id)} className="text-xs px-2.5 py-1.5 rounded-full border border-border text-gray-500 hover:text-white hover:border-gray-500 transition-colors">
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2.5">📤 Ofertas que mandaste</h3>
        {!sentOffers.length && <p className="text-xs text-gray-600">Todavía no mandaste ninguna oferta.</p>}
        <div className="space-y-1.5">
          {sentOffers.map((o) => (
            <p key={o.id} className="text-xs text-gray-500">
              {o.type === "fee" ? `€${o.amount}M por el pase de` : `€${o.amount}k/sem (${o.years} años) a`} {o.playerName}
              {o.byClause ? " (cláusula)" : ""} · <span className={o.accepted ? "text-emerald" : "text-red-400"}>{o.accepted ? "aceptada" : "rechazada"}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

const STEP_LABELS = { fee: 1, "window-closed-after-fee": 1, wage: 2, "window-closed": 2, "complete-error": 2, done: 2 };

function StepIndicator({ stage }) {
  const step = STEP_LABELS[stage] || 1;
  return (
    <div className="flex items-center gap-2 mb-1">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-2 flex-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
            step >= n ? "bg-accent text-onaccent" : "bg-bg border border-border text-gray-500"
          }`}>
            {n}
          </div>
          <span className={`text-xs ${step >= n ? "text-gray-300" : "text-gray-600"}`}>{n === 1 ? "Pase" : "Contrato"}</span>
          {n === 1 && <div className={`h-px flex-1 ${step >= 2 ? "bg-accent" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function OfferFlow({ player, budget, report, releaseClause, windowOpen, isOnOfferCooldown, weeksUntilCanOffer, onOfferForPlayer, onOfferContractTo, onComplete, onClose }) {
  const sellerTeam = teamById(player.teamId);
  const [stage, setStage] = useState("fee");
  const [feeInput, setFeeInput] = useState(report?.suggestedOffer ?? player.value);
  const [feeAgreed, setFeeAgreed] = useState(null);
  const [feeResult, setFeeResult] = useState(null);
  const [wageInput, setWageInput] = useState(player.wage + Math.round(player.wage * 0.2));
  const [years, setYears] = useState(3);
  const [wageResult, setWageResult] = useState(null);
  const [completeError, setCompleteError] = useState(null);

  const feeCooling = isOnOfferCooldown(player.id);

  function submitFee(overrideAmount) {
    const amount = overrideAmount ?? feeInput;
    if (amount > budget) {
      setFeeResult({ accepted: false, hint: "muy_lejos", noBudget: true });
      return;
    }
    const res = onOfferForPlayer(player, amount);
    setFeeResult(res);
    if (res.askingPrice != null) setFeeInput(res.askingPrice);
    if (res.accepted) {
      setFeeAgreed(amount);
      setStage(!windowOpen ? "window-closed-after-fee" : "wage");
    }
  }

  function submitWage() {
    const res = onOfferContractTo(player, wageInput, years);
    setWageResult(res);
    if (res.expectedWageHint != null) setWageInput(res.expectedWageHint);
    if (res.accepted) {
      const completed = onComplete(player, feeAgreed, wageInput, years);
      if (completed?.success === false) {
        if (completed.reason === "window_closed") setStage("window-closed");
        else { setCompleteError(completed.reason); setStage("complete-error"); }
      } else {
        setStage("done");
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-panel border border-border rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold">{player.name}</p>
              <p className="text-xs text-gray-500">{player.position} · {player.age} años · {sellerTeam.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
          </div>
          <StepIndicator stage={stage} />
        </div>

        <div className="p-4 space-y-4">
          {stage === "fee" && (
            <>
              <p className="text-sm text-gray-400">
                Valor de mercado: <span className="text-white font-semibold">€{player.value}M</span> · Presupuesto: <span className="text-white font-semibold">€{budget}M</span>
                {report?.suggestedOffer != null && <> · Sugerida por scout: <span className="text-white font-semibold">€{report.suggestedOffer}M</span></>}
              </p>
              <p className="text-xs text-gray-500">Si igualás o superás lo que pide el club, el pase se cierra seguro. Por debajo es más arriesgado.</p>

              {/* Cláusula de liberación */}
              {releaseClause != null && (
                <div className="bg-amber/5 border border-amber/25 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-amber font-semibold">⚡ Cláusula de liberación: €{releaseClause}M</p>
                  <p className="text-xs text-gray-500">Pagando esta cifra el club está obligado a vender sin importar su decisión.</p>
                  <button
                    onClick={() => submitFee(releaseClause)}
                    disabled={releaseClause > budget || feeCooling}
                    className="text-xs px-3 py-1.5 rounded-full bg-amber/15 text-amber border border-amber/30 hover:bg-amber/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {releaseClause > budget ? "No te alcanza el presupuesto" : `Activar cláusula (€${releaseClause}M)`}
                  </button>
                </div>
              )}

              {feeResult && !feeResult.accepted && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 space-y-1">
                  <p className="text-sm text-red-300">
                    ❌ {feeResult.noBudget ? "No te alcanza el presupuesto." : `Rechazada. ${HINT_LABEL[feeResult.hint]}`}
                  </p>
                  {feeResult.askingPrice != null && (
                    <p className="text-xs text-gray-400">El club pide unos <span className="text-white font-semibold">€{feeResult.askingPrice}M</span> — ya te lo prellenamos abajo, ajustá y volvé a intentar.</p>
                  )}
                </div>
              )}

              {feeCooling ? (
                <p className="text-xs text-amber">😤 Le ofertaste algo muy bajo y el club no quiere hablar por {weeksUntilCanOffer(player.id)} semana{weeksUntilCanOffer(player.id) === 1 ? "" : "s"} más.</p>
              ) : (
                <>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide">Oferta por el pase (€M)</label>
                  <input
                    type="number" min="0" step="0.5" value={feeInput}
                    onChange={(e) => setFeeInput(Number(e.target.value))}
                    className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
                  />
                  <button onClick={() => submitFee()} className="w-full bg-accent text-onaccent font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                    {feeResult && !feeResult.accepted ? "Volver a ofertar" : "Enviar oferta al club"}
                  </button>
                </>
              )}
            </>
          )}

          {stage === "window-closed-after-fee" && (
            <>
              <p className="text-sm text-emerald font-medium">✅ El club aceptó €{feeAgreed}M por el pase.</p>
              <div className="bg-amber/10 border border-amber/30 rounded-xl p-3">
                <p className="text-sm text-amber font-semibold">🔒 Ventana cerrada</p>
                <p className="text-xs text-gray-400 mt-1">El pase está acordado pero no podés cerrar el fichaje hasta la ventana de invierno (jornada 20-24) o el próximo verano.</p>
              </div>
              <button onClick={onClose} className="w-full bg-panel border border-border text-gray-300 font-semibold py-2.5 rounded-2xl hover:border-gray-500 transition">
                Cerrar (negociación pendiente)
              </button>
            </>
          )}

          {stage === "wage" && (
            <>
              <p className="text-sm text-emerald font-medium">✅ El club aceptó €{feeAgreed}M por el pase.</p>
              <p className="text-sm text-gray-400">Sueldo actual: <span className="text-white font-semibold">€{player.wage}k/sem</span></p>
              <p className="text-xs text-gray-500">Si igualás o superás lo que pide, firma seguro. Contratos de 1 año piden un plus.</p>

              {wageResult && !wageResult.accepted && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 space-y-1">
                  <p className="text-sm text-red-300">❌ Rechazó el contrato. {HINT_LABEL[wageResult.hint]}</p>
                  {wageResult.expectedWageHint != null && (
                    <p className="text-xs text-gray-400">Pide unos <span className="text-white font-semibold">€{wageResult.expectedWageHint}k/sem</span> — ya lo prellenamos, ajustá y reintentá.</p>
                  )}
                </div>
              )}

              <label className="block text-xs text-gray-500 uppercase tracking-wide">Sueldo ofrecido (€k/semana)</label>
              <input
                type="number" min="1" value={wageInput}
                onChange={(e) => setWageInput(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
              />
              <label className="block text-xs text-gray-500 uppercase tracking-wide">Años de contrato</label>
              <select value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm">
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} año{y === 1 ? "" : "s"}</option>)}
              </select>
              <button onClick={submitWage} className="w-full bg-accent text-onaccent font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                {wageResult && !wageResult.accepted ? "Volver a ofrecer" : "Ofrecer contrato al jugador"}
              </button>
            </>
          )}

          {stage === "window-closed" && (
            <>
              <p className="text-sm text-emerald font-medium">✅ El jugador aceptó el contrato.</p>
              <div className="bg-amber/10 border border-amber/30 rounded-xl p-3">
                <p className="text-sm text-amber font-semibold">🔒 Ventana cerrada</p>
                <p className="text-xs text-gray-400 mt-1">Todo está acordado pero no podés formalizar el traspaso hasta que abra la ventana.</p>
              </div>
              <button onClick={onClose} className="w-full bg-panel border border-border text-gray-300 font-semibold py-2.5 rounded-2xl hover:border-gray-500 transition">
                Cerrar
              </button>
            </>
          )}

          {stage === "complete-error" && (
            <>
              <p className="text-sm text-red-400">
                ❌ {completeError === "insufficient_budget" ? "El presupuesto bajó y ya no te alcanza para cerrar este fichaje." : "No se pudo cerrar el fichaje."}
              </p>
              <p className="text-xs text-gray-500">El acuerdo con el jugador se perdió. Revisá tu presupuesto e intentá de nuevo más adelante.</p>
              <button onClick={onClose} className="w-full bg-panel border border-border text-gray-300 font-semibold py-2.5 rounded-2xl hover:border-gray-500 transition">
                Cerrar
              </button>
            </>
          )}

          {stage === "done" && (
            <>
              <p className="text-sm text-emerald font-semibold">🎉 ¡Fichaje cerrado! {player.name} ya es tuyo.</p>
              <button onClick={onClose} className="w-full bg-accent text-onaccent font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
