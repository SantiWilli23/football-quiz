import { useState } from "react";
import { Link } from "react-router-dom";
import { CareerProvider, useCareer } from "./context/CareerContext.jsx";
import TeamSelector from "./components/TeamSelector.jsx";
import SaveManager from "./components/SaveManager.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Squad from "./components/Squad.jsx";
import Tactics from "./components/Tactics.jsx";
import MatchSimulator from "./components/MatchSimulator.jsx";
import SeasonCalendar from "./components/SeasonCalendar.jsx";
import Transfers from "./components/Transfers.jsx";
import CareerHistory from "./components/CareerHistory.jsx";
import Finances from "./components/Finances.jsx";

function CareerApp() {
  const { state, saveSlots, exitToMenu } = useCareer();
  const [screen, setScreen] = useState("dashboard");
  const [matchResult, setMatchResult] = useState(null);
  const [forceNewCareer, setForceNewCareer] = useState(false);

  if (!state) {
    if (!forceNewCareer && saveSlots.length > 0) {
      return <SaveManager onNewCareer={() => setForceNewCareer(true)} />;
    }
    return <TeamSelector onBack={saveSlots.length > 0 ? () => setForceNewCareer(false) : null} />;
  }

  if (screen === "match") {
    return (
      <MatchSimulator
        matchResult={matchResult}
        onFinish={() => { setMatchResult(null); setScreen("dashboard"); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg text-white">
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-panel px-3 py-2 sticky top-0 z-10">
        <Link
          to="/panel"
          title="Volver al menú principal"
          className="px-3 py-1.5 rounded-card text-sm font-medium whitespace-nowrap text-gray-400 hover:text-white border border-transparent hover:border-border shrink-0 mr-1"
        >
          🏠 Salir
        </Link>
        <button
          onClick={() => { setForceNewCareer(false); exitToMenu(); }}
          title="Cambiar de carrera"
          className="px-3 py-1.5 rounded-card text-sm font-medium whitespace-nowrap text-gray-400 hover:text-white border border-transparent hover:border-border shrink-0 mr-1"
        >
          🔀 Mis carreras
        </button>
        <span className="w-px h-5 bg-border shrink-0 mr-1" />
        {[
          ["dashboard", "Panel"],
          ["squad", "Plantilla"],
          ["transfers", "Fichajes"],
          ["tactics", "Tácticas"],
          ["finances", "Finanzas"],
          ["calendar", "Calendario"],
          ["history", "Historial"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            className={`px-3 py-1.5 rounded-card text-sm font-medium whitespace-nowrap transition-colors ${
              screen === id ? "bg-accent/15 text-accent border border-accent/30" : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="max-w-5xl mx-auto p-4">
        {screen === "dashboard" && (
          <Dashboard onPlayMatch={(result) => { setMatchResult(result); setScreen("match"); }} />
        )}
        {screen === "squad" && <Squad />}
        {screen === "transfers" && <Transfers />}
        {screen === "tactics" && <Tactics />}
        {screen === "finances" && <Finances />}
        {screen === "calendar" && <SeasonCalendar />}
        {screen === "history" && <CareerHistory />}
      </main>
    </div>
  );
}

export default function CareerMode() {
  return (
    <CareerProvider>
      <CareerApp />
    </CareerProvider>
  );
}
