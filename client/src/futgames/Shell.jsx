import { useState } from "react";
import { BarChart3, Check, Share2, X } from "lucide-react";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { loadStats } from "./storage.js";

// Encabezado común: título del juego + botón de estadísticas.
export function GameHeader({ game, title, subtitle, icon: Icon, distLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <Icon size={22} className="text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="t-title">{title}</h1>
          <p className="text-gray-400 text-sm">{subtitle}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-card border border-border text-gray-300 hover:text-white hover:border-white/30"
          aria-label="Estadísticas"
        >
          <BarChart3 size={16} />
        </button>
      </div>
      {open && <StatsModal game={game} title={title} distLabel={distLabel} onClose={() => setOpen(false)} />}
    </>
  );
}

function StatsModal({ game, title, distLabel, onClose }) {
  const s = loadStats(game);
  const entries = Object.entries(s.dist).sort((a, b) => Number(b[0]) - Number(a[0]));
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Estadísticas de ${title}`}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Estadísticas · {title}</p>
            <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center mb-5">
            {[["Jugadas", s.played], ["% ganadas", s.played ? Math.round((100 * s.won) / s.played) : 0], ["Racha", s.streak], ["Mejor racha", s.maxStreak]].map(([l, v]) => (
              <div key={l}>
                <p className="text-xl font-bold tabular-nums">{v}</p>
                <p className="text-[11px] text-gray-500 leading-tight">{l}</p>
              </div>
            ))}
          </div>
          <p className="t-eyebrow mb-2">Distribución · {distLabel}</p>
          {entries.length === 0 && <p className="text-xs text-gray-500">Todavía no terminaste ninguna partida.</p>}
          <div className="space-y-1">
            {entries.map(([k, n]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-right tabular-nums text-gray-400">{k}</span>
                <div className="flex-1 h-4 bg-white/5 rounded">
                  <div className="h-4 rounded bg-accent/70" style={{ width: `${(100 * n) / max}%` }} />
                </div>
                <span className="w-6 tabular-nums text-gray-400">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Botón compartir: copia un resumen sin spoilers.
export function ShareResult({ text }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch { /* cancelado */ }
  }
  return (
    <button onClick={share} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90">
      {copied ? <Check size={15} /> : <Share2 size={15} />} {copied ? "Copiado" : "Compartir"}
    </button>
  );
}

// Pantalla previa: explicación + opciones + Empezar.
export function PreGame({ how, children, onStart, busy }) {
  return (
    <Card className="space-y-5">
      <ul className="text-sm text-gray-300 space-y-1.5 list-disc pl-5">
        {how.map((h) => <li key={h}>{h}</li>)}
      </ul>
      {children}
      <button onClick={onStart} disabled={busy} className="w-full py-2.5 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90 disabled:opacity-50">
        Empezar
      </button>
    </Card>
  );
}

export function OptionRow({ label, options, value, onChange }) {
  return (
    <div>
      <p className="t-eyebrow mb-2">{label}</p>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(([k, l]) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${value === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export { Layout };
