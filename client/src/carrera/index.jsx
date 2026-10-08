import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import VidaFutBanner from "../components/VidaFutBanner.jsx";
import {
  Home, Shuffle, LayoutDashboard, Users, ArrowLeftRight,
  Wallet, CalendarDays, History,
} from "lucide-react";
import { CareerProvider, useCareer } from "./context/CareerContext.jsx";
import TeamSelector from "./components/TeamSelector.jsx";
import SaveManager from "./components/SaveManager.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Squad from "./components/Squad.jsx";
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
  ["finances", "Finanzas", Wallet],
  ["calendar", "Calendario", CalendarDays],
  ["history", "Historial", History],
];
// Menú lateral del Modo DT: las secciones agrupadas por para qué sirven.
const MENU = [
  { group: "Club", tone: "accent", items: [["dashboard", "Panel", LayoutDashboard], ["finances", "Finanzas", Wallet], ["history", "Historial", History]] },
  { group: "Equipo", tone: "blue", items: [["pizarra", "Formación y tácticas", Shuffle], ["squad", "Plantilla", Users]] },
  { group: "Mercado", tone: "amber", items: [["transfers", "Fichajes", ArrowLeftRight]] },
  { group: "Partidos", tone: "pink", items: [["calendar", "Calendario y tabla", CalendarDays]] },
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
        <div className="flex md:hidden items-center gap-1 overflow-x-auto px-2 pb-1 pt-1.5">
          {[...TABS.slice(0, 1), ["pizarra", "Formación", Shuffle], ...TABS.slice(1)].map(([id, label, Icon]) => {
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
      <div className="md:flex md:max-w-6xl md:mx-auto">
      <aside className="hidden md:block w-56 shrink-0 p-4 pr-0">
        <div className="sticky top-24 space-y-5">
          {MENU.map((g) => (
            <div key={g.group} className={`tone-${g.tone}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tone mb-1.5 px-2">{g.group}</p>
              <div className="space-y-1">
                {g.items.map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => setScreen(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-card text-sm text-left border transition-colors ${screen === id ? "tile-b text-white font-semibold" : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"}`}
                  >
                    <Icon size={16} className="text-tone shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 min-w-0 max-w-5xl mx-auto md:mx-0 p-4 w-full">
        {screen === "dashboard" && (
          <Dashboard onPlayMatch={(result) => { setMatchResult(result); setScreen("match"); }} />
        )}
        {screen === "pizarra" && <Squad key="pizarra" initialTab="formacion" />}
        {screen === "squad" && <Squad key="plantilla" initialTab="plantilla" />}
        {screen === "transfers" && <Transfers />}
        {screen === "finances" && <Finances />}
        {screen === "calendar" && <SeasonCalendar />}
        {screen === "history" && <CareerHistory />}
      </main>
      </div>
    </div>
  );
}

export default function CareerMode() {
  // La key fuerza un remount al pasar entre la Carrera DT suelta y la de Vida
  // FUT (misma ruta, distinto ?vidafut): si no, quedaría cargada la partida de
  // un modo y se guardaría en el otro.
  const { search } = useLocation();
  const vf = new URLSearchParams(search).get("vidafut") === "1";
  return (
    <CareerProvider key={vf ? "vidafut" : "suelta"}>
      <VidaFutBanner />
      <CareerApp />
    </CareerProvider>
  );
}
