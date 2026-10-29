import { useMemo, useState } from "react";
import { Star, X } from "lucide-react";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { formatRange, reportFor } from "../engine/scouting.js";
import { askingPrice, squadNeeds, lineOf, LINES, wageTotal, wageCapOf, MAX_ROUNDS } from "../engine/transferMarket.js";
import { ROLES, expectedRole } from "../engine/playerForm.js";
import { windowClosesIn, nextWindow } from "../engine/schedule.js";
import Scouts from "./Scouts.jsx";
import ComparePlayers from "./ComparePlayers.jsx";
import PlayerInfoModal from "./PlayerInfoModal.jsx";
import PlayerFace from "../../components/PlayerFace.jsx";
import TeamCrest from "./TeamCrest.jsx";

// Fichajes 2.0 (Modo DT y DT Online): qué necesita tu plantel, el mercado como lista ordenable y
// una negociación por rondas (el club y el jugador contraofertan; sin azar si cumples lo que piden),
// con pago en cuotas, pre-acuerdos con la ventana cerrada y tope de masa salarial.

function findAnyPlayer(state, playerId) {
  return state.squad.find((p) => p.id === playerId) || allPlayers.find((p) => p.id === playerId);
}

const LEAGUE_OPTIONS = [["premier", "Premier League"], ["laliga", "La Liga"], ["seriea", "Serie A"], ["bundesliga", "Bundesliga"]];
const LIGHT = ["var(--acc)", "var(--gold)", "var(--red)"];
const COLS = [["name", "Jugador"], ["age", "Edad"], ["club", "Club"], ["ovr", "OVR"], ["value", "Valor"], ["ask", "Pide"], ["contract", "Contrato"]];
const mid = (r) => (r ? (r.ovrRange[0] + r.ovrRange[1]) / 2 : -1);
const round5 = (v) => Math.round(v / 5) * 5 || Math.round(v);

export default function Transfers() {
  const { state, team, toggleWatchlist, respondToIncomingOffer, counterIncomingOffer, isOnOfferCooldown, weeksUntilCanOffer, sendScoutMission, isTransferWindowOpen } = useCareer();
  const [subTab, setSubTab] = useState("mercado");
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("");
  const [line, setLine] = useState("");
  const [afford, setAfford] = useState(false);
  const [lastYear, setLastYear] = useState(false);
  const [scoutedOnly, setScoutedOnly] = useState(false);
  const [sort, setSort] = useState({ k: "ovr", d: -1 });
  const [target, setTarget] = useState(null);
  const [compareTarget, setCompareTarget] = useState(null);
  const [infoPlayer, setInfoPlayer] = useState(null);

  const windowOpen = isTransferWindowOpen();
  const closesIn = windowClosesIn(state.week);
  const nextWin = nextWindow(state.week);
  const scoutReports = state.scoutReports || {};
  const watchlist = state.watchlist || [];
  const incomingOffers = state.incomingOffers || [];
  const pendingIncoming = incomingOffers.filter((o) => o.status === "pending");
  const needs = useMemo(() => squadNeeds(state.squad), [state.squad]);
  const wages = wageTotal(state.squad);
  const cap = wageCapOf(state);

  const ownedIds = useMemo(() => new Set([...state.squad.map((p) => p.id), ...(state.acquired || []), ...Object.keys(state.stolenByAI || {}).map(Number)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.squad.length, (state.acquired || []).length]);
  const pool = useMemo(() => allPlayers.filter((p) => !ownedIds.has(p.id)), [ownedIds]);

  const rowOf = (p) => {
    const report = reportFor(scoutReports, p);
    const seller = teamById(p.teamId);
    return { p, report, seller, ask: report && seller ? askingPrice(p, seller) : null };
  };

  const { rows, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = pool
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .filter((p) => !league || teamById(p.teamId)?.league === league)
      .filter((p) => !line || lineOf(p.position) === line)
      .filter((p) => !afford || p.value <= state.budget)
      .filter((p) => !lastYear || p.contractYears <= 1)
      .filter((p) => !scoutedOnly || !!reportFor(scoutReports, p))
      .map(rowOf);
    const key = {
      name: (r) => r.p.name, age: (r) => r.p.age, club: (r) => r.seller?.name || "", ovr: (r) => (r.report ? mid(r.report) : r.p.ovr - 100),
      value: (r) => r.p.value, ask: (r) => r.ask ?? -1, contract: (r) => r.p.contractYears ?? 0,
    }[sort.k];
    list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * sort.d);
    return { rows: list.slice(0, 60), total: list.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, query, league, line, afford, lastYear, scoutedOnly, sort, scoutReports, state.budget]);

  // Sugeridos: la línea que más necesita refuerzo, jugadores conocidos que alcanzan.
  const worst = [...needs].sort((a, b) => b.status - a.status || a.level - b.level)[0];
  const suggestions = useMemo(() => {
    if (!worst || worst.status === 0) return [];
    return pool.filter((p) => lineOf(p.position) === worst.id && p.value <= state.budget && reportFor(scoutReports, p))
      .map(rowOf).filter((r) => mid(r.report) >= worst.level).sort((a, b) => mid(b.report) - mid(a.report)).slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, worst?.id, worst?.status, state.budget, scoutReports]);

  const sortBy = (k) => setSort((s) => ({ k, d: s.k === k ? -s.d : k === "name" || k === "club" ? 1 : -1 }));
  const chip = (on) => ({ background: on ? "var(--me-bg)" : "transparent", borderColor: on ? "var(--acc)" : "var(--line)", color: on ? "var(--fg)" : "var(--mute)" });

  return (
    <div className="space-y-4">
      {/* Estado del mercado y necesidades del plantel */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
        <div className="p-card" style={{ borderColor: windowOpen ? "var(--gold-line)" : "var(--line)" }}>
          <p className="p-eyebrow" style={{ justifyContent: "flex-start" }}>{windowOpen ? "Mercado abierto" : "Mercado cerrado"}</p>
          <p className="text-sm mt-1">{windowOpen ? (closesIn === 0 ? "Cierra esta semana." : `Cierra en ${closesIn} ${closesIn === 1 ? "semana" : "semanas"}.`) : nextWin ? `Abre en ${nextWin.from - state.week} semanas. Puedes dejar pre-acuerdos.` : "Abre en verano."}</p>
          <p className="text-xs p-muted mt-1">Masa salarial €{wages}k de €{cap}k/sem</p>
          <div className="p-cbar mt-1"><i style={{ width: `${Math.min(100, (wages / cap) * 100)}%` }} /></div>
        </div>
        {needs.map((n) => (
          <button key={n.id} onClick={() => { setLine(line === n.id ? "" : n.id); setSubTab("mercado"); }} className="p-card text-left transition-colors" style={line === n.id ? { borderColor: "var(--acc)" } : undefined} title={`Filtrar el mercado por ${n.label.toLowerCase()}`}>
            <div className="flex items-center justify-between"><b className="p-num text-2xl">{n.id}</b><i className="w-3 h-3 rounded-full" style={{ background: LIGHT[n.status], boxShadow: "0 0 0 4px var(--panel2)" }} /></div>
            <p className="text-xs p-muted mt-1"><b className="p-num text-base" style={{ color: "var(--fg)" }}>{n.count}</b>/{n.want} · nivel <b className="p-num text-base" style={{ color: "var(--fg)" }}>{n.level || "—"}</b></p>
            <p className="text-[11px] mt-0.5" style={{ color: LIGHT[n.status] }}>{n.status === 2 ? (n.short ? `Faltan ${n.short}` : "Urgente") : n.status === 1 ? (n.short ? `Falta ${n.short}` : "Nivel bajo") : "Bien cubierto"}</p>
          </button>
        ))}
      </div>

      <div className="p-seg" style={{ maxWidth: 520 }} role="tablist" aria-label="Fichajes">
        {[["mercado", "Mercado"], ["scouting", "Scouting"], ["central", `Central${pendingIncoming.length ? ` (${pendingIncoming.length})` : ""}`]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={subTab === id} className={subTab === id ? "on" : ""} onClick={() => setSubTab(id)}>{label}</button>
        ))}
      </div>

      {subTab === "mercado" && (
        <div className={`grid gap-4 items-start ${target ? "lg:grid-cols-[minmax(0,1fr)_400px]" : ""}`}>
          <div className="space-y-3 min-w-0">
            {suggestions.length > 0 && (
              <section className="p-card">
                <p className="p-eyebrow"><span>Para reforzar · {worst.label.toLowerCase()}</span><span>te alcanzan</span></p>
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                  {suggestions.map(({ p, report, seller }) => (
                    <button key={p.id} onClick={() => setTarget(p)} className="p-row" style={{ padding: "8px 10px" }}>
                      <PlayerFace name={p.name} size={30} />
                      <span className="nm text-sm">{p.name}<small style={{ color: "var(--mute)" }}>{p.position} · {p.age} años · {seller?.name}</small></span>
                      <span className="text-right"><b className="p-num text-base block" style={{ color: "var(--acc2)" }}>{formatRange(report.ovrRange)}</b><small className="p-muted">€{p.value}M</small></span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="p-card space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugador…" className="flex-1 min-w-[160px] rounded-xl border px-3 py-2 text-sm" style={{ background: "var(--bg)", borderColor: "var(--line)" }} />
                <select value={league} onChange={(e) => setLeague(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" style={{ background: "var(--bg)", borderColor: "var(--line)" }}>
                  <option value="">Todas las ligas</option>
                  {LEAGUE_OPTIONS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                </select>
                <select value={line} onChange={(e) => setLine(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" style={{ background: "var(--bg)", borderColor: "var(--line)" }}>
                  <option value="">Todas las líneas</option>
                  {LINES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[["Me alcanza", afford, setAfford], ["Último año de contrato", lastYear, setLastYear], ["Solo scouteados", scoutedOnly, setScoutedOnly]].map(([l, on, set]) => (
                  <button key={l} onClick={() => set(!on)} aria-pressed={on} className="rounded-full border px-3 py-1 text-xs font-semibold" style={chip(on)}>{l}</button>
                ))}
                <span className="text-xs p-dim self-center ml-auto">{total} jugadores · se muestran {rows.length}</span>
              </div>

              {/* Computador: tabla ordenable. Teléfono: filas compactas. */}
              <div className="hidden md:block -mx-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs p-muted">
                      <th className="w-6" />
                      {COLS.map(([k, l]) => (
                        <th key={k} onClick={() => sortBy(k)} className="px-2 pb-2 font-medium cursor-pointer select-none hover:text-white whitespace-nowrap" aria-sort={sort.k === k ? (sort.d === 1 ? "ascending" : "descending") : "none"}>
                          {l} {sort.k === k && (sort.d === 1 ? "↑" : "↓")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ p, report, seller, ask }) => {
                      const watched = watchlist.includes(p.id);
                      const sel = target?.id === p.id;
                      return (
                        <tr key={p.id} onClick={() => setTarget(p)} className="cursor-pointer transition-colors" style={{ borderTop: "1px solid var(--line)", background: sel ? "var(--me-bg)" : undefined }}>
                          <td className="pl-2"><button onClick={(e) => { e.stopPropagation(); toggleWatchlist(p.id); }} aria-label={watched ? "Dejar de seguir" : "Seguir"} style={{ color: watched ? "var(--gold)" : "var(--dim)" }}><Star size={15} fill={watched ? "currentColor" : "none"} /></button></td>
                          <td className="px-2 py-2">
                            <span className="flex items-center gap-2 min-w-0"><PlayerFace name={p.name} size={28} /><span className="min-w-0"><b className="block truncate max-w-[180px]">{p.name}</b><small className="p-num text-xs p-muted">{p.position}{report?.isPublic ? " · figura" : ""}</small></span></span>
                          </td>
                          <td className="p-num px-2 text-base">{p.age}</td>
                          <td className="px-2"><span className="flex items-center gap-1.5 p-muted truncate max-w-[130px]">{seller && <TeamCrest team={seller} size={16} />}{seller?.name}</span></td>
                          <td className="p-num px-2 text-base whitespace-nowrap" style={{ color: report ? "var(--acc2)" : "var(--dim)" }}>{report ? formatRange(report.ovrRange) : "?"}</td>
                          <td className="p-num px-2 text-base whitespace-nowrap">€{p.value}M</td>
                          <td className="p-num px-2 text-base whitespace-nowrap" style={{ color: ask == null ? "var(--dim)" : ask > state.budget ? "var(--red)" : "var(--gold)" }}>{ask == null ? "—" : `~€${round5(ask)}M`}</td>
                          <td className="p-num px-2 text-base whitespace-nowrap" style={{ color: p.contractYears <= 1 ? "var(--gold)" : "var(--mute)" }}>{p.contractYears} a</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden"><div className="p-rows">
                {rows.map(({ p, report, seller, ask }) => (
                  <button key={p.id} onClick={() => setTarget(p)} className="p-row" style={{ padding: "8px 10px" }}>
                    <PlayerFace name={p.name} size={30} />
                    <span className="nm text-sm">{p.name}<small style={{ color: "var(--mute)" }}>{p.position} · {p.age} a · {seller?.name}{p.contractYears <= 1 ? " · último año" : ""}</small></span>
                    <span className="text-right shrink-0"><b className="p-num text-base block" style={{ color: report ? "var(--acc2)" : "var(--dim)" }}>{report ? formatRange(report.ovrRange) : "?"}</b><small className="p-muted">{ask == null ? `€${p.value}M` : `pide ~€${round5(ask)}M`}</small></span>
                  </button>
                ))}
              </div></div>
              {!rows.length && <p className="text-center text-sm p-muted py-4">Sin resultados con esos filtros.</p>}
              <p className="text-xs p-dim">El OVR es «?» hasta que lo scoutees (las figuras mundiales ya vienen scouteadas). «Pide» es lo que más o menos pide el club: se confirma al negociar.</p>
            </section>
          </div>

          {target && (
            <Negotiation key={target.id} player={target} onClose={() => setTarget(null)}
              onCompare={() => setCompareTarget(target)} onInfo={() => setInfoPlayer(target)} onScout={sendScoutMission}
              hiredScouts={state.hiredScouts || []} scouting={(state.scoutMissions || []).some((m) => m.playerIds.includes(target.id))}
              cooling={isOnOfferCooldown(target.id)} coolWeeks={weeksUntilCanOffer(target.id)} />
          )}
        </div>
      )}

      {subTab === "scouting" && <Scouts />}

      {subTab === "central" && (
        <TransferHub state={state} watchlist={watchlist} sentOffers={state.sentOffers || []} incomingOffers={incomingOffers}
          onUnwatch={toggleWatchlist} onOffer={(p) => { setTarget(p); setSubTab("mercado"); }} onRespond={respondToIncomingOffer} onCounter={counterIncomingOffer} onInfo={setInfoPlayer} />
      )}

      {compareTarget && (
        <ComparePlayers target={compareTarget} mine={[...state.squad].filter((p) => p.position === compareTarget.position).sort((a, b) => b.ovr - a.ovr)[0] || null} onClose={() => setCompareTarget(null)} />
      )}
      {infoPlayer && (
        <PlayerInfoModal player={infoPlayer} state={state} watched={watchlist.includes(infoPlayer.id)} onClose={() => setInfoPlayer(null)} onOffer={(p) => { setTarget(p); setInfoPlayer(null); setSubTab("mercado"); }} onUnwatch={toggleWatchlist} />
      )}
    </div>
  );
}

function TransferHub({ state, watchlist, sentOffers, incomingOffers, onUnwatch, onOffer, onRespond, onCounter, onInfo }) {
  const pending  = incomingOffers.filter((o) => o.status === "pending");
  const resolved = incomingOffers.filter((o) => o.status !== "pending");

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2.5">Ofertas recibidas por tus jugadores</h3>
        {!pending.length && <p className="text-xs text-gray-600">Ninguna oferta pendiente por ahora.</p>}
        <div className="space-y-2">
          {pending.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 bg-panel border border-border rounded-2xl px-4 py-3">
              <div className="min-w-0 cursor-pointer" onClick={() => { const pl = findAnyPlayer(state, o.playerId); if (pl) onInfo(pl); }}>
                <p className="text-sm font-semibold truncate hover:text-accent">{o.playerName}</p>
                <p className="text-xs text-gray-500">{o.teamName} ofrece {o.isLoan ? "un préstamo" : `€${o.amount}M por el pase`}</p>
                {o.playerReason && <p className={`text-xs mt-0.5 ${o.playerWilling === false ? "text-red-400" : "text-gray-400"}`}>{o.playerWilling === false ? "✋ " : "💬 "}{o.playerReason}</p>}
                {pending.filter((x) => x.playerId === o.playerId).length > 1 && <p className="text-[11px] text-amber mt-0.5">Hay más ofertas por este jugador: aceptar una cancela las demás.</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onRespond(o.id, true)} disabled={o.playerWilling === false} title={o.playerWilling === false ? "El jugador no quiere irse" : undefined} className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald/15 text-emerald border border-emerald/40 hover:bg-emerald/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Aceptar
                </button>
                {!o.isLoan && !o.raisedOnce && <button onClick={() => onCounter(o.id)} className="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors" style={{ color: "var(--gold)", borderColor: "var(--gold-line)" }}>Pedir más</button>}
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
                  {o.teamName} por {o.playerName} — {o.isLoan ? "préstamo" : `€${o.amount}M`} · <span className={o.status === "accepted" ? "text-emerald" : o.status === "withdrawn" ? "text-gray-500" : "text-red-400"}>{o.status === "accepted" ? "aceptada" : o.status === "withdrawn" ? "retirada" : "rechazada"}</span>
                </p>
              ))}
            </div>
          </details>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2.5">☆ Jugadores que sigues</h3>
        {!watchlist.length && <p className="text-xs text-gray-600">Marca jugadores con la estrella en el Mercado o en Scouting para seguirlos acá.</p>}
        <div className="grid sm:grid-cols-2 gap-2.5">
          {watchlist.map((id) => {
            const p = findAnyPlayer(state, id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center justify-between gap-2 bg-panel border border-border rounded-2xl px-4 py-3">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onInfo(p)} title="Ver toda su información">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlayerFace name={p.name} size={32} className="border border-border" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate hover:text-accent">{p.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5">{teamById(p.teamId) && <TeamCrest team={teamById(p.teamId)} size={14} />}{p.position} · {p.age} años · €{p.value}M · {teamById(p.teamId)?.name}</p>
                    </div>
                  </div>
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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2.5">Ofertas que mandaste</h3>
        {!sentOffers.length && <p className="text-xs text-gray-600">Todavía no mandaste ninguna oferta.</p>}
        <div className="space-y-1.5">
          {sentOffers.map((o) => (
            <p key={o.id} className="text-xs text-gray-500">
              {o.type === "fee" ? `€${o.amount}M por el pase de` : `€${o.amount}k/sem (${o.years} años) a`} {o.playerName}
              {o.byClause ? " (cláusula)" : ""} · <span className={o.accepted ? "text-emerald" : o.verdict === "counter" ? "text-amber" : "text-red-400"}>{o.accepted ? "aceptada" : o.verdict === "counter" ? "contraoferta" : "rechazada"}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}


function Rounds({ round }) {
  return (
    <div className="flex items-center gap-1.5 mt-3" aria-label={`Ronda ${round} de ${MAX_ROUNDS}`}>
      {Array.from({ length: MAX_ROUNDS }, (_, i) => <i key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < round ? "var(--acc)" : "var(--panel2)" }} />)}
      <span className="p-num text-sm p-muted ml-1">Ronda {Math.min(round + 1, MAX_ROUNDS)}/{MAX_ROUNDS}</span>
    </div>
  );
}

function Bubble({ me, who, children }) {
  return (
    <div className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm ${me ? "ml-auto rounded-br-sm" : "rounded-bl-sm"}`} style={{ background: me ? "color-mix(in srgb, var(--acc) 22%, transparent)" : "var(--panel2)" }}>
      {who && <p className="text-[11px] p-muted">{who}</p>}
      {children}
    </div>
  );
}

// Negociación por rondas: primero el pase con el club, después el contrato con el jugador, y firmar.
function Negotiation({ player, onClose, onCompare, onInfo, onScout, hiredScouts, scouting, cooling, coolWeeks }) {
  const { state, team, negotiationOf, negotiateFee, acceptFeeCounter, negotiateContract, acceptWageCounter, signPlayer, isTransferWindowOpen } = useCareer();
  const seller = teamById(player.teamId);
  const report = reportFor(state.scoutReports, player);
  const clause = (state.releaseClauses || {})[player.id];
  const neg = negotiationOf(player.id);
  const fee = neg?.fee;
  const wageN = neg?.wage;
  const [bid, setBid] = useState(fee?.counter ?? report?.suggestedOffer ?? player.value);
  const [split, setSplit] = useState(!!fee?.installments);
  const [wage, setWage] = useState(wageN?.counter ?? Math.round(player.wage * 1.15));
  const [years, setYears] = useState(player.age >= 31 ? 2 : 4);
  const wanted = expectedRole(player, state.squad);
  const [role, setRole] = useState(wanted.id);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(null);
  const say = (m) => setLog((l) => [...l, m]);
  const wages = wageTotal(state.squad);
  const cap = wageCapOf(state);
  const open = isTransferWindowOpen();
  const stage = done ? "done" : fee?.agreed == null ? "fee" : wageN?.agreed == null ? "wage" : "sign";

  function sendFee(amount = bid) {
    if (amount > state.budget && !split) { say({ who: seller?.name, text: `No te alcanza: tienes €${state.budget}M.` }); return; }
    say({ me: true, text: `Ofrecemos €${amount}M${split ? " en dos cuotas" : ""}.` });
    const r = negotiateFee(player, amount, { installments: split });
    if (r.verdict === "cooldown") say({ who: seller?.name, text: `No queremos hablar por ${r.weeks} semana${r.weeks === 1 ? "" : "s"}.` });
    else if (r.verdict === "accept") say({ who: seller?.name, text: r.byClause ? "Pagas la cláusula: no podemos negarnos." : "Trato hecho. Habla con el jugador." });
    else if (r.verdict === "counter") { say({ who: seller?.name, text: `Insuficiente. Pedimos €${r.counter}M.${r.last ? " Es nuestra última palabra." : ""}`, counter: true }); setBid(r.counter); }
    else say({ who: seller?.name, text: r.angry ? "Eso es una falta de respeto. No vuelvan a llamar por un tiempo." : r.last ? "No hay acuerdo. Cerramos la negociación." : `Muy lejos. Por menos de €${round5(r.ask)}M ni lo pensamos.` });
  }

  function sendWage(amount = wage) {
    say({ me: true, text: `Te ofrecemos €${amount}k/semana, ${years} año${years === 1 ? "" : "s"}, como ${ROLES[role].label.toLowerCase()}.` });
    const r = negotiateContract(player, amount, years, role);
    if (r.verdict === "wage_cap") say({ who: "Directiva", text: `Ese sueldo pasa el tope de masa salarial (€${cap}k/sem). Vende a alguien o baja la cifra.` });
    else if (r.verdict === "accept") say({ who: player.name, text: `${r.roleTalk} Acepto.` });
    else if (r.verdict === "counter") { say({ who: player.name, text: `${r.roleTalk} Quiero €${r.counter}k/semana.${r.last ? " No bajo de ahí." : ""}`, counter: true }); setWage(r.counter); }
    else if (r.verdict === "no_fee") say({ who: "Directiva", text: "Primero cierra el pase con el club." });
    else say({ who: player.name, text: r.last ? "No nos entendimos. Me quedo donde estoy." : `${r.roleTalk} Así no vengo: estás muy lejos.` });
  }

  function sign() {
    const r = signPlayer(player);
    if (r.success) setDone(r.preAgreed ? "pre" : "ok");
    else say({ who: "Directiva", text: r.reason === "insufficient_budget" ? "No alcanza el presupuesto para cerrar." : "Falta cerrar el pase o el contrato." });
  }

  const after = wages + (stage === "wage" ? wage : wageN?.agreed || 0);
  const now = fee?.agreed != null ? (fee.installments ? Math.round((fee.agreed / 2) * 20) / 20 : fee.agreed) : null;

  return (
    <aside className="p-card h-fit lg:sticky lg:top-[132px] fixed inset-x-0 bottom-0 z-40 lg:static max-h-[85vh] overflow-y-auto lg:max-h-none rounded-b-none lg:rounded-b-[18px]" style={{ boxShadow: "0 -20px 40px -20px #000" }}>
      <div className="flex items-start gap-3">
        <PlayerFace name={player.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="p-eyebrow" style={{ justifyContent: "flex-start" }}>Negociación</p>
          <h3 className="text-lg font-bold leading-tight truncate" style={{ fontFamily: "var(--f-d)" }}>{player.name}</h3>
          <p className="text-xs p-muted">{seller?.name} · {player.position} · {player.age} años · contrato {player.contractYears} a</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="p-roundb shrink-0"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="rounded-xl py-1.5" style={{ background: "var(--panel2)" }}><small className="p-muted text-[10px] uppercase">OVR</small><b className="p-num text-lg block">{report ? formatRange(report.ovrRange) : "?"}</b></div>
        <div className="rounded-xl py-1.5" style={{ background: "var(--panel2)" }}><small className="p-muted text-[10px] uppercase">Potencial</small><b className="p-num text-lg block">{report?.potentialEstimate ? `~${report.potentialEstimate}` : "?"}</b></div>
        <div className="rounded-xl py-1.5" style={{ background: "var(--panel2)" }}><small className="p-muted text-[10px] uppercase">Valor</small><b className="p-num text-lg block">€{player.value}M</b></div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <button onClick={onInfo} className="p-btn ghost sm">Ficha</button>
        <button onClick={onCompare} className="p-btn ghost sm">Comparar</button>
        {!report && !scouting && hiredScouts.length > 0 && (
          <select defaultValue="" onChange={(e) => { if (e.target.value) onScout(e.target.value, player.id); e.target.value = ""; }} className="rounded-xl border px-2 text-xs" style={{ background: "var(--panel2)", borderColor: "var(--line)" }}>
            <option value="">Scoutear…</option>
            {hiredScouts.map((sc) => <option key={sc.id} value={sc.id}>{sc.specialty === "ovr" ? "OVR" : sc.specialty === "potential" ? "Potencial" : "Generalista"}</option>)}
          </select>
        )}
        {scouting && <span className="text-xs p-muted self-center">Ojeador en camino…</span>}
      </div>

      {cooling && stage === "fee" ? (
        <p className="mt-4 text-sm" style={{ color: "var(--gold)" }}>El club no quiere hablar por {coolWeeks} semana{coolWeeks === 1 ? "" : "s"} más.</p>
      ) : (
        <>
          {stage !== "done" && <Rounds round={(stage === "fee" ? fee?.round : wageN?.round) || 0} />}
          {log.length > 0 && <div className="mt-3 space-y-2">{log.map((m, i) => <Bubble key={i} me={m.me} who={m.who}>{m.text}</Bubble>)}</div>}

          {stage === "fee" && (
            <div className="mt-4 space-y-3">
              {clause != null && (
                <button onClick={() => sendFee(clause)} disabled={clause > state.budget} className="w-full rounded-xl border px-3 py-2 text-left text-sm disabled:opacity-40" style={{ borderColor: "var(--gold-line)" }}>
                  Pagar la cláusula: <b className="p-num text-base" style={{ color: "var(--gold)" }}>€{clause}M</b> <small className="p-muted">(el club no puede negarse)</small>
                </button>
              )}
              <div className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
                <div className="flex justify-between items-baseline text-sm"><span className="p-muted">Tu oferta por el pase</span><b className="p-num text-2xl" style={{ color: "var(--acc2)" }}>€{bid}M</b></div>
                <input type="range" min={Math.max(0.5, Math.round(player.value * 0.5))} max={Math.round(Math.max(player.value * 1.6, bid))} step={0.5} value={bid} onChange={(e) => setBid(Number(e.target.value))} className="w-full mt-2" style={{ accentColor: "var(--acc)" }} aria-label="Oferta en millones" />
                <div className="flex items-center justify-between mt-1 gap-2">
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} style={{ accentColor: "var(--acc)" }} /> Pagar en 2 cuotas <span className="p-muted">(+5 %)</span></label>
                  <input type="number" min={0} step={0.5} value={bid} onChange={(e) => setBid(Number(e.target.value))} className="w-20 rounded-lg border px-2 py-1 text-sm text-right" style={{ background: "var(--bg)", borderColor: "var(--line)" }} aria-label="Oferta exacta" />
                </div>
                <p className="text-[11px] p-muted mt-1">Presupuesto €{state.budget}M{split ? ` · ahora pagas €${Math.round((bid / 2) * 20) / 20}M y el resto la próxima temporada` : ""}</p>
              </div>
              <div className="flex gap-2">
                {fee?.counter != null && <button onClick={() => { const r = acceptFeeCounter(player); if (r) say({ me: true, text: `Aceptamos €${r.price}M.` }); }} className="p-btn gold flex-1">Aceptar €{fee.counter}M</button>}
                <button onClick={() => sendFee()} className={`p-btn flex-1 ${fee?.counter != null ? "ghost" : ""}`}>{fee?.round ? "Nueva oferta" : "Enviar oferta"}</button>
              </div>
            </div>
          )}

          {stage === "wage" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm" style={{ color: "var(--acc2)" }}>✓ Pase acordado: <b className="p-num text-base">€{fee.agreed}M</b>{fee.installments ? " en dos cuotas" : ""}</p>
              <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--panel2)" }}>
                <div className="flex justify-between items-baseline text-sm"><span className="p-muted">Sueldo (hoy cobra €{player.wage}k)</span><b className="p-num text-2xl">€{wage}k<small className="text-xs p-muted">/sem</small></b></div>
                <input type="range" min={Math.max(1, Math.round(player.wage * 0.6))} max={Math.round(Math.max(player.wage * 2.5, wage))} value={wage} onChange={(e) => setWage(Number(e.target.value))} className="w-full" style={{ accentColor: "var(--acc)" }} aria-label="Sueldo semanal en miles" />
                <div className="flex items-center justify-between text-sm"><span className="p-muted">Años</span><span className="flex gap-1">{[1, 2, 3, 4, 5].map((y) => <button key={y} onClick={() => setYears(y)} className="p-num w-8 rounded-lg py-0.5 text-base" style={{ background: years === y ? "var(--acc)" : "var(--panel)", color: years === y ? "var(--onacc)" : "var(--fg)" }}>{y}</button>)}</span></div>
                <div className="flex items-center justify-between text-sm gap-2"><span className="p-muted">Rol que le prometes</span><span className="flex gap-1">{Object.values(ROLES).map((r) => <button key={r.id} onClick={() => setRole(r.id)} className="rounded-lg px-2 py-1 text-xs" style={{ background: role === r.id ? "var(--acc)" : "var(--panel)", color: role === r.id ? "var(--onacc)" : "var(--fg)" }}>{r.label}</button>)}</span></div>
                <p className="text-[11px] p-muted">Él espera ser {wanted.label.toLowerCase()}. Si después no lo cumples, su moral baja.</p>
              </div>
              <div className="text-xs space-y-1.5">
                <p className="p-muted">Masa salarial (tope €{cap}k/sem)</p>
                <div className="flex items-center gap-2"><span className="w-14">Antes</span><div className="p-cbar flex-1"><i style={{ width: `${Math.min(100, (wages / cap) * 100)}%` }} /></div><span className="p-num w-12 text-right text-sm">€{wages}k</span></div>
                <div className="flex items-center gap-2"><span className="w-14">Después</span><div className="p-cbar flex-1"><i style={{ width: `${Math.min(100, (after / cap) * 100)}%`, background: after > cap ? "var(--red)" : undefined }} /></div><span className="p-num w-12 text-right text-sm" style={after > cap ? { color: "var(--red)" } : undefined}>€{after}k</span></div>
              </div>
              <div className="flex gap-2">
                {wageN?.counter != null && <button onClick={() => { const r = acceptWageCounter(player, years, role); if (r?.verdict === "accept") say({ me: true, text: `Aceptamos €${r.price}k/semana.` }); else if (r) say({ who: "Directiva", text: "Ese sueldo pasa el tope de masa salarial." }); }} className="p-btn gold flex-1">Aceptar €{wageN.counter}k</button>}
                <button onClick={() => sendWage()} disabled={after > cap} className={`p-btn flex-1 ${wageN?.counter != null ? "ghost" : ""}`}>Ofrecer contrato</button>
              </div>
            </div>
          )}

          {stage === "sign" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: "var(--panel2)" }}>
                <p>Pase: <b className="p-num text-base">€{fee.agreed}M</b>{fee.installments ? <span className="p-muted"> (ahora €{now}M, resto la próxima temporada)</span> : ""}</p>
                <p>Contrato: <b className="p-num text-base">€{wageN.agreed}k/sem</b> · {wageN.years} años · {ROLES[wageN.role]?.label || "Rotación"}</p>
              </div>
              {!open && <p className="text-xs" style={{ color: "var(--gold)" }}>El mercado está cerrado: quedará como pre-acuerdo y se suma al equipo apenas abra.</p>}
              <button onClick={sign} disabled={now > state.budget} className="p-btn big" style={{ marginInline: 0 }}>{open ? "Firmar" : "Firmar pre-acuerdo"}</button>
            </div>
          )}

          {stage === "done" && (
            <div className="mt-5 rounded-xl p-5 text-center" style={{ background: "var(--me-bg)" }}>
              <p className="text-3xl">✍️</p>
              <p className="font-bold mt-1" style={{ fontFamily: "var(--f-d)" }}>{done === "pre" ? `Pre-acuerdo con ${player.name}` : `¡${player.name} es de ${team.name}!`}</p>
              <p className="text-sm p-muted">{done === "pre" ? "Se suma cuando abra el mercado." : "Ya está en tu plantel, entre los suplentes."}</p>
              <button onClick={onClose} className="p-btn ghost sm mt-3">Seguir en el mercado</button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

