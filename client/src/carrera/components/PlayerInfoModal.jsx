import { teamById } from "../data/teams.js";
import { formatRange, reportFor } from "../engine/scouting.js";
import { ATTR_LABELS } from "../engine/attributeEffects.js";
import { energyOf } from "../engine/energy.js";
import { getInjury } from "../engine/injuryEngine.js";
import TeamCrest from "./TeamCrest.jsx";

function Stat({ label, value, hint }) {
  return (
    <div className="bg-bg/60 border border-border rounded-xl px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-gray-600 mt-0.5">{hint}</p>}
    </div>
  );
}

// Ficha completa de un jugador: datos del club, contrato, nivel, atributos y, si es de
// tu plantel, su estado (moral, energía, lesión y números de la temporada). Lo que no
// scouteaste todavía se muestra como desconocido.
export default function PlayerInfoModal({ player: p, state, watched, onClose, onOffer, onUnwatch }) {
  const club = teamById(p.teamId);
  const own = state.squad.some((x) => x.id === p.id);
  const report = reportFor(state.scoutReports, p);
  const known = own || !!report;
  const clause = (state.releaseClauses || {})[p.id];
  const injury = own ? getInjury(state.injuries || [], p.id) : null;
  const injured = injury && injury.returnWeek > state.week;
  const stats = own ? (state.playerStats || {})[p.id] : null;
  const offers = (state.sentOffers || []).filter((o) => o.playerId === p.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-panel border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Ficha de ${p.name}`}>
        <div className="flex items-start gap-3">
          <span className="w-12 h-12 shrink-0 rounded-card bg-bg border border-border flex items-center justify-center text-sm font-bold text-gray-300">{p.position}</span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight">{p.name}</p>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {club && <TeamCrest team={club} size={16} />}
              {own ? `${club?.name} (tu plantel)` : club?.name || "Sin club"} · {p.age} años · {p.nationality}
              {p.number != null && <span>· camiseta {p.number}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm shrink-0" aria-label="Cerrar">✕</button>
        </div>

        {injured && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{injury.type} — vuelve en {Math.max(0, injury.returnWeek - state.week)} sem.</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label="Nivel (OVR)" value={own ? p.ovr : report ? formatRange(report.ovrRange) : "?"} hint={own || report ? null : "sin scoutear"} />
          <Stat label="Potencial" value={own ? p.potential : report?.potentialEstimate != null ? `~${report.potentialEstimate}` : "?"} hint={own || report ? null : "sin scoutear"} />
          <Stat label="Valor de mercado" value={`€${p.value}M`} />
          <Stat label="Sueldo" value={p.wage != null ? `€${p.wage}k/sem` : "—"} />
          <Stat label="Contrato" value={p.contractYears != null ? `${p.contractYears} año${p.contractYears === 1 ? "" : "s"}` : "—"} hint={p.contractYears <= 1 ? "último año" : null} />
          <Stat label="Cláusula" value={clause != null ? `€${clause}M` : "—"} />
          {report && !own && <Stat label="Oferta sugerida" value={`€${report.suggestedOffer}M`} />}
          {p.transferListed && <Stat label="Estado" value="Transferible" />}
          {p.loanListed && <Stat label="Estado" value="A préstamo" />}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-2">Estadísticas</p>
          {known ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {Object.entries(ATTR_LABELS).map(([key, label]) => {
                const v = p.attributes?.[key];
                return (
                  <div key={key} className="bg-bg border border-border rounded-xl px-2 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600">{label}</p>
                    <p className={`text-base font-bold ${v >= 80 ? "text-emerald" : v >= 65 ? "text-white" : "text-red-400"}`}>{v ?? "—"}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500 bg-bg/60 border border-dashed border-border rounded-xl px-3 py-3">Todavía no scouteaste a este jugador. Mandá un ojeador desde Scouting para conocer su nivel y sus estadísticas.</p>
          )}
        </div>

        {own && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Moral" value={Math.round((state.morale || {})[p.id] ?? 70)} />
            <Stat label="Energía" value={energyOf(state, p.id)} />
            <Stat label="Goles" value={stats?.goals ?? 0} />
            <Stat label="Asistencias" value={stats?.assists ?? 0} />
            <Stat label="Partidos" value={stats?.appearances ?? 0} />
            <Stat label="Amarillas" value={stats?.yellowCards ?? 0} />
          </div>
        )}

        {offers.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-2">Tus ofertas por él</p>
            <ul className="space-y-1">
              {offers.map((o) => (
                <li key={o.id} className="text-xs text-gray-400">
                  {o.type === "fee" ? `€${o.amount}M por el pase` : `€${o.amount}k/sem (${o.years} años)`}{o.byClause ? " (cláusula)" : ""} · <span className={o.accepted ? "text-emerald" : "text-red-400"}>{o.accepted ? "aceptada" : "rechazada"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!own && (onOffer || onUnwatch) && (
          <div className="flex gap-2 justify-end pt-1">
            {onUnwatch && watched && (
              <button onClick={() => { onUnwatch(p.id); onClose(); }} className="text-xs px-3.5 py-2 rounded-xl border border-border text-gray-400 hover:text-white">Quitar de la Central</button>
            )}
            {onOffer && (
              <button onClick={() => { onClose(); onOffer(p); }} className="text-xs font-medium px-4 py-2 rounded-xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20">Fichar</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
