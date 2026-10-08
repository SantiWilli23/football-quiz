import { Settings as SettingsIcon, Swords, Wallet } from "lucide-react";
import { useCareer } from "../context/CareerContext.jsx";
import { DIFFICULTIES, difficultyOf } from "../engine/difficulty.js";

const TONES = { facil: "tone-emerald", media: "tone-amber", dificil: "tone-red" };

// Configuración del Modo DT. Por ahora: la dificultad (la Media es la de siempre).
export default function Settings() {
  const { state, setDifficulty } = useCareer();
  const current = difficultyOf(state);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><SettingsIcon size={22} className="text-accent" /> Configuración</h2>
        <p className="text-sm text-gray-500">Ajustes de esta carrera. Se pueden cambiar cuando quieras y valen desde el próximo partido.</p>
      </div>

      <div>
        <p className="t-eyebrow mb-2">Dificultad</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.values(DIFFICULTIES).map((d) => {
            const active = current.id === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                aria-pressed={active}
                className={`${TONES[d.id]} text-left rounded-2xl border p-4 transition-colors ${active ? "tile-b" : "border-border bg-panel hover:border-white/30"}`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-base font-bold">{d.label}</span>
                  {active && <span className="text-[11px] font-semibold uppercase tracking-wide text-tone">Activa</span>}
                </span>
                <span className="block text-xs text-gray-400 mt-1.5 leading-relaxed">{d.desc}</span>
                <span className="mt-3 flex flex-col gap-1 text-[11px] text-gray-300 tabular-nums">
                  <span className="flex items-center gap-1.5"><Swords size={12} /> Rivales {d.rivalOvr > 0 ? "+" : ""}{d.rivalOvr} de nivel</span>
                  <span className="flex items-center gap-1.5"><Wallet size={12} /> Presupuesto ×{d.budget}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-600 mt-3">La dificultad Media es la que tenía el Modo DT hasta ahora.</p>
      </div>
    </div>
  );
}
