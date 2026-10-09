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
import { ackBudgetAdjustments, markPreseasonReady, claimYouth, getBudgetAdjustments, getCpuOffers, getSquad, getYouthClaims, respondCpuOffer, saveSquad } from "./api.js";

// Lo mismo que el Modo DT solo, para el club del manager en la liga online (sin Inicio ni
// Historial, que la liga cubre con Jornada, Calendario y Tabla).
// Amistosos de pretemporada (solo antes de que empiece la liga): dan forma y moral, no puntos.
function Preseason({ code, league }) {
  const { state, preseasonAvailable, playPreseasonMatch } = useCareer();
  const [last, setLast] = useState(null);
  const [marked, setMarked] = useState(false);
  const [wait, setWait] = useState("");
  const pre = state.preseason;
  if (!pre) return null;
  const available = preseasonAvailable();
  const next = pre.opponents[pre.matchesPlayed];
  const finished = pre.matchesPlayed >= pre.total;
  const me = league?.members?.find((m) => m.isMe);
  const done = marked || !!me?.preseasonReady;
  async function markReady() {
    try {
      const r = await markPreseasonReady(code);
      setMarked(true);
      setWait(r.started ? "¡Arrancó la liga!" : `Falta que terminen: ${(r.pending || []).join(", ")}`);
    } catch { setWait("No se pudo avisar. Probá de nuevo."); }
  }
  return (
    <div className="space-y-3 max-w-xl">
      <p className="text-sm text-gray-400">Los amistosos solo se juegan en la pretemporada, antes de que arranque la liga. No suman puntos ni cuentan en la tabla: sirven para que los titulares ganen forma y para levantar la moral.</p>
      {last && <p className="text-sm rounded-card border border-border bg-panel px-3 py-2">Último amistoso: {last.myGoals} - {last.rivalGoals} vs {last.rival?.name}</p>}
      {league?.preseasonOpen && (
        <div className="rounded-card border border-accent/30 bg-accent/5 px-3 py-2 text-sm space-y-2">
          <p>La liga arranca cuando <b>todos</b> los managers terminen su pretemporada. Hasta entonces no se juega ningún partido de liga.</p>
          {done ? (
            <p className="text-emerald">Ya avisaste que terminaste. {wait || "Esperando a los demás managers."}</p>
          ) : (
            <button onClick={markReady} disabled={!finished} className="btn btn-primary btn-sm disabled:opacity-40">{finished ? "Terminé mi pretemporada" : `Jugá tus ${pre.total} amistosos para poder terminar (${pre.matchesPlayed}/${pre.total})`}</button>
          )}
          {wait && !done && <p className="text-xs text-gray-400">{wait}</p>}
        </div>
      )}
      {available && next ? (
        <button onClick={() => setLast(playPreseasonMatch())} className="btn btn-primary">Jugar amistoso {pre.matchesPlayed + 1}/{pre.total} vs {next.name}</button>
      ) : (
        <p className="text-sm text-gray-500">{(state.week ?? 0) > 0 ? "La pretemporada ya terminó: ahora hay liga." : "Ya jugaste todos los amistosos de la pretemporada."}</p>
      )}
    </div>
  );
}

const SECTIONS = [
  ["squad", "Plantel", Users],
  ["formations", "Formaciones", LayoutGrid],
  ["tactics", "Tácticas", SlidersHorizontal],
  ["transfers", "Fichajes", ArrowLeftRight],
  ["cantera", "Cantera", Sprout],
  ["finances", "Finanzas", Wallet],
  ["week", "Semana", CalendarDays],
  ["preseason", "Pretemporada", CalendarDays],
];

function Sections({ code, league, leagueWeek, season, marketLabel }) {
  const { syncOnlineWeek, syncOnlineSeason, applyBudgetAdjustment, injectCpuOffers } = useCareer();
  const [screen, setScreen] = useState("squad");

  // Temporada nueva: el club cierra la anterior. Después, cada jornada de la liga hace pasar una
  // semana en el club (energía, cantera, lesiones, forma y progresión de los jugadores).
  useEffect(() => { syncOnlineSeason(season); }, [season]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { syncOnlineWeek(leagueWeek); }, [leagueWeek, season]); // eslint-disable-line react-hooks/exhaustive-deps

  // Multas y premios de la liga se aplican al presupuesto del club, y llegan las ofertas de la CPU.
  useEffect(() => {
    let alive = true;
    getBudgetAdjustments(code).then(async (adj) => {
      if (!alive || !adj.count) return;
      applyBudgetAdjustment(adj.total);
      await ackBudgetAdjustments(code).catch(() => {});
    }).catch(() => {});
    getCpuOffers(code).then((offers) => { if (alive) injectCpuOffers(offers); }).catch(() => {});
    return () => { alive = false; };
  }, [code, leagueWeek, season]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {marketLabel && (
        <p className="text-xs rounded-card border border-accent/30 bg-accent/10 text-accent px-3 py-2">
          {marketLabel} abierto: podés fichar y vender. Los clubes de la CPU también hacen movimientos y te pueden mandar ofertas.
        </p>
      )}
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
      {screen === "preseason" && <Preseason code={code} league={league} />}
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
      <CareerProvider online={{ state: boot.state, teamId: myTeamId, code, onChange, onCpuOfferResponse: (id, accept) => respondCpuOffer(code, id, accept).catch(() => {}), claim: (id) => claimYouth(code, id), fetchClaims: () => getYouthClaims(code) }}>
        <Sections code={code} league={league} leagueWeek={league.currentWeek} season={league.season || 1} marketLabel={league.marketLabel} />
      </CareerProvider>
    </div>
  );
}
