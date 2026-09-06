import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { formatRange } from "../engine/scouting.js";
import { HINT_LABEL } from "../engine/transferMarket.js";

function findAnyPlayer(state, playerId) {
  return state.squad.find((p) => p.id === playerId) || allPlayers.find((p) => p.id === playerId);
}

export default function Transfers() {
  const {
    state, team, offerForPlayer, offerContractTo, completeTransfer, isOnOfferCooldown, weeksUntilCanOffer,
    toggleWatchlist, respondToIncomingOffer,
  } = useCareer();
  const [subTab, setSubTab] = useState("mercado");
  const [teamId, setTeamId] = useState(teams.find((t) => t.id !== team.id).id);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState(null);
  const [showMonthly, setShowMonthly] = useState(!!state.monthlyReports?.length);

  const ownedIds = new Set([...state.squad.map((p) => p.id), ...(state.acquired || [])]);
  const watchlist = state.watchlist || [];
  const sentOffers = state.sentOffers || [];
  const incomingOffers = state.incomingOffers || [];
  const pendingIncoming = incomingOffers.filter((o) => o.status === "pending");

  const pool = useMemo(
    () => allPlayers.filter((p) => p.teamId === teamId && !ownedIds.has(p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamId, (state.acquired || []).length, state.squad.length]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => b.ovr - a.ovr).slice(0, 40);
  }, [pool, query]);

  const latestMonthly = state.monthlyReports?.[0];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold mb-2">Fichajes</h2>
        <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
          Primero le ofertás al club por el pase. Si acepta, recién ahí le ofrecés contrato al jugador. Cada intento es
          de una sola vez — si rechazan (el club o el jugador), no podés insistir con otra cifra al toque, hay que
          esperar unas semanas. Presupuesto disponible: <span className="text-white font-semibold">€{state.budget}M</span>.
        </p>
      </div>

      <div className="flex gap-1">
        {[["mercado", "Mercado"], ["central", `Central de Transferencias${pendingIncoming.length ? ` (${pendingIncoming.length})` : ""}`]].map(([id, label]) => (
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
          <div className="flex flex-wrap gap-3 items-center">
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="bg-panel border border-border rounded-2xl px-4 py-3 text-sm max-w-[220px]">
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
                  <th className="px-3 py-3">Valor</th>
                  <th className="px-3 py-3">Contrato</th>
                  <th className="px-3 py-3"></th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const report = state.scoutReports[p.id];
                  const cooling = isOnOfferCooldown(p.id);
                  const watched = watchlist.includes(p.id);
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-3 truncate max-w-[160px]">
                        {p.name}
                        <span className="text-gray-500 ml-1.5" title={report ? `OVR estimado por ${report.scoutName}` : "Sin reclutar"}>
                          ({report ? formatRange(report.ovrRange) : "?"})
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-400">{p.position}</td>
                      <td className="px-3 py-3 text-center text-gray-400">{p.age}</td>
                      <td className="px-3 py-3 text-center font-semibold">€{p.value}M</td>
                      <td className="px-3 py-3 text-center text-gray-400">{p.contractYears} año{p.contractYears === 1 ? "" : "s"}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleWatchlist(p.id)}
                          title={watched ? "Quitar de seguimiento" : "Seguir jugador"}
                          className={`text-lg leading-none ${watched ? "text-amber" : "text-gray-600 hover:text-gray-300"}`}
                        >
                          {watched ? "★" : "☆"}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {cooling ? (
                          <span className="text-xs text-gray-600" title="Te rechazaron hace poco, esperá antes de volver a ofertar">
                            Esperá {weeksUntilCanOffer(p.id)} sem.
                          </span>
                        ) : (
                          <button
                            onClick={() => setTarget(p)}
                            className="text-sm font-medium px-4 py-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors"
                          >
                            Ofertar
                          </button>
                        )}
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

          <p className="text-xs text-gray-600">
            El OVR de un jugador ajeno es una estimación de tus reclutadores — mandá uno en la pestaña Scouting antes de ofertar. Ahí también te va a sugerir una oferta.
          </p>
        </>
      )}

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
          report={state.scoutReports[target.id]}
          onOfferForPlayer={offerForPlayer}
          onOfferContractTo={offerContractTo}
          onComplete={completeTransfer}
          onClose={() => setTarget(null)}
        />
      )}

      {showMonthly && latestMonthly && (
        <MonthlyReportModal report={latestMonthly} onClose={() => setShowMonthly(false)} />
      )}
    </div>
  );
}

function MonthlyReportModal({ report, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-panel border border-amber/30 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber">📋 Antes de entrar al mercado</p>
          <p className="font-semibold mt-1">Informe mensual de Iker Salgado</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {report.entries.map((e) => {
              const t = teamById(e.teamId);
              return (
                <span
                  key={e.playerId}
                  className={`text-xs px-3 py-1.5 rounded-full border ${e.isGem ? "border-amber/50 bg-amber/10 text-amber" : "border-border text-gray-400"}`}
                  title={t ? t.name : ""}
                >
                  {e.isGem && "💎 "}{e.name} (~{e.potentialEstimate}){t ? ` · ${t.name}` : ""}
                </span>
              );
            })}
          </div>
          <button onClick={onClose} className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
            Ir al mercado
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferHub({ state, watchlist, sentOffers, incomingOffers, onUnwatch, onOffer, onRespond }) {
  const pending = incomingOffers.filter((o) => o.status === "pending");
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
                <p className="text-xs text-gray-500">
                  {o.teamName} ofrece {o.isLoan ? "un préstamo" : `€${o.amount}M por el pase`}
                </p>
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
        {!watchlist.length && <p className="text-xs text-gray-600">Marcá jugadores con la estrella en el Mercado para seguirlos acá.</p>}
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
                    Ofertar
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
              {o.type === "fee" ? `€${o.amount}M por el pase de` : `€${o.amount}k/sem (${o.years} años) a`} {o.playerName} ·{" "}
              <span className={o.accepted ? "text-emerald" : "text-red-400"}>{o.accepted ? "aceptada" : "rechazada"}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

function OfferFlow({ player, budget, report, onOfferForPlayer, onOfferContractTo, onComplete, onClose }) {
  const sellerTeam = teamById(player.teamId);
  const [stage, setStage] = useState("fee"); // fee -> wage -> done | fee-rejected | wage-rejected
  const [feeInput, setFeeInput] = useState(report?.suggestedOffer ?? player.value);
  const [feeAgreed, setFeeAgreed] = useState(null);
  const [feeResult, setFeeResult] = useState(null);
  const [wageInput, setWageInput] = useState(player.wage + Math.round(player.wage * 0.2));
  const [years, setYears] = useState(3);
  const [wageResult, setWageResult] = useState(null);

  // Cada oferta se manda una sola vez: si rechazan, la negociación queda
  // cerrada acá — para volver a intentar hay que salir y esperar el
  // enfriamiento (se ve en la lista de jugadores).
  function submitFee() {
    if (feeInput > budget) {
      setFeeResult({ accepted: false, hint: "muy_lejos", noBudget: true });
      setStage("fee-rejected");
      return;
    }
    const res = onOfferForPlayer(player, feeInput);
    setFeeResult(res);
    if (res.accepted) {
      setFeeAgreed(feeInput);
      setStage("wage");
    } else {
      setStage("fee-rejected");
    }
  }

  function submitWage() {
    const res = onOfferContractTo(player, wageInput, years);
    setWageResult(res);
    if (res.accepted) {
      onComplete(player, feeAgreed, wageInput, years);
      setStage("done");
    } else {
      setStage("wage-rejected");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-panel border border-border rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-semibold">{player.name}</p>
            <p className="text-xs text-gray-500">{player.position} · {player.age} años · {sellerTeam.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {stage === "fee" && (
            <>
              <p className="text-sm text-gray-400">
                Valor de mercado: <span className="text-white font-semibold">€{player.value}M</span> · Presupuesto: <span className="text-white font-semibold">€{budget}M</span>
                {report?.suggestedOffer != null && <> · Oferta sugerida por tu reclutador: <span className="text-white font-semibold">€{report.suggestedOffer}M</span></>}
              </p>
              <label className="block text-xs text-gray-500 uppercase tracking-wide">Oferta por el pase (€M)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={feeInput}
                onChange={(e) => setFeeInput(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
              />
              <p className="text-xs text-amber">⚠️ Es tu única chance con este club por ahora — si la rechazan, tenés que esperar unas semanas para volver a ofertar.</p>
              <button onClick={submitFee} className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                Enviar oferta al club
              </button>
            </>
          )}

          {stage === "fee-rejected" && (
            <>
              <p className="text-sm text-red-400">
                ❌ {feeResult.noBudget ? "No te alcanza el presupuesto." : `Rechazada. ${HINT_LABEL[feeResult.hint]}`}
              </p>
              <p className="text-xs text-gray-500">El club no quiere seguir hablando por ahora. Volvé a intentarlo más adelante.</p>
              <button onClick={onClose} className="w-full bg-panel border border-border text-gray-300 font-semibold py-2.5 rounded-2xl hover:border-gray-500 transition">
                Cerrar
              </button>
            </>
          )}

          {stage === "wage" && (
            <>
              <p className="text-sm text-emerald font-medium">✅ El club aceptó €{feeAgreed}M por el pase.</p>
              <p className="text-sm text-gray-400">Sueldo actual: <span className="text-white font-semibold">€{player.wage}k/sem</span></p>
              <label className="block text-xs text-gray-500 uppercase tracking-wide">Sueldo ofrecido (€k/semana)</label>
              <input
                type="number"
                min="1"
                value={wageInput}
                onChange={(e) => setWageInput(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
              />
              <label className="block text-xs text-gray-500 uppercase tracking-wide">Años de contrato</label>
              <select value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm">
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} año{y === 1 ? "" : "s"}</option>)}
              </select>
              <p className="text-xs text-amber">⚠️ También es una única oferta — si el jugador la rechaza, se cae todo el fichaje (el pase ya no queda reservado).</p>
              <button onClick={submitWage} className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                Ofrecer contrato al jugador
              </button>
            </>
          )}

          {stage === "wage-rejected" && (
            <>
              <p className="text-sm text-red-400">❌ Rechazó el contrato. {HINT_LABEL[wageResult.hint]}</p>
              <p className="text-xs text-gray-500">El fichaje se cayó — el club ya gastó su paciencia con esta negociación. Probá más adelante.</p>
              <button onClick={onClose} className="w-full bg-panel border border-border text-gray-300 font-semibold py-2.5 rounded-2xl hover:border-gray-500 transition">
                Cerrar
              </button>
            </>
          )}

          {stage === "done" && (
            <>
              <p className="text-sm text-emerald font-semibold">🎉 ¡Fichaje cerrado! {player.name} ya es tuyo.</p>
              <button onClick={onClose} className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
