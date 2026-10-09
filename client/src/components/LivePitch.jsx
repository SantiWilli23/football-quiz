import { useEffect, useMemo, useRef, useState } from "react";

// Partido minuto a minuto en una cancha horizontal con los 22 jugadores y la pelota, como la simulación
// del 8a2. El local ataca hacia la derecha y el visitante hacia la izquierda. Antes de cada gol o
// de cada ocasión la pelota va acercándose al arco que va a atacar, y se avisa "Peligro de X", así se ve
// para qué lado puede haber gol. La reproducción es determinística: se precalcula el recorrido de la pelota.
//
// Props:
//  home / away: { name, xi: [{ name, pos }] }
//  match: { goalsA, goalsB, scorersA, scorersB, minsA, minsB, chances: [{ min, team: "a" | "b" }] }
//  onDone: se llama al llegar al minuto 90 (o al saltar el partido)
const W = 600;
const H = 380;
const LINE_X = { GK: 7, DEF: 19, MID: 33, FWD: 45 }; // % de la cancha, para el local; el visitante se espeja
const PULL = { GK: 0.03, DEF: 0.12, MID: 0.24, FWD: 0.34 }; // cuánto sigue cada línea a la pelota
const surname = (n) => String(n || "").split(" ").slice(-1)[0];

function dotsFor(xi, side) {
  const rows = { GK: [], DEF: [], MID: [], FWD: [] };
  (xi || []).forEach((p) => (rows[p.pos] || rows.MID).push(p));
  const out = [];
  for (const [pos, list] of Object.entries(rows)) {
    list.forEach((p, k) => {
      const x = LINE_X[pos];
      out.push({ name: p.name, pos, x: side === "home" ? x : 100 - x, y: ((k + 1) / (list.length + 1)) * 100 });
    });
  }
  return out;
}

export default function LivePitch({ home, away, match, onDone, speed = 1 }) {
  const [minute, setMinute] = useState(0);
  const [rate, setRate] = useState(speed);
  const doneRef = useRef(false);

  // Eventos del partido: goles (con minuto y goleador) y ocasiones sin gol.
  const events = useMemo(() => {
    const ev = [];
    (match.minsA || []).forEach((m, i) => ev.push({ min: m, team: "home", type: "goal", who: match.scorersA?.[i] }));
    (match.minsB || []).forEach((m, i) => ev.push({ min: m, team: "away", type: "goal", who: match.scorersB?.[i] }));
    (match.chances || []).forEach((c) => ev.push({ min: c.min, team: c.team === "a" || c.team === match.a ? "home" : "away", type: "chance" }));
    return ev.sort((x, y) => x.min - y.min);
  }, [match]);

  // Recorrido de la pelota minuto a minuto (0..90).
  const track = useMemo(() => {
    let seed = (match.goalsA * 7 + match.goalsB * 13 + (match.minsA?.[0] || 3) + (match.minsB?.[0] || 5)) % 997 || 11;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const out = [];
    for (let m = 0; m <= 90; m++) {
      const next = events.find((e) => e.min >= m && e.min - m <= 4);
      let x, attacker, y = 50 + (rnd() - 0.5) * 44;
      if (next) {
        const d = next.min - m;
        attacker = next.team;
        const depth = next.type === "goal" ? 93 - d * 7 : 88 - d * 8;
        x = next.team === "home" ? depth : 100 - depth;
        if (d === 0 && next.type === "goal") x = next.team === "home" ? 98.5 : 1.5;
        if (d === 0) y = 50 + (rnd() - 0.5) * 18;
      } else {
        x = 50 + Math.sin(m * 0.7 + seed) * 17 + (rnd() - 0.5) * 10;
        attacker = x >= 50 ? "home" : "away";
      }
      out.push({ x, y, attacker, danger: attacker === "home" ? x > 72 : x < 28 });
    }
    return out;
  }, [events, match]);

  useEffect(() => {
    doneRef.current = false;
    setMinute(0);
  }, [match]);

  useEffect(() => {
    if (minute >= 90) {
      if (!doneRef.current) { doneRef.current = true; const t = setTimeout(() => onDone?.(), 900); return () => clearTimeout(t); }
      return undefined;
    }
    const id = setTimeout(() => setMinute((m) => Math.min(90, m + 1)), (minute === 45 ? 900 : 230) / rate);
    return () => clearTimeout(id);
  }, [minute, rate]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = track[minute];
  const shown = events.filter((e) => e.min <= minute);
  const goalsHome = shown.filter((e) => e.type === "goal" && e.team === "home").length;
  const goalsAway = shown.filter((e) => e.type === "goal" && e.team === "away").length;
  const last = shown[shown.length - 1];
  const justNow = last && minute - last.min <= 2 ? last : null;
  const homeDots = useMemo(() => dotsFor(home.xi, "home"), [home]);
  const awayDots = useMemo(() => dotsFor(away.xi, "away"), [away]);
  const bx = (t.x / 100) * W;
  const by = (t.y / 100) * H;
  const place = (d, color) => {
    const pull = PULL[d.pos];
    const px = ((d.x + (t.x - d.x) * pull) / 100) * W;
    const py = ((d.y + (t.y - d.y) * pull * 0.8) / 100) * H;
    return (
      <g key={`${color}-${d.name}-${d.pos}-${d.x}-${d.y}`} style={{ transform: `translate(${px}px, ${py}px)`, transition: "transform 0.6s ease-out" }}>
        <circle r="9" fill={color} stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" />
        <text y="19" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.85)">{surname(d.name).slice(0, 9)}</text>
      </g>
    );
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-emerald-950/40">
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/30 text-sm">
        <span className="font-semibold truncate flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400" />{home.name}</span>
        <span className="font-extrabold tabular-nums text-xl px-3">{goalsHome} – {goalsAway}</span>
        <span className="font-semibold truncate text-right flex items-center gap-1.5 justify-end">{away.name}<span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400" /></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Cancha del partido en vivo">
        <rect width={W} height={H} fill="rgb(6 78 59)" />
        {Array.from({ length: 8 }).map((_, i) => <rect key={i} x={i * (W / 8)} width={W / 8} height={H} fill={i % 2 === 0 ? "rgba(255,255,255,0.035)" : "transparent"} />)}
        <rect x="2" y="2" width={W - 4} height={H - 4} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <line x1={W / 2} y1="2" x2={W / 2} y2={H - 2} stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <circle cx={W / 2} cy={H / 2} r="46" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <rect x="2" y={H / 2 - 74} width="104" height="148" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <rect x={W - 106} y={H / 2 - 74} width="104" height="148" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
        <rect x="-4" y={H / 2 - 26} width="10" height="52" fill={justNow?.type === "goal" && justNow.team === "away" ? "rgb(251 191 36)" : "rgba(255,255,255,0.6)"} />
        <rect x={W - 6} y={H / 2 - 26} width="10" height="52" fill={justNow?.type === "goal" && justNow.team === "home" ? "rgb(251 191 36)" : "rgba(255,255,255,0.6)"} />
        {homeDots.map((d) => place(d, "rgb(56 189 248)"))}
        {awayDots.map((d) => place(d, "rgb(251 113 133)"))}
        <g style={{ transform: `translate(${bx}px, ${by}px)`, transition: "transform 0.5s cubic-bezier(.3,.8,.4,1)" }}>
          <circle r="7" fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" />
        </g>
        {justNow?.type === "goal" && minute - justNow.min <= 1 && (
          <text x={W / 2} y="38" textAnchor="middle" fontSize="26" fontWeight="800" fill="rgb(251 191 36)">¡GOOOL!</text>
        )}
      </svg>
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-black/25 text-xs">
        <span className="tabular-nums font-semibold text-sm">{minute >= 90 ? "Final" : minute === 45 ? "Entretiempo" : `${minute}'`}</span>
        <span className={`flex-1 text-center truncate ${t.danger && minute < 90 ? "text-amber-300 font-semibold" : "text-gray-400"}`}>
          {justNow?.type === "goal"
            ? `Gol de ${justNow.who || "—"} (${justNow.team === "home" ? home.name : away.name})`
            : justNow?.type === "chance" && minute - justNow.min <= 1
              ? `Ocasión de ${justNow.team === "home" ? home.name : away.name}: no entró`
              : t.danger && minute < 90
                ? `Peligro de ${t.attacker === "home" ? home.name : away.name}`
                : minute < 90 ? "Juego en el medio" : ""}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {[1, 2, 4].map((r) => (
            <button key={r} type="button" onClick={() => setRate(r)} aria-pressed={rate === r} className={`px-2 py-0.5 rounded-full border ${rate === r ? "border-accent text-accent" : "border-white/20 text-gray-400"}`}>×{r}</button>
          ))}
          <button type="button" onClick={() => setMinute(90)} className="px-2 py-0.5 rounded-full border border-white/20 text-gray-300">Saltar</button>
        </span>
      </div>
      {shown.some((e) => e.type === "goal") && (
        <ul className="px-4 py-2 text-xs text-gray-300 space-y-0.5 bg-black/15">
          {shown.filter((e) => e.type === "goal").map((e, i) => (
            <li key={i}>⚽ {e.min}' {e.who || "—"} <span className="text-gray-500">({e.team === "home" ? home.name : away.name})</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
