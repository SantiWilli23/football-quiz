import { useEffect, useRef, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import { playSfx } from "../utils/sfx.js";

// Ventana de felicitaciones con el puntaje (ver utils/celebrate.js). Se cierra
// sola a los 5 s, tocando afuera o con la X.
export default function ScoreCelebration() {
  const [lines, setLines] = useState(null); // [{ points, unit, detail }]
  const timer = useRef(null);

  useEffect(() => {
    function onScore(e) {
      setLines((prev) => {
        const next = [...(prev || []), e.detail];
        // Mismo puntaje repetido (p. ej. dos avisos del mismo resultado): uno solo.
        return next.filter((l, i) => next.findIndex((o) => o.points === l.points && o.unit === l.unit) === i);
      });
      playSfx("win");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setLines(null), 5000);
    }
    window.addEventListener("fq:score", onScore);
    return () => {
      window.removeEventListener("fq:score", onScore);
      clearTimeout(timer.current);
    };
  }, []);

  if (!lines) return null;
  const [main, ...rest] = lines;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4" onClick={() => setLines(null)} role="dialog" aria-live="polite" aria-label="Felicitaciones">
      <div className="celebrate-pop relative overflow-hidden w-full max-w-xs bg-panel border border-accent/50 rounded-2xl px-6 py-7 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-confetti absolute inset-x-0 top-0 h-0 pointer-events-none" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, i) => <span key={i} />)}
        </div>
        <button onClick={() => setLines(null)} className="absolute top-3 right-3 text-gray-500 hover:text-white" aria-label="Cerrar"><X size={16} /></button>
        <PartyPopper size={30} className="mx-auto text-accent mb-2" />
        <p className="text-lg font-bold">¡Felicitaciones!</p>
        <p className="text-4xl font-extrabold text-accent tabular-nums mt-2">+{main.points}</p>
        <p className="text-sm text-gray-300">{main.unit}</p>
        {main.detail && <p className="text-xs text-gray-400 mt-1">{main.detail}</p>}
        {rest.map((l, i) => (
          <p key={i} className="text-sm text-gray-300 mt-3 pt-3 border-t border-border">
            <span className="font-bold text-accent">+{l.points}</span> {l.unit}
            {l.detail && <span className="block text-xs text-gray-400">{l.detail}</span>}
          </p>
        ))}
      </div>
    </div>
  );
}
