import { useState } from "react";
import { ArrowUpCircle, Globe2, Sprout, UserMinus, Users } from "lucide-react";
import { useCareer } from "../context/CareerContext.jsx";
import {
  ACADEMY_COUNTRIES, MAX_CANTERA_SCOUTS, MAX_NETWORKS, MAX_NETWORK_LEVEL, MAX_YOUTH, NETWORK_COSTS,
  formatPotentialRange, monthsUntilLeaving, potentialRange,
} from "../engine/cantera.js";
import { SCOUT_SPECIALTIES } from "../engine/scouting.js";
import { MONTH_NAMES, currentDate } from "../engine/energy.js";

const SPECIALTIES = Object.values(SCOUT_SPECIALTIES);
const ERRORS = {
  insufficient_budget: (r) => `No te alcanza el presupuesto (cuesta €${r.cost}M).`,
  max_scouts: () => `Ya tenés el máximo de ${MAX_CANTERA_SCOUTS} ojeadores de cantera.`,
  max_networks: () => `Ya tenés redes en ${MAX_NETWORKS} países.`,
  max_level: () => "Esa red ya está al nivel máximo.",
  no_scouts: () => "Contratá un ojeador de cantera para poder fichar chicos.",
  full: () => `La cantera está llena (${MAX_YOUTH} chicos).`,
};

function Stat({ label, value, tone = "accent", Icon }) {
  return (
    <div className={`tone-${tone} tile-b rounded-2xl px-4 py-3`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-300 flex items-center gap-1.5">{Icon && <Icon size={12} />}{label}</p>
      <p className="text-xl font-extrabold text-tone leading-tight mt-0.5">{value}</p>
    </div>
  );
}

function PositionChip({ pos }) {
  return <span className="w-8 h-8 shrink-0 rounded-card bg-bg border border-border flex items-center justify-center text-[11px] font-bold text-gray-400">{pos}</span>;
}

function RangeBadge({ player, specialty }) {
  const range = potentialRange(player, specialty);
  return (
    <div className="text-center" title="Rango estimado del potencial: de joven es ancho y optimista, y se achica y baja hacia el real a medida que crece.">
      <p className="text-[10px] uppercase tracking-wide text-gray-600">Potencial</p>
      <p className="text-sm font-semibold text-purple tabular-nums">{formatPotentialRange(range)}</p>
    </div>
  );
}

export default function Cantera() {
  const { state, hireCanteraScoutAction, buildCanteraNetwork, signCanteraProspect, promoteYouth, releaseCanteraYouth } = useCareer();
  const cantera = state.cantera;
  const [section, setSection] = useState("jovenes");
  const [specialty, setSpecialty] = useState("potential");
  const [seasons, setSeasons] = useState(1);
  const [feedback, setFeedback] = useState("");

  const scouts = cantera.scouts;
  const hasScouts = scouts.length > 0;
  const date = currentDate(state);
  const nextMonth = MONTH_NAMES[(date.getUTCMonth() + 1) % 12];
  const leavingCount = cantera.youth.filter((y) => y.leaving).length;
  const specialtyOf = (id) => SCOUT_SPECIALTIES[id]?.id;

  function report(res, okText) {
    if (res?.error) setFeedback(ERRORS[res.error]?.(res) || "No se pudo completar.");
    else setFeedback(okText(res));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><Sprout size={22} className="text-emerald" /> Cantera</h2>
          <p className="text-sm text-gray-500 max-w-xl leading-relaxed">
            Armá tu red de ojeadores por el mundo: cada mes te muestran jóvenes para sumar. Para fichar a un chico necesitás tener ojeadores contratados.
          </p>
        </div>
        <div className="tone-accent tile-b rounded-2xl px-5 py-3 text-right shrink-0">
          <p className="text-xs uppercase tracking-wide text-gray-300">Presupuesto</p>
          <p className="text-2xl font-extrabold text-tone leading-none">€{state.budget}M</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Ojeadores" value={`${scouts.length}/${MAX_CANTERA_SCOUTS}`} tone="blue" Icon={Users} />
        <Stat label="Redes en países" value={`${cantera.networks.length}/${MAX_NETWORKS}`} tone="purple" Icon={Globe2} />
        <Stat label="En la cantera" value={`${cantera.youth.length}/${MAX_YOUTH}`} tone="emerald" Icon={Sprout} />
        <Stat label="Próximos jóvenes" value={hasScouts && cantera.networks.length ? nextMonth : "—"} tone="amber" />
      </div>

      {leavingCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-sm text-red-300">
          {leavingCount} chico{leavingCount === 1 ? "" : "s"} de tu cantera se {leavingCount === 1 ? "va" : "van"} a otro club al terminar la temporada si no {leavingCount === 1 ? "lo subís" : "los subís"} al primer equipo.
        </div>
      )}

      <div className="flex gap-1 flex-wrap">
        {[
          ["jovenes", `Jóvenes del mes (${cantera.prospects.length})`],
          ["mia", `Mi cantera (${cantera.youth.length})`],
          ["redes", "Ojeadores y redes"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setSection(id); setFeedback(""); }}
            className={`px-3 py-1.5 rounded-card text-sm font-medium border ${section === id ? "bg-accent/15 text-accent border-accent/30" : "text-gray-400 border-transparent hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {feedback && <p className="text-xs text-amber">{feedback}</p>}

      {section === "jovenes" && (
        <div className="space-y-3">
          {!hasScouts || !cantera.networks.length ? (
            <div className="bg-panel border border-dashed border-border rounded-2xl p-6 text-center space-y-2">
              <p className="text-sm text-gray-300">Todavía no te llegan jóvenes.</p>
              <p className="text-xs text-gray-500">Contratá al menos un ojeador y abrí una red en algún país: desde el mes que viene te muestran jóvenes.</p>
              <button onClick={() => setSection("redes")} className="mt-1 text-xs font-medium px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20">Ir a ojeadores y redes</button>
            </div>
          ) : null}
          {cantera.prospects.length > 0 && (
            <p className="text-xs text-gray-500">El potencial es un rango: cuanto más joven el chico, más ancho y más alto lo estiman. Se afina a medida que crece.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cantera.prospects.map((p) => (
              <div key={p.id} className="bg-panel border border-border border-l-4 border-l-emerald rounded-2xl p-3 flex flex-col gap-2.5 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PositionChip pos={p.position} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{p.age} años · {p.country}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-bg/60 border border-border rounded-xl py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600">Nivel</p>
                    <p className="text-sm font-semibold">{p.ovr}</p>
                  </div>
                  <div className="bg-bg/60 border border-border rounded-xl py-1.5"><RangeBadge player={p} specialty={p.foundBy} /></div>
                  <div className="bg-bg/60 border border-border rounded-xl py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600">Ficha</p>
                    <p className="text-sm font-semibold">€{p.signCost}M</p>
                  </div>
                </div>
                <button
                  onClick={() => report(signCanteraProspect(p.id), () => `Sumaste a ${p.name} a la cantera.`)}
                  disabled={!hasScouts}
                  title={hasScouts ? "" : "Necesitás un ojeador de cantera contratado"}
                  className="self-end text-xs font-medium px-3.5 py-2 rounded-xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 disabled:opacity-40 transition-colors"
                >
                  Fichar para la cantera
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "mia" && (
        <div className="space-y-3">
          {!cantera.youth.length && (
            <p className="px-4 py-6 text-center text-gray-600 text-sm bg-panel border border-border rounded-2xl">Tu cantera está vacía. Ficha chicos desde "Jóvenes del mes".</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cantera.youth.map((y) => (
              <div key={y.id} className={`bg-panel border ${y.leaving ? "border-red-500/40" : "border-border"} border-l-4 border-l-emerald rounded-2xl p-3 flex flex-col gap-2.5 min-w-0`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <PositionChip pos={y.position} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{y.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{y.age} años · {y.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-gray-600">Nivel</p>
                    <p className="text-lg font-bold leading-none">{y.ovr}</p>
                  </div>
                  <RangeBadge player={y} specialty={y.scoutSpecialty} />
                </div>
                {y.leaving && (
                  <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-1.5">
                    {y.leaving.club} lo quiere: se va en ~{monthsUntilLeaving(state.week)} mes{monthsUntilLeaving(state.week) === 1 ? "" : "es"} si no lo subís.
                  </p>
                )}
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={() => report(promoteYouth(y.id), () => `Subiste a ${y.name} al primer equipo.`)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-3.5 py-2 rounded-xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20"
                  >
                    <ArrowUpCircle size={13} /> Subir al primer equipo
                  </button>
                  <button
                    onClick={() => report(releaseCanteraYouth(y.id), () => `${y.name} dejó la cantera.`)}
                    className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-xl border border-border text-gray-400 hover:text-white"
                    title="Dar de baja"
                  >
                    <UserMinus size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "redes" && (
        <div className="space-y-6">
          <div className="bg-panel border border-border rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Contratar ojeador de cantera ({scouts.length}/{MAX_CANTERA_SCOUTS})</p>
              <p className="text-xs text-gray-500 mt-0.5">Trabaja por temporadas. Sin ojeadores no se pueden fichar chicos ni llegan jóvenes nuevos.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSpecialty(s.id)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-colors ${specialty === s.id ? "border-accent bg-accent/10" : "border-border hover:border-gray-500"}`}
                >
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-gray-500 mt-0.5">{s.id === "both" ? "€15M" : "€5-7M"}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">{SCOUT_SPECIALTIES[specialty]?.desc}</p>
            <div className="flex gap-2 items-center">
              <select value={seasons} onChange={(e) => setSeasons(Number(e.target.value))} className="bg-bg border border-border rounded-xl px-3 py-2 text-xs">
                <option value={1}>1 temporada</option>
                <option value={2}>2 temporadas</option>
              </select>
              <button
                onClick={() => report(hireCanteraScoutAction(specialty, seasons), (r) => `✅ Contratado por €${r.cost}M.`)}
                disabled={scouts.length >= MAX_CANTERA_SCOUTS}
                className="ml-auto text-xs font-medium px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 disabled:opacity-40"
              >
                Contratar
              </button>
            </div>
            {!!scouts.length && (
              <div className="grid sm:grid-cols-2 gap-2 pt-1">
                {scouts.map((sc) => (
                  <div key={sc.id} className="bg-bg/60 border border-border rounded-xl px-3 py-2">
                    <p className="text-sm font-semibold">{SCOUT_SPECIALTIES[sc.specialty]?.label}</p>
                    <p className="text-xs text-gray-500">Quedan {sc.seasonsLeft} temporada{sc.seasonsLeft === 1 ? "" : "s"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">Redes en países ({cantera.networks.length}/{MAX_NETWORKS})</p>
            <p className="text-xs text-gray-500 mb-3">Cada red nivel 1 a {MAX_NETWORK_LEVEL}. Más nivel, más chicos por mes y mejores.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {ACADEMY_COUNTRIES.map((country) => {
                const net = cantera.networks.find((n) => n.country === country);
                const level = net?.level || 0;
                const next = level < MAX_NETWORK_LEVEL ? NETWORK_COSTS[level] : null;
                return (
                  <div key={country} className={`tone-purple rounded-2xl border p-3 ${level ? "tile-b" : "border-border bg-panel"}`}>
                    <p className="text-sm font-semibold truncate">{country}</p>
                    <div className="flex gap-1 my-2" aria-label={`Nivel ${level} de ${MAX_NETWORK_LEVEL}`}>
                      {Array.from({ length: MAX_NETWORK_LEVEL }).map((_, i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < level ? "bg-tone" : "bg-white/10"}`} />
                      ))}
                    </div>
                    {next != null ? (
                      <button
                        onClick={() => report(buildCanteraNetwork(country), () => (level ? `Ampliaste la red en ${country}.` : `Abriste una red en ${country}.`))}
                        className="w-full text-xs font-medium px-2 py-1.5 rounded-xl bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20"
                      >
                        {level ? `Subir a nivel ${level + 1}` : "Abrir red"} · €{next}M
                      </button>
                    ) : (
                      <p className="text-xs text-center text-tone font-semibold">Nivel máximo</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
