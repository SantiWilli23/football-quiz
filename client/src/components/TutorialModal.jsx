import { useState } from "react";
import { Star } from "lucide-react";

const MAX_PICKS = 3;

// Se muestra una sola vez por usuario (ver flag en localStorage, Dashboard.jsx)
// — la idea es bajar la fricción de entrar a un menú con más de 15 juegos sin
// ningún contexto: elegís 2-3 para arrancar y esas quedan destacadas arriba.
export default function TutorialModal({ sections, onDone }) {
  const [picked, setPicked] = useState([]);

  function toggle(to) {
    setPicked((prev) => {
      if (prev.includes(to)) return prev.filter((p) => p !== to);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, to];
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-panel border border-border rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-lg font-bold mb-1">¡Bienvenido a Futotal!</h2>
        <p className="text-sm text-gray-400 mb-5">
          Hay bastante para explorar. Elegí hasta {MAX_PICKS} para arrancar — las vas a ver destacadas en tu panel (podés cambiarlo cuando quieras).
        </p>

        <div className="space-y-2 mb-6">
          {sections.map(({ to, label, icon: Icon, description, color }) => {
            const active = picked.includes(to);
            return (
              <button
                key={to}
                onClick={() => toggle(to)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-card border text-left transition-colors ${
                  active ? "border-accent/50 bg-accent/10" : "border-border hover:border-white/30"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}22`, border: `1px solid ${color}44`, color }}
                >
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-[11px] text-gray-500 truncate">{description}</p>
                </div>
                {active && <Star size={15} className="text-accent shrink-0" fill="currentColor" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => onDone([])} className="text-xs text-gray-500 hover:text-white transition-colors">
            Saltear
          </button>
          <button
            onClick={() => onDone(picked)}
            className="px-5 py-2.5 rounded-card bg-accent text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Arrancar
          </button>
        </div>
      </div>
    </div>
  );
}
