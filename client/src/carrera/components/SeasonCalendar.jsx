import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FastForward, Zap } from "lucide-react";
import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import {
  ACTIVITIES, DAY_LABELS, DAY_NAMES, DEFAULT_ACTIVITY, MATCH_DAY, MONTH_NAMES,
  dateOfDay, energyOf, energyTone, matchReadiness, monthKey, squadEnergy, seasonStartDate,
} from "../engine/energy.js";
import TeamCrest from "./TeamCrest.jsx";
import CompChip from "./CompChip.jsx";
import { COMP, seasonSchedule, windowAt } from "../engine/schedule.js";

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
  const events = seasonSchedule(state);
  const nextId = events.find((e) => !e.played)?.id;
  const res = (e) => (!e.result ? null : e.result.my > e.result.rival || e.result.won ? "G" : e.result.my === e.result.rival ? "E" : "P");
  const tone = { G: "var(--acc2)", E: "var(--gold)", P: "var(--red)" };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <h2 className="text-lg font-bold mr-auto">Todos los partidos</h2>
        {Object.keys(COMP).map((c) => <CompChip key={c} comp={c} />)}
      </div>
      {/* Línea de tiempo: un punto por partido, coloreado según resultado; el próximo se destaca. */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" role="img" aria-label="Línea de tiempo de la temporada">
        {events.map((e) => <span key={e.id} title={`${e.round}`} className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: e.id === nextId ? "var(--acc)" : res(e) ? tone[res(e)] : "var(--panel2)", boxShadow: e.id === nextId ? "0 0 0 3px #2fb67344" : undefined, outline: e.comp !== "liga" ? `1px solid ${COMP[e.comp].color}` : undefined }} />)}
      </div>
      <ul className="p-card divide-y" style={{ padding: "4px 14px", borderColor: "var(--line)" }}>
        {events.map((e) => {
          const d = dateOfDay(state.season, e.weekIdx, e.day);
          const t = teamById(e.opponentId);
          const r = res(e);
          return (
            <li key={e.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: "var(--line)", background: e.id === nextId ? "var(--me-bg)" : undefined }}>
              <span className="p-num w-16 text-sm p-muted shrink-0">{DAY_LABELS[(d.getUTCDay() + 6) % 7]} {d.getUTCDate()}/{d.getUTCMonth() + 1}</span>
              <CompChip comp={e.comp} short />
              {t ? <TeamCrest team={t} size={22} /> : <span className="w-[22px]" />}
              <span className="flex-1 min-w-0 truncate text-sm font-medium">{e.home ? "vs" : "@"} {t?.name || e.opponentName}<small className="block p-dim text-[11px]">{e.round}</small></span>
              {r ? <span className="p-num text-lg rounded-lg px-2" style={{ color: tone[r], background: "var(--panel2)" }}>{e.result.my}-{e.result.rival}</span>
                : <span className="text-xs p-muted">{e.id === nextId ? "Próximo" : "Pendiente"}</span>}
            </li>
          );
        })}
      </ul>
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
  const { state, simulateToMatchDay, isOnline } = useCareer();
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

  // Todos los partidos de la temporada (liga, copa, Europa, amistosos) en su día.
  const events = useMemo(() => (isOnline ? [] : seasonSchedule(state)), [state, isOnline]);
  const matchByDate = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      const iso = dateOfDay(state.season, e.weekIdx, e.day).toISOString().slice(0, 10);
      (map[iso] = map[iso] || []).push(e);
    });
    return map;
  }, [events, state.season]);
  const start = seasonStartDate(state.season).getTime();
  const weekOfIso = (iso) => Math.floor((Date.parse(iso) - start) / 86400000 / 7);
  const weekEvents = events.filter((e) => e.weekIdx === state.week);

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
            const ev = weekEvents.find((e) => e.day === i && e.comp !== "liga");
            const logged = (state.dayLog || []).find((l) => l.week === state.week && l.day === i);
            return (
              <div
                key={label}
                className={`rounded-xl border px-1 py-2 text-center text-xs ${current ? "border-accent bg-accent/15 text-white" : past ? "border-border bg-bg/50 text-gray-500" : "border-border bg-bg/30 text-gray-400"} ${isMatch ? "ring-1 ring-amber/50" : ""}`}
              >
                <p className="font-semibold">{label}</p>
                <p className="mt-0.5 text-[10px] leading-tight min-h-[24px]">
                  {ev ? <span style={{ color: COMP[ev.comp].color, fontWeight: 700 }}>{COMP[ev.comp].short}{ev.played ? " ✓" : ""}</span> : isMatch ? "Partido" : logged ? ACTIVITIES[logged.activity]?.label.split(" ")[0] : current ? "Hoy" : i > MATCH_DAY ? "Libre" : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {!matchDay && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Plan de la semana</p>
            <p className="text-xs text-gray-500">Eliges una sola vez cómo trabaja el plantel hasta el partido: el plan se aplica a todos los días de la semana.</p>
          </div>
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
            <button onClick={() => simulateToMatchDay(activity)} className="btn btn-primary inline-flex items-center gap-2"><FastForward size={15} /> Simular la semana</button>
          </div>
        </div>
      )}
      {matchDay && <p className="text-sm text-gray-400">{isOnline ? "Ya es sábado: tu partido se juega desde la pestaña Jornada de la liga." : "Ya es sábado: juega el partido desde el Inicio. Después de jugar arranca la semana siguiente."}</p>}

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
              const evs = matchByDate[iso] || [];
              const isToday = iso === todayIso;
              const past = iso < todayIso;
              const inWindow = !isOnline && windowAt(weekOfIso(iso));
              return (
                <div
                  key={iso}
                  className={`relative min-h-[64px] lg:min-h-[86px] rounded-xl border p-1.5 flex flex-col gap-1 text-xs overflow-hidden ${past && !isToday ? "opacity-60" : ""}`}
                  style={{ borderColor: isToday ? "var(--acc)" : "var(--line)", background: isToday ? "var(--me-bg)" : "var(--panel)" }}
                >
                  <span className={`p-num text-sm ${isToday ? "" : "p-muted"}`} style={isToday ? { color: "var(--acc2)" } : undefined}>{d}</span>
                  {evs.map((m) => {
                    const mRival = teamById(m.opponentId);
                    const c = COMP[m.comp];
                    const r = m.result;
                    return (
                      <span key={m.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-semibold truncate" style={{ color: c.color, background: `${c.color}1f`, border: `1px solid ${c.color}55` }} title={`${m.round} · ${m.home ? "vs" : "@"} ${mRival?.name || m.opponentName}`}>
                        {mRival && <TeamCrest team={mRival} size={12} />}
                        <span className="truncate hidden sm:inline">{r ? `${r.my}-${r.rival}` : `${m.home ? "vs" : "@"} ${(mRival?.name || m.opponentName || "").split(" ")[0]}`}</span>
                        <span className="sm:hidden">{r ? `${r.my}-${r.rival}` : c.short}</span>
                      </span>
                    );
                  })}
                  {inWindow && <i className="absolute inset-x-0 bottom-0 h-1" style={{ background: "var(--gold)", opacity: 0.6 }} title="Mercado de fichajes abierto" />}
                  {!evs.length && d === 1 && <span className="text-[9px] leading-tight text-purple">Nuevos jóvenes</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-3 text-xs p-muted">
            {Object.keys(COMP).map((c) => <CompChip key={c} comp={c} />)}
            <span className="flex items-center gap-1.5"><i className="w-5 h-1 rounded" style={{ background: "var(--gold)" }} /> Mercado abierto</span>
          </div>
          <p className="text-xs p-dim mt-2">Liga los sábados, Europa los martes y Copa los miércoles. Cada mes tus redes de cantera traen jóvenes nuevos.</p>
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
