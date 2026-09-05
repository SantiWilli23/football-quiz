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

export default function Tactics() {
  const { state, formations, setFormation, setMentality, setSlider } = useCareer();

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
