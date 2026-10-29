import { useCareer, WEEKLY_DECISIONS } from "../context/CareerContext.jsx";

// Una decisión por jornada: mueve la moral de todo el plantel y la confianza de la
// directiva. Una vez tomada, queda la elección hasta la jornada siguiente.
export default function WeeklyDecisionCard() {
  const { state, takeWeeklyDecision } = useCareer();
  const decided = state.weeklyDecision?.week === state.week ? WEEKLY_DECISIONS.find((o) => o.id === state.weeklyDecision.id) : null;
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
      <p className="p-eyebrow"><span style={{ color: "var(--gold)" }}>Decisión de la semana · jornada {state.week + 1}</span>{decided && <span style={{ color: "var(--acc2)" }}>Tomada</span>}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
        {WEEKLY_DECISIONS.map((o) => {
          const active = decided?.id === o.id;
          return (
            <button
              key={o.id}
              disabled={!!decided}
              onClick={() => takeWeeklyDecision(o.id)}
              className="text-left rounded-xl border px-3 py-2.5 transition-colors"
              style={{ borderColor: active ? "var(--acc)" : "var(--line)", background: active ? "var(--me-bg)" : "var(--panel)", opacity: decided && !active ? 0.45 : 1 }}
            >
              <p className="text-sm font-semibold">{o.label}</p>
              <p className="text-xs p-muted mt-0.5">{o.desc}</p>
              <p className="text-[11px] mt-1.5 p-num" style={{ fontSize: 13 }}>
                <span style={{ color: o.morale >= 0 ? "var(--acc2)" : "var(--red)" }}>Moral {sign(o.morale)}</span> · <span style={{ color: o.board >= 0 ? "var(--acc2)" : "var(--red)" }}>Directiva {sign(o.board)}</span>
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
