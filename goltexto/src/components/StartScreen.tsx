import { useState } from "react";
import { DIFFICULTIES, type DifficultyId } from "../utils/difficulty";

interface Props {
  onStart: (difficulty: DifficultyId, mode: "random" | "daily") => void;
  hasSavedGame: boolean;
  onResume: () => void;
}

export default function StartScreen({ onStart, hasSavedGame, onResume }: Props) {
  const [difficulty, setDifficulty] = useState<DifficultyId>("normal");
  const [mode, setMode] = useState<"random" | "daily">("random");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-black text-xl font-bold mb-4">
            F
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Fichado</h1>
          <p className="text-sm text-gray-400">Adiviná al futbolista secreto, un intento a la vez.</p>
        </div>

        {hasSavedGame && (
          <button
            onClick={onResume}
            className="w-full mb-8 rounded-2xl bg-accent text-black py-3.5 text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:bg-accent-light active:scale-[0.99] transition-all"
          >
            Continuar partida
          </button>
        )}

        <div className="mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Modo</p>
          <div className="grid grid-cols-2 gap-2">
            {(["random", "daily"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl py-3 text-sm font-medium border transition-all ${
                  mode === m
                    ? "bg-accent/15 text-accent border-accent"
                    : "border-border text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
              >
                {m === "random" ? "Aleatorio" : "Diario"}
              </button>
            ))}
          </div>
          {mode === "daily" && (
            <p className="text-xs text-gray-500 mt-2.5 px-0.5">El mismo jugador secreto para todos hoy.</p>
          )}
        </div>

        <div className="mb-9">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Dificultad</p>
          <div className="space-y-2">
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    active
                      ? "bg-accent/15 text-white border-accent"
                      : "border-border hover:border-gray-500"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${active ? "text-accent" : "text-white"}`}>{d.label}</p>
                    <p className="text-xs mt-0.5 text-gray-400">{d.description}</p>
                  </div>
                  <span className={`text-lg font-bold tabular-nums shrink-0 ${active ? "text-accent" : "text-gray-500"}`}>
                    {d.attempts}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => onStart(difficulty, mode)}
          className="w-full rounded-2xl bg-accent text-black py-4 text-sm font-bold tracking-wide hover:bg-accent-light active:scale-[0.99] transition-all"
        >
          Comenzar
        </button>
      </div>
    </div>
  );
}
