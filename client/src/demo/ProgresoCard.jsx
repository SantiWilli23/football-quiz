import { Lock, Star } from "lucide-react";
import useProgreso from "./useProgreso.js";

// Tarjeta de progresión del perfil: nivel, experiencia, título y celebraciones de gol.
export default function ProgresoCard() {
  const { progreso: p, choose } = useProgreso();
  if (!p) return null;
  const span = p.next ? p.next - p.from : 1;
  const pct = p.next ? Math.min(100, Math.round(((p.xp - p.from) / span) * 100)) : 100;
  return (
    <section className="p-card" aria-label="Tu progreso">
      <div className="flex items-center gap-3.5">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--acc) ${pct * 3.6}deg, var(--line) 0)` }}>
          <span className="flex h-[54px] w-[54px] flex-col items-center justify-center rounded-full" style={{ background: "var(--panel)" }}>
            <small className="p-muted" style={{ fontSize: 9, letterSpacing: ".08em" }}>NIVEL</small>
            <b className="p-num" style={{ fontSize: 22, lineHeight: 1 }}>{p.level}</b>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold"><Star size={14} style={{ color: "var(--gold)" }} /> {p.title}</p>
          <p className="text-xs p-muted">{p.titleFromAdn ? `${p.rank} · ` : ""}{p.xp} XP{p.next ? ` · faltan ${p.next - p.xp} para el nivel ${p.level + 1}` : " · nivel máximo"}</p>
          <div className="p-cbar mt-1.5"><i style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide p-muted">Celebración de gol</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Celebración de gol">
        {p.celebrations.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={p.celebration === c.id} disabled={!c.unlocked} onClick={() => choose(c.id)}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs disabled:opacity-50"
            style={{ borderColor: p.celebration === c.id ? "var(--acc)" : "var(--line)", background: p.celebration === c.id ? "var(--me-bg)" : "transparent" }}>
            {!c.unlocked && <Lock size={11} />}{c.label}{!c.unlocked && <small className="p-dim"> · nivel {c.level}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}
