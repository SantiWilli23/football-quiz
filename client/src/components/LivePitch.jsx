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
const LINE_X = { GK: 6, DEF: 20, MID: 34, FWD: 46 }; // % de la cancha, para el local; el visitante se espeja
const PULL = { GK: 0.02, DEF: 0.1, MID: 0.2, FWD: 0.3 }; // cuánto sigue cada línea a la pelota
// Velocidades en % de la cancha por segundo REAL: no dependen de la velocidad del reloj (×1/×2/×4), así
// los jugadores corren siempre igual y solo el minuto del partido pasa más rápido.
const PLAYER_SPEED = 13;
const BALL_SPEED = 140;
const surname = (n) => String(n || "").split(" ").slice(-1)[0];

function dotsFor(xi, side) {
  const rows = { GK: [], DEF: [], MID: [], FWD: [] };
  (xi || []).forEach((p) => (rows[p.pos] || rows.MID).push(p));
  const out = [];
  for (const [pos, list] of Object.entries(rows)) {
    list.forEach((p, k) => {
      const x = LINE_X[pos];
      // Los jugadores de una línea se reparten en el ancho (de 12% a 88%); el arquero va al centro.
      const y = list.length === 1 ? 50 : 12 + ((k + 0.5) / list.length) * 76;
      out.push({ key: `${side}-${pos}-${k}`, name: p.name, pos, side, x: side === "home" ? x : 100 - x, y });
    });
  }
  return out;
}

export default function LivePitch({ home, away, match, onDone, speed = 1 }) {
  const [minute, setMinute] = useState(0);
  const [rate, setRate] = useState(speed);
  const [holder, setHolder] = useState(null); // key del jugador que tiene la pelota
  const doneRef = useRef(false);
  const minuteRef = useRef(0);
  const nodes = useRef({}); // key -> <g> de cada jugador
  const ballNode = useRef(null);

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

  const homeDots = useMemo(() => dotsFor(home.xi, "home"), [home]);
  const awayDots = useMemo(() => dotsFor(away.xi, "away"), [away]);
  const all = useMemo(() => [...homeDots, ...awayDots], [homeDots, awayDots]);

  useEffect(() => {
    doneRef.current = false;
    setMinute(0);
  }, [match]);

  useEffect(() => { minuteRef.current = minute; }, [minute]);

  useEffect(() => {
    if (minute >= 90) {
      if (!doneRef.current) { doneRef.current = true; const t = setTimeout(() => onDone?.(), 900); return () => clearTimeout(t); }
      return undefined;
    }
    const id = setTimeout(() => setMinute((m) => Math.min(90, m + 1)), (minute === 45 ? 900 : 230) / rate);
    return () => clearTimeout(id);
  }, [minute, rate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Movimiento: en cada cuadro, jugadores y pelota avanzan hacia su objetivo a velocidad propia. El objetivo
  // sale del minuto actual, pero la velocidad no depende de él.
  useEffect(() => {
    const cur = {};
    all.forEach((d) => { cur[d.key] = { x: d.x, y: d.y }; });
    const ball = { x: 50, y: 50 };
    let last = performance.now();
    let raf = 0;
    let holderKey = null;
    const step = (c, tx, ty, max) => {
      const dx = tx - c.x, dy = ty - c.y, dist = Math.hypot(dx, dy);
      if (dist <= max) { c.x = tx; c.y = ty; } else { c.x += (dx / dist) * max; c.y += (dy / dist) * max; }
    };
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = track[Math.min(90, minuteRef.current)];
      step(ball, t.x, t.y, BALL_SPEED * dt);
      let best = null, bestD = Infinity;
      for (const d of all) {
        const c = cur[d.key];
        const pull = PULL[d.pos];
        let tx = d.x + (t.x - d.x) * pull;
        const ty = d.y + (t.y - d.y) * pull * 0.8;
        tx = d.side === "home" ? Math.min(72, tx) : Math.max(28, tx);
        step(c, tx, ty, PLAYER_SPEED * dt);
        const node = nodes.current[d.key];
        if (node) node.setAttribute("transform", `translate(${(c.x / 100) * W} ${(c.y / 100) * H})`);
        if (d.side === t.attacker && d.pos !== "GK") {
          const dd = Math.hypot(c.x - ball.x, c.y - ball.y);
          if (dd < bestD) { bestD = dd; best = d.key; }
        }
      }
      if (best !== holderKey) { holderKey = best; setHolder(best); }
      if (ballNode.current) ballNode.current.setAttribute("transform", `translate(${(ball.x / 100) * W} ${(ball.y / 100) * H})`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [all, track]);

  const t = track[minute];
  const shown = events.filter((e) => e.min <= minute);
  const goalsHome = shown.filter((e) => e.type === "goal" && e.team === "home").length;
  const goalsAway = shown.filter((e) => e.type === "goal" && e.team === "away").length;
  const last = shown[shown.length - 1];
  const justNow = last && minute - last.min <= 2 ? last : null;
  const GOLD = "rgb(253 224 71)";
  const place = (d, color) => {
    const has = holder === d.key;
    return (
      <g key={d.key} ref={(el) => { nodes.current[d.key] = el; }} transform={`translate(${(d.x / 100) * W} ${(d.y / 100) * H})`}>
        {has && <circle r="17" fill={GOLD} className="live-glow" />}
        <circle r="9" fill={color} stroke={has ? GOLD : "rgba(255,255,255,0.85)"} strokeWidth={has ? 3 : 1.5} />
        <text y="19" textAnchor="middle" fontSize="8" fill={has ? GOLD : "rgba(255,255,255,0.85)"} fontWeight={has ? 700 : 400}>{surname(d.name).slice(0, 9)}</text>
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
      <style>{".live-glow{transform-box:fill-box;transform-origin:center;animation:live-glow 1s ease-in-out infinite}@keyframes live-glow{0%,100%{transform:scale(.8);opacity:.25}50%{transform:scale(1.4);opacity:.65}}"}</style>
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
        <g ref={ballNode} transform={`translate(${W / 2} ${H / 2})`}>
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
