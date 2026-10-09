import { useMemo } from "react";
import PlayerFace from "./PlayerFace.jsx";

// Cancha vertical con los once de un equipo según su formación. Cada puesto (slot) es una
// ficha con la foto, el nivel y el apellido; los puestos vacíos se ven punteados. Si se pasa
// `onSelect`, las fichas se pueden tocar para intercambiarlas de lugar (el padre decide qué hacer).
const ROW_Y = { GK: 88, DEF: 68, MID: 44, FWD: 19 };
const POS_SHORT = { GK: "POR", DEF: "DEF", MID: "MED", FWD: "DEL" };

// Posición (en % de la cancha) de cada slot, repartiendo cada línea a lo ancho.
export function layoutFor(slots) {
  const groups = {};
  slots.forEach((pos, i) => { (groups[pos] ||= []).push(i); });
  const pts = Array(slots.length);
  for (const [pos, idxs] of Object.entries(groups)) {
    idxs.forEach((slotIndex, k) => { pts[slotIndex] = { x: ((k + 1) / (idxs.length + 1)) * 100, y: ROW_Y[pos] ?? 50 }; });
  }
  return pts;
}

const surname = (name) => String(name || "").split(" ").slice(-1)[0];

// `faces`: si una ficha no trae foto propia, se pide la cara del jugador por su nombre.
// `onEmptyClick`: tocar un puesto vacío (para elegir quién lo ocupa).
export default function FormationPitch({ slots, picks = [], selected = null, onSelect = null, onEmptyClick = null, faces = false, className = "" }) {
  const pts = useMemo(() => layoutFor(slots), [slots]);
  return (
    <div className={`relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-white/15 ${className}`} style={{ background: "linear-gradient(180deg, rgb(6 78 59), rgb(4 60 45))" }}>
      <svg viewBox="0 0 100 133" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <rect key={i} x="0" y={i * (133 / 6)} width="100" height={133 / 6} fill={i % 2 === 0 ? "rgba(255,255,255,0.035)" : "transparent"} />
        ))}
        <rect x="2" y="2" width="96" height="129" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
        <line x1="2" y1="66.5" x2="98" y2="66.5" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
        <circle cx="50" cy="66.5" r="11" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
        <rect x="26" y="2" width="48" height="19" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
        <rect x="26" y="112" width="48" height="19" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
        <rect x="38" y="2" width="24" height="7" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
        <rect x="38" y="124" width="24" height="7" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" />
      </svg>
      {slots.map((pos, i) => {
        const pick = picks[i];
        const p = pts[i];
        const isSel = selected === i;
        const can = (!!onSelect && !!pick) || (!!onEmptyClick && !pick);
        const Tag = can ? "button" : "div";
        return (
          <Tag
            key={i}
            {...(can ? { type: "button", onClick: () => (pick ? onSelect(i) : onEmptyClick(i)), "aria-label": pick ? `${pick.name}, ${POS_SHORT[pos]}. Tocá para cambiarlo` : `Puesto vacío de ${POS_SHORT[pos]}. Tocá para elegir un jugador` } : {})}
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-[19%] ${can ? "cursor-pointer" : ""}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center overflow-hidden transition-all ${pick ? "bg-white/90 border-2 border-white" : "border-2 border-dashed border-white/40 bg-black/15"} ${isSel ? "ring-4 ring-amber-400 scale-110" : ""}`}>
              {pick?.photo
                ? <img src={pick.photo} alt="" draggable={false} className="h-full w-auto object-cover object-top select-none pointer-events-none" />
                : pick && faces
                ? <PlayerFace name={pick.name} size={44} className="!bg-transparent" />
                : <span className={`text-[10px] font-bold ${pick ? "text-gray-700" : "text-white/70"}`}>{pick ? (pick.name || "?")[0] : POS_SHORT[pos]}</span>}
              {pick && <span className="absolute -bottom-0.5 -right-0.5 text-[9px] font-extrabold leading-none rounded-full bg-emerald-700 text-white px-1 py-0.5">{pick.ovr}</span>}
            </span>
            <span className="mt-0.5 text-[10px] leading-tight font-semibold text-white drop-shadow max-w-full truncate">{pick ? surname(pick.name) : ""}</span>
          </Tag>
        );
      })}
    </div>
  );
}
