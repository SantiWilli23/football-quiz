import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

// Reproductor de tutoriales: pasos con barra de progreso, teclado (← → y Esc)
// y, en el último paso, opciones opcionales (`choices`) que cierran con su
// `favorites`. Lo usan el tutorial general (Inicio y Perfil) y el «?» de cada
// pantalla; `onClose` recibe el resultado de la opción elegida, si la hay.
export default function TutorialPlayer({ title, steps, onClose }) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-panel border border-border rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="text-xs uppercase tracking-wide text-gray-500 truncate">{title}</span>
          <button onClick={() => onClose()} className="p-1 text-gray-400 hover:text-white shrink-0" aria-label="Cerrar tutorial">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1.5 mb-5" aria-hidden="true">
          {steps.map((_, n) => (
            <span key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= i ? "bg-accent" : "bg-white/10"}`} />
          ))}
        </div>

        <h2 className="text-lg font-bold mb-2">{step.title}</h2>
        {step.body && <p className="text-sm text-gray-400 mb-4">{step.body}</p>}
        {step.points && (
          <ul className="space-y-2.5 text-sm text-gray-300 mb-5">
            {step.points.map((p) => (
              <li key={p} className="flex gap-2"><span className="text-accent shrink-0">•</span><span>{p}</span></li>
            ))}
          </ul>
        )}

        {last && step.choices && (
          <div className="space-y-2 mb-5">
            {step.choices.map((o, n) => (
              <Link
                key={o.label}
                to={o.to}
                onClick={() => onClose(o.favorites)}
                className={`btn h-auto py-3 w-full justify-between ${n === 0 ? "btn-primary" : "btn-secondary"}`}
              >
                <span>{o.label}</span>
                <span className="text-xs font-normal opacity-80">{o.hint}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="btn btn-secondary btn-sm">Atrás</button>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 tabular-nums">{i + 1}/{steps.length}</span>
            {last
              ? <button onClick={() => onClose()} className="btn btn-primary btn-sm">Listo</button>
              : <button onClick={() => setI(i + 1)} className="btn btn-primary btn-sm">Siguiente</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
