import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, CalendarDays, Check, LayoutGrid, Loader2, SlidersHorizontal, Sprout, Users, Wallet } from "lucide-react";
import { CareerProvider, useCareer } from "../carrera/context/CareerContext.jsx";
import Squad from "../carrera/components/Squad.jsx";
import Formation from "../carrera/components/Formation.jsx";
import Tactics from "../carrera/components/Tactics.jsx";
import Transfers from "../carrera/components/Transfers.jsx";
import Cantera from "../carrera/components/Cantera.jsx";
import Finances from "../carrera/components/Finances.jsx";
import { DaysSection } from "../carrera/components/SeasonCalendar.jsx";
import { getSquad, saveSquad } from "./api.js";

// Lo mismo que el Modo DT solo, para el club del manager en la liga online (sin Inicio ni
// Historial, que la liga cubre con Jornada, Calendario y Tabla).
const SECTIONS = [
  ["squad", "Plantel", Users],
  ["formations", "Formaciones", LayoutGrid],
  ["tactics", "Tácticas", SlidersHorizontal],
  ["transfers", "Fichajes", ArrowLeftRight],
  ["cantera", "Cantera", Sprout],
  ["finances", "Finanzas", Wallet],
  ["week", "Semana", CalendarDays],
];

function Sections({ leagueWeek }) {
  const { syncOnlineWeek } = useCareer();
  const [screen, setScreen] = useState("squad");

  // Cada jornada nueva de la liga hace pasar una semana en el club (energía, cantera, lesiones).
  useEffect(() => { syncOnlineWeek(leagueWeek); }, [leagueWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Mi club">
        {SECTIONS.map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={screen === id}
            onClick={() => setScreen(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-card text-sm font-medium whitespace-nowrap border transition-colors shrink-0 ${screen === id ? "bg-accent/15 text-accent border-accent/30" : "text-gray-400 border-transparent hover:text-white"}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {screen === "squad" && <Squad />}
      {screen === "formations" && <Formation />}
      {screen === "tactics" && <div className="max-w-xl"><Tactics /></div>}
      {screen === "transfers" && <Transfers />}
      {screen === "cantera" && <Cantera />}
      {screen === "finances" && <Finances />}
      {screen === "week" && <DaysSection />}
    </div>
  );
}

// "Mi club": la carrera del manager (plantel, formación, tácticas, fichajes, cantera, finanzas
// y energía) guardada en el servidor. De ahí sale la fuerza real con la que juega la liga.
export default function ClubPanel({ code, league, myTeamId }) {
  const [boot, setBoot] = useState(null); // { state } cuando ya se cargó
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("saved"); // saved | saving | error
  const latest = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    getSquad(code)
      .then((d) => alive && setBoot({ state: d.state }))
      .catch(() => alive && setError("No se pudo cargar tu club."));
    return () => { alive = false; };
  }, [code]);

  async function flush() {
    clearTimeout(timer.current);
    const state = latest.current;
    if (!state) return;
    latest.current = null;
    setStatus("saving");
    try {
      await saveSquad(code, state);
      setStatus("saved");
    } catch {
      if (!latest.current) latest.current = state; // para poder reintentar
      setStatus("error");
    }
  }

  // Guarda unos instantes después del último cambio, y al salir de la pantalla.
  function onChange(state) {
    latest.current = state;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  }
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!boot) return <p className="text-sm text-gray-500 text-center py-6">Cargando tu club…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
        <p>Tu plantel define cómo rinde tu club en la liga: el once titular, la energía y las tácticas cuentan en cada partido.</p>
        <span className="inline-flex items-center gap-1 shrink-0" aria-live="polite">
          {status === "saving" && <><Loader2 size={12} className="animate-spin" /> Guardando</>}
          {status === "saved" && <><Check size={12} className="text-emerald" /> Guardado</>}
          {status === "error" && <button onClick={flush} className="text-red-300 hover:underline">No se guardó, reintentar</button>}
        </span>
      </div>
      <CareerProvider online={{ state: boot.state, teamId: myTeamId, onChange }}>
        <Sections leagueWeek={league.currentWeek} />
      </CareerProvider>
    </div>
  );
}
