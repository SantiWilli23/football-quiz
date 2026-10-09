import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FastForward, Play, Zap } from "lucide-react";
import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import {
  ACTIVITIES, DAY_LABELS, DAY_NAMES, DEFAULT_ACTIVITY, MATCH_DAY, MONTH_NAMES,
  dateOfDay, energyOf, energyTone, matchReadiness, monthKey, squadEnergy,
} from "../engine/energy.js";
import TeamCrest from "./TeamCrest.jsx";

const SECTIONS = [
  ["dias", "Días del mes"],
  ["tabla", "Tabla de posiciones"],
  ["partidos", "Partidos"],
];

export default function SeasonCalendar() {
  const [section, setSection] = useState("dias");
  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Calendario y tabla">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`px-4 py-2 rounded-card text-sm font-medium whitespace-nowrap border transition-colors ${section === id ? "bg-accent/15 text-accent border-accent/30" : "text-gray-400 border-transparent hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {section === "dias" && <DaysSection />}
      {section === "tabla" && <StandingsSection />}
      {section === "partidos" && <FixturesSection />}
    </div>
  );
}

function StandingsSection() {
  const { state, standingsSorted } = useCareer();
  return (
    <div>
      <h2 className="text-lg font-bold mb-3">Tabla de posiciones</h2>
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-panel text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-2 py-2">Equipo</th>
              <th className="px-2 py-2">PJ</th>
              <th className="px-2 py-2">G</th>
              <th className="px-2 py-2">E</th>
              <th className="px-2 py-2">P</th>
              <th className="px-2 py-2">GF</th>
              <th className="px-2 py-2">GC</th>
              <th className="px-2 py-2">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standingsSorted.map((row, i) => {
              const t = teamById(row.teamId);
              const mine = row.teamId === state.teamId;
              return (
                <tr key={row.teamId} className={`border-t border-border ${mine ? "bg-accent/10" : ""}`}>
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className={`px-2 py-2 truncate max-w-[140px] ${mine ? "font-semibold text-accent" : ""}`}>
                    <span className="flex items-center gap-2"><TeamCrest team={t} size={18} />{t?.name}</span>
                  </td>
                  <td className="px-2 py-2 text-center">{row.played}</td>
                  <td className="px-2 py-2 text-center">{row.won}</td>
                  <td className="px-2 py-2 text-center">{row.drawn}</td>
                  <td className="px-2 py-2 text-center">{row.lost}</td>
                  <td className="px-2 py-2 text-center">{row.gf}</td>
                  <td className="px-2 py-2 text-center">{row.ga}</td>
                  <td className="px-2 py-2 text-center font-semibold">{row.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FixturesSection() {
  const { state } = useCareer();
  return (
    <div>
      <h2 className="text-lg font-bold mb-3">Partidos</h2>
      {/* Línea de tiempo: un punto por fecha, coloreado según resultado; la
          próxima fecha se destaca. La lista de abajo sigue con el detalle. */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-3" role="img" aria-label="Línea de tiempo de la temporada">
        {state.calendar.map((c) => {
          const isNext = !c.played && state.calendar.find((x) => !x.played)?.week === c.week;
          const color = !c.played
            ? isNext ? "bg-accent ring-2 ring-accent/40" : "bg-white/10"
            : c.result.myGoals > c.result.rivalGoals ? "bg-good" : c.result.myGoals === c.result.rivalGoals ? "bg-amber" : "bg-bad";
          return <span key={c.week} title={`J${c.week}`} className={`shrink-0 w-2.5 h-2.5 rounded-full ${color}`} />;
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[28rem] overflow-y-auto pr-1">
        {state.calendar.map((c) => {
          const rival = teamById(c.opponentTeamId);
          const tone = !c.played ? "tone-blue" : c.result.myGoals > c.result.rivalGoals ? "tone-emerald" : c.result.myGoals === c.result.rivalGoals ? "tone-amber" : "tone-red";
          return (
            <div key={c.week} className={`${tone} tile-b rounded-card px-3 py-2.5 flex flex-col gap-1`}>
              <span className="text-[11px] uppercase tracking-wider text-gray-300">J{c.week} · {c.home ? "Local" : "Visitante"}</span>
              <span className="text-sm font-semibold truncate">{rival?.name}</span>
              <span className="text-lg font-bold tabular-nums text-tone">
                {c.played ? `${c.result.myGoals} - ${c.result.rivalGoals}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Meter({ label, value, tone }) {
  return (
    <div className={`tone-${tone}`}>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold tabular-nums text-tone">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-tone transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// Días de la semana (con el partido el sábado) y calendario del mes para ir simulando.
export function DaysSection() {
  const { state, simulateDay, simulateToMatchDay, isOnline } = useCareer();
  const [activity, setActivity] = useState(DEFAULT_ACTIVITY);
  const day = state.day || 0;
  // En la liga online los partidos los juega la liga (pestañas Jornada y Calendario).
  const fixture = isOnline ? null : state.calendar.find((c) => !c.played) || null;
  const rival = fixture ? teamById(fixture.opponentTeamId) : null;
  const matchDay = day >= MATCH_DAY;
  const readiness = matchReadiness(state);
  const today = dateOfDay(state.season, state.week, day);
  const [monthShift, setMonthShift] = useState(0);

  // Mes que se muestra: el de hoy, más o menos los meses que se hayan movido.
  const shown = useMemo(() => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthShift, 1)), [today, monthShift]);
  const year = shown.getUTCFullYear();
  const month = shown.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = (shown.getUTCDay() + 6) % 7; // lunes = 0

  // Cada fecha de partido de la temporada cae en su sábado.
  const matchByDate = useMemo(() => {
    const map = {};
    (isOnline ? [] : state.calendar).forEach((c) => {
      const d = dateOfDay(state.season, c.week - 1, MATCH_DAY); // la fecha 1 se juega en la semana 0
      map[d.toISOString().slice(0, 10)] = c;
    });
    return map;
  }, [state.calendar, state.season, isOnline]);

  const tiredPlayers = [...state.squad].sort((a, b) => energyOf(state, a.id) - energyOf(state, b.id)).slice(0, 5);
  const todayIso = today.toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-5">
      <div className="hero-b rounded-3xl p-5" style={{ "--hero-a": "var(--c-blue)", "--hero-b": "var(--c-emerald)" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="t-eyebrow">Jornada {state.week + 1} · {DAY_NAMES[Math.min(day, 6)]} {today.getUTCDate()} de {MONTH_NAMES[today.getUTCMonth()]}</p>
            <h2 className="text-xl font-bold mt-1">
              {matchDay ? "Día de partido" : `Faltan ${MATCH_DAY - day} día${MATCH_DAY - day === 1 ? "" : "s"} para el partido`}
            </h2>
            {rival && (
              <p className="text-sm text-gray-300 mt-1 flex items-center gap-2">
                <TeamCrest team={rival} size={18} /> {fixture.home ? "Local" : "Visitante"} vs {rival.name}
              </p>
            )}
          </div>
          <div className="min-w-[180px] flex-1 max-w-xs space-y-2.5">
            <Meter label="Energía del XI" value={squadEnergy(state)} tone={energyTone(squadEnergy(state))} />
            <Meter label="Ritmo de competencia" value={state.sharpness ?? 50} tone="purple" />
            <p className="text-xs text-gray-300">{readiness.label}</p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mt-5">
          {DAY_LABELS.map((label, i) => {
            const past = i < day;
            const current = i === day;
            const isMatch = i === MATCH_DAY;
            const logged = (state.dayLog || []).find((l) => l.week === state.week && l.day === i);
            return (
              <div
                key={label}
                className={`rounded-xl border px-1 py-2 text-center text-xs ${current ? "border-accent bg-accent/15 text-white" : past ? "border-border bg-bg/50 text-gray-500" : "border-border bg-bg/30 text-gray-400"} ${isMatch ? "ring-1 ring-amber/50" : ""}`}
              >
                <p className="font-semibold">{label}</p>
                <p className="mt-0.5 text-[10px] leading-tight min-h-[24px]">
                  {isMatch ? "Partido" : logged ? ACTIVITIES[logged.activity]?.label.split(" ")[0] : current ? "Hoy" : i > MATCH_DAY ? "Libre" : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {!matchDay && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">¿Qué hace el plantel hoy?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(ACTIVITIES).map(([id, a]) => (
              <button
                key={id}
                onClick={() => setActivity(id)}
                className={`tone-${a.tone} text-left rounded-2xl border p-3 transition-colors ${activity === id ? "tile-b" : "border-border bg-panel hover:border-white/30"}`}
              >
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{a.desc}</p>
                <p className="text-[11px] mt-1.5 tabular-nums text-gray-300">
                  Energía {a.energy > 0 ? "+" : ""}{a.energy} · Ritmo {a.sharpness > 0 ? "+" : ""}{a.sharpness}
                </p>
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => simulateDay(activity)} className="btn btn-primary inline-flex items-center gap-2"><Play size={15} /> Simular el día</button>
            <button onClick={() => simulateToMatchDay(activity)} className="px-5 py-2.5 rounded-card border border-border text-sm text-gray-300 hover:text-white hover:border-white/30 inline-flex items-center gap-2">
              <FastForward size={15} /> Simular hasta el partido
            </button>
          </div>
        </div>
      )}
      {matchDay && <p className="text-sm text-gray-400">{isOnline ? "Ya es sábado: tu partido se juega desde la pestaña Jornada de la liga." : "Ya es sábado: jugá el partido desde el Inicio. Después de jugar arranca la semana siguiente."}</p>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold flex items-center gap-2"><CalendarDays size={18} className="text-accent" /> {MONTH_NAMES[month][0].toUpperCase() + MONTH_NAMES[month].slice(1)} {year}</h3>
            <div className="flex gap-1">
              <button onClick={() => setMonthShift((m) => m - 1)} aria-label="Mes anterior" className="p-2 rounded-card border border-border text-gray-400 hover:text-white"><ChevronLeft size={16} /></button>
              <button onClick={() => setMonthShift(0)} className="px-3 py-2 rounded-card border border-border text-xs text-gray-300 hover:text-white">Hoy</button>
              <button onClick={() => setMonthShift((m) => m + 1)} aria-label="Mes siguiente" className="p-2 rounded-card border border-border text-gray-400 hover:text-white"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-gray-500 mb-1">
            {DAY_LABELS.map((l) => <span key={l}>{l}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d == null) return <span key={`e${i}`} />;
              const iso = new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10);
              const m = matchByDate[iso];
              const mRival = m ? teamById(m.opponentTeamId) : null;
              const isToday = iso === todayIso;
              const past = iso < todayIso;
              return (
                <div
                  key={iso}
                  className={`min-h-[58px] rounded-xl border p-1.5 flex flex-col items-center gap-0.5 text-xs ${isToday ? "border-accent bg-accent/15" : m ? "border-amber/40 bg-amber/5" : "border-border bg-panel"} ${past && !isToday ? "opacity-60" : ""}`}
                >
                  <span className={`tabular-nums ${isToday ? "font-bold text-accent" : "text-gray-300"}`}>{d}</span>
                  {m && (
                    <>
                      <TeamCrest team={mRival} size={16} />
                      <span className={`text-[10px] tabular-nums ${m.played ? (m.result.myGoals > m.result.rivalGoals ? "text-good" : m.result.myGoals === m.result.rivalGoals ? "text-amber" : "text-bad") : "text-gray-500"}`}>
                        {m.played ? `${m.result.myGoals}-${m.result.rivalGoals}` : m.home ? "L" : "V"}
                      </span>
                    </>
                  )}
                  {!m && d === 1 && <span className="text-[9px] leading-tight text-purple text-center">Nuevos jóvenes</span>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">Cada mes que pasa tus redes de cantera te muestran jóvenes nuevos. Los partidos caen los sábados.</p>
        </div>

        <div className="bg-panel border border-border rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-3 flex items-center gap-1.5"><Zap size={13} /> Más cansados</p>
          <ul className="space-y-2">
            {tiredPlayers.map((p) => {
              const e = energyOf(state, p.id);
              return (
                <li key={p.id} className={`tone-${energyTone(e)}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="truncate pr-2">{p.name}</span>
                    <span className="font-semibold tabular-nums text-tone">{e}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-tone" style={{ width: `${e}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
