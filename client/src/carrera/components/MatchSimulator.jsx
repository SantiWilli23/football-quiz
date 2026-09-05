import { useEffect, useRef, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import TeamCrest from "./TeamCrest.jsx";

export default function MatchSimulator({ matchResult, onFinish }) {
  const { team } = useCareer();
  const [shown, setShown] = useState([]);
  const [playing, setPlaying] = useState(true);
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  const events = matchResult?.events || [];
  const rival = matchResult?.rival;

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      idxRef.current += 1;
      setShown(events.slice(0, idxRef.current));
      if (idxRef.current >= events.length) clearInterval(timerRef.current);
    }, 900);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  function simulateFast() {
    clearInterval(timerRef.current);
    setPlaying(false);
    idxRef.current = events.length;
    setShown(events);
  }

  if (!matchResult) return null;

  const finished = shown.length >= events.length;
  const myGoalsSoFar = shown.filter((e) => e.type === "goal" && e.team === "me").length;
  const rivalGoalsSoFar = shown.filter((e) => e.type === "goal" && e.team === "rival").length;

  return (
    <div className="min-h-screen bg-bg text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-panel border border-border rounded-card p-5 text-center mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Liga</p>
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-2 font-semibold text-lg"><TeamCrest team={team} size={24} />{team.name}</span>
            <span className="text-3xl font-bold tabular-nums">{myGoalsSoFar} - {rivalGoalsSoFar}</span>
            <span className="flex items-center gap-2 font-semibold text-lg">{rival?.name}{rival && <TeamCrest team={rival} size={24} />}</span>
          </div>
          {!finished && <p className="text-xs text-gray-500 mt-2">Min {shown.length ? shown[shown.length - 1].min : 0}'</p>}
        </div>

        {!finished && (
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

        {finished && (
          <div className="space-y-4">
            <div className="bg-panel border border-border rounded-card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Estadísticas</p>
              <StatRow label="Posesión" me={`${matchResult.stats.possession}%`} rival={`${100 - matchResult.stats.possession}%`} />
              <StatRow label="Tiros" me={matchResult.stats.shots.me} rival={matchResult.stats.shots.rival} />
              <StatRow label="Tiros a puerta" me={matchResult.stats.shotsOnTarget.me} rival={matchResult.stats.shotsOnTarget.rival} />
              <StatRow label="Corners" me={matchResult.stats.corners.me} rival={matchResult.stats.corners.rival} />
              <StatRow label="Faltas" me={matchResult.stats.fouls.me} rival={matchResult.stats.fouls.rival} />
              <StatRow label="Amarillas" me={matchResult.stats.yellow.me} rival={matchResult.stats.yellow.rival} />
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

function StatRow({ label, me, rival }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
      <span className="w-12 text-right tabular-nums">{me}</span>
      <span className="text-gray-500 text-xs flex-1 text-center">{label}</span>
      <span className="w-12 tabular-nums">{rival}</span>
    </div>
  );
}
