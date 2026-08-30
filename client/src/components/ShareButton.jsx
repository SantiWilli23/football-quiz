import { useState } from "react";
import { Check, Share2 } from "lucide-react";

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

export default function ShareButton({ trivia, modeB, className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = buildShareText({
      trivia,
      modeB,
      date: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long" }),
    });

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

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-card text-sm font-medium border transition-colors ${
        copied
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border text-gray-300 hover:text-white hover:border-white/30"
      } ${className}`}
    >
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      {copied ? "Copiado" : "Compartir"}
    </button>
  );
}
