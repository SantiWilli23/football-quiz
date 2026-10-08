import { useCareer, WEEKLY_DECISIONS } from "../context/CareerContext.jsx";

// Una decisión por jornada: mueve la moral de todo el plantel y la confianza de la
// directiva. Una vez tomada, queda la elección hasta la jornada siguiente.
export default function WeeklyDecisionCard() {
  const { state, takeWeeklyDecision } = useCareer();
  const decided = state.weeklyDecision?.week === state.week ? WEEKLY_DECISIONS.find((o) => o.id === state.weeklyDecision.id) : null;
  const TONES = { elogiar: "tone-emerald", exigir: "tone-red", defender: "tone-blue" };

  return (
    <div className="tone-pink tile-b rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs uppercase tracking-wide font-semibold text-gray-300">Decisión de la semana · jornada {state.week + 1}</p>
        {decided && <span className="text-xs font-semibold text-tone">Tomada</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {WEEKLY_DECISIONS.map((o) => {
          const active = decided?.id === o.id;
          return (
            <button
              key={o.id}
              disabled={!!decided}
              onClick={() => takeWeeklyDecision(o.id)}
              className={`${TONES[o.id]} text-left rounded-xl border px-3 py-2.5 transition-colors ${active ? "tile-b text-white" : "border-border bg-bg/50 hover:border-white/30"} ${decided && !active ? "opacity-40" : ""}`}
            >
              <p className="text-sm font-semibold">{o.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{o.desc}</p>
              <p className="text-[11px] mt-1.5 tabular-nums text-gray-300">
                Moral {o.morale > 0 ? "+" : ""}{o.morale} · Directiva {o.board > 0 ? "+" : ""}{o.board}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
