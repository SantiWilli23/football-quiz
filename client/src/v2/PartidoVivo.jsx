import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeftRight, Goal, WifiOff } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import PlayerFace from "../components/PlayerFace.jsx";
import { playSfx } from "../utils/sfx.js";

// Partido real en vivo con el modelo único del servidor (utils/live-match.js): marcador y
// minuto, línea de tiempo, alineación en cancha vertical, estadísticas y comentarios.
const POLL_MS = { live: 15_000, pre: 60_000 };
const STATUS_TEXT = { NS: "Por jugar", "1H": "1er tiempo", HT: "Entretiempo", "2H": "2do tiempo", ET: "Alargue", P: "Penales", FT: "Finalizado", AET: "Finalizado (alargue)", PEN: "Finalizado (penales)", PST: "Postergado", SUSP: "Suspendido" };
const TABS = [["resumen", "Resumen"], ["alineacion", "Alineación"], ["stats", "Estadísticas"], ["comentarios", "Comentarios"]];

function useLiveMatch(league, id) {
  const [model, setModel] = useState(null);
  const [error, setError] = useState("");
  const [goal, setGoal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const fetchedAt = useRef(0);
  const prev = useRef(null); // marcador de la actualización anterior, para detectar goles

  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      let keepGoing = true;
      let interval = POLL_MS.pre;
      try {
        const { data } = await api.get(`/live/${league}/${id}`);
        if (!alive) return;
        fetchedAt.current = Date.now() - (data.ageSeconds || 0) * 1000;
        const cur = { home: data.score.home ?? 0, away: data.score.away ?? 0 };
        if (prev.current && (cur.home > prev.current.home || cur.away > prev.current.away)) {
          const side = cur.home > prev.current.home ? "home" : "away";
          setGoal({ team: data.teams[side]?.name, at: Date.now() });
          playSfx("win");
          setTimeout(() => alive && setGoal(null), 4500);
        }
        prev.current = cur;
        setModel(data);
        setError(data.error || "");
        keepGoing = !data.finished; // un partido terminado no se vuelve a pedir
        interval = data.live ? POLL_MS.live : POLL_MS.pre;
      } catch (e) {
        if (alive) setError(e.response?.data?.error || "No hay conexión con la fuente del partido.");
      }
      if (alive && keepGoing && !document.hidden) timer = setTimeout(tick, interval);
    };
    tick();
    // Al volver a la pestaña se actualiza enseguida (mientras estaba oculta no se pedía nada).
    const onVisible = () => { if (!document.hidden) { clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", onVisible);
    const clock = setInterval(() => setNow(Date.now()), 5000);
    return () => { alive = false; clearTimeout(timer); clearInterval(clock); document.removeEventListener("visibilitychange", onVisible); };
  }, [league, id]);

  const age = model ? Math.max(0, Math.round((now - fetchedAt.current) / 1000)) : null;
  return { model, error, goal, age };
}

function Scoreboard({ m, age, error }) {
  const live = m.live;
  return (
    <div className="rounded-3xl border border-border bg-panel p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Team t={m.teams.home} />
        <div className="text-center min-w-[96px]">
          <p className="text-4xl font-extrabold tabular-nums leading-none">{m.score.home ?? "–"}<span className="text-gray-500 mx-1.5">:</span>{m.score.away ?? "–"}</p>
          {m.score.pens && <p className="text-xs text-gray-400 mt-1">({m.score.pens.home} – {m.score.pens.away} en penales)</p>}
          <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${live ? "bg-red-600 text-white" : "bg-white/10 text-gray-300"}`}>
            {live && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            {live && m.minute != null ? `${m.minute}'${m.stoppage ? `+${m.stoppage}` : ""}` : STATUS_TEXT[m.status] || m.detail}
          </p>
        </div>
        <Team t={m.teams.away} right />
      </div>
      <p className="mt-3 text-center text-xs text-gray-500" role="status">
        {error ? <span className="inline-flex items-center gap-1 text-amber"><WifiOff size={12} /> {error}</span> : live ? `Actualizado hace ${age ?? 0} s` : m.kickoff ? new Date(m.kickoff).toLocaleString("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
        {m.venue ? ` · ${m.venue}` : ""}
      </p>
    </div>
  );
}

function Team({ t, right }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1.5 text-center ${right ? "" : ""}`}>
      {t?.logo ? <img src={t.logo} alt="" className="h-12 w-12 object-contain" /> : <span className="h-12 w-12 rounded-full bg-white/10" />}
      <span className="text-sm font-semibold leading-tight break-words">{t?.name}</span>
    </div>
  );
}

function EventIcon({ type }) {
  if (type === "goal" || type === "pen_goal") return <Goal size={15} className="text-white" />;
  if (type === "own_goal") return <Goal size={15} className="text-red-400" />;
  if (type === "yellow") return <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-yellow-400" />;
  if (type === "red") return <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-red-500" />;
  if (type === "sub") return <ArrowLeftRight size={14} className="text-accent" />;
  return <span className="text-[10px] font-bold text-gray-400">VAR</span>;
}

function Timeline({ m }) {
  if (!m.events.length) return <p className="text-sm text-gray-500">{m.status === "NS" ? "El partido todavía no empezó." : "Todavía no hay eventos."}</p>;
  return (
    <ol className="divide-y divide-border">
      {m.events.map((e) => {
        const left = e.team === "home";
        const text = e.type === "sub"
          ? <><span className="text-good">▲ {e.in}</span> <span className="text-gray-500">▼ {e.out}</span></>
          : <>{e.player}{e.assist ? <span className="text-gray-500"> · asist. {e.assist}</span> : null}{e.type === "pen_goal" ? <span className="text-gray-500"> (pen.)</span> : null}{e.type === "own_goal" ? <span className="text-gray-500"> (en contra)</span> : null}</>;
        return (
          <li key={e.id} className={`flex items-center gap-2 py-2 text-sm ${left ? "" : "flex-row-reverse text-right"}`}>
            <span className="w-12 shrink-0 tabular-nums text-xs text-gray-400 text-center">{e.display || `${e.min}'`}</span>
            <span className="w-5 shrink-0 flex justify-center"><EventIcon type={e.type} /></span>
            <span className="min-w-0 flex-1 break-words">{text}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Token({ p }) {
  const m = p.marks || {};
  return (
    <div className="absolute flex w-[76px] -translate-x-1/2 translate-y-1/2 flex-col items-center" style={{ left: `${p.x}%`, bottom: `${p.y}%` }}>
      <div className="relative">
        <PlayerFace name={p.name} size={40} className="border-2 border-white/80" />
        <span className="absolute -bottom-1 -left-1 min-w-[18px] rounded-full bg-black/80 px-1 text-center text-[11px] font-bold leading-[18px] text-white">{p.number ?? ""}</span>
        <span className="absolute -top-1.5 -right-2 flex gap-0.5">
          {m.goals > 0 && <span className="inline-flex items-center rounded-full bg-white px-1 text-[11px] font-bold text-black leading-4"><Goal size={10} />{m.goals > 1 ? m.goals : ""}</span>}
          {m.yellow > 0 && <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-yellow-400" />}
          {m.red > 0 && <span className="inline-block h-3.5 w-2.5 rounded-[2px] bg-red-500" />}
        </span>
        {p.subbedOut && <span className="absolute -bottom-1 -right-1 rounded-full bg-black/80 p-0.5"><ArrowLeftRight size={10} className="text-red-400" /></span>}
      </div>
      <span className="mt-1 max-w-[76px] truncate rounded bg-black/55 px-1 text-[12px] font-medium leading-4 text-white">{p.short || p.name}</span>
    </div>
  );
}

function Lineup({ m }) {
  const [side, setSide] = useState("home");
  const lineup = m.lineups[side];
  const team = m.teams[side];
  if (!m.lineups.home && !m.lineups.away) return <p className="text-sm text-gray-500">La alineación todavía no está confirmada.</p>;
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5" role="tablist" aria-label="Equipo">
        {["home", "away"].map((s) => (
          <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`flex-1 rounded-xl border py-2 text-sm min-h-[44px] ${side === s ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{m.teams[s]?.name}</button>
        ))}
      </div>
      {lineup ? (
        <>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{lineup.formation ? `Formación ${lineup.formation}${lineup.formationGiven ? "" : " (estimada)"}` : "Formación sin confirmar"}</span>
            <span>{lineup.coach ? `DT: ${lineup.coach}` : ""}{lineup.probable ? " · probable" : ""}</span>
          </div>
          <div className="relative mx-auto aspect-[68/105] w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/20" style={{ background: "repeating-linear-gradient(0deg, #1f6b3a 0 12.5%, #247a42 12.5% 25%)" }} role="img" aria-label={`Alineación de ${team?.name}`}>
            <div className="absolute inset-3 rounded-lg border border-white/30" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-white/30" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
            <div className="absolute bottom-3 left-1/4 right-1/4 h-[15%] border border-white/30 border-b-0" />
            <div className="absolute top-3 left-1/4 right-1/4 h-[15%] border border-white/30 border-t-0" />
            {lineup.starters.map((p) => <Token key={p.id} p={p} />)}
          </div>
          {lineup.bench.length > 0 && (
            <div>
              <p className="t-eyebrow mb-1.5">Banca</p>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {lineup.bench.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl border border-border bg-panel px-2.5 py-1.5 text-sm">
                    <span className="w-6 text-right tabular-nums text-xs text-gray-500">{p.number ?? ""}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.subbedIn && <ArrowLeftRight size={13} className="shrink-0 text-good" aria-label="Ya entró" />}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : <p className="text-sm text-gray-500">Sin alineación de este equipo todavía.</p>}
    </div>
  );
}

const STAT_ROWS = [["possession", "Posesión", "%"], ["shots", "Tiros", ""], ["onTarget", "Al arco", ""], ["corners", "Córners", ""], ["fouls", "Faltas", ""], ["yellow", "Amarillas", ""], ["red", "Rojas", ""], ["offsides", "Offsides", ""], ["saves", "Atajadas", ""]];

function Stats({ m }) {
  const rows = STAT_ROWS.filter(([k]) => m.stats[k]?.some((v) => v !== null));
  if (!rows.length) return <p className="text-sm text-gray-500">Todavía no hay estadísticas.</p>;
  return (
    <div className="space-y-3">
      {rows.map(([k, label, unit]) => {
        const [a, b] = m.stats[k];
        const total = (a || 0) + (b || 0) || 1;
        return (
          <div key={k}>
            <div className="flex items-center justify-between text-sm"><b className="tabular-nums">{a ?? "–"}{unit}</b><span className="text-gray-400 text-xs">{label}</span><b className="tabular-nums">{b ?? "–"}{unit}</b></div>
            <div className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full"><span className="bg-accent" style={{ width: `${((a || 0) / total) * 100}%` }} /><span className="bg-white/25" style={{ width: `${((b || 0) / total) * 100}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function Commentary({ m }) {
  if (!m.commentary.length) return <p className="text-sm text-gray-500">Todavía no hay comentarios.</p>;
  return (
    <ol className="space-y-2">
      {[...m.commentary].reverse().map((c, i) => (
        <li key={i} className="flex gap-2 text-sm"><span className="w-12 shrink-0 text-right text-xs tabular-nums text-gray-500">{c.display}</span><span className="min-w-0 flex-1 break-words text-gray-300">{c.text}</span></li>
      ))}
    </ol>
  );
}

export default function PartidoVivo() {
  const { league, id } = useParams();
  const { model, error, goal, age } = useLiveMatch(league, id);
  const [tab, setTab] = useState("resumen");
  const view = useMemo(() => model, [model]);

  return (
    <Layout exitTo="/futbol">
      <div className="mx-auto max-w-xl space-y-4">
        {goal && (
          <div className="celebrate-pop fixed inset-x-4 top-16 z-50 mx-auto max-w-sm rounded-2xl border border-white/30 bg-accent px-4 py-3 text-center text-onaccent shadow-lg" role="alert">
            <p className="text-2xl font-extrabold">¡GOL!</p>
            <p className="text-sm font-semibold">{goal.team}</p>
          </div>
        )}
        {!view && !error && <p className="text-sm text-gray-500">Cargando el partido…</p>}
        {!view && error && <p className="text-sm text-red-400">{error}</p>}
        {view && (
          <>
            <Scoreboard m={view} age={age} error={error} />
            <div className="flex gap-1 overflow-x-auto" role="tablist">
              {TABS.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm min-h-[44px] ${tab === k ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{label}</button>
              ))}
            </div>
            <div className="rounded-2xl border border-border bg-panel p-4">
              {tab === "resumen" && <Timeline m={view} />}
              {tab === "alineacion" && <Lineup m={view} />}
              {tab === "stats" && <Stats m={view} />}
              {tab === "comentarios" && <Commentary m={view} />}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
