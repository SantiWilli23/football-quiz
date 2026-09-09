import { useState } from "react";
import type { MaxAttempts } from "../types/player";

const OPTIONS: MaxAttempts[] = [10, 20, 100];

interface Props {
  onStart: (maxAttempts: MaxAttempts, mode: "random" | "daily") => void;
  hasSavedGame: boolean;
  onResume: () => void;
}

export default function StartScreen({ onStart, hasSavedGame, onResume }: Props) {
  const [maxAttempts, setMaxAttempts] = useState<MaxAttempts>(20);
  const [mode, setMode] = useState<"random" | "daily">("random");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold tracking-tight text-center mb-1">Fichado</h1>
        <p className="text-sm text-gray-500 text-center mb-10">Adiviná al futbolista secreto.</p>

        {hasSavedGame && (
          <button
            onClick={onResume}
            className="w-full mb-6 border border-black bg-black text-white py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Continuar partida
          </button>
        )}

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Modo</p>
          <div className="grid grid-cols-2 gap-2">
            {(["random", "daily"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-2.5 text-sm border transition-colors ${
                  mode === m ? "bg-black text-white border-black" : "border-gray-300 text-gray-700 hover:border-black"
                }`}
              >
                {m === "random" ? "Aleatorio" : "Diario"}
              </button>
            ))}
          </div>
          {mode === "daily" && (
            <p className="text-xs text-gray-500 mt-2">El mismo jugador secreto para todos hoy.</p>
          )}
        </div>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Intentos máximos</p>
          <div className="grid grid-cols-3 gap-2">
            {OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setMaxAttempts(n)}
                className={`py-2.5 text-sm border transition-colors ${
                  maxAttempts === n ? "bg-black text-white border-black" : "border-gray-300 text-gray-700 hover:border-black"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onStart(maxAttempts, mode)}
          className="w-full border border-black bg-white text-black py-3.5 text-sm font-semibold hover:bg-black hover:text-white transition-colors"
        >
          Comenzar
        </button>
      </div>
    </div>
  );
}
