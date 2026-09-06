import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { teams, teamById } from "../data/teams.js";
import { players as allPlayers } from "../data/players.js";
import { formatRange } from "../engine/scouting.js";
import { HINT_LABEL } from "../engine/transferMarket.js";

export default function Transfers() {
  const { state, team, offerForPlayer, offerContractTo, completeTransfer } = useCareer();
  const [teamId, setTeamId] = useState(teams.find((t) => t.id !== team.id).id);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState(null);

  const ownedIds = new Set([...state.squad.map((p) => p.id), ...(state.acquired || [])]);

  const pool = useMemo(
    () => allPlayers.filter((p) => p.teamId === teamId && !ownedIds.has(p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamId, (state.acquired || []).length, state.squad.length]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => b.ovr - a.ovr).slice(0, 40);
  }, [pool, query]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold mb-2">Mercado de Fichajes</h2>
        <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
          Primero le ofertás al club por el pase. Si acepta, recién ahí le ofrecés contrato al jugador — puede
          rechazarlo igual si el sueldo no le cierra. Presupuesto disponible: <span className="text-white font-semibold">€{state.budget}M</span>.
        </p>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const report = state.scoutReports[p.id];
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
                      onClick={() => setTarget(p)}
                      className="text-sm font-medium px-4 py-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 transition-colors"
                    >
                      Ofertar
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-600 text-sm">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">
        El OVR de un jugador ajeno es una estimación de tus reclutadores — mandá uno en la pestaña Scouting antes de ofertar fuerte por alguien.
      </p>

      {target && (
        <OfferFlow
          player={target}
          budget={state.budget}
          myTeam={team}
          onOfferForPlayer={offerForPlayer}
          onOfferContractTo={offerContractTo}
          onComplete={completeTransfer}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

function OfferFlow({ player, budget, myTeam, onOfferForPlayer, onOfferContractTo, onComplete, onClose }) {
  const sellerTeam = teamById(player.teamId);
  const [stage, setStage] = useState("fee"); // fee -> wage -> done
  const [feeInput, setFeeInput] = useState(player.value);
  const [feeAgreed, setFeeAgreed] = useState(null);
  const [feeResult, setFeeResult] = useState(null);
  const [wageInput, setWageInput] = useState(player.wage + Math.round(player.wage * 0.2));
  const [years, setYears] = useState(3);
  const [wageResult, setWageResult] = useState(null);

  function submitFee() {
    if (feeInput > budget) {
      setFeeResult({ accepted: false, hint: "muy_lejos", noBudget: true });
      return;
    }
    const res = onOfferForPlayer(player, feeInput);
    setFeeResult(res);
    if (res.accepted) {
      setFeeAgreed(feeInput);
      setStage("wage");
    }
  }

  function submitWage() {
    const res = onOfferContractTo(player, wageInput, years);
    setWageResult(res);
    if (res.accepted) {
      onComplete(player, feeAgreed, wageInput, years);
      setStage("done");
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
              <p className="text-sm text-gray-400">Valor de mercado: <span className="text-white font-semibold">€{player.value}M</span> · Presupuesto: <span className="text-white font-semibold">€{budget}M</span></p>
              <label className="block text-xs text-gray-500 uppercase tracking-wide">Oferta por el pase (€M)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={feeInput}
                onChange={(e) => setFeeInput(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
              />
              {feeResult && !feeResult.accepted && (
                <p className="text-sm text-red-400">
                  {feeResult.noBudget ? "No te alcanza el presupuesto." : `Rechazada. ${HINT_LABEL[feeResult.hint]}`}
                </p>
              )}
              <button onClick={submitFee} className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                Enviar oferta al club
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
              {wageResult && !wageResult.accepted && (
                <p className="text-sm text-red-400">Rechazado. {HINT_LABEL[wageResult.hint]}</p>
              )}
              <button onClick={submitWage} className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                Ofrecer contrato al jugador
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
