import { useState } from "react";
import Card from "../components/Card.jsx";

const KEY = "fq_ghost_off";

// El fantasma del rival se puede apagar en Yo › Ajustes. Es una preferencia de este
// teléfono, así que vive en localStorage (si no hay storage, queda encendido).
export function ghostOn() {
  try { return localStorage.getItem(KEY) !== "1"; } catch { return true; }
}

export default function GhostToggle() {
  const [on, setOn] = useState(ghostOn);
  function toggle() {
    const next = !on;
    setOn(next);
    try { if (next) localStorage.removeItem(KEY); else localStorage.setItem(KEY, "1"); } catch { /* sin storage */ }
  }
  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Fantasma del rival</h2>
          <p className="text-sm text-gray-400">Mientras juegas el partido del día, ves en qué pregunta acertó o falló tu rival de la semana.</p>
        </div>
        <button role="switch" aria-checked={on} aria-label="Fantasma del rival" onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${on ? "border-accent bg-accent/30" : "border-border bg-bg"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
      </div>
    </Card>
  );
}
