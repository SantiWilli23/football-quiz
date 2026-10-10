import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { meetingsForWeek } from "../engine/meetings.js";
import { playerTacticNotes } from "../engine/attributeEffects.js";
import { attrPairs, attrValuesOf } from "../engine/gkAttributes.js";
import PlayerFace from "../../components/PlayerFace.jsx";
import { ALL_POSITIONS, trainingTier, trainingTierLabel } from "../engine/positions.js";
import { getInjury } from "../engine/injuryEngine.js";
import { reportFor } from "../engine/scouting.js";
import { contractSummary, formArrow, formOf, styleOf, stylesFor } from "../engine/playerForm.js";

const GROUPS = [
  { id: "GK",  label: "Arqueros",    positions: ["GK"],             color: "amber"   },
  { id: "DEF", label: "Defensas",    positions: ["CB", "LB", "RB"], color: "blue"    },
  { id: "MID", label: "Mediocampo",  positions: ["CDM", "CM", "CAM"], color: "emerald" },
  { id: "ATT", label: "Ataque",      positions: ["LW", "RW", "ST"], color: "red"     },
];
const COLOR_CLASSES = {
  amber:   "bg-amber/15 text-amber border-amber/30",
  blue:    "bg-blue/15 text-blue border-blue/30",
  emerald: "bg-emerald/15 text-emerald border-emerald/30",
  red:     "bg-red/15 text-red border-red/30",
};
const DOT_CLASSES = {
  amber: "bg-amber", blue: "bg-blue", emerald: "bg-emerald", red: "bg-red",
};

function moraleColor(m) {
  if (m >= 80) return "text-emerald";
  if (m >= 55) return "text-amber";
  if (m >= 35) return "text-orange-400";
  return "text-red-400";
}

function fatigueColor(f) {
  if (f >= 70) return "text-emerald";
  if (f >= 45) return "text-amber";
  return "text-red-400";
}

const INSTRUCTION_OPTIONS = [
  { id: "libre", label: "Libre" },
  { id: "ofensivo", label: "Ofensivo" },
  { id: "conservador", label: "Conservador" },
];

export default function Squad() {
  const { state, moveToBench, moveToReserves, toggleTransferListed, toggleLoanListed, startPositionTraining, startStyleChange, holdSquadMeeting, setCaptain, setPlayerInstruction } = useCareer();
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("ovr");

  const starterIds = new Set(state.lineup.starters.map((s) => s.playerId).filter(Boolean));
  const benchIds   = new Set(state.lineup.bench);

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
      <div className="space-y-6">
          <SquadMeeting
            options={meetingsForWeek(state)}
            onMeet={holdSquadMeeting}
            usedThisWeek={state.lastMeetingWeek === state.week}
          />

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
                <div key={g.id} className={`tone-${g.color === "red" ? "pink" : g.color}`}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-tone" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-tone">{g.label}</h3>
                    <span className="text-xs text-gray-400">· {g.players.length}</span>
                  </div>
                  <div className="tile-b rounded-card divide-y divide-white/10 overflow-hidden">
                    {g.players.map((p) => (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        state={state}
                        onStartStyle={(id) => startStyleChange(p.id, id)}
                        level={levelOf(p.id)}
                        report={reportFor(state.scoutReports, p)}
                        week={state.week}
                        injury={getInjury(state.injuries || [], p.id)}
                        morale={(state.morale || {})[p.id] ?? 70}
                        fatigue={(state.fatigue || {})[p.id] ?? 100}
                        seasonStats={(state.playerStats || {})[p.id]}
                        sliders={state.sliders}
                        isCaptain={state.captainId === p.id}
                        instruction={(state.playerInstructions || {})[p.id] || "libre"}
                        onBench={() => moveToBench(p.id)}
                        onReserves={() => moveToReserves(p.id)}
                        onToggleTransferListed={() => toggleTransferListed(p.id)}
                        onToggleLoanListed={() => toggleLoanListed(p.id)}
                        onStartTraining={(pos) => startPositionTraining(p.id, pos)}
                        onSetCaptain={() => setCaptain(p.id)}
                        onSetInstruction={(instr) => setPlayerInstruction(p.id, instr)}
                      />
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>

          <p className="text-xs text-gray-600">Tocá a un jugador para ver sus estadísticas. El potencial (POT) es una estimación de tus reclutadores — mandá uno a verlo en la pestaña Scouting para afinar el rango.</p>
      </div>
    </div>
  );
}

const FX_LABELS = [
  ["morale", "Moral"], ["moraleStarters", "Moral titulares"], ["moraleBench", "Moral suplentes"], ["moraleStar", "Moral figura"],
  ["energy", "Energía"], ["sharpness", "Ritmo"], ["board", "Directiva"], ["reputation", "Reputación"], ["budget", "Presupuesto"], ["youth", "Cantera"],
];

function effectChips(effects) {
  return FX_LABELS.filter(([k]) => effects[k]).map(([k, label]) => {
    const v = effects[k];
    const shown = k === "youth" ? "suben" : k === "budget" ? `${v > 0 ? "+" : ""}€${v}M` : `${v > 0 ? "+" : ""}${v}`;
    return { key: k, label, shown, good: k === "youth" ? true : v > 0 };
  });
}

// Una reunión por semana: cada semana se ofrecen 3 distintas del catálogo, al azar.
function SquadMeeting({ options, onMeet, usedThisWeek }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-panel border border-border rounded-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-semibold">Reunión de la semana</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {usedThisWeek ? "Ya tuviste tu reunión esta semana." : "Elegí una de las 3 reuniones que se pueden hacer esta semana."}
          </p>
        </div>
        <span className="text-gray-500 text-sm ml-4">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-border p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              disabled={usedThisWeek}
              onClick={() => onMeet(opt.id)}
              className={`tone-${opt.tone} text-left rounded-xl border p-3 transition-colors ${usedThisWeek ? "border-border text-gray-600 cursor-not-allowed opacity-50" : "border-tone bg-tone-soft hover:brightness-110"}`}
            >
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className="block text-xs text-gray-400 mt-0.5">{opt.desc}</span>
              <span className="flex flex-wrap gap-1 mt-2">
                {effectChips(opt.effects).map((c) => (
                  <span key={c.key} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${c.good ? "border-emerald/40 text-emerald" : "border-red-500/40 text-red-400"}`}>{c.label} {c.shown}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const LEVEL_STYLE = {
  Titular: "bg-accent/15 text-accent border-accent/30",
  Banca:   "bg-white/10 text-gray-300 border-white/10",
  Reserva: "text-gray-500 border-border",
};

function PlayerRow({ player: p, state, onStartStyle, level, report, week, injury, morale, fatigue, seasonStats, sliders, isCaptain, instruction, onBench, onReserves, onToggleTransferListed, onToggleLoanListed, onStartTraining, onSetCaptain, onSetInstruction }) {
  const [showStats, setShowStats] = useState(false);
  const isInjured = injury && injury.returnWeek > week;
  const weeksLeft = isInjured ? Math.max(0, injury.returnWeek - week) : 0;
  const notes = showStats ? playerTacticNotes(p, sliders || {}) : [];
  const form = formOf(state, p.id);
  const fa = formArrow(form);
  const style = styleOf(p);
  const contract = showStats ? contractSummary(p, state) : null;

  return (
    <div className={`px-4 py-3.5 hover:bg-white/[0.03] transition-colors space-y-2.5 ${isInjured ? "opacity-75" : ""}`}>
      {/* Baja por lesión */}
      {isInjured && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-1.5">
          <span className="text-red-400 text-sm"></span>
          <p className="text-xs text-red-400">{injury.type} — vuelve en {weeksLeft} sem.</p>
        </div>
      )}

      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setShowStats((v) => !v)} aria-expanded={showStats}>
        <div className="relative shrink-0">
          <PlayerFace name={p.name} size={44} className="border border-border" />
          <span className="absolute -bottom-1 -right-1 rounded bg-bg border border-border px-1 text-[10px] font-bold text-gray-300 leading-4">{p.position}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">
            {isCaptain && <span className="text-amber align-middle mr-1 font-bold" title="Capitán">C</span>}
            {p.name} {p.isYouth && <span className="text-amber text-xs align-middle" title="Promesa de la cantera"></span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{p.nationality} · {p.age} años</p>
        </div>

        {/* Moral */}
        <div className="hidden sm:flex flex-col items-center w-14 shrink-0">
          <span className="text-xs uppercase tracking-wide text-gray-600">Moral</span>
          <span className={`text-sm font-semibold ${moraleColor(morale)}`}>{Math.round(morale)}</span>
        </div>

        {/* Físico */}
        <div className="hidden sm:flex flex-col items-center w-14 shrink-0">
          <span className="text-xs uppercase tracking-wide text-gray-600">Energía</span>
          <span className={`text-sm font-semibold ${fatigueColor(fatigue)}`}>{fatigue}</span>
        </div>

        <div className="hidden sm:flex flex-col items-center w-16 shrink-0">
          <span className="text-xs uppercase tracking-wide text-gray-600">Valor</span>
          <span className="text-sm text-gray-300 font-medium">€{p.value}M</span>
          {p.prevValue != null && p.value !== p.prevValue && (
            <span className={`text-xs ${p.value > p.prevValue ? "text-emerald" : "text-red-400"}`}>
              {p.value > p.prevValue ? "▲" : "▼"} antes €{p.prevValue}M
            </span>
          )}
        </div>

        <div className="hidden sm:flex flex-col items-center w-16 shrink-0">
          <span className="text-xs uppercase tracking-wide text-gray-600">Pot.</span>
          <span className="text-sm text-gray-300 font-medium" title={report ? `Reportado por ${report.scoutName}` : "Sin reclutar"}>
            {report?.potentialEstimate != null ? `~${report.potentialEstimate}` : <span className="text-gray-600">?</span>}
          </span>
        </div>

        <div className="flex flex-col items-center w-11 shrink-0">
          <span className="text-xs uppercase tracking-wide text-gray-600">OVR</span>
          <span className="text-base font-bold">{p.ovr}</span>
          <span className={`text-xs font-bold leading-none ${FORM_TONE[fa.tone]}`} title={`${fa.label} (${form > 0 ? "+" : ""}${form.toFixed(1)} OVR en partido)`}>{fa.arrow}</span>
        </div>

        <span className={`hidden md:inline-flex shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${LEVEL_STYLE[level]}`}>
          {level}
        </span>

        <div className="hidden lg:flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onBench} className="text-xs px-2.5 py-1 rounded-card border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
            Banca
          </button>
          <button onClick={onReserves} className="text-xs px-2.5 py-1 rounded-card border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
            Reservas
          </button>
        </div>
      </div>

      {showStats && (
        <div className="pl-[52px] space-y-2.5">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {attrPairs(p).map(([key, label]) => {
              const v = attrValuesOf(p)[key];
              return (
                <div key={key} className="bg-bg border border-border rounded-xl px-2 py-1.5 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-gray-600">{label}</p>
                  <p className={`text-sm font-bold ${v >= 80 ? "text-emerald" : v >= 65 ? "text-white" : "text-red-400"}`}>{v ?? "—"}</p>
                </div>
              );
            })}
          </div>
          <div className="text-xs space-y-1 bg-bg border border-border rounded-xl px-3 py-2">
            <p><span className="text-gray-500">Estilo:</span> <span className="text-white font-medium">{style.label}</span> <span className="text-gray-500">— {style.desc}</span></p>
            <p><span className="text-gray-500">Forma:</span> <span className={`font-semibold ${FORM_TONE[fa.tone]}`}>{fa.arrow} {fa.label}</span></p>
            <p className={contract.wageTone === "bad" ? "text-red-400" : contract.wageTone === "good" ? "text-emerald" : "text-gray-400"}>Contrato: {contract.wageText} (€{p.wage}k/sem)</p>
            <p className={contract.roleTone === "bad" ? "text-red-400" : "text-gray-400"}>{contract.roleText}</p>
          </div>
          <ul className="space-y-1">
            {notes.map((n, i) => (
              <li key={i} className={`text-xs ${n.tone === "good" ? "text-emerald" : n.tone === "bad" ? "text-red-400" : "text-gray-400"}`}>• {n.text}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Estadísticas de temporada */}
      {seasonStats && (
        <div className="flex items-center gap-3 pl-[52px] flex-wrap">
          <span className="text-xs text-gray-500">{seasonStats.goals ?? 0}</span>
          <span className="text-xs text-gray-500">🅰️ {seasonStats.assists ?? 0}</span>
          <span className="text-xs text-gray-500">{seasonStats.yellowCards ?? 0}</span>
          <span className="text-xs text-gray-500">▶ {seasonStats.appearances ?? 0} partidos</span>
        </div>
      )}

      {/* Controles de transferencia y entrenamiento */}
      <div className="flex flex-wrap items-center gap-2 pl-[52px]">
        <button
          onClick={onSetCaptain}
          disabled={isCaptain}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isCaptain ? "bg-amber/15 text-amber border-amber/40 cursor-default" : "text-gray-500 border-border hover:text-white hover:border-gray-500"
          }`}
        >
          {isCaptain ? "Capitán" : "Nombrar capitán"}
        </button>
        <select
          value={instruction}
          onChange={(e) => onSetInstruction(e.target.value)}
          title="Instrucción individual para partidos"
          className="bg-bg border border-border rounded-full px-2.5 py-1 text-xs text-gray-300"
        >
          {INSTRUCTION_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={onToggleTransferListed}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            p.transferListed ? "bg-red-500/15 text-red-400 border-red-500/40" : "text-gray-500 border-border hover:text-white hover:border-gray-500"
          }`}
        >
          {p.transferListed ? "✓ Transferible" : "Poner transferible"}
        </button>
        <button
          onClick={onToggleLoanListed}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            p.loanListed ? "bg-blue/15 text-blue border-blue/40" : "text-gray-500 border-border hover:text-white hover:border-gray-500"
          }`}
        >
          {p.loanListed ? "✓ A préstamo" : "Ofrecer a préstamo"}
        </button>
        <PositionTraining player={p} week={week} onStart={onStartTraining} />
        <StyleChange player={p} week={week} onStart={onStartStyle} />
      </div>
    </div>
  );
}

const FORM_TONE = { good: "text-emerald", bad: "text-red-400", neutral: "text-gray-500" };

function StyleChange({ player: p, week, onStart }) {
  const [target, setTarget] = useState("");
  const styles = stylesFor(p.position);
  const current = styleOf(p);
  if (p.styleChange) {
    const st = styles.find((x) => x.id === p.styleChange.target);
    return (
      <span className="text-xs px-2.5 py-1 rounded-full border border-amber/30 bg-amber/10 text-amber">
        Cambiando a {st?.label} ({Math.max(0, p.styleChange.endWeek - week)} sem.)
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="bg-bg border border-border rounded-full px-2.5 py-1 text-xs text-gray-300">
        <option value="">Cambiar estilo…</option>
        {styles.filter((x) => x.id !== current.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      {target && (
        <button onClick={() => { onStart(target); setTarget(""); }} className="text-xs px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
          Cambiar
        </button>
      )}
    </div>
  );
}

function PositionTraining({ player: p, week, onStart }) {
  const [target, setTarget] = useState("");

  if (p.training) {
    const weeksLeft = Math.max(0, p.training.endWeek - week);
    return (
      <span className="text-xs px-2.5 py-1 rounded-full border border-amber/30 bg-amber/10 text-amber">
        Entrenando → {p.training.targetPos} ({weeksLeft} sem.)
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
        className="bg-bg border border-border rounded-full px-2.5 py-1 text-xs text-gray-300"
      >
        <option value="">Reconvertir a…</option>
        {ALL_POSITIONS.filter((pos) => pos !== p.position).map((pos) => (
          <option key={pos} value={pos}>{pos}</option>
        ))}
      </select>
      {target && (
        <button
          onClick={() => { onStart(target); setTarget(""); }}
          className="text-xs px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          Entrenar
        </button>
      )}
      {hint && <span className={`text-xs ${hint.tone === "good" ? "text-emerald" : hint.tone === "warn" ? "text-amber" : "text-red-400"}`}>{hint.text}</span>}
    </div>
  );
}
