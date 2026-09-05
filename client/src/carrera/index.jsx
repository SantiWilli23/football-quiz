import { useState } from "react";
import { CareerProvider, useCareer } from "./context/CareerContext.jsx";
import TeamSelector from "./components/TeamSelector.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Squad from "./components/Squad.jsx";
import Tactics from "./components/Tactics.jsx";
import MatchSimulator from "./components/MatchSimulator.jsx";
import SeasonCalendar from "./components/SeasonCalendar.jsx";

function CareerApp() {
  const { state } = useCareer();
  const [screen, setScreen] = useState("dashboard");
  const [matchResult, setMatchResult] = useState(null);

  if (!state) return <TeamSelector />;

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
      <nav className="flex gap-1 overflow-x-auto border-b border-border bg-panel px-3 py-2 sticky top-0 z-10">
        {[
          ["dashboard", "Inicio"],
          ["squad", "Plantilla"],
          ["tactics", "Tácticas"],
          ["calendar", "Calendario"],
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
        {screen === "tactics" && <Tactics />}
        {screen === "calendar" && <SeasonCalendar />}
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
