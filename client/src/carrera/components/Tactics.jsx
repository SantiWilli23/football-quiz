import { useCareer } from "../context/CareerContext.jsx";

const MENTALITY_LABELS = ["Muy defensivo", "Defensivo", "Equilibrado", "Ofensivo", "Muy ofensivo"];
const SLIDER_DEFS = [
  ["pressing", "Pressing", "Bajo", "Alto"],
  ["defLine", "Línea defensiva", "Baja", "Alta"],
  ["tempo", "Tempo", "Lento", "Rápido"],
  ["width", "Amplitud", "Estrecha", "Amplia"],
  ["offDepth", "Profundidad ofensiva", "Baja", "Alta"],
  ["duels", "Duelos", "Evitar", "Buscar"],
  ["buildUp", "Salida de balón", "Largo", "Corto"],
  ["transition", "Transición", "Conservar", "Contraatacar"],
];

const FOCUS_OPTIONS = [
  { id: "balanced", label: "Equilibrado", emoji: "⚖️", desc: "Sin modificadores especiales" },
  { id: "defense",  label: "Defensa",     emoji: "🛡️", desc: "+Solidez defensiva, leve baja ofensiva" },
  { id: "attack",   label: "Ataque",      emoji: "⚔️", desc: "+Poder ofensivo, leve baja defensiva" },
  { id: "pressing", label: "Pressing",    emoji: "🔥", desc: "+Pressing efectivo durante todo el partido" },
  { id: "fitness",  label: "Físico",      emoji: "💪", desc: "Reduce el desgaste en el segundo tiempo" },
];

export default function Tactics() {
  const { state, formations, setFormation, setMentality, setSlider, setTrainingFocus } = useCareer();
  const focus = state.trainingFocus || "balanced";

  return (
    <div className="space-y-5">
      <div className="bg-panel border border-border rounded-card p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Formación</p>
        <select
          value={state.formation}
          onChange={(e) => setFormation(e.target.value)}
          className="w-full bg-bg border border-border rounded-card px-3 py-2 text-sm"
        >
          {formations.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <p className="text-xs text-gray-500 mt-2">Cambiar formación reubica automáticamente a la plantilla en la pantalla de Plantilla.</p>
      </div>

      <div className="bg-panel border border-border rounded-card p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Mentalidad — {MENTALITY_LABELS[state.mentality - 1]}</p>
        <input
          type="range" min={1} max={5} step={1} value={state.mentality}
          onChange={(e) => setMentality(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>Park the bus</span><span>Todos arriba</span>
        </div>
      </div>

      {/* Foco de entrenamiento semanal */}
      <div className="bg-panel border border-border rounded-card p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Foco de entrenamiento semanal</p>
        <p className="text-xs text-gray-600 mb-3">El foco elegido aplica un modificador en el próximo partido.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FOCUS_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setTrainingFocus(opt.id)}
              className={`flex items-start gap-3 text-left px-3 py-2.5 rounded-card border transition-colors ${
                focus === opt.id
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border text-gray-400 hover:border-gray-500 hover:text-white"
              }`}
            >
              <span className="text-xl leading-none mt-0.5">{opt.emoji}</span>
              <div>
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="text-[11px] opacity-70">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-panel border border-border rounded-card p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Instrucciones de equipo</p>
        <div className="space-y-4">
          {SLIDER_DEFS.map(([key, label, lo, hi]) => (
            <div key={key}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{label}</span>
                <span>{state.sliders[key]}</span>
              </div>
              <input
                type="range" min={0} max={100} step={5} value={state.sliders[key]}
                onChange={(e) => setSlider(key, Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>{lo}</span><span>{hi}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
