import { useState } from "react";
import { Check, Image as ImageIcon, Share2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { generateResultCard, shareOrDownloadCard } from "../utils/shareImage.js";

const KIND_EMOJI = {
  quien_es_mas: "🫵",
  que_prefieres: "⚖️",
  personalidad: "🎭",
  grupal: "✍️",
};

// Resumen del día en texto plano, estilo Wordle: se puede pegar en el grupo
// sin spoilear las respuestas, sólo si acertaste la predicción.
export function buildShareText({ trivia, modeB, date }) {
  const lines = [`⚽ Futotal · ${date}`];

  if (trivia?.length) {
    const marks = trivia
      .map((item) => (item.answered ? (item.result.is_correct ? "🟢" : "🔴") : "⚪"))
      .join("");
    const correct = trivia.filter((i) => i.answered && i.result.is_correct).length;
    lines.push(`Trivia: ${marks} ${correct}/${trivia.length}`);
  }

  if (modeB) {
    const kinds = ["quien_es_mas", "que_prefieres", "personalidad", "grupal"];
    const marks = kinds
      .map((kind) => {
        const q = modeB[kind];
        if (!q || q.pending || !q.revealed) return null;
        return `${KIND_EMOJI[kind]}${q.prediction_hit ? "✅" : "❌"}`;
      })
      .filter(Boolean);
    if (marks.length) {
      const hits = kinds.filter((k) => modeB[k]?.revealed && modeB[k].prediction_hit).length;
      lines.push(`Especial: ${marks.join(" ")} ${hits}/${marks.length} predicciones`);
    }
  }

  lines.push("");
  lines.push(window.location.origin);
  return lines.join("\n");
}

export default function ShareButton({ trivia, modeB, stats, className = "" }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const dateLabel = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long" });

  const handleShare = async () => {
    const text = buildShareText({ trivia, modeB, date: dateLabel });

    // En el teléfono abre el menú nativo (con WhatsApp adentro); en escritorio
    // no existe, así que se copia al portapapeles.
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Si se cancela el menú nativo, se cae al portapapeles.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleShareImage = async () => {
    if (generating || !trivia?.length) return;
    setGenerating(true);
    try {
      const blob = await generateResultCard({
        username: user?.username || "Jugador",
        date: dateLabel,
        trivia,
        streak: stats?.current_streak,
      });
      await shareOrDownloadCard(blob, `futotal-${new Date().toISOString().slice(0, 10)}.png`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        onClick={handleShare}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-card text-sm font-medium border transition-colors ${
          copied
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border text-gray-300 hover:text-white hover:border-white/30"
        }`}
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {copied ? "Copiado" : "Compartir"}
      </button>
      {trivia?.length > 0 && (
        <button
          onClick={handleShareImage}
          disabled={generating}
          title="Compartir como imagen"
          className="flex items-center gap-2 px-3 py-1.5 rounded-card text-sm font-medium border border-border text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-40 transition-colors"
        >
          <ImageIcon size={14} />
          {generating ? "..." : "Imagen"}
        </button>
      )}
    </div>
  );
}
