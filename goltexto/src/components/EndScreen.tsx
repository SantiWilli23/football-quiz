import { useState } from "react";
import type { Player } from "../types/player";

interface Props {
  status: "won" | "lost";
  secret: Player;
  attemptsUsed: number;
  maxAttempts: number;
  shareText: string;
  onRestart: () => void;
  onHome: () => void;
}

export default function EndScreen({ status, secret, attemptsUsed, maxAttempts, shareText, onRestart, onHome }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard no disponible, no rompe nada
    }
  }

  return (
    <div className={`rounded-2xl px-6 py-7 text-center shadow-[0_4px_16px_rgba(0,0,0,0.35)] ${status === "won" ? "bg-accent/15 border border-accent/40" : "bg-panel border border-border"}`}>
      <span className="text-3xl">{status === "won" ? "🎯" : "🔒"}</span>

      {status === "won" ? (
        <>
          <p className="text-lg font-bold mt-3 mb-1 text-accent">¡Lo adivinaste!</p>
          <p className="text-sm text-gray-300 mb-5">
            {secret.name} en {attemptsUsed} de {maxAttempts} intentos.
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-bold mt-3 mb-1">Se acabaron los intentos.</p>
          <p className="text-sm text-gray-400 mb-5">El jugador secreto era {secret.name}.</p>
        </>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={handleShare}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          {copied ? "Copiado" : "Compartir resultado"}
        </button>
        <button
          onClick={onRestart}
          className="rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent-light transition-colors"
        >
          Jugar de nuevo
        </button>
        <button
          onClick={onHome}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          Inicio
        </button>
      </div>
    </div>
  );
}
