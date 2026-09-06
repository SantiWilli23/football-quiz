import { useEffect, useRef, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { getInjury } from "../engine/injuryEngine.js";
import TeamCrest from "./TeamCrest.jsx";

const MAX_SUBS = 3;

export default function MatchSimulator({ matchResult, onFinish }) {
  const { team, state, playNextMatchSecondHalf } = useCareer();
  const [data, setData] = useState(matchResult);
  const [shown, setShown] = useState([]);
  const [playing, setPlaying] = useState(true);
  const [subs, setSubs] = useState([]);
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
    }, 900);
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
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{data.isCopa ? `Copa del Rey · ${data.copaRound}` : "Liga"}</p>
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-2 font-semibold text-lg"><TeamCrest team={team} size={24} />{team.name}</span>
            <span className="text-3xl font-bold tabular-nums">{myGoalsSoFar} - {rivalGoalsSoFar}</span>
            <span className="flex items-center gap-2 font-semibold text-lg">{rival?.name}{rival && <TeamCrest team={rival} size={24} />}</span>
          </div>
          {!eventsDone && <p className="text-xs text-gray-500 mt-2">Min {shown.length ? shown[shown.length - 1].min : 0}'</p>}
        </div>

        {!eventsDone && (
          <div className="flex gap-2 mb-4">
            <button onClick={simulateFast} className="flex-1 bg-panel border border-border rounded-card py-2 text-sm hover:border-white/20">
              ⏩ Simular rápido
            </button>
          </div>
        )}

        <div className="bg-panel border border-border rounded-card p-4 mb-4 max-h-96 overflow-y-auto space-y-2">
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
            <button onClick={onFinish} className="w-full bg-accent text-black font-semibold py-2.5 rounded-card hover:brightness-110">
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
