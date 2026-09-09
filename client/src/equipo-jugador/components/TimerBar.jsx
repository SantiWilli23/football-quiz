export default function TimerBar({ secondsLeft, totalSeconds }) {
  const pct = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const danger = secondsLeft <= 6;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Tiempo</span>
        <span className={`text-sm font-bold tabular-nums ${danger ? "text-red-400" : "text-gray-300"}`}>{secondsLeft}s</span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%`, background: danger ? "#d9534f" : "#3fae9a" }}
        />
      </div>
    </div>
  );
}
