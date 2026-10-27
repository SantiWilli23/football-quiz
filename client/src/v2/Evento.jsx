import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, ListChecks, Radio, Star, Swords } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Partidos temáticos (clásicos y finales reales) en Hoy: previa con pronóstico, «¿con quién
// vas?», adivinar la alineación, marcador en vivo, duelo de hinchadas, figura del partido y
// «el día después». Nada de esto da puntos: da sobres e insignias.
const PICK_LABEL = { home: "Local", draw: "Empate", away: "Visita" };

function whenText(iso) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  const when = new Date(iso).toLocaleString("es-CL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  if (ms <= 0) return when;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${when} · faltan ${h > 0 ? `${h} h ` : ""}${m} min`;
}

export default function EventCards({ groupId, played }) {
  const [days, setDays] = useState(null);
  const reload = useCallback(() => api.get("/events/current").then((r) => setDays(r.data.days)).catch(() => setDays([])), []);
  useEffect(() => { reload(); }, [reload]);
  if (!days || days.length === 0) return null;
  return (
    <div className="space-y-4">
      {days.map((d) => <EventCard key={d.event.date} day={d} groupId={groupId} played={played} onChange={reload} />)}
    </div>
  );
}

function EventCard({ day, groupId, played, onChange }) {
  const toast = useToast();
  const { event, rel, mine, started } = day;
  const [busy, setBusy] = useState(false);
  const pal = event.palette || {};

  async function post(path, body, ok) {
    setBusy(true);
    try { await api.post(path, body); if (ok) toast(ok); await onChange(); } catch (e) { toast(e.response?.data?.error || "No se pudo completar"); } finally { setBusy(false); }
  }
  const sideName = (s) => event.teams[s].name;

  return (
    <Card variant="feature" className="overflow-hidden" >
      <div className="-m-5 mb-3 px-5 py-3" style={{ background: `linear-gradient(120deg, ${pal.b || "#1c3f94"}33, ${pal.bg || "#10131a"})` }}>
        <p className="t-eyebrow">{rel === "tomorrow" ? "Previa" : rel === "today" ? "Hoy" : "Ayer"} · {event.label}</p>
        <p className="mt-0.5 text-lg font-bold leading-tight">{sideName("home")} <span className="text-gray-500">vs</span> {sideName("away")}</p>
        <p className="text-xs text-gray-400">{whenText(event.kickoff)}</p>
      </div>

      {rel === "yesterday" && event.result && (
        <p className="text-center text-3xl font-extrabold tabular-nums">{event.result.home} <span className="text-gray-500">–</span> {event.result.away}</p>
      )}

      {rel !== "yesterday" && (
        <>
          {!started && (
            <div className="mt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tu pronóstico · da un sobre si acertás</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {["home", "draw", "away"].map((p) => (
                  <button key={p} disabled={busy} onClick={() => post("/events/pred", { date: event.date, pick: p }, "Pronóstico guardado")} className={`min-h-[44px] rounded-xl border px-1 text-sm ${mine.pred === p ? "border-accent bg-accent/15 font-semibold" : "border-border text-gray-300"}`}>
                    {p === "draw" ? PICK_LABEL.draw : sideName(p)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!played && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1"><Swords size={12} /> ¿Con quién vas?</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {["home", "away"].map((s) => (
                  <button key={s} disabled={busy} onClick={() => post("/events/side", { date: event.date, side: s }, `Vas con ${sideName(s)}`)} className={`min-h-[44px] rounded-xl border px-1 text-sm ${mine.side === s ? "border-accent bg-accent/15 font-semibold" : "border-border text-gray-300"}`}>{sideName(s)}</button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">No cambia tus puntos: sirve para el duelo de hinchadas de tu club.</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {(rel === "tomorrow" || !mine.lineupGuess?.revealed) && (
              <Link to={`/evento/alineacion/${event.date}`} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"><ListChecks size={14} /> {mine.lineupGuess ? "Tu alineación" : "Adivina la alineación"}</Link>
            )}
            {rel === "today" && <Link to={`/vivo/${event.league}/${event.eventId}`} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"><Radio size={14} /> Marcador en vivo</Link>}
          </div>
          {mine.badges.includes("partido") && <p className="mt-3 text-sm text-accent flex items-center gap-1.5"><Star size={14} /> Ganaste la insignia {event.badge}.</p>}
        </>
      )}

      {rel === "yesterday" && (
        <>
          <Fans groupId={groupId} date={event.date} sideName={sideName} />
          <Figure groupId={groupId} date={event.date} />
          <DayAfter onChange={onChange} />
          <Link to={`/vivo/${event.league}/${event.eventId}`} className="mt-3 inline-flex text-xs text-accent">Ver el resumen del partido</Link>
        </>
      )}
    </Card>
  );
}

function Fans({ groupId, date, sideName }) {
  const [f, setF] = useState(null);
  useEffect(() => { if (groupId) api.get("/events/fans", { params: { groupId, date } }).then((r) => setF(r.data)).catch(() => setF(null)); }, [groupId, date]);
  if (!f || (!f.home.fans && !f.away.fans)) return null;
  return (
    <div className="mt-4">
      <p className="t-eyebrow flex items-center gap-1.5"><Flame size={12} /> Duelo de hinchadas de tu club</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-center text-sm">
        {["home", "away"].map((s) => (
          <div key={s} className={`rounded-xl border px-2 py-2 ${f.winner === s ? "border-accent bg-accent/10" : "border-border"}`}>
            <p className="font-semibold truncate">{sideName(s)}</p>
            <p className="text-xs text-gray-400">{f[s].fans} {f[s].fans === 1 ? "hincha" : "hinchas"} · {f[s].points} pts</p>
          </div>
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-gray-500">{f.winner ? `Ganó la hinchada de ${sideName(f.winner)}.` : "Empate de hinchadas."}</p>
    </div>
  );
}

function Figure({ groupId, date }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const load = useCallback(() => { if (groupId) api.get("/events/figure", { params: { groupId, date } }).then((r) => setData(r.data)).catch(() => setData(null)); }, [groupId, date]);
  useEffect(() => { load(); }, [load]);
  if (!data || !data.candidates.length) return null;
  const total = data.candidates.reduce((n, c) => n + c.votes, 0) || 1;
  async function vote(player) {
    try { await api.post("/events/figure", { groupId, date, player }); load(); } catch (e) { toast(e.response?.data?.error || "No se pudo votar"); }
  }
  return (
    <div className="mt-4">
      <p className="t-eyebrow">Figura del partido · vota tu club</p>
      <div className="mt-1.5 space-y-1.5">
        {data.candidates.map((c) => (
          <button key={c.player} disabled={!!data.mine} onClick={() => vote(c.player)} className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm ${data.mine === c.player ? "border-accent" : "border-border"}`}>
            <span className="absolute inset-y-0 left-0 bg-accent/15" style={{ width: `${data.mine ? (c.votes / total) * 100 : 0}%` }} />
            <span className="relative flex justify-between gap-2"><span className="truncate">{c.player}</span>{data.mine && <b className="tabular-nums">{c.votes}</b>}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DayAfter({ onChange }) {
  const [q, setQ] = useState(null);
  const [res, setRes] = useState(null);
  useEffect(() => { api.get("/events/day-after").then((r) => setQ(r.data)).catch(() => setQ(null)); }, []);
  if (!q || !q.available || q.done) return q?.done ? <p className="mt-4 text-xs text-gray-500">{q.won ? "Ya ganaste la insignia de «El día después»." : "Ya respondiste «El día después»."}</p> : null;
  async function answer(i) {
    try { const { data } = await api.post("/events/day-after", { choice: i }); setRes(data); onChange(); } catch { setRes({ ok: false, correct: "?" }); }
  }
  return (
    <div className="mt-4">
      <p className="t-eyebrow">El día después · sin puntos, con insignia</p>
      <p className="mt-1 text-sm">{q.question}</p>
      {!res ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">{q.options.map((o, i) => <button key={o} onClick={() => answer(i)} className="min-h-[44px] rounded-xl border border-border px-2 text-sm tabular-nums">{o}</button>)}</div>
      ) : (
        <p className={`mt-2 text-sm ${res.ok ? "text-good" : "text-bad"}`}>{res.ok ? "¡Acertaste! Ganaste la insignia." : `Era ${res.correct}.`}</p>
      )}
    </div>
  );
}
