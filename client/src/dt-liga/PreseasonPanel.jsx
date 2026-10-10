import { useState } from "react";
import { useCareer } from "../carrera/context/CareerContext.jsx";
import { dateOfDay, MONTH_NAMES } from "../carrera/engine/energy.js";
import { markPreseasonReady } from "./api.js";

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const GRID_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MATCH_DAY = 5; // sábado, igual que los partidos de liga

// Los amistosos caen en los sábados de las semanas anteriores a la primera fecha: el último, justo antes de que arranque la liga.
function friendlyDate(season, i, total) {
  return dateOfDay(season || 1, i - total, MATCH_DAY);
}
const fmt = (d) => `${WEEKDAYS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} de ${MONTH_NAMES[d.getUTCMonth()]}`;

function MiniMonth({ year, mon, byDay }) {
  const first = new Date(Date.UTC(year, mon, 1));
  const daysInMonth = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const title = MONTH_NAMES[mon][0].toUpperCase() + MONTH_NAMES[mon].slice(1);
  return (
    <div className="space-y-2">
      <h4 className="font-bold text-sm">{title} {year}</h4>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-gray-500">{GRID_DAYS.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d == null) return <span key={"e" + i} />;
          const f = byDay.get(d);
          return (
            <div key={d} className={"min-h-[52px] rounded-xl border p-1 text-center flex flex-col items-center gap-0.5 " + (f ? (f.played ? "border-border bg-bg/40" : f.next ? "border-accent bg-accent/15" : "border-accent/40 bg-accent/5") : "border-border/50 bg-panel/40 text-gray-600")}>
              <span className={"text-[11px] " + (f ? "text-white font-semibold" : "")}>{d}</span>
              {f && (
                <>
                  <span className="block truncate max-w-full text-[10px] text-gray-300">vs {f.opp.name}</span>
                  <span className={"block text-[11px] font-bold " + (f.played ? "text-white" : "text-accent")}>{f.played ? `${f.res.myGoals}-${f.res.rivalGoals}` : f.next ? "Jugar" : "Amistoso"}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Amistosos de pretemporada, cada uno con su día. variant "play": lista con el botón de jugar y el aviso de que
// terminaste. variant "calendar": solo el calendario.
export default function PreseasonPanel({ code, league, variant = "play" }) {
  const { state, preseasonAvailable, playPreseasonMatch } = useCareer();
  const [last, setLast] = useState(null);
  const [marked, setMarked] = useState(false);
  const [wait, setWait] = useState("");
  const pre = state.preseason;
  if (!pre || !pre.total) return null;
  const available = preseasonAvailable();
  const season = state.season || 1;
  const finished = pre.matchesPlayed >= pre.total;
  const me = league?.members?.find((m) => m.isMe);
  const done = marked || !!me?.preseasonReady;
  const friendlies = pre.opponents.map((opp, i) => ({
    opp, i, date: friendlyDate(season, i, pre.total),
    played: i < pre.matchesPlayed, next: i === pre.matchesPlayed && available,
    res: pre.results?.[i] || { myGoals: "?", rivalGoals: "?" },
  }));
  const months = [];
  friendlies.forEach((f) => {
    const key = f.date.getUTCFullYear() * 12 + f.date.getUTCMonth();
    let m = months.find((x) => x.key === key);
    if (!m) { m = { key, year: f.date.getUTCFullYear(), mon: f.date.getUTCMonth(), byDay: new Map() }; months.push(m); }
    m.byDay.set(f.date.getUTCDate(), f);
  });

  async function markReady() {
    try {
      const r = await markPreseasonReady(code);
      setMarked(true);
      setWait(r.started ? "¡Arrancó la liga!" : `Falta que terminen: ${(r.pending || []).join(", ")}`);
    } catch { setWait("No se pudo avisar. Probá de nuevo."); }
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-4 space-y-4">
      <div>
        <p className="font-semibold">Pretemporada</p>
        <p className="text-xs text-gray-500 mt-0.5">Los amistosos se juegan en su día, en orden, antes de la primera fecha. No suman puntos ni cuentan en la tabla: dan forma a los titulares y levantan la moral.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {months.map((m) => <MiniMonth key={m.key} year={m.year} mon={m.mon} byDay={m.byDay} />)}
      </div>
      {variant === "play" && (
        <>
          <ul className="space-y-1.5">
            {friendlies.map((f) => (
              <li key={f.i} className={"flex items-center gap-3 px-3 py-2 rounded-xl border text-sm " + (f.next ? "border-accent/40 bg-accent/5" : "border-border")}>
                <span className="w-24 shrink-0 text-xs text-gray-400 capitalize">{fmt(f.date)}</span>
                <span className="flex-1 min-w-0 truncate">Amistoso {f.i + 1} · vs {f.opp.name}</span>
                {f.played ? <b className="tabular-nums">{f.res.myGoals} - {f.res.rivalGoals}</b>
                  : f.next ? <button onClick={() => setLast(playPreseasonMatch())} className="btn btn-primary btn-sm">Jugar</button>
                  : <span className="text-xs text-gray-600">Pendiente</span>}
              </li>
            ))}
          </ul>
          {last && <p className="text-sm rounded-card border border-border bg-bg/40 px-3 py-2">Último amistoso: {last.myGoals} - {last.rivalGoals} vs {last.rival?.name}</p>}
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
          {league?.members?.length > 0 && (
            <ul className="text-sm space-y-1">
              {league.members.map((m) => <li key={m.userId} className="flex items-center gap-2"><span className={m.preseasonReady ? "text-emerald" : "text-gray-500"}>{m.preseasonReady ? "✓" : "…"}</span>{m.username}{m.isMe ? " (vos)" : ""}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
