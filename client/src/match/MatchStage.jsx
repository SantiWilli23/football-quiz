import { useEffect, useMemo, useRef, useState } from "react";
import { FastForward } from "lucide-react";
import { playGoal, playWhistle, playSfx } from "../utils/sfx.js";
import { Timeline } from "./parts.jsx";
import { scoreOf } from "./simMatch.js";

// Visor único de partidos simulados (Futotal 2.0). Recibe un SimMatch (ver simMatch.js) y lo
// reproduce: marcador, cancha con la pelota, avisos de gol / peligro / tarjetas / cambios,
// línea de tiempo, velocidades x1 · x2 · x4 y «Saltar». `onDone` se llama UNA sola vez, al
// terminar o al saltar. En modo `live` no hay reloj propio: se anima cada evento a medida que
// llega. Con prefers-reduced-motion no hay movimiento y los eventos aparecen directo.
const PITCH = { w: 600, h: 380 };
const CENTER = { x: PITCH.w / 2, y: PITCH.h / 2 };
const MINUTE_MS = 90; // x1: ~8 s el partido completo
const HOLD_MS = { shootout_kick: 700, goal: 900, pen_goal: 900, own_goal: 900, chance: 600, save: 600, pen_miss: 700, yellow: 700, red: 900, sub: 600, injury: 700, ht: 1100, ft: 1100, kickoff: 700 };
const SPEEDS = [1, 2, 4];

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const attacksRight = (team) => team === "home";

// Punto de la cancha para cada tipo de evento (si el evento trae x e y de 0 a 100, se usan).
function spot(e) {
  if (e.x != null && e.y != null) return { x: (e.x / 100) * PITCH.w, y: (e.y / 100) * PITCH.h };
  const right = attacksRight(e.team);
  const jitter = (n) => CENTER.y + (((e.min * 37 + n) % 60) - 30);
  if (e.type === "goal" || e.type === "pen_goal") return { x: right ? PITCH.w - 34 : 34, y: jitter(7) };
  if (e.type === "own_goal") return { x: right ? 34 : PITCH.w - 34, y: jitter(13) };
  if (e.type === "chance" || e.type === "save" || e.type === "pen_miss") return { x: right ? PITCH.w - 120 : 120, y: jitter(3) };
  return CENTER;
}

const BANNER = {
  goal: (e, m) => ({ big: "¡GOL!", small: [e.player, m.teams[e.team]?.name].filter(Boolean).join(" · "), tone: "text-amber" }),
  pen_goal: (e, m) => ({ big: "¡GOL DE PENAL!", small: [e.player, m.teams[e.team]?.name].filter(Boolean).join(" · "), tone: "text-amber" }),
  own_goal: (e) => ({ big: "¡GOL EN CONTRA!", small: e.player || "", tone: "text-red-400" }),
  chance: (e, m) => ({ big: `Peligro de ${m.teams[e.team]?.short || m.teams[e.team]?.name || "gol"}`, small: e.player || "", tone: "text-white" }),
  save: (e) => ({ big: "¡Atajó el arquero!", small: e.player || "", tone: "text-white" }),
  pen_miss: () => ({ big: "¡Penal fallado!", small: "", tone: "text-red-400" }),
  yellow: (e) => ({ big: "Tarjeta amarilla", small: e.player || "", tone: "text-yellow-400" }),
  red: (e) => ({ big: "Tarjeta roja", small: e.player || "", tone: "text-red-500" }),
  sub: (e) => ({ big: "Cambio", small: [e.in && `▲ ${e.in}`, e.out && `▼ ${e.out}`].filter(Boolean).join("  "), tone: "text-accent" }),
  injury: (e) => ({ big: "Lesión", small: e.player || "", tone: "text-red-400" }),
  ht: () => ({ big: "Entretiempo", small: "", tone: "text-white" }),
  ft: (_e, _m, score) => ({ big: "Final del partido", small: `${score.home} – ${score.away}`, tone: "text-white" }),
  kickoff: () => ({ big: "¡Pitazo inicial!", small: "", tone: "text-white" }),
  shootout_kick: (e) => ({ big: e.scored ? "¡Gol de penal!" : "¡Atajado!", small: e.player || "", tone: e.scored ? "text-amber" : "text-red-400" }),
};

function Dot({ team }) {
  const [a, b] = team.colors || [];
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/40" style={{ background: a || "rgb(var(--c-accent))", boxShadow: b ? `inset -3px 0 0 ${b}` : undefined }} aria-hidden="true" />;
}

export default function MatchStage({ match, live = false, onDone, controls = true, children }) {
  // En replay el partido se identifica por su `id`: si el padre vuelve a armar el objeto (mismo
  // partido, otra referencia) el reloj NO se reinicia ni se vuelve a llamar a `onDone`. En vivo
  // cuenta la cantidad de eventos, que es lo que cambia.
  const identity = live ? `live-${(match.events || []).length}` : match.id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events = useMemo(() => [...(match.events || [])].sort((a, b) => a.min - b.min), [identity]);
  const duration = match.duration || 90;
  const [speed, setSpeed] = useState(match.playback?.speed || 1);
  const [minute, setMinute] = useState(0);
  const [cursor, setCursor] = useState(0); // cuántos eventos ya se mostraron
  const [focus, setFocus] = useState(null); // { e, key }: evento que se está destacando
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const noMotion = useMemo(reduced, []);

  const shown = events.slice(0, cursor);
  const score = scoreOf(shown);
  const pens = { home: shown.filter((e) => e.type === "shootout_kick" && e.scored && e.team === "home").length, away: shown.filter((e) => e.type === "shootout_kick" && e.scored && e.team === "away").length };
  const last = shown[shown.length - 1];

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    setTimeout(() => onDone?.(), 350);
  }

  // Reloj de reproducción (solo en modo replay).
  useEffect(() => {
    if (live) return undefined;
    doneRef.current = false;
    setDone(false); setMinute(0); setCursor(0); setFocus(null);
    let m = 0;
    let c = 0;
    let timer;
    const revealOne = () => {
      const e = events[c];
      c += 1;
      setCursor(c);
      setFocus({ e, key: `${c}-${e.type}` });
      if (e.type === "goal" || e.type === "pen_goal" || e.type === "own_goal") playGoal();
      else if (e.type === "shootout_kick") playSfx(e.scored ? "ok" : "bad");
      else if (e.type === "ht" || e.type === "ft" || e.type === "kickoff") playWhistle(e.type === "ft");
      else if (e.type === "yellow" || e.type === "red") playSfx("tick");
    };
    // Los penales de la definición se muestran de a uno, no todos juntos.
    const reveal = (upTo) => { while (c < events.length && events[c].min <= upTo && events[c].type !== "shootout_kick") revealOne(); };
    const step = () => {
      if (doneRef.current) return; // «Saltar» ya mostró todo: el reloj no vuelve a tocar nada
      reveal(m);
      if (c < events.length && events[c].type === "shootout_kick" && m >= duration) {
        revealOne();
        timer = setTimeout(step, noMotion ? 25 : 700 / speedRef.current);
        return;
      }
      if (m >= duration || c >= events.length && m >= (events[events.length - 1]?.min ?? 0)) {
        setMinute(Math.min(m, duration));
        finish();
        return;
      }
      m += 1;
      setMinute(m);
      timer = setTimeout(step, noMotion ? 25 : MINUTE_MS / speedRef.current);
    };
    step();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, live]);

  // Modo en vivo: cada evento nuevo se destaca al llegar.
  const seen = useRef(0);
  useEffect(() => {
    if (!live) return;
    if (events.length < seen.current) seen.current = 0;
    const fresh = events.slice(seen.current);
    seen.current = events.length;
    setCursor(events.length);
    setMinute(events[events.length - 1]?.min ?? 0);
    // Si de golpe llegan muchos (reconexión), solo se anima el último; el resto aparece sin animar.
    const lastFresh = fresh[fresh.length - 1];
    if (lastFresh) { setFocus({ e: lastFresh, key: `${events.length}-${lastFresh.type}` }); if (lastFresh.type === "goal") playGoal(); }
    if (events[events.length - 1]?.type === "ft") finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, live]);

  // El destaque dura un rato y se apaga solo.
  useEffect(() => {
    if (!focus) return undefined;
    const t = setTimeout(() => setFocus((f) => (f && f.key === focus.key ? null : f)), (HOLD_MS[focus.e.type] || 700) / (live ? 1 : speed));
    return () => clearTimeout(t);
  }, [focus, speed, live]);

  function skip() {
    if (live || doneRef.current) return;
    setCursor(events.length);
    setMinute(duration);
    setFocus(null);
    finish();
  }

  const f = focus?.e;
  const banner = f && BANNER[f.type] ? BANNER[f.type](f, match, score) : null;
  const goalFx = f && (f.type === "goal" || f.type === "pen_goal" || f.type === "own_goal");
  const ball = f && !noMotion ? spot(f) : { x: CENTER.x, y: CENTER.y + Math.sin(minute / 3) * 14 };
  const home = match.teams.home;
  const away = match.teams.away;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-emerald-900/40 to-emerald-950/40">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-black/30 px-4 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-1.5 font-medium"><Dot team={home} /><span className="truncate">{home.name}</span></span>
          <span key={`${score.home}-${score.away}`} className={`px-3 text-center text-xl font-extrabold tabular-nums ${goalFx ? "fq-pop" : ""}`}>{score.home} – {score.away}{pens.home + pens.away > 0 && <small className="block text-[11px] font-semibold text-gray-400">pen. {pens.home}–{pens.away}</small>}</span>
          <span className="flex min-w-0 items-center justify-end gap-1.5 text-right font-medium"><span className="truncate">{away.name}</span><Dot team={away} /></span>
        </div>
        <div className="relative">
          <svg viewBox={`0 0 ${PITCH.w} ${PITCH.h}`} className="block h-auto w-full" role="img" aria-label={`Cancha del partido ${home.name} contra ${away.name}`}>
            <rect width={PITCH.w} height={PITCH.h} fill="rgb(6 78 59)" />
            {Array.from({ length: 6 }).map((_, i) => <rect key={i} x={i * (PITCH.w / 6)} y="0" width={PITCH.w / 6} height={PITCH.h} fill={i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent"} />)}
            <rect x="1" y="1" width={PITCH.w - 2} height={PITCH.h - 2} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
            <line x1={CENTER.x} y1="0" x2={CENTER.x} y2={PITCH.h} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
            <circle cx={CENTER.x} cy={CENTER.y} r="48" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
            {["home", "away"].map((side) => {
              const isHome = side === "home";
              const scoredHere = goalFx && ((f.type === "own_goal" ? f.team === side : f.team !== side));
              return (
                <g key={side}>
                  <rect x={isHome ? -2 : PITCH.w - 118} y={PITCH.h / 2 - 70} width="120" height="140" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                  <rect x={isHome ? -6 : PITCH.w - 6} y={PITCH.h / 2 - 28} width="12" height="56" fill={scoredHere ? "rgb(var(--c-amber))" : "rgba(255,255,255,0.55)"} style={{ transition: "fill 0.15s" }} />
                </g>
              );
            })}
            <g style={{ transform: `translate(${ball.x}px, ${ball.y}px)`, transition: noMotion ? "none" : "transform 0.45s cubic-bezier(.3,.8,.4,1)" }}>
              <circle r="7" fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
            </g>
          </svg>
          {banner && !noMotion && (
            <div key={focus.key} className={`fq-flash pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-3 text-center`} aria-hidden="true">
              <p className={`text-3xl font-black tracking-wide drop-shadow ${banner.tone}`}>{banner.big}</p>
              {banner.small && <p className="mt-0.5 text-sm font-semibold text-white/90 drop-shadow">{banner.small}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 bg-black/20 px-4 py-2 text-xs text-gray-400">
          <span aria-live="polite">{done || last?.type === "ft" ? "Final del partido" : last?.type === "ht" ? "Entretiempo" : `Minuto ${Math.min(minute, duration)}'`}</span>
          {controls && !live && (
            <span className="flex items-center gap-1.5">
              {SPEEDS.map((s) => (
                <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`rounded-full border px-2 py-0.5 tabular-nums ${speed === s ? "border-accent bg-accent/15 text-white" : "border-border"}`}>x{s}</button>
              ))}
              <button onClick={skip} disabled={done} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 hover:text-white disabled:opacity-40"><FastForward size={11} /> Saltar</button>
            </span>
          )}
        </div>
      </div>
      {children}
      <div className="max-h-64 overflow-y-auto rounded-2xl border border-border bg-panel p-3">
        <Timeline events={shown} empty="Todavía no hay eventos." />
      </div>
    </div>
  );
}
