import { useEffect, useMemo, useRef, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { getInjury } from "../engine/injuryEngine.js";
import { layoutSlots } from "../engine/pitchLayout.js";
import { getPressQuestion } from "../engine/pressEngine.js";
import TeamCrest from "./TeamCrest.jsx";

const MAX_SUBS = 3;
const TICK_MS = 1000;
const RIVAL_FORMATION = ["GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CM", "RW", "ST", "LW"].map((slot) => ({ slot }));

function ballPositionFor(event) {
  if (!event) return { x: 50, y: 50 };
  if (event.type === "goal") return event.team === "me" ? { x: 50, y: 6 } : { x: 50, y: 94 };
  if (event.type === "shot") return event.team === "me" ? { x: 50, y: 24 } : { x: 50, y: 76 };
  if (event.type === "card") return { x: 50, y: 50 };
  return { x: 50, y: 50 };
}

function LivePitch({ myColor, starters, byId, lastEvent }) {
  const myCoords = useMemo(() => layoutSlots(starters), [starters]);
  const rivalCoords = useMemo(
    () => layoutSlots(RIVAL_FORMATION).map((c) => ({ x: c.x, y: 100 - c.y })),
    []
  );
  const ball = ballPositionFor(lastEvent);
  const goalFlash = lastEvent?.type === "goal";

  return (
    <div
      className="relative w-full rounded-card overflow-hidden border border-border select-none mb-4"
      style={{ aspectRatio: "0.8", background: "linear-gradient(180deg,#1f4d33,#255c3d 50%,#1f4d33)" }}
    >
      <div className="absolute inset-2 border border-white/25 rounded-md" />
      <div className="absolute left-2 right-2 top-1/2 border-t border-white/25" />
      <div className="absolute left-1/2 top-1/2 w-14 h-14 -translate-x-1/2 -translate-y-1/2 border border-white/25 rounded-full" />

      {starters.map((slot, i) => {
        const p = byId[slot.playerId];
        const pos = myCoords[i] || { x: 50, y: 50 };
        return (
          <div
            key={`me-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transition: "left 0.4s ease, top 0.4s ease" }}
          >
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold text-white shadow-md border border-black/20"
              style={{ background: myColor }}
            >
              {p?.number ?? "?"}
            </div>
          </div>
        );
      })}

      {rivalCoords.map((pos, i) => (
        <div
          key={`riv-${i}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold bg-gray-700 text-gray-200 border border-gray-500"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          {i + 1}
        </div>
      ))}

      <div
        className={`absolute w-2.5 h-2.5 rounded-full bg-white shadow transition-all duration-500 ${goalFlash ? "ring-4 ring-amber/70" : ""}`}
        style={{ left: `${ball.x}%`, top: `${ball.y}%`, transform: "translate(-50%,-50%)" }}
      />
    </div>
  );
}

export default function MatchSimulator({ matchResult, onFinish }) {
  const { team, state, playNextMatchSecondHalf, answerPressConference } = useCareer();
  const [data, setData] = useState(matchResult);
  const [shown, setShown] = useState([]);
  const [playing, setPlaying] = useState(true);
  const [subs, setSubs] = useState([]);
  const [pressChoice, setPressChoice] = useState(null);
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  const events = data?.events || [];
  const rival = data?.rival;
  const isHalftimePending = data?.phase === "half1";

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      idxRef.current += 1;
      setShown(events.slice(0, idxRef.current));
      if (idxRef.current >= events.length) clearInterval(timerRef.current);
    }, TICK_MS);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, events.length]);

  function simulateFast() {
    clearInterval(timerRef.current);
    setPlaying(false);
    idxRef.current = events.length;
    setShown(events);
  }

  function confirmSubstitutions() {
    const result = playNextMatchSecondHalf(subs);
    if (!result) return;
    setData(result);
    // Ya se mostraron los eventos del primer tiempo; seguimos animando desde ahí.
    setShown(result.events.slice(0, idxRef.current));
    setSubs([]);
    setPlaying(true);
  }

  function handlePressAnswer(option) {
    answerPressConference(option.effects);
    setPressChoice(option.id);
  }

  if (!data) return null;

  const eventsDone = shown.length >= events.length;
  const finished = eventsDone && !isHalftimePending;
  const showHalftimePanel = eventsDone && isHalftimePending;

  const myGoalsSoFar = shown.filter((e) => e.type === "goal" && e.team === "me").length;
  const rivalGoalsSoFar = shown.filter((e) => e.type === "goal" && e.team === "rival").length;

  const starters = (state.lineup.starters || []).filter((s) => s.playerId);
  const bench = state.lineup.bench || [];
  const playerById = (id) => state.squad.find((p) => p.id === id);
  const usedOut = new Set(subs.map((s) => s.outId));
  const usedIn = new Set(subs.map((s) => s.inId));
  const availableOut = starters.filter((s) => !usedOut.has(s.playerId));
  const availableIn = bench.filter((id) => !usedIn.has(id) && !getInjury(state.injuries || [], id));

  const byId = Object.fromEntries(state.squad.map((p) => [p.id, p]));
  const lastEvent = shown[shown.length - 1] || null;
  const isPreseason = data.competitionLabel === "Amistoso de pretemporada";
  const pressQuestion = finished && !isPreseason ? getPressQuestion(data.myGoals, data.rivalGoals) : null;

  function addSub(outId, inId) {
    if (!outId || !inId || subs.length >= MAX_SUBS) return;
    setSubs((prev) => [...prev, { outId, inId }]);
  }
  function removeSub(idx) {
    setSubs((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="min-h-screen bg-bg text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-panel border border-border rounded-card p-5 text-center mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{data.competitionLabel || "Liga"}</p>
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-2 font-semibold text-lg"><TeamCrest team={team} size={24} />{team.name}</span>
            <span className="text-3xl font-bold tabular-nums">{myGoalsSoFar} - {rivalGoalsSoFar}</span>
            <span className="flex items-center gap-2 font-semibold text-lg">{rival?.name}{rival && <TeamCrest team={rival} size={24} />}</span>
          </div>
          {!eventsDone && <p className="text-xs text-gray-500 mt-2">Min {shown.length ? shown[shown.length - 1].min : 0}'</p>}
        </div>

        <LivePitch myColor={team.colors?.primary || "#3fae9a"} starters={starters} byId={byId} lastEvent={lastEvent} />

        {!eventsDone && (
          <div className="flex gap-2 mb-4">
            <button onClick={simulateFast} className="flex-1 bg-panel border border-border rounded-card py-2 text-sm hover:border-white/20">
              ⏩ Simular rápido
            </button>
          </div>
        )}

        <div className="bg-panel border border-border rounded-card p-4 mb-4 max-h-72 overflow-y-auto space-y-2">
          {shown.length === 0 && <p className="text-sm text-gray-500">El partido está por comenzar...</p>}
          {shown.map((e, i) => (
            <p key={i} className="text-sm">
              <span className="text-gray-500">Min {e.min}'</span> — {e.text}
            </p>
          ))}
        </div>

        {showHalftimePanel && (
          <div className="space-y-4">
            <div className="bg-amber/5 border border-amber/30 rounded-card p-4">
              <p className="text-sm font-semibold text-amber mb-1">⏸ Entretiempo — hacé tus cambios</p>
              <p className="text-xs text-gray-400 mb-4">Podés hacer hasta {MAX_SUBS} sustituciones antes del segundo tiempo. También podés continuar sin cambios.</p>

              {subs.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {subs.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-bg border border-border rounded-full px-3 py-1.5">
                      <span>🔴 {playerById(s.outId)?.name} → 🟢 {playerById(s.inId)?.name}</span>
                      <button onClick={() => removeSub(i)} className="text-gray-500 hover:text-white">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {subs.length < MAX_SUBS && availableOut.length > 0 && availableIn.length > 0 && (
                <SubPicker starters={availableOut} bench={availableIn} playerById={playerById} onAdd={addSub} />
              )}

              <button
                onClick={confirmSubstitutions}
                className="w-full mt-4 bg-accent text-black font-semibold py-2.5 rounded-card hover:brightness-110"
              >
                {subs.length ? `Continuar con ${subs.length} cambio${subs.length === 1 ? "" : "s"}` : "Continuar sin cambios"}
              </button>
            </div>
          </div>
        )}

        {finished && (
          <div className="space-y-4">
            <div className="bg-panel border border-border rounded-card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Estadísticas</p>
              <StatRow label="Posesión" me={`${data.stats.possession}%`} rival={`${100 - data.stats.possession}%`} />
              <StatRow label="Tiros" me={data.stats.shots.me} rival={data.stats.shots.rival} />
              <StatRow label="Tiros a puerta" me={data.stats.shotsOnTarget.me} rival={data.stats.shotsOnTarget.rival} />
              <StatRow label="Corners" me={data.stats.corners.me} rival={data.stats.corners.rival} />
              <StatRow label="Faltas" me={data.stats.fouls.me} rival={data.stats.fouls.rival} />
              <StatRow label="Amarillas" me={data.stats.yellow.me} rival={data.stats.yellow.rival} />
            </div>

            {pressQuestion && !pressChoice && (
              <div className="bg-panel border border-accent/30 rounded-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">🎙️ Conferencia de prensa</p>
                <p className="text-sm font-medium mb-3">{pressQuestion.question}</p>
                <div className="space-y-2">
                  {pressQuestion.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handlePressAnswer(opt)}
                      className="w-full text-left text-sm px-3.5 py-2.5 rounded-card border border-border bg-bg hover:border-accent/40 hover:bg-accent/5 transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pressQuestion && pressChoice && (
              <div className="bg-panel border border-border rounded-card p-4">
                <p className="text-xs text-gray-500">🎙️ Declaraste tu postura en la conferencia de prensa.</p>
              </div>
            )}

            <button
              onClick={onFinish}
              disabled={!!pressQuestion && !pressChoice}
              className="w-full bg-accent text-black font-semibold py-2.5 rounded-card hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubPicker({ starters, bench, playerById, onAdd }) {
  const [outId, setOutId] = useState("");
  const [inId, setInId] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={outId} onChange={(e) => setOutId(e.target.value)} className="bg-bg border border-border rounded-full px-3 py-1.5 text-xs flex-1 min-w-[130px]">
        <option value="">Sale…</option>
        {starters.map((s) => {
          const p = playerById(s.playerId);
          return p ? <option key={s.playerId} value={s.playerId}>{p.name} ({p.position})</option> : null;
        })}
      </select>
      <span className="text-gray-500 text-xs">→</span>
      <select value={inId} onChange={(e) => setInId(e.target.value)} className="bg-bg border border-border rounded-full px-3 py-1.5 text-xs flex-1 min-w-[130px]">
        <option value="">Entra…</option>
        {bench.map((id) => {
          const p = playerById(id);
          return p ? <option key={id} value={id}>{p.name} ({p.position})</option> : null;
        })}
      </select>
      <button
        onClick={() => { if (outId && inId) { onAdd(outId, inId); setOutId(""); setInId(""); } }}
        className="text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20"
      >
        Confirmar
      </button>
    </div>
  );
}

function StatRow({ label, me, rival }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
      <span className="w-12 text-right tabular-nums">{me}</span>
      <span className="text-gray-500 text-xs flex-1 text-center">{label}</span>
      <span className="w-12 tabular-nums">{rival}</span>
    </div>
  );
}
