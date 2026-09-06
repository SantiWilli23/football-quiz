import { useState } from "react";
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

const PRESETS = [
  {
    id: "flick_barca",
    name: "Barça de Flick",
    badge: "🔵🔴",
    desc: "Presión ultra-alta tras pérdida, línea muy elevada, extremos que atacan el espacio por dentro. Verticalidad y velocidad de circulación.",
    examples: ["FC Barcelona (Flick, 2024-25)"],
    formation: "4-3-3",
    mentality: 5,
    sliders: { pressing: 90, defLine: 80, tempo: 75, width: 80, offDepth: 80, duels: 60, buildUp: 70, transition: 65 },
  },
  {
    id: "gegenpressing",
    name: "Gegenpressing",
    badge: "⚡",
    desc: "Presión intensa e inmediata tras perder el balón. Bloque alto, recuperaciones rápidas en campo rival.",
    examples: ["Liverpool (Klopp)", "Bayer Leverkusen (Xabi Alonso)", "B. Dortmund (Klopp)"],
    formation: "4-3-3",
    mentality: 4,
    sliders: { pressing: 95, defLine: 70, tempo: 80, width: 65, offDepth: 70, duels: 75, buildUp: 60, transition: 80 },
  },
  {
    id: "posesion",
    name: "Posesión total",
    badge: "🎯",
    desc: "Control absoluto del balón, salida desde atrás, movimiento constante entre líneas. El rival se cansa de correr.",
    examples: ["Man City (Guardiola)", "Barça (Xavi, 2022-24)"],
    formation: "4-3-3",
    mentality: 4,
    sliders: { pressing: 65, defLine: 65, tempo: 45, width: 75, offDepth: 65, duels: 40, buildUp: 85, transition: 30 },
  },
  {
    id: "contragolpe",
    name: "Contragolpe",
    badge: "🗡️",
    desc: "Bloque medio-bajo, esperar el error rival y salir en tromba al espacio. Velocistas en punta imprescindibles.",
    examples: ["Real Madrid (Ancelotti)", "Inter (Mourinho)", "Atlético Champions (Simeone)"],
    formation: "4-2-3-1",
    mentality: 2,
    sliders: { pressing: 35, defLine: 40, tempo: 70, width: 55, offDepth: 75, duels: 65, buildUp: 40, transition: 95 },
  },
  {
    id: "bloque_bajo",
    name: "Bloque bajo",
    badge: "🏰",
    desc: "Equipo muy compacto en campo propio, líneas juntas, orden defensivo y salida al golpe. Efectivo ante rivales superiores.",
    examples: ["Atlético de Madrid (Simeone)", "Getafe (Bordalás)", "Burnley"],
    formation: "4-4-2",
    mentality: 1,
    sliders: { pressing: 20, defLine: 25, tempo: 40, width: 45, offDepth: 55, duels: 80, buildUp: 35, transition: 75 },
  },
  {
    id: "juego_directo",
    name: "Juego directo",
    badge: "🪓",
    desc: "Pelota larga al delantero, segunda jugada, intensidad física. Sin florituras pero muy efectivo.",
    examples: ["Leeds (Bielsa)", "Brentford (Thomas Frank)", "Sheffield United"],
    formation: "4-4-2",
    mentality: 3,
    sliders: { pressing: 70, defLine: 55, tempo: 80, width: 60, offDepth: 65, duels: 85, buildUp: 20, transition: 70 },
  },
  {
    id: "tres_defensores",
    name: "Back 3 + carrileros",
    badge: "🔷",
    desc: "Tres centrales, carrileros de alto voltaje, doble pivote y mucho ancho. Versátil entre posesión y presión.",
    examples: ["Chelsea (Tuchel)", "Inter (Conte)", "Atalanta (Gasperini)"],
    formation: "3-5-2",
    mentality: 3,
    sliders: { pressing: 60, defLine: 60, tempo: 60, width: 85, offDepth: 70, duels: 65, buildUp: 65, transition: 55 },
  },
];

export default function Tactics() {
  const { state, formations, setFormation, setMentality, setSlider, setTrainingFocus, applyTacticsPreset } = useCareer();
  const focus = state.trainingFocus || "balanced";
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="space-y-5">
      {/* Tácticas preestablecidas */}
      <div className="bg-panel border border-border rounded-card overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
          onClick={() => setShowPresets((v) => !v)}
        >
          <div>
            <p className="text-sm font-semibold">Tácticas preestablecidas</p>
            <p className="text-xs text-gray-500 mt-0.5">Estilos de juego de equipos reales — aplica uno como base</p>
          </div>
          <span className="text-gray-500 text-sm ml-4">{showPresets ? "▲" : "▼"}</span>
        </button>

        {showPresets && (
          <div className="border-t border-border divide-y divide-border">
            {PRESETS.map((preset) => (
              <div key={preset.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
                <span className="text-2xl leading-none mt-0.5 shrink-0">{preset.badge}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{preset.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{preset.desc}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {preset.examples.map((ex) => (
                      <span key={ex} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-border text-gray-400">{ex}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">
                    {preset.formation} · {MENTALITY_LABELS[preset.mentality - 1]} · Pressing {preset.sliders.pressing}
                  </p>
                </div>
                <button
                  onClick={() => { applyTacticsPreset(preset); setShowPresets(false); }}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors mt-0.5"
                >
                  Aplicar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
