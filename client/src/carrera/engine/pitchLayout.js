// Ubica cada slot en la cancha por "línea" según su posición, repartiendo el
// ancho entre los que comparten línea y respetando lado (zurdo/diestro).
// Compartido entre la pantalla de Formación y el visor en vivo del partido.
export const LINE_Y = { GK: 91, CB: 74, LB: 74, RB: 74, CDM: 60, CM: 50, CAM: 38, LW: 20, RW: 20, ST: 12 };
const SIDE = { LB: -1, LW: -1, RB: 1, RW: 1 };
const SPREAD = { 1: [50], 2: [34, 66], 3: [22, 50, 78], 4: [16, 38, 62, 84], 5: [12, 31, 50, 69, 88] };

export function layoutSlots(slots) {
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
