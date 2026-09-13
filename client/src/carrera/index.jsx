import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Home, Shuffle, LayoutDashboard, Users, ArrowLeftRight, SlidersHorizontal,
  Wallet, CalendarDays, History,
} from "lucide-react";
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
import TeamCrest from "./components/TeamCrest.jsx";
import { teamById } from "./data/teams.js";

const TABS = [
  ["dashboard", "Panel", LayoutDashboard],
  ["squad", "Plantilla", Users],
  ["transfers", "Fichajes", ArrowLeftRight],
  ["tactics", "Tácticas", SlidersHorizontal],
  ["finances", "Finanzas", Wallet],
  ["calendar", "Calendario", CalendarDays],
  ["history", "Historial", History],
];

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

  const team = teamById(state.teamId);

  return (
    <div className="min-h-screen bg-bg text-white">
      <nav className="sticky top-0 z-10 bg-panel border-b border-border">
        <div className="flex items-center gap-2 px-3 pt-2.5">
          {team && <TeamCrest team={team} size={22} className="shrink-0" />}
          <p className="text-sm font-semibold truncate mr-auto">{team?.name}</p>
          <Link
            to="/panel"
            title="Volver al menú principal"
            className="p-1.5 rounded-card text-gray-500 hover:text-white hover:bg-white/5 shrink-0"
          >
            <Home size={16} />
          </Link>
          <button
            onClick={() => { setForceNewCareer(false); exitToMenu(); }}
            title="Cambiar de carrera"
            className="p-1.5 rounded-card text-gray-500 hover:text-white hover:bg-white/5 shrink-0"
          >
            <Shuffle size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto px-2 pb-1 pt-1.5">
          {TABS.map(([id, label, Icon]) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => setScreen(id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 shrink-0 ${
                  active ? "text-accent border-accent" : "text-gray-400 border-transparent hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>
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
