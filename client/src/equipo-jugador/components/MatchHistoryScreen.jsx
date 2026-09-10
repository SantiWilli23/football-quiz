import { useState } from "react";
import { getMatchHistory, clearMatchHistory } from "../matchHistory.js";

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function MatchHistoryScreen({ onBack }) {
  const [history, setHistory] = useState(() => getMatchHistory());

  function handleClear() {
    clearMatchHistory();
    setHistory([]);
  }

  return (
    <div className="max-w-md mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Historial de partidas</h2>
        {history.length > 0 && (
          <button onClick={handleClear} className="text-xs text-gray-500 hover:text-red-400">Borrar historial</button>
        )}
      </div>

      {!history.length && (
        <p className="text-sm text-gray-500 bg-panel border border-border rounded-2xl p-5 text-center">
          Todavía no jugaste ninguna partida.
        </p>
      )}

      <div className="space-y-2">
        {history.map((m) => (
          <div key={m.id} className="bg-panel border border-border rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {m.winnerName ? `🏆 ${m.winnerName}` : "Empate / sin ganador"}
                  {m.iWon != null && (
                    <span className={`ml-1.5 text-xs ${m.iWon ? "text-emerald" : "text-gray-500"}`}>
                      {m.iWon ? "(ganaste)" : "(perdiste)"}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{m.playerNames?.join(" vs ")}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">{m.mode === "online" ? "Online" : m.mode === "bot" ? "Vs. Bot" : "Local"}</p>
                <p className="text-[11px] text-gray-600">{formatDate(m.date)}</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-600 mt-1.5">Cadena de {m.chainLength} eslabones</p>
          </div>
        ))}
      </div>

      <button onClick={onBack} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2">Volver</button>
    </div>
  );
}
