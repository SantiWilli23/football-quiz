import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, Shuffle, LayoutDashboard, Users, ArrowLeftRight, Wallet, CalendarDays, Settings as SettingsIcon,
} from "lucide-react";
import { CareerProvider, useCareer } from "./context/CareerContext.jsx";
import TeamSelector from "./components/TeamSelector.jsx";
import SaveManager from "./components/SaveManager.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Squad from "./components/Squad.jsx";
import Formation from "./components/Formation.jsx";
import Tactics from "./components/Tactics.jsx";
import Cantera from "./components/Cantera.jsx";
import Settings from "./components/Settings.jsx";
import MatchSimulator from "./components/MatchSimulator.jsx";
import SeasonCalendar from "./components/SeasonCalendar.jsx";
import Transfers from "./components/Transfers.jsx";
import CareerHistory from "./components/CareerHistory.jsx";
import Finances from "./components/Finances.jsx";
import TeamCrest from "./components/TeamCrest.jsx";
import { teamById } from "./data/teams.js";
import { currentDate, DAY_LABELS, MONTH_NAMES } from "./engine/energy.js";
import { wageTotal, wageCapOf } from "./engine/transferMarket.js";

// Menú del Modo DT: 6 secciones; Plantel y Club tienen sub-pestañas (antes eran 10 botones sueltos).
const MENU = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { id: "plantel", label: "Plantel", icon: Users, sub: [["squad", "Plantel"], ["formations", "Formación"], ["tactics", "Tácticas"]] },
  { id: "transfers", label: "Fichajes", icon: ArrowLeftRight },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "club", label: "Club", icon: Wallet, sub: [["finances", "Finanzas"], ["cantera", "Cantera"], ["history", "Historial"]] },
  { id: "settings", label: "Ajustes", icon: SettingsIcon },
];
const groupOf = (screen) => MENU.find((m) => m.id === screen || m.sub?.some(([k]) => k === screen)) || MENU[0];
const LEAGUE_LABELS = { premier: "Premier League", laliga: "La Liga", seriea: "Serie A", bundesliga: "Bundesliga" };

// Cabecera del club: fecha, posición, presupuesto y masa salarial siempre a la vista.
function ClubHeader({ team, onExit }) {
  const { state, standingsSorted } = useCareer();
  const d = currentDate(state);
  const pos = standingsSorted.findIndex((r) => r.teamId === state.teamId) + 1;
  const wages = wageTotal(state.squad);
  const cap = wageCapOf(state);
  const pct = Math.min(100, Math.round((wages / cap) * 100));
  return (
    <div className="flex items-center gap-3 flex-wrap px-4 pt-3 pb-2 max-w-[1280px] mx-auto">
      {team && <TeamCrest team={team} size={40} className="shrink-0" />}
      <div className="min-w-0 mr-auto">
        <p className="font-bold text-lg leading-tight truncate" style={{ fontFamily: "var(--f-d)" }}>{team?.name}</p>
        <p className="text-xs p-muted">{DAY_LABELS[(d.getUTCDay() + 6) % 7]} {d.getUTCDate()} {MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} · {pos}° {LEAGUE_LABELS[team?.league] || ""} · Temp. {state.season}</p>
      </div>
      <div className="text-right">
        <p className="p-eyebrow" style={{ justifyContent: "flex-end" }}>Presupuesto</p>
        <p className="p-num text-2xl leading-none" style={{ color: "var(--gold)" }}>€{state.budget}M</p>
      </div>
      <div className="w-36 hidden sm:block" title={`Sueldos: €${wages}k/sem de un tope de €${cap}k/sem`}>
        <p className="p-eyebrow"><span>Masa salarial</span><span>{pct}%</span></p>
        <div className="p-cbar mt-1"><i style={{ width: `${pct}%`, background: pct > 95 ? "var(--red)" : undefined }} /></div>
      </div>
      <Link to="/hoy" title="Volver a Futotal" className="p-roundb shrink-0"><Home size={16} /></Link>
      <button onClick={onExit} title="Cambiar de carrera" className="p-roundb shrink-0"><Shuffle size={16} /></button>
    </div>
  );
}

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
  const group = groupOf(screen);

  return (
    <div className="min-h-screen bg-bg text-white">
      <nav className="sticky top-0 z-10 border-b" style={{ background: "color-mix(in srgb, var(--bg2) 94%, transparent)", backdropFilter: "blur(8px)", borderColor: "var(--line)" }}>
        <ClubHeader team={team} onExit={() => { setForceNewCareer(false); exitToMenu(); }} />
        <div className="flex gap-1 overflow-x-auto px-3 max-w-[1280px] mx-auto [scrollbar-width:none]" role="tablist" aria-label="Secciones del Modo DT">
          {MENU.map(({ id, label, icon: Icon, sub }) => {
            const active = group.id === id;
            return (
              <button key={id} role="tab" aria-selected={active} onClick={() => setScreen(sub ? sub[0][0] : id)}
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
                style={{ color: active ? "var(--fg)" : "var(--mute)" }}>
                <Icon size={15} />{label}
                {active && <i className="absolute left-2 right-2 bottom-0 h-[3px] rounded-t" style={{ background: "var(--acc)" }} />}
              </button>
            );
          })}
        </div>
      </nav>
      <main className="w-full max-w-[1280px] mx-auto p-4 space-y-4">
        {group.sub && (
          <div className="p-seg" style={{ maxWidth: 420 }} role="tablist" aria-label={group.label}>
            {group.sub.map(([k, l]) => <button key={k} role="tab" aria-selected={screen === k} className={screen === k ? "on" : ""} onClick={() => setScreen(k)}>{l}</button>)}
          </div>
        )}
        {screen === "dashboard" && (
          <Dashboard onPlayMatch={(result) => { setMatchResult(result); setScreen("match"); }} />
        )}
        {screen === "squad" && <Squad />}
        {screen === "formations" && <Formation />}
        {screen === "tactics" && <Tactics />}
        {screen === "cantera" && <Cantera />}
        {screen === "settings" && <Settings />}
        {screen === "transfers" && <Transfers />}
        {screen === "finances" && <Finances />}
        {screen === "calendar" && <SeasonCalendar />}
        {screen === "history" && <CareerHistory />}
      </main>
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
      <CareerApp />
    </CareerProvider>
  );
}
