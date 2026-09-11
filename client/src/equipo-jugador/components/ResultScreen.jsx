import { useEffect, useRef } from "react";
import { saveMatchResult } from "../matchHistory.js";
import { registerFourPlayerWin } from "../weeklyChallenge.js";

export default function ResultScreen({ state, mySeat, mode = "local", onPlayAgain, onExit }) {
  const winnerName = state.winnerSeat != null ? state.playerNames[state.winnerSeat] : null;
  const iWon = mySeat != null && mySeat === state.winnerSeat;
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    saveMatchResult({
      mode,
      winnerName,
      iWon: mySeat != null ? iWon : null,
      playerNames: state.playerNames,
      chainLength: state.chain.length,
    });
    // El reto semanal suma cuando se gana una partida online de 4 o más
    // jugadores (el modo "de a hartos" con eliminación grupal); 1v1 no cuenta.
    if (mode === "online" && iWon && state.playerCount >= 4) {
      registerFourPlayerWin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-panel border border-border rounded-2xl p-8 text-center space-y-4">
      <span className="text-5xl">{winnerName ? "🏆" : "🤝"}</span>
      <div>
        <p className="text-2xl font-bold">{winnerName ? `${winnerName} gana la partida` : "Partida terminada"}</p>
        {mySeat != null && winnerName && (
          <p className="text-sm text-gray-500 mt-1">{iWon ? "¡Sos el último en pie! 🎉" : "Mejor suerte la próxima."}</p>
        )}
      </div>

      <div className="bg-bg border border-border rounded-2xl p-4 text-left">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Cadena final ({state.chain.length} eslabones)</p>
        <p className="text-sm text-gray-300 leading-relaxed">
          {state.chain.map((c) => c.label).join(" → ")}
        </p>
      </div>

      <div className="flex gap-2 justify-center pt-2">
        {onPlayAgain && (
          <button onClick={onPlayAgain} className="bg-accent text-black font-semibold px-6 py-2.5 rounded-2xl hover:brightness-110 transition">
            Jugar de nuevo
          </button>
        )}
        <button onClick={onExit} className="bg-panel border border-border text-gray-300 font-semibold px-6 py-2.5 rounded-2xl hover:border-gray-500 transition">
          Salir
        </button>
      </div>
    </div>
  );
}
