import { useEffect } from "react";
import { Hand, X } from "lucide-react";

// Demo animada de 10 segundos de cómo se juega: una pregunta de ejemplo, la mano que toca la
// respuesta, la barra de tiempo y el acierto. Se cierra sola; con prefers-reduced-motion queda quieta.
export default function Demo({ onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 10_000);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[9996] flex items-center justify-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Demo de cómo se juega">
      <div className="relative w-full max-w-xs rounded-3xl border border-border bg-panel p-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 p-1 text-gray-400" aria-label="Cerrar demo"><X size={18} /></button>
        <p className="t-eyebrow">Así se juega</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="demo-bar h-full rounded-full bg-accent" /></div>
        <p className="mt-3 text-sm font-semibold">¿Quién es? · Mediocampista</p>
        <div className="relative mt-3 space-y-2">
          {["Opción A", "Respuesta correcta", "Opción C"].map((o, i) => (
            <div key={o} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${i === 1 ? "demo-right border-border" : "border-border"}`}>{o}</div>
          ))}
          <Hand size={34} className="demo-hand absolute right-6 text-white drop-shadow-lg" aria-hidden="true" />
        </div>
        <p className="demo-msg mt-3 text-center text-sm font-bold text-good">¡Acertaste! Rápido suma más.</p>
        <style>{`
          .demo-bar{width:100%;animation:demo-bar 10s linear forwards}
          .demo-hand{top:44px;animation:demo-hand 10s ease-in-out forwards}
          .demo-right{animation:demo-right 10s steps(1) forwards}
          .demo-msg{opacity:0;animation:demo-msg 10s steps(1) forwards}
          @keyframes demo-bar{from{width:100%}to{width:40%}}
          @keyframes demo-hand{0%{transform:translate(40px,30px);opacity:0}15%{opacity:1}45%{transform:translate(0,0)}55%{transform:translate(0,-8px) scale(.9)}70%,100%{transform:translate(0,0);opacity:1}}
          @keyframes demo-right{0%,54%{background:transparent}55%,100%{background:rgb(var(--c-emerald) / .2);border-color:rgb(var(--c-emerald))}}
          @keyframes demo-msg{0%,57%{opacity:0}58%,100%{opacity:1}}
          @media (prefers-reduced-motion: reduce){.demo-bar,.demo-hand,.demo-right,.demo-msg{animation:none}.demo-msg{opacity:1}.demo-hand{opacity:1}}
        `}</style>
      </div>
    </div>
  );
}
