import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { playSfx } from "../utils/sfx.js";

// Versus: una ruleta elige el modo de duelo con tu club. Respeta prefers-reduced-motion: sin
// animación el resultado aparece de una.
const MODES = [
  { label: "Duelos", text: "Preguntas difíciles, uno contra uno.", to: "/duelos" },
  { label: "Equipo-Jugador", text: "Una cadena de jugadores y equipos.", to: "/equipo-jugador" },
  { label: "¿Quién es? en vivo", text: "Pistas cada 12 segundos: gana quien adivine primero.", to: "/quien-es-vivo" },
  { label: "Dorsal histórico", text: "¿Quién usó ese número?", to: "/dorsal-historico" },
  { label: "Mentiroso", text: "Una afirmación, ¿es verdad o mentira?", to: "/mentiroso.html" },
];
const N = MODES.length;
// Las páginas estáticas (Mentiroso) no pasan por el enrutador.
const go = (navigate, to) => (to.endsWith(".html") ? window.location.assign(to) : navigate(to));
const SLICE = 360 / N;
const COLORS = ["var(--c-emerald)", "var(--c-blue)", "var(--c-amber)", "var(--c-purple)", "var(--c-red)"];

function arc(i) {
  const a0 = ((i * SLICE - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * SLICE - 90) * Math.PI) / 180;
  const p = (a) => [100 + 96 * Math.cos(a), 100 + 96 * Math.sin(a)].map((n) => n.toFixed(2)).join(" ");
  return `M100 100 L${p(a0)} A96 96 0 0 1 ${p(a1)} Z`;
}

export default function Versus() {
  const navigate = useNavigate();
  const [angle, setAngle] = useState(0);
  const [picked, setPicked] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const turns = useRef(0);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function spin() {
    if (spinning) return;
    const target = Math.floor(Math.random() * N);
    // La flecha apunta arriba: el centro de la porción elegida tiene que quedar a 0°.
    const center = target * SLICE + SLICE / 2;
    turns.current += 1;
    const next = 360 * (5 + turns.current) - center;
    setPicked(null);
    setSpinning(true);
    setAngle(next);
    playSfx("tick");
    const done = () => { setSpinning(false); setPicked(MODES[target]); playSfx("win"); };
    if (reduce) done(); else setTimeout(done, 3200);
  }

  return (
    <Layout>
      <div className="mx-auto max-w-sm space-y-5 text-center">
        <div>
          <p className="t-eyebrow">Versus</p>
          <h1 className="t-title">Que decida la ruleta</h1>
          <p className="text-sm text-gray-400">Giras, sale un modo y a jugar contra alguien de tu club.</p>
        </div>

        <div className="relative mx-auto w-64">
          <div className="absolute left-1/2 -top-2 z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-white" aria-hidden="true" />
          <svg viewBox="0 0 200 200" className="w-full drop-shadow-lg" style={{ transform: `rotate(${angle}deg)`, transition: reduce ? "none" : "transform 3.2s cubic-bezier(.12,.7,.15,1)" }} role="img" aria-label={`Ruleta con ${N} modos: ${MODES.map((m) => m.label).join(", ")}`}>
            {MODES.map((m, i) => {
              const mid = ((i * SLICE + SLICE / 2 - 90) * Math.PI) / 180;
              return (
                <g key={m.label}>
                  <path d={arc(i)} fill={`rgb(${COLORS[i % COLORS.length]})`} stroke="rgb(var(--c-bg))" strokeWidth="2" />
                  <text x={100 + 62 * Math.cos(mid)} y={100 + 62 * Math.sin(mid)} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * SLICE + SLICE / 2} ${100 + 62 * Math.cos(mid)} ${100 + 62 * Math.sin(mid)})`} style={{ font: "700 8px sans-serif" }} fill="rgb(var(--c-onaccent))">{m.label.split(" ").slice(0, 2).join(" ")}</text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="9" fill="rgb(var(--c-bg))" />
          </svg>
        </div>

        {picked ? (
          <div className="celebrate-pop rounded-2xl border border-accent/50 bg-accent/10 p-4" role="status">
            <p className="text-lg font-bold">{picked.label}</p>
            <p className="text-sm text-gray-300">{picked.text}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={spin} className="btn btn-secondary flex-1">Girar de nuevo</button>
              <button onClick={() => go(navigate, picked.to)} className="btn btn-primary flex-1">Jugar</button>
            </div>
          </div>
        ) : (
          <button onClick={spin} disabled={spinning} className="btn btn-primary w-full disabled:opacity-60">{spinning ? "Girando…" : "Girar la ruleta"}</button>
        )}
        <div>
          <p className="t-eyebrow mb-1.5">¿Prefieres elegir?</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {MODES.map((m) => <button key={m.label} onClick={() => go(navigate, m.to)} className="rounded-full border border-border px-3 py-1.5 text-xs text-gray-300 hover:border-accent/60">{m.label}</button>)}
          </div>
        </div>
        <p className="text-xs text-gray-500">Ganar un Duelo suma 30 puntos a los clubes Total en los que estás (una vez al día). Si nadie está conectado, el Duelo se juega a tu ritmo: respondes ahora y tu rival cuando entre.</p>
        <ul className="space-y-1 text-left text-xs text-gray-500">{MODES.map((m) => <li key={m.label}><b className="text-gray-300">{m.label}:</b> {m.text}</li>)}</ul>
      </div>
    </Layout>
  );
}
