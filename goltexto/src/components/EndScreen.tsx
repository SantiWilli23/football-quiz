import { useState } from "react";
import type { Player } from "../types/player";

interface Props {
  status: "won" | "lost";
  secret: Player;
  attemptsUsed: number;
  maxAttempts: number;
  shareText: string;
  onRestart: () => void;
}

export default function EndScreen({ status, secret, attemptsUsed, maxAttempts, shareText, onRestart }: Props) {
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
    <div className="border border-black bg-black text-white px-5 py-6 text-center">
      {status === "won" ? (
        <>
          <p className="text-lg font-bold mb-1">¡Lo adivinaste!</p>
          <p className="text-sm text-gray-300 mb-4">
            {secret.name} en {attemptsUsed} de {maxAttempts} intentos.
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-bold mb-1">Se acabaron los intentos.</p>
          <p className="text-sm text-gray-300 mb-4">El jugador secreto era {secret.name}.</p>
        </>
      )}

      <div className="flex gap-2 justify-center">
        <button
          onClick={handleShare}
          className="border border-white px-4 py-2 text-sm hover:bg-white hover:text-black transition-colors"
        >
          {copied ? "Copiado" : "Compartir resultado"}
        </button>
        <button
          onClick={onRestart}
          className="border border-white bg-white text-black px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Jugar de nuevo
        </button>
      </div>
    </div>
  );
}
