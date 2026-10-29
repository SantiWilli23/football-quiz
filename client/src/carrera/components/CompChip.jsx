import { COMP } from "../engine/schedule.js";

// Chip de color por competición (Liga, Copa, Europa, Amistoso), como en la agenda y el calendario.
export default function CompChip({ comp, short = false }) {
  const c = COMP[comp] || COMP.liga;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0"
      style={{ color: c.color, border: `1px solid ${c.color}55`, background: `${c.color}1a` }}>
      <i className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />{short ? c.short : c.label}
    </span>
  );
}
