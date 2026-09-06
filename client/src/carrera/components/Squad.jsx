import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import Formation from "./Formation.jsx";
import { ALL_POSITIONS, trainingTier, trainingTierLabel } from "../engine/positions.js";

// Agrupamos por línea de cancha en vez de tirar las 10 posiciones sueltas:
// así la plantilla se lee en bloques (arco, defensa, medio, ataque) y no
// como una sola sopa de filas.
const GROUPS = [
  { id: "GK", label: "Arqueros", positions: ["GK"], color: "amber" },
  { id: "DEF", label: "Defensas", positions: ["CB", "LB", "RB"], color: "blue" },
  { id: "MID", label: "Mediocampo", positions: ["CDM", "CM", "CAM"], color: "emerald" },
  { id: "ATT", label: "Ataque", positions: ["LW", "RW", "ST"], color: "red" },
];
const COLOR_CLASSES = {
  amber: "bg-amber/15 text-amber border-amber/30",
  blue: "bg-blue/15 text-blue border-blue/30",
  emerald: "bg-emerald/15 text-emerald border-emerald/30",
  red: "bg-red/15 text-red border-red/30",
};
// Tailwind no puede resolver clases armadas con template strings (bg-${x}):
// necesita ver la clase completa y literal en el código para generarla.
const DOT_CLASSES = {
  amber: "bg-amber",
  blue: "bg-blue",
  emerald: "bg-emerald",
  red: "bg-red",
};

export default function Squad() {
  const { state, moveToBench, moveToReserves, toggleTransferListed, toggleLoanListed, startPositionTraining } = useCareer();
  const [tab, setTab] = useState("formacion");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("ovr");

  const starterIds = new Set(state.lineup.starters.map((s) => s.playerId).filter(Boolean));
  const benchIds = new Set(state.lineup.bench);

  function levelOf(id) {
    if (starterIds.has(id)) return "Titular";
    if (benchIds.has(id)) return "Banca";
    return "Reserva";
  }

  const groupedList = useMemo(() => {
    const sorted = [...state.squad].sort((a, b) => (sortBy === "age" ? a.age - b.age : b[sortBy] - a[sortBy]));
    return GROUPS.filter((g) => groupFilter === "ALL" || groupFilter === g.id).map((g) => ({
      ...g,
      players: sorted.filter((p) => g.positions.includes(p.position)),
    }));
  }, [state.squad, groupFilter, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {[["formacion", "Formación"], ["plantilla", "Plantilla"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-card text-sm font-medium ${tab === id ? "bg-accent/15 text-accent border border-accent/30" : "text-gray-400 border border-transparent hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "formacion" && <Formation />}

      {tab === "plantilla" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-bold">Plantilla <span className="text-gray-500 font-normal text-base">({state.squad.length})</span></h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-panel border border-border rounded-card px-3 py-2 text-sm text-gray-300"
            >
              <option value="ovr">Ordenar por OVR</option>
              <option value="age">Ordenar por edad</option>
              <option value="value">Ordenar por valor</option>
            </select>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setGroupFilter("ALL")}
              className={`px-3.5 py-1.5 rounded-card text-sm font-medium border transition-colors ${
                groupFilter === "ALL" ? "bg-white/10 text-white border-white/20" : "text-gray-500 border-border hover:text-white hover:border-gray-500"
              }`}
            >
              Todos
            </button>
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroupFilter(g.id)}
                className={`px-3.5 py-1.5 rounded-card text-sm font-medium border transition-colors ${
                  groupFilter === g.id ? COLOR_CLASSES[g.color] : "text-gray-500 border-border hover:text-white hover:border-gray-500"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {groupedList.map((g) => (
              g.players.length > 0 && (
                <div key={g.id}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className={`w-2 h-2 rounded-full ${DOT_CLASSES[g.color]}`} />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{g.label}</h3>
                    <span className="text-xs text-gray-600">· {g.players.length}</span>
                  </div>
                  <div className="rounded-card border border-border bg-panel divide-y divide-border overflow-hidden">
                    {g.players.map((p) => (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        level={levelOf(p.id)}
                        report={state.scoutReports[p.id]}
                        week={state.week}
                        onBench={() => moveToBench(p.id)}
                        onReserves={() => moveToReserves(p.id)}
                        onToggleTransferListed={() => toggleTransferListed(p.id)}
                        onToggleLoanListed={() => toggleLoanListed(p.id)}
                        onStartTraining={(pos) => startPositionTraining(p.id, pos)}
                      />
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>

          <p className="text-xs text-gray-600">El potencial (POT) es una estimación de tus reclutadores — mandá uno a verlo en la pestaña Scouting para afinar el rango.</p>
        </div>
      )}
    </div>
  );
}

const LEVEL_STYLE = {
  Titular: "bg-accent/15 text-accent border-accent/30",
  Banca: "bg-white/10 text-gray-300 border-white/10",
  Reserva: "text-gray-500 border-border",
};

function PlayerRow({ player: p, level, report, week, onBench, onReserves, onToggleTransferListed, onToggleLoanListed, onStartTraining }) {
  return (
    <div className="px-4 py-3.5 hover:bg-white/[0.03] transition-colors space-y-2.5">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 shrink-0 rounded-card bg-bg border border-border flex items-center justify-center text-[11px] font-bold text-gray-400">
          {p.position}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">
            {p.name} {p.isYouth && <span className="text-amber text-xs align-middle" title="Promesa de la cantera">⭐</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{p.nationality} · {p.age} años</p>
        </div>

        <div className="hidden sm:flex flex-col items-center w-16 shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-gray-600">Valor</span>
          <span className="text-sm text-gray-300 font-medium">€{p.value}M</span>
        </div>

        <div className="hidden sm:flex flex-col items-center w-16 shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-gray-600">Pot.</span>
          <span className="text-sm text-gray-300 font-medium" title={report ? `Reportado por ${report.scoutName}` : "Sin reclutar"}>
            {report?.potentialEstimate != null ? `~${report.potentialEstimate}` : <span className="text-gray-600">?</span>}
          </span>
        </div>

        <div className="flex flex-col items-center w-11 shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-gray-600">OVR</span>
          <span className="text-base font-bold">{p.ovr}</span>
        </div>

        <span className={`hidden md:inline-flex shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border ${LEVEL_STYLE[level]}`}>
          {level}
        </span>

        <div className="hidden lg:flex gap-1.5 shrink-0">
          <button onClick={onBench} className="text-xs px-2.5 py-1 rounded-card border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
            Banca
          </button>
          <button onClick={onReserves} className="text-xs px-2.5 py-1 rounded-card border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
            Reservas
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[52px]">
        <button
          onClick={onToggleTransferListed}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
            p.transferListed ? "bg-red-500/15 text-red-400 border-red-500/40" : "text-gray-500 border-border hover:text-white hover:border-gray-500"
          }`}
        >
          {p.transferListed ? "✓ Transferible" : "Poner transferible"}
        </button>
        <button
          onClick={onToggleLoanListed}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
            p.loanListed ? "bg-blue/15 text-blue border-blue/40" : "text-gray-500 border-border hover:text-white hover:border-gray-500"
          }`}
        >
          {p.loanListed ? "✓ A préstamo" : "Ofrecer a préstamo"}
        </button>
        <PositionTraining player={p} week={week} onStart={onStartTraining} />
      </div>
    </div>
  );
}

function PositionTraining({ player: p, week, onStart }) {
  const [target, setTarget] = useState("");

  if (p.training) {
    const weeksLeft = Math.max(0, p.training.endWeek - week);
    return (
      <span className="text-[11px] px-2.5 py-1 rounded-full border border-amber/30 bg-amber/10 text-amber">
        🎓 Entrenando → {p.training.targetPos} ({weeksLeft} sem.)
      </span>
    );
  }

  const tier = target ? trainingTier(p.position, target) : null;
  const hint = tier ? trainingTierLabel(tier) : null;

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="bg-bg border border-border rounded-full px-2.5 py-1 text-[11px] text-gray-300"
      >
        <option value="">Reconvertir a…</option>
        {ALL_POSITIONS.filter((pos) => pos !== p.position).map((pos) => (
          <option key={pos} value={pos}>{pos}</option>
        ))}
      </select>
      {target && (
        <button
          onClick={() => { onStart(target); setTarget(""); }}
          className="text-[11px] px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          Entrenar
        </button>
      )}
      {hint && <span className={`text-[10px] ${hint.tone === "good" ? "text-emerald" : hint.tone === "warn" ? "text-amber" : "text-red-400"}`}>{hint.text}</span>}
    </div>
  );
}
