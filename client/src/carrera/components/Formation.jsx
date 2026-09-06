import { useMemo, useRef, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { effectiveOvr, positionPenalty, positionLabel } from "../engine/positions.js";

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
  const [pickerSlot, setPickerSlot] = useState(null);
  const [dragPos, setDragPos] = useState(null); // { index, x, y } — posición en vivo mientras se arrastra
  const pitchRef = useRef(null);
  const dragRef = useRef(null);

  const byId = useMemo(() => Object.fromEntries(state.squad.map((p) => [p.id, p])), [state.squad]);
  const { starters, bench, reserves } = state.lineup;
  const autoCoords = useMemo(() => layoutSlots(starters), [starters]);
  const hasCustomPositions = starters.some((s) => s.x != null);

  // Dónde juega hoy cada jugador — se lo mostramos al elegir, y con esto el
  // picker puede ofrecer TODO el plantel (otros titulares y banca incluidos,
  // no sólo reservas), porque assignSlot ahora sabe intercambiarlos bien.
  const roleById = useMemo(() => {
    const m = {};
    starters.forEach((s) => { if (s.playerId) m[s.playerId] = { kind: "starter", slot: s.slot }; });
    bench.forEach((id) => { m[id] = { kind: "bench" }; });
    return m;
  }, [starters, bench]);

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
      setPickerSlot(i);
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
        <span className="text-xs text-gray-500">Tocá un puesto para asignar jugador, o arrastralo para moverlo.</span>
      </div>

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
                className={`w-20 h-20 rounded-full flex items-center justify-center text-lg font-extrabold border-2 shadow-lg pointer-events-none ${
                  p ? (penalty > 0 ? "bg-amber/90 border-amber text-black" : "bg-accent border-accent-light text-white") : "bg-panel border-dashed border-gray-500 text-gray-400 text-sm"
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
        <BenchList title={`Banca (${bench.length}/9)`} ids={bench} byId={byId} onMove={moveToReserves} moveLabel="Mandar a reservas" />
        <BenchList title={`Reservas (${reserves.length})`} ids={reserves} byId={byId} onMove={moveToBench} moveLabel="Subir a la banca" />
      </div>

      {pickerSlot !== null && (
        <SlotPicker
          slotPos={starters[pickerSlot].slot}
          currentId={starters[pickerSlot].playerId}
          squad={state.squad}
          roleById={roleById}
          onPick={(playerId) => { assignSlot(pickerSlot, playerId); setPickerSlot(null); }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}

function BenchList({ title, ids, byId, onMove, moveLabel }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2.5">{title}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {ids.map((id) => {
          const p = byId[id];
          if (!p) return null;
          return (
            <button
              key={id}
              onClick={() => onMove(id)}
              title={moveLabel}
              className="flex flex-col items-center gap-1 p-3 rounded-card border border-border bg-panel hover:border-accent/40 hover:bg-bg transition-colors"
            >
              <span className="text-[10px] font-semibold text-gray-500">{p.position}</span>
              <span className="text-xl font-bold leading-none">{p.ovr}</span>
              <span className="text-[11px] text-gray-400 truncate max-w-full">{p.name.split(" ").slice(-1)[0]}</span>
            </button>
          );
        })}
        {!ids.length && <p className="text-xs text-gray-600 col-span-full py-2">Vacío.</p>}
      </div>
    </div>
  );
}

function SlotPicker({ slotPos, currentId, squad, roleById, onPick, onClose }) {
  const candidates = squad
    .filter((p) => p.id !== currentId)
    .map((p) => ({ p, penalty: positionPenalty(p.position, slotPos), role: roleById[p.id] }))
    .sort((a, b) => effectiveOvr(b.p, slotPos) - effectiveOvr(a.p, slotPos));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-panel border border-border rounded-card w-full max-w-md max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-sm">Elegir para {slotPos}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
        </div>
        <div className="divide-y divide-border">
          {currentId && (
            <button onClick={() => onPick(null)} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-bg">
              Dejar el puesto vacío
            </button>
          )}
          {candidates.map(({ p, penalty, role }) => {
            const label = positionLabel(penalty);
            const roleText = role?.kind === "starter" ? `Titular (${role.slot})` : role?.kind === "bench" ? "Banca" : "Reserva";
            return (
              <button key={p.id} onClick={() => onPick(p.id)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-bg">
                <span className="flex items-center gap-2 truncate">
                  <span className="text-gray-500 text-xs w-9 shrink-0">{p.position}</span>
                  <span className="truncate">{p.name}</span>
                  <span className="text-[10px] text-gray-600 shrink-0">{roleText}</span>
                  {label && <span className="text-[10px] text-amber shrink-0">{label.text}</span>}
                </span>
                <span className="shrink-0 font-semibold">{effectiveOvr(p, slotPos)}{penalty > 0 && <span className="text-gray-500 font-normal text-xs"> ({p.ovr})</span>}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
