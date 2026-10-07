import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Calendario de un mes para elegir un día. `value` y `onPick` usan "YYYY-MM-DD".
export default function MonthCalendar({ value, onPick, today }) {
  const [vy, vm] = value.split("-").map(Number);
  const [view, setView] = useState({ y: vy, m: vm - 1 });

  const first = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  const move = (delta) => setView(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const raw = first.toLocaleDateString("es-ES", { month: "long", year: "numeric" }).replace(" de ", " ");
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <div className="w-64 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => move(-1)} aria-label="Mes anterior" className="p-1.5 rounded-card border border-border text-gray-400 hover:text-white hover:border-white/30 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-medium">{title}</span>
        <button onClick={() => move(1)} aria-label="Mes siguiente" className="p-1.5 rounded-card border border-border text-gray-400 hover:text-white hover:border-white/30 transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => <span key={w} className="text-[10px] text-gray-500 py-1">{w}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const key = iso(view.y, view.m, d);
          const selected = key === value;
          const isToday = key === today;
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              aria-pressed={selected}
              className={`h-8 rounded-card text-xs tabular-nums transition-colors ${
                selected ? "bg-accent text-onaccent font-semibold"
                  : isToday ? "border border-accent/60 text-accent"
                  : "text-gray-300 hover:bg-white/10"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
