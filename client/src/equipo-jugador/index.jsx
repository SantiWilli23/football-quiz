import { useState } from "react";
import { Link } from "react-router-dom";
import LocalGame from "./components/LocalGame.jsx";
import OnlineGame from "./components/OnlineGame.jsx";
import BotGame from "./components/BotGame.jsx";
import MatchHistoryScreen from "./components/MatchHistoryScreen.jsx";
import { DIFFICULTIES, getDifficulty, setDifficulty } from "./api.js";

export default function EquipoJugador() {
  const [mode, setMode] = useState(null); // null | "local" | "online" | "bot" | "history"
  const [difficulty, setDifficultyState] = useState(getDifficulty);

  return (
    <div className="min-h-screen bg-bg text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Equipo-Jugador</h1>
            <p className="text-sm text-gray-500 mt-0.5">Cadena de conexiones futbolísticas.</p>
          </div>
          <Link to="/panel" className="text-xs text-gray-500 hover:text-white">🏠 Salir</Link>
        </div>

        {!mode && (
          <div className="space-y-4">
            <div className="bg-panel border border-border rounded-2xl p-4 text-sm text-gray-400 leading-relaxed">
              Un jugador dice un futbolista. El siguiente tiene que decir un equipo en el que jugó.
              El siguiente, otro jugador de ese equipo (de cualquier época). Y así, sin repetir a nadie.
              El que no responde a tiempo o se equivoca, queda eliminado directo.
            </div>

            <div className="bg-panel border border-border rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Dificultad</p>
              <div className="flex gap-2 flex-wrap">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setDifficulty(d.id); setDifficultyState(d.id); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      difficulty === d.id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">{DIFFICULTIES.find((d) => d.id === difficulty).hint}</p>
            </div>

            <button
              onClick={() => setMode("bot")}
              className="w-full bg-panel border border-border rounded-2xl p-5 text-left hover:border-accent/40 transition-colors"
            >
              <p className="font-semibold">Vs. Bot</p>
              <p className="text-sm text-gray-500 mt-1">Jugás solo contra un bot que responde solo. Ideal para practicar.</p>
            </button>

            <button
              onClick={() => setMode("local")}
              className="w-full bg-panel border border-border rounded-2xl p-5 text-left hover:border-accent/40 transition-colors"
            >
              <p className="font-semibold">Local (mismo dispositivo)</p>
              <p className="text-sm text-gray-500 mt-1">2 jugadores, turnos alternados pasando el celular/compu.</p>
            </button>

            <button
              onClick={() => setMode("online")}
              className="w-full bg-panel border border-border rounded-2xl p-5 text-left hover:border-accent/40 transition-colors"
            >
              <p className="font-semibold">Online</p>
              <p className="text-sm text-gray-500 mt-1">De 2 a 8 jugadores, cada uno desde su dispositivo con un código de sala. Con 6 u 8 es el modo "de a hartos": eliminación hasta que quede uno solo.</p>
            </button>

            <button
              onClick={() => setMode("history")}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-300 py-2"
            >
              📜 Ver historial de partidas
            </button>
          </div>
        )}

        {mode === "bot" && <BotGame onExit={() => setMode(null)} />}
        {mode === "local" && <LocalGame onExit={() => setMode(null)} />}
        {mode === "online" && <OnlineGame onExit={() => setMode(null)} />}
        {mode === "history" && <MatchHistoryScreen onBack={() => setMode(null)} />}
      </div>
    </div>
  );
}
