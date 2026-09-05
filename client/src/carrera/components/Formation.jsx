import { useMemo, useState } from "react";
import { useCareer } from "../context/CareerContext.jsx";
import { effectiveOvr, positionPenalty, positionLabel } from "../engine/positions.js";

// Ubica cada slot en la cancha por "línea" (según su posición) y reparte el
// ancho entre los que comparten línea, respetando lado (zurdo/diestro).
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

export default function Formation() {
  const { state, formations, setFormation, assignSlot, moveToBench, moveToReserves } = useCareer();
  const [pickerSlot, setPickerSlot] = useState(null);

  const byId = useMemo(() => Object.fromEntries(state.squad.map((p) => [p.id, p])), [state.squad]);
  const { starters, bench, reserves } = state.lineup;
  const coords = useMemo(() => layoutSlots(starters), [starters]);
  const usedIds = new Set([...starters.map((s) => s.playerId), ...bench].filter(Boolean));

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
        <span className="text-xs text-gray-500">Tocá un puesto para asignar jugador.</span>
      </div>

      <div className="relative w-full rounded-card overflow-hidden border border-border" style={{ aspectRatio: "0.68", background: "linear-gradient(180deg,#1f4d33,#255c3d 50%,#1f4d33)" }}>
        <div className="absolute inset-2 border border-white/25 rounded-md" />
        <div className="absolute left-2 right-2 top-1/2 border-t border-white/25" />
        <div className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 border border-white/25 rounded-full" />
        {starters.map((slot, i) => {
          const p = byId[slot.playerId];
          const pos = coords[i] || { x: 50, y: 50 };
          const penalty = p ? positionPenalty(p.position, slot.slot) : 0;
          const label = positionLabel(penalty);
          return (
            <button
              key={i}
              onClick={() => setPickerSlot(i)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 group"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-md transition-colors ${
                  p ? (penalty > 0 ? "bg-amber/90 border-amber text-black" : "bg-accent border-accent-light text-white") : "bg-panel border-dashed border-gray-500 text-gray-400"
                }`}
              >
                {p ? effectiveOvr(p, slot.slot) : slot.slot}
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white whitespace-nowrap max-w-[90px] truncate">
                {p ? p.name.split(" ").slice(-1)[0] : slot.slot}
              </span>
              {label && (
                <span className={`text-[9px] px-1 rounded ${label.tone === "critical" ? "bg-red-500/80" : label.tone === "bad" ? "bg-orange-500/80" : "bg-amber/80 text-black"} text-white`}>
                  {label.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BenchList title={`Banca (${bench.length}/9)`} ids={bench} byId={byId} onReserve={moveToReserves} />
        <BenchList title={`Reservas (${reserves.length})`} ids={reserves} byId={byId} onBench={moveToBench} />
      </div>

      {pickerSlot !== null && (
        <SlotPicker
          slotPos={starters[pickerSlot].slot}
          currentId={starters[pickerSlot].playerId}
          squad={state.squad}
          usedIds={usedIds}
          onPick={(playerId) => { assignSlot(pickerSlot, playerId); setPickerSlot(null); }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}

function BenchList({ title, ids, byId, onReserve, onBench }) {
  return (
    <div className="bg-panel border border-border rounded-card p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1">
        {ids.map((id) => {
          const p = byId[id];
          if (!p) return null;
          return (
            <div key={id} className="flex items-center justify-between text-sm gap-2">
              <span className="truncate">[{p.position}] {p.name}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-gray-400">{p.ovr}</span>
                {onReserve && <button onClick={() => onReserve(id)} className="text-[10px] text-gray-500 hover:text-white underline">a reservas</button>}
                {onBench && <button onClick={() => onBench(id)} className="text-[10px] text-gray-500 hover:text-white underline">a banca</button>}
              </span>
            </div>
          );
        })}
        {!ids.length && <p className="text-xs text-gray-600">Vacío.</p>}
      </div>
    </div>
  );
}

function SlotPicker({ slotPos, currentId, squad, usedIds, onPick, onClose }) {
  const candidates = squad
    .filter((p) => p.id === currentId || !usedIds.has(p.id))
    .map((p) => ({ p, penalty: positionPenalty(p.position, slotPos) }))
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
          {candidates.map(({ p, penalty }) => {
            const label = positionLabel(penalty);
            return (
              <button key={p.id} onClick={() => onPick(p.id)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-bg">
                <span className="flex items-center gap-2 truncate">
                  <span className="text-gray-500 text-xs w-9 shrink-0">{p.position}</span>
                  <span className="truncate">{p.name}</span>
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
