import { useMemo, useState } from "react";
import { layoutSlots } from "../engine/pitchLayout.js";
import { Crosshair, Dumbbell, Flame, Scale, Shield, Swords, Zap, Castle, Target, Users } from "lucide-react";
import { useCareer } from "../context/CareerContext.jsx";

export const MENTALITY_LABELS = ["Muy defensivo", "Defensivo", "Equilibrado", "Ofensivo", "Muy ofensivo"];
export const SLIDER_DEFS = [
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
  { id: "balanced", label: "Equilibrado", icon: Scale, desc: "Sin modificadores especiales" },
  { id: "defense",  label: "Defensa",     icon: Shield, desc: "+Solidez defensiva, leve baja ofensiva" },
  { id: "attack",   label: "Ataque",      icon: Swords, desc: "+Poder ofensivo, leve baja defensiva" },
  { id: "pressing", label: "Pressing",    icon: Flame, desc: "+Pressing efectivo durante todo el partido" },
  { id: "fitness",  label: "Físico",      icon: Dumbbell, desc: "Reduce el desgaste en el segundo tiempo" },
];

const PRESETS = [
  {
    id: "flick_barca",
    name: "Barça de Flick",
    badge: Users,
    desc: "Presión ultra-alta tras pérdida, línea muy elevada, extremos que atacan el espacio por dentro. Verticalidad y velocidad de circulación.",
    examples: ["FC Barcelona (Flick, 2024-25)"],
    formation: "4-3-3",
    mentality: 5,
    sliders: { pressing: 90, defLine: 80, tempo: 75, width: 80, offDepth: 80, duels: 60, buildUp: 70, transition: 65 },
  },
  {
    id: "gegenpressing",
    name: "Gegenpressing",
    badge: Zap,
    desc: "Presión intensa e inmediata tras perder el balón. Bloque alto, recuperaciones rápidas en campo rival.",
    examples: ["Liverpool (Klopp)", "Bayer Leverkusen (Xabi Alonso)", "B. Dortmund (Klopp)"],
    formation: "4-3-3",
    mentality: 4,
    sliders: { pressing: 95, defLine: 70, tempo: 80, width: 65, offDepth: 70, duels: 75, buildUp: 60, transition: 80 },
  },
  {
    id: "posesion",
    name: "Posesión total",
    badge: Target,
    desc: "Control absoluto del balón, salida desde atrás, movimiento constante entre líneas. El rival se cansa de correr.",
    examples: ["Man City (Guardiola)", "Barça (Xavi, 2022-24)"],
    formation: "4-3-3",
    mentality: 4,
    sliders: { pressing: 65, defLine: 65, tempo: 45, width: 75, offDepth: 65, duels: 40, buildUp: 85, transition: 30 },
  },
  {
    id: "contragolpe",
    name: "Contragolpe",
    badge: Crosshair,
    desc: "Bloque medio-bajo, esperar el error rival y salir en tromba al espacio. Velocistas en punta imprescindibles.",
    examples: ["Real Madrid (Ancelotti)", "Inter (Mourinho)", "Atlético Champions (Simeone)"],
    formation: "4-2-3-1",
    mentality: 2,
    sliders: { pressing: 35, defLine: 40, tempo: 70, width: 55, offDepth: 75, duels: 65, buildUp: 40, transition: 95 },
  },
  {
    id: "bloque_bajo",
    name: "Bloque bajo",
    badge: Castle,
    desc: "Equipo muy compacto en campo propio, líneas juntas, orden defensivo y salida al golpe. Efectivo ante rivales superiores.",
    examples: ["Atlético de Madrid (Simeone)", "Getafe (Bordalás)", "Burnley"],
    formation: "4-4-2",
    mentality: 1,
    sliders: { pressing: 20, defLine: 25, tempo: 40, width: 45, offDepth: 55, duels: 80, buildUp: 35, transition: 75 },
  },
  {
    id: "juego_directo",
    name: "Juego directo",
    badge: Swords,
    desc: "Pelota larga al delantero, segunda jugada, intensidad física. Sin florituras pero muy efectivo.",
    examples: ["Leeds (Bielsa)", "Brentford (Thomas Frank)", "Sheffield United"],
    formation: "4-4-2",
    mentality: 3,
    sliders: { pressing: 70, defLine: 55, tempo: 80, width: 60, offDepth: 65, duels: 85, buildUp: 20, transition: 70 },
  },
  {
    id: "tres_defensores",
    name: "Back 3 + carrileros",
    badge: Shield,
    desc: "Tres centrales, carrileros de alto voltaje, doble pivote y mucho ancho. Versátil entre posesión y presión.",
    examples: ["Chelsea (Tuchel)", "Inter (Conte)", "Atalanta (Gasperini)"],
    formation: "3-5-2",
    mentality: 3,
    sliders: { pressing: 60, defLine: 60, tempo: 60, width: 85, offDepth: 70, duels: 65, buildUp: 65, transition: 55 },
  },
];

// Cancha chica con los titulares ubicados como en la formación elegida.
function PitchPreview({ starters }) {
  const coords = useMemo(() => layoutSlots(starters), [starters]);
  return (
    <svg viewBox="0 0 100 130" className="w-full max-w-[260px] mx-auto rounded-card bg-emerald-950/50 border border-border" role="img" aria-label="Formación elegida">
      <rect x="2" y="2" width="96" height="126" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      <line x1="2" y1="65" x2="98" y2="65" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      <circle cx="50" cy="65" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      <rect x="28" y="2" width="44" height="18" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      <rect x="28" y="110" width="44" height="18" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      {starters.map((sl, i) => {
        const c = coords[i] || { x: 50, y: 50 };
        const x = sl.x != null ? sl.x : c.x;
        const y = sl.y != null ? sl.y : c.y;
        return (
          <g key={i} transform={`translate(${2 + (x / 100) * 96} ${2 + (y / 100) * 126})`}>
            <circle r="5" className="fill-accent" stroke="rgba(255,255,255,0.8)" strokeWidth="0.6" />
            <text y="1.8" textAnchor="middle" fontSize="4.2" fontWeight="700" fill="#0b1220">{sl.slot}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Tactics() {
  const { state, formations, setFormation, setMentality, setSlider, setTrainingFocus, applyTacticsPreset } = useCareer();
  const focus = state.trainingFocus || "balanced";
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="space-y-4">
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
          <div className="border-t border-border grid md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:gap-px bg-border">
            {PRESETS.map((preset) => (
              <div key={preset.id} className="flex items-start gap-3 px-4 py-3 bg-panel hover:bg-white/[0.02]">
                <preset.badge size={22} className="mt-0.5 shrink-0 text-accent" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{preset.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{preset.desc}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {preset.examples.map((ex) => (
                      <span key={ex} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-border text-gray-400">{ex}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
      <div className="space-y-4">
      <div className="tone-blue tile-b rounded-card p-4">
        <p className="text-xs text-gray-300 uppercase tracking-wide mb-2">Formación</p>
        <select
          value={state.formation}
          onChange={(e) => setFormation(e.target.value)}
          className="w-full bg-bg border border-border rounded-card px-3 py-2 text-sm"
        >
          {formations.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="mt-3"><PitchPreview starters={state.lineup.starters} /></div>
        <p className="text-xs text-gray-500 mt-2">Cambiar formación reubica automáticamente a la plantilla en la pantalla de Plantilla.</p>
      </div>

      <div className="tone-accent tile-b rounded-card p-4">
        <p className="text-xs text-gray-300 uppercase tracking-wide mb-2">Mentalidad — {MENTALITY_LABELS[state.mentality - 1]}</p>
        <input
          type="range" min={1} max={5} step={1} value={state.mentality}
          onChange={(e) => setMentality(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Park the bus</span><span>Todos arriba</span>
        </div>
      </div>

      {/* Foco de entrenamiento semanal */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[["Ataque", (state.mentality - 3) * 4, "tone-emerald"], ["Defensa", -(state.mentality - 3) * 3, "tone-blue"], ["Cansancio", (state.mentality - 3) * 3, "tone-red"]].map(([l, v, t]) => (
          <div key={l} className={`${t} tile-b rounded-card py-3`}>
            <p className="text-xs text-gray-300 uppercase tracking-wide">{l}</p>
            <p className="text-2xl font-bold tabular-nums text-tone">{v > 0 ? "+" : ""}{v}%</p>
          </div>
        ))}
      </div>

      </div>
      <div className="space-y-4">
      <div className="tone-amber tile-b rounded-card p-4">
        <p className="text-xs text-gray-300 uppercase tracking-wide mb-1">Foco de entrenamiento semanal</p>
        <p className="text-xs text-gray-600 mb-3">El foco elegido aplica un modificador en el próximo partido.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
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
              <opt.icon size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="text-xs opacity-70">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="tone-pink tile-b rounded-card p-4">
        <p className="text-xs text-gray-300 uppercase tracking-wide mb-3">Instrucciones de equipo</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
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
              <div className="flex justify-between text-xs text-gray-500">
                <span>{lo}</span><span>{hi}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
