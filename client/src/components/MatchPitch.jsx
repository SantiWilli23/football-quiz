import { useEffect, useMemo, useRef, useState } from "react";

// Cancha animada compartida — la usa Cartas hoy, y es la misma pieza que
// después van a reusar DT League/Cotrero/Presidente cuando migren al motor
// de simulación único (server/utils/match-engine.js). Recibe la línea de
// tiempo que ya devuelve ese motor ({min, team, type, text}) y la reproduce
// en cámara rápida (90 minutos simulados en ~9 segundos reales) en vez de
// tirar el resultado final de una.
//
// Cancha en SVG de 600x380: el equipo "home" ataca hacia la derecha, el
// equipo "away" hacia la izquierda. La pelota viaja al arco contrario en
// cada gol y hay un flash en la red; el resto del tiempo hace un leve
// vaivén en el círculo central para que no se sienta estática.
const PITCH = { w: 600, h: 380 };
const CENTER = { x: PITCH.w / 2, y: PITCH.h / 2 };
const GOAL_X = { home: PITCH.w - 34, away: 34 }; // adonde va la pelota cuando convierte ese equipo
const MINUTE_MS = 90; // velocidad de reproducción: ~8s el partido completo

export default function MatchPitch({ events, homeLabel, awayLabel, onDone }) {
  const [minute, setMinute] = useState(0);
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const [flash, setFlash] = useState(null); // "home" | "away" | null
  const [ball, setBall] = useState(CENTER);
  const doneRef = useRef(false);

  const sorted = useMemo(() => [...(events || [])].sort((a, b) => a.min - b.min), [events]);

  useEffect(() => {
    doneRef.current = false;
    setMinute(0); setScoreHome(0); setScoreAway(0); setFlash(null); setBall(CENTER);
    const fired = new Set();

    const id = setInterval(() => {
      setMinute((m) => {
        const next = m + 1;
        sorted.forEach((ev, i) => {
          if (ev.min !== next || fired.has(i)) return;
          fired.add(i);
          if (ev.type === "goal") {
            setBall({ x: GOAL_X[ev.team], y: CENTER.y + (Math.random() * 60 - 30) });
            setFlash(ev.team);
            if (ev.team === "home") setScoreHome((s) => s + 1); else setScoreAway((s) => s + 1);
            setTimeout(() => { setFlash(null); setBall(CENTER); }, 550);
          }
        });
        if (next >= 90) {
          clearInterval(id);
          if (!doneRef.current) { doneRef.current = true; setTimeout(() => onDone?.(), 400); }
          return 90;
        }
        return next;
      });
    }, MINUTE_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted]);

  // Vaivén ambiental de la pelota en el círculo central cuando no hay gol.
  const idleBob = flash ? 0 : Math.sin(minute / 3) * 14;

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-gradient-to-b from-emerald-900/40 to-emerald-950/40">
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/30 text-sm">
        <span className="font-medium truncate">{homeLabel}</span>
        <span className="font-bold tabular-nums text-lg px-3">{scoreHome} – {scoreAway}</span>
        <span className="font-medium truncate text-right">{awayLabel}</span>
      </div>
      <svg viewBox={`0 0 ${PITCH.w} ${PITCH.h}`} className="w-full h-auto block" aria-label="Cancha animada del partido">
        <rect width={PITCH.w} height={PITCH.h} fill="rgb(6 78 59)" />
        {/* rayado de cancha */}
        {Array.from({ length: 6 }).map((_, i) => (
          <rect key={i} x={i * (PITCH.w / 6)} y="0" width={PITCH.w / 6} height={PITCH.h} fill={i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent"} />
        ))}
        <rect x="1" y="1" width={PITCH.w - 2} height={PITCH.h - 2} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <line x1={CENTER.x} y1="0" x2={CENTER.x} y2={PITCH.h} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <circle cx={CENTER.x} cy={CENTER.y} r="48" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        {/* áreas y arcos */}
        {["home", "away"].map((side) => {
          const isHome = side === "home";
          const boxX = isHome ? -2 : PITCH.w - 118;
          return (
            <g key={side}>
              <rect x={boxX} y={PITCH.h / 2 - 70} width="120" height="140" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
              <rect
                x={isHome ? -6 : PITCH.w - 6}
                y={PITCH.h / 2 - 28}
                width="12" height="56"
                fill={flash === side ? "rgb(var(--c-amber))" : "rgba(255,255,255,0.55)"}
                style={{ transition: "fill 0.15s" }}
              />
            </g>
          );
        })}
        {/* pelota */}
        <g style={{ transform: `translate(${ball.x}px, ${ball.y + idleBob}px)`, transition: "transform 0.5s cubic-bezier(.3,.8,.4,1)" }}>
          <circle r="7" fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
        </g>
        {flash && (
          <text x={GOAL_X[flash]} y={CENTER.y - 50} textAnchor="middle" fontSize="20" fontWeight="700" fill="rgb(var(--c-amber))">¡GOL!</text>
        )}
      </svg>
      <div className="px-4 py-2 bg-black/20 text-xs text-gray-400 flex justify-between">
        <span>{minute < 90 ? `Minuto ${minute}'` : "Final del partido"}</span>
        {minute === 45 && <span>⏸ Entretiempo</span>}
      </div>
    </div>
  );
}
