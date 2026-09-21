import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext.jsx";
import { Check, RotateCcw, Share2, Trophy } from "lucide-react";
import Card from "./Card.jsx";

// Pantalla final común a los juegos con puntaje: antes cada uno armaba su
// propia tarjeta con el mismo esqueleto copiado. `saveState` es el que ya
// manejan los juegos: null | "saving" | { improved }.
export default function ResultScreen({
  score, unit, groupId, saveState, onAgain, shareText, highlight,
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function share() {
    const text = shareText || `⚽ Futotal · ${score} ${unit}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch { /* el usuario canceló el menú de compartir */ }
  }

  const improved = saveState && saveState !== "saving" && saveState.improved;
  const saved = saveState && saveState !== "saving";

  useEffect(() => {
    if (saved) toast(improved ? "Marca guardada · nuevo récord de la semana" : "Marca guardada");
  }, [saved, improved, toast]);

  return (
    <Card className="mt-4 text-center py-10">
      {improved && (
        <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-emerald/15 text-emerald mb-3">
          Nuevo récord
        </span>
      )}
      <Trophy size={32} className="mx-auto text-accent mb-3" />
      <p className="text-4xl font-bold mb-1 tabular-nums animate-result-pop">{score}</p>
      <p className="text-sm text-gray-400 mb-5">{unit}</p>
      {highlight && <p className="text-xs text-gray-500 mb-5">{highlight}</p>}
      {!groupId && <p className="text-xs text-gray-500 mb-5">Unite a un grupo para que tu marca cuente en un ranking.</p>}
      {saveState === "saving" && <p className="text-xs text-gray-500 mb-5">Guardando marca...</p>}
      {saveState && saveState !== "saving" && !improved && (
        <p className="text-xs text-gray-500 mb-5">Guardado (no superó tu mejor marca de esta semana)</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {onAgain && (
          <button
            onClick={onAgain}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Jugar de nuevo
          </button>
        )}
        <button
          onClick={share}
          className="px-5 py-2.5 rounded-card border border-border text-gray-300 hover:text-white hover:border-white/30 text-sm font-semibold transition-colors inline-flex items-center gap-1.5"
        >
          {copied ? <Check size={14} /> : <Share2 size={14} />} {copied ? "Copiado" : "Compartir"}
        </button>
      </div>
    </Card>
  );
}
