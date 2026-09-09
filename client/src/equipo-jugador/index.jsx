import { useState } from "react";
import { Link } from "react-router-dom";
import LocalGame from "./components/LocalGame.jsx";
import OnlineGame from "./components/OnlineGame.jsx";

export default function EquipoJugador() {
  const [mode, setMode] = useState(null); // null | "local" | "online"

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
              <p className="text-sm text-gray-500 mt-1">2 o 4 jugadores, cada uno desde su dispositivo con un código de sala.</p>
            </button>
          </div>
        )}

        {mode === "local" && <LocalGame onExit={() => setMode(null)} />}
        {mode === "online" && <OnlineGame onExit={() => setMode(null)} />}
      </div>
    </div>
  );
}
