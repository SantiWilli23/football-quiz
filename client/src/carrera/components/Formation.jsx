import { useMemo, useRef, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { effectiveOvr, positionPenalty, positionLabel } from "../engine/positions.js";

function lastName(name) { return name.split(" ").slice(-1)[0]; }

// Ubica cada slot en la cancha por "línea" (según su posición) y reparte el
// ancho entre los que comparten línea, respetando lado (zurdo/diestro). Esta
// es sólo la posición DE ARRANQUE de cada formación preestablecida — el
// usuario puede arrastrar cada jugador a cualquier otro punto de la cancha
// para armar su propia disposición a partir de ahí.
const LINE_Y = { GK: 91, CB: 74, LB: 74, RB: 74, CDM: 60, CM: 50, CAM: 38, LW: 20, RW: 20, ST: 12 };
const SIDE = { LB: -1, LW: -1, RB: 1, RW: 1 };
const SPREAD = { 1: [50], 2: [34, 66], 3: [22, 50, 78], 4: [16, 38, 62, 84], 5: [12, 31, 50, 69, 88] };

function layoutSlots(slots) {
  const lines = {};
  slots.forEach((s, i) => {
    const y = LINE_Y[s.slot] ?? 50;
    (lines[y] = lines[y] || []).push({ ...s, i });
  });
  const coords = new Array(slots.length);
  Object.entries(lines).forEach(([y, items]) => {
    const left = items.filter((it) => SIDE[it.slot] === -1);
    const right = items.filter((it) => SIDE[it.slot] === 1);
    const center = items.filter((it) => !SIDE[it.slot]);
    left.forEach((it) => { coords[it.i] = { x: 14, y: Number(y) }; });
    right.forEach((it) => { coords[it.i] = { x: 86, y: Number(y) }; });
    const spread = SPREAD[center.length] || SPREAD[3];
    center.forEach((it, idx) => { coords[it.i] = { x: spread[idx] ?? 50, y: Number(y) }; });
  });
  return coords;
}

function clampPct(v) { return Math.min(95, Math.max(5, v)); }
const DRAG_THRESHOLD = 6;

// A qué posición corresponde soltar al jugador en tal punto de la cancha.
// Son los puntos medios entre las líneas de LINE_Y: si lo soltás más cerca
// de la línea de ataque que de la de mediocampo, pasa a jugar de delantero
// (con la penalización que le toque si no es lo suyo), y así con el resto.
function nearestPositionForDrop(x, y) {
  if (y >= 82.5) return "GK";
  if (y >= 67) return x < 30 ? "LB" : x > 70 ? "RB" : "CB";
  if (y >= 55) return "CDM";
  if (y >= 44) return "CM";
  if (y >= 29) return "CAM";
  if (y >= 16) return x < 50 ? "LW" : "RW";
  return "ST";
}

export default function Formation() {
  const { state, formations, setFormation, assignSlot, setSlotPosition, resetLineupPositions, moveToBench, moveToReserves } = useCareer();
  // Intercambio de dos toques: primero tocás un titular (queda resaltado),
  // después tocás a cualquier otro jugador (titular, banca o reserva) y se
  // cambian de lugar. Nada de menús — es la misma lógica que mover fichas.
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [dragPos, setDragPos] = useState(null); // { index, x, y } — posición en vivo mientras se arrastra
  const pitchRef = useRef(null);
  const dragRef = useRef(null);

  const byId = useMemo(() => Object.fromEntries(state.squad.map((p) => [p.id, p])), [state.squad]);
  const { starters, bench, reserves } = state.lineup;
  const autoCoords = useMemo(() => layoutSlots(starters), [starters]);
  const hasCustomPositions = starters.some((s) => s.x != null);
  const selectedPlayer = selectedSlot != null ? byId[starters[selectedSlot].playerId] : null;

  function pickStarter(i) {
    if (selectedSlot === null) {
      setSelectedSlot(i);
    } else if (selectedSlot === i) {
      setSelectedSlot(null);
    } else {
      assignSlot(selectedSlot, starters[i].playerId);
      setSelectedSlot(null);
    }
  }

  function pickOther(playerId) {
    if (selectedSlot === null) return;
    assignSlot(selectedSlot, playerId);
    setSelectedSlot(null);
  }

  function coordFor(i) {
    if (dragPos && dragPos.index === i) return dragPos;
    const slot = starters[i];
    if (slot.x != null && slot.y != null) return { x: slot.x, y: slot.y };
    return autoCoords[i] || { x: 50, y: 50 };
  }

  function onTokenPointerDown(e, i) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { index: i, moved: false, startX: e.clientX, startY: e.clientY };
  }

  function onTokenPointerMove(e, i) {
    const d = dragRef.current;
    if (!d || d.index !== i || !pitchRef.current) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    const rect = pitchRef.current.getBoundingClientRect();
    const x = clampPct(((e.clientX - rect.left) / rect.width) * 100);
    const y = clampPct(((e.clientY - rect.top) / rect.height) * 100);
    setDragPos({ index: i, x, y });
  }

  function onTokenPointerUp(e, i) {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.moved) {
      const final = dragPos && dragPos.index === i ? dragPos : null;
      if (final) setSlotPosition(i, final.x, final.y, nearestPositionForDrop(final.x, final.y));
      setDragPos(null);
    } else {
      setDragPos(null);
      pickStarter(i);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={state.formation}
          onChange={(e) => setFormation(e.target.value)}
          className="bg-panel border border-border rounded-card px-2 py-1.5 text-sm font-medium"
        >
          {formations.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        {hasCustomPositions && (
          <button
            onClick={resetLineupPositions}
            className="text-xs px-2.5 py-1.5 rounded-card border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            ↺ Restablecer posiciones
          </button>
        )}
        <span className="text-xs text-gray-500">Tocá un titular y después a otro jugador (titular, banca o reserva) para cambiarlos de lugar, o arrastrá para reposicionar.</span>
      </div>

      {selectedPlayer && (
        <div className="flex items-center justify-between gap-3 bg-accent/10 border border-accent/30 rounded-card px-3.5 py-2.5">
          <p className="text-sm">
            <span className="font-semibold">{selectedPlayer.name}</span> seleccionado ({starters[selectedSlot].slot}) — tocá a otro jugador para cambiarlo de lugar.
          </p>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => { assignSlot(selectedSlot, null); setSelectedSlot(null); }} className="text-xs px-2.5 py-1 rounded-card border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
              Vaciar puesto
            </button>
            <button onClick={() => setSelectedSlot(null)} className="text-xs px-2.5 py-1 rounded-card border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div
        ref={pitchRef}
        className="relative w-full rounded-card overflow-hidden border border-border select-none"
        style={{ aspectRatio: "0.95", background: "linear-gradient(180deg,#1f4d33,#255c3d 50%,#1f4d33)", touchAction: "none" }}
      >
        <div className="absolute inset-2 border border-white/25 rounded-md" />
        <div className="absolute left-2 right-2 top-1/2 border-t border-white/25" />
        <div className="absolute left-1/2 top-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 border border-white/25 rounded-full" />
        {starters.map((slot, i) => {
          const p = byId[slot.playerId];
          const pos = coordFor(i);
          const penalty = p ? positionPenalty(p.position, slot.slot) : 0;
          const label = positionLabel(penalty);
          const dragging = dragPos && dragPos.index === i;
          const selected = selectedSlot === i;
          return (
            <div
              key={i}
              onPointerDown={(e) => onTokenPointerDown(e, i)}
              onPointerMove={(e) => onTokenPointerMove(e, i)}
              onPointerUp={(e) => onTokenPointerUp(e, i)}
              onPointerCancel={() => { dragRef.current = null; setDragPos(null); }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing ${dragging ? "z-20" : "z-10"}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transition: dragging ? "none" : "left 0.15s ease, top 0.15s ease" }}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-lg font-extrabold border-2 shadow-lg pointer-events-none transition-all ${
                  selected
                    ? "bg-white border-white text-black ring-4 ring-white/50 scale-110"
                    : p
                    ? (penalty > 0 ? "bg-amber/90 border-amber text-black" : "bg-accent border-accent-light text-white")
                    : "bg-panel border-dashed border-gray-500 text-gray-400 text-sm"
                }`}
              >
                {p ? effectiveOvr(p, slot.slot) : slot.slot}
              </div>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/70 text-white whitespace-nowrap max-w-[100px] truncate pointer-events-none">
                {p ? p.name.split(" ").slice(-1)[0] : slot.slot}
              </span>
              {label && (
                <span className={`text-[9px] px-1 rounded pointer-events-none ${label.tone === "critical" ? "bg-red-500/80" : label.tone === "bad" ? "bg-orange-500/80" : "bg-amber/80 text-black"} text-white`}>
                  {label.text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BenchList
          title={`Banca (${bench.length}/9)`}
          ids={bench}
          byId={byId}
          selecting={selectedSlot !== null}
          selectedSlotPos={selectedSlot != null ? starters[selectedSlot].slot : null}
          onPick={pickOther}
          onMove={moveToReserves}
          moveLabel="Mandar a reservas"
        />
        <BenchList
          title={`Reservas (${reserves.length})`}
          ids={reserves}
          byId={byId}
          selecting={selectedSlot !== null}
          selectedSlotPos={selectedSlot != null ? starters[selectedSlot].slot : null}
          onPick={pickOther}
          onMove={moveToBench}
          moveLabel="Subir a la banca"
        />
      </div>
    </div>
  );
}

function BenchList({ title, ids, byId, selecting, selectedSlotPos, onPick, onMove, moveLabel }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2.5">{title}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {ids.map((id) => {
          const p = byId[id];
          if (!p) return null;
          const penalty = selecting && selectedSlotPos ? positionPenalty(p.position, selectedSlotPos) : 0;
          const label = selecting ? positionLabel(penalty) : null;
          return (
            <button
              key={id}
              onClick={() => (selecting ? onPick(id) : onMove(id))}
              title={selecting ? "Tocá para cambiarlo con el titular seleccionado" : moveLabel}
              className={`relative flex flex-col items-center gap-1 p-3 rounded-card border transition-colors ${
                selecting ? "border-accent/50 bg-accent/5 hover:bg-accent/15 animate-pulse" : "border-border bg-panel hover:border-accent/40 hover:bg-bg"
              }`}
            >
              <span className="text-[10px] font-semibold text-gray-500">{p.position}</span>
              <span className="text-xl font-bold leading-none">{selecting ? effectiveOvr(p, selectedSlotPos) : p.ovr}</span>
              <span className="text-[11px] text-gray-400 truncate max-w-full">{lastName(p.name)}</span>
              {label && <span className="text-[8px] text-amber leading-tight">{label.text}</span>}
            </button>
          );
        })}
        {!ids.length && <p className="text-xs text-gray-600 col-span-full py-2">Vacío.</p>}
      </div>
      {!selecting && !!ids.length && (
        <p className="text-[11px] text-gray-600 mt-1.5">Tocá un titular en la cancha para intercambiarlo con uno de estos.</p>
      )}
    </div>
  );
}
