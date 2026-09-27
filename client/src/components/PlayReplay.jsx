import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Crosshair } from "lucide-react";

// Repeticiones animadas de cada jugada del modo Arbitraje/VAR. No hay video
// real con licencia libre de estas situaciones, así que cada jugada es una
// animación propia (jugadores, pelota, línea de offside, brazos/piernas) que
// se puede pausar, pasar en cámara lenta y recorrer cuadro a cuadro como en
// el monitor del VAR. Coordenadas en una cancha de 200x120, el arco
// izquierdo está en x=4.

// Keys: [tiempo, x, y]. limb: brazo/pierna visible entre from y to.
const S = {
  1: {
    duration: 4.2, key: 2.25, view: [0, 20, 110, 80],
    actors: [
      { kind: "atk", num: 9, path: [[0, 80, 55], [1.6, 40, 58], [2.2, 32, 60], [2.7, 29, 63]], fall: 2.3 },
      { kind: "def", num: 4, path: [[0, 50, 82], [1.6, 39, 69], [2.25, 33, 62], [2.8, 31, 62]], limb: { from: 2.05, to: 2.5, angle: 250, len: 7, kind: "leg" } },
      { kind: "gk", num: 1, path: [[0, 9, 60], [2, 11, 60], [4, 10, 64]] },
    ],
    ball: [[0, 82, 55], [1.6, 38, 58], [2.0, 33, 61], [3.2, 12, 84], [4.2, 6, 100]],
    marks: [
      { t: 2.0, x: 33, y: 61, text: "El delantero pierde el control: la pelota se va afuera" },
      { t: 2.25, x: 32, y: 61, text: "Contacto en el tobillo, sin tocar la pelota" },
    ],
  },
  2: {
    duration: 4.8, key: 2.3, view: [60, 20, 90, 70],
    actors: [
      { kind: "ref", num: "", path: [[0, 98, 60], [4.8, 97, 60]] },
      { kind: "atk", num: 8, path: [[0, 135, 38], [2.0, 103, 57], [4.8, 102.5, 57.5]], limb: { from: 2.0, to: 4.8, angle: 200, len: 6, kind: "arm", wave: true } },
      { kind: "def", num: 5, path: [[0, 120, 80], [4.8, 116, 76]] },
    ],
    ball: [],
    marks: [{ t: 2.3, x: 100, y: 58, text: "A centímetros de la cara, gritando — sin tocarlo" }],
  },
  3: {
    duration: 4, key: 2.3, view: [60, 25, 100, 70],
    actors: [
      { kind: "atk", num: 10, path: [[0, 130, 60], [2.0, 97, 60], [2.6, 92, 60], [4, 84, 61]] },
      { kind: "def", num: 6, path: [[0, 145, 63], [2.0, 101, 61], [2.3, 95, 61], [2.7, 94, 61]], limb: { from: 2.1, to: 2.45, angle: 180, len: 6, kind: "leg" } },
    ],
    ball: [[0, 127, 60], [2.0, 94, 60], [4, 78, 61]],
    marks: [
      { t: 2.15, x: 96, y: 61, text: "Entrada por detrás, tapones altos" },
      { t: 2.35, x: 93, y: 61, text: "Frena justo antes: el contacto es leve" },
    ],
  },
  4: {
    duration: 3.8, key: 1.5, view: [0, 20, 110, 80],
    actors: [
      { kind: "atk", num: 7, path: [[0, 85, 40], [1.5, 80, 42], [3.8, 78, 42]] },
      { kind: "atk", num: 9, path: [[0, 48, 62], [1.5, 40.2, 61], [2.6, 28, 60], [3.8, 22, 60]], shoulder: { from: 1.3, to: 1.7, dx: -2.4 } },
      { kind: "def", num: 3, path: [[0, 46, 52], [1.5, 40, 52], [3.8, 32, 55]] },
      { kind: "def", num: 2, path: [[0, 47, 76], [1.5, 42, 74], [3.8, 34, 70]] },
      { kind: "gk", num: 1, path: [[0, 10, 60], [3.8, 14, 60]] },
    ],
    ball: [[0, 84, 41], [1.5, 80, 42], [2.6, 29, 59], [3.8, 23, 60]],
    lines: [{ x1: 40, y1: 4, x2: 40, y2: 116, from: 1.5, to: 3.8, label: "último defensor" }],
    marks: [{ t: 1.5, x: 38.5, y: 60, text: "Momento del pase: solo el hombro está por delante" }],
  },
  5: {
    duration: 3, key: 0.75, view: [0, 25, 80, 70],
    actors: [
      { kind: "atk", num: 11, path: [[0, 38, 50], [3, 38, 50]] },
      { kind: "def", num: 5, path: [[0, 26, 56], [3, 26, 56]], limb: { from: 0, to: 3, angle: 95, len: 3.5, kind: "arm" } },
      { kind: "gk", num: 1, path: [[0, 9, 60], [3, 9, 60]] },
    ],
    ball: [[0, 20, 62], [0.35, 37, 51], [0.75, 26.5, 58.5], [1.6, 40, 72], [3, 46, 80]],
    marks: [
      { t: 0.35, x: 37, y: 51, text: "Rebote a muy corta distancia" },
      { t: 0.75, x: 26.5, y: 58.5, text: "Brazo pegado al cuerpo, sin tiempo a reaccionar" },
    ],
  },
  6: {
    duration: 3, key: 1.0, view: [0, 25, 90, 70],
    actors: [
      { kind: "atk", num: 10, path: [[0, 70, 48], [0.4, 66, 50], [3, 64, 50]] },
      { kind: "def", num: 4, path: [[0, 32, 58], [3, 32, 58]], limb: { from: 0, to: 3, angle: 270, len: 7, kind: "arm" } },
      { kind: "gk", num: 1, path: [[0, 9, 60], [3, 9, 60]] },
    ],
    ball: [[0, 68, 49], [0.4, 64, 50], [1.0, 32.5, 51.2], [1.8, 44, 36], [3, 50, 26]],
    marks: [{ t: 1.0, x: 32.5, y: 51.5, text: "Brazo separado y extendido: agranda su volumen" }],
  },
  7: {
    duration: 3.6, key: 1.75, view: [55, 25, 90, 70],
    actors: [
      { kind: "atk", num: 8, path: [[0, 120, 45], [1.6, 95, 55], [1.9, 92, 57]], fall: 1.85 },
      { kind: "def", num: 6, path: [[0, 110, 72], [1.6, 96, 60], [1.9, 94, 59], [3.6, 95, 60]], limb: { from: 1.6, to: 1.95, angle: 250, len: 5, kind: "leg" }, badge: "yellow" },
    ],
    ball: [[0, 118, 46], [1.6, 93, 56], [3.6, 80, 62]],
    marks: [{ t: 1.75, x: 94, y: 58, text: "Falta táctica, sin agresividad — ya estaba amonestado" }],
  },
  8: {
    duration: 3.6, key: 0.6, view: [0, 15, 100, 90],
    actors: [
      { kind: "atk", num: 6, path: [[0, 76, 28], [0.6, 72, 30], [3.6, 70, 32]] },
      { kind: "atk", num: 9, path: [[0, 42, 52], [0.6, 40, 52], [1.8, 30, 55], [2.4, 26, 57], [3.6, 24, 57]] },
      { kind: "def", num: 4, path: [[0, 52, 42], [0.6, 48, 43], [1.1, 50, 44], [3.6, 42, 50]] },
      { kind: "def", num: 5, path: [[0, 48, 70], [0.6, 45, 68], [3.6, 36, 64]] },
      { kind: "gk", num: 1, path: [[0, 9, 60], [2.3, 12, 58], [2.6, 8, 64], [3.6, 8, 64]] },
    ],
    ball: [[0, 74, 29], [0.6, 72, 30], [1.1, 50, 43], [1.9, 29, 55], [2.4, 26, 57], [2.9, 3, 56], [3.6, 2, 56]],
    lines: [{ x1: 45, y1: 4, x2: 45, y2: 116, from: 0.6, to: 3.6, label: "línea al momento del pase" }],
    marks: [
      { t: 0.6, x: 40, y: 52, text: "Pase original: el 9 está adelantado" },
      { t: 1.1, x: 50, y: 43, text: "Rebote en el defensor" },
      { t: 2.9, x: 4, y: 56, text: "Gol" },
    ],
  },
  9: {
    duration: 4, key: 2.1, view: [0, 25, 100, 75],
    actors: [
      { kind: "atk", num: 11, path: [[0, 72, 60], [1.8, 36, 62], [2.15, 33, 62], [2.9, 26, 64]], fall: 2.15 },
      { kind: "def", num: 2, path: [[0, 42, 80], [1.8, 37, 68], [2.1, 34.5, 66.5], [2.8, 36, 67]], limb: { from: 1.95, to: 2.2, angle: 250, len: 3, kind: "leg" } },
      { kind: "gk", num: 1, path: [[0, 9, 60], [4, 10, 60]] },
    ],
    ball: [[0, 74, 60], [1.8, 38, 62], [2.4, 30, 70], [4, 26, 76]],
    marks: [
      { t: 2.05, x: 34, y: 64, text: "Roce mínimo en la pierna" },
      { t: 2.4, x: 29, y: 63, text: "Caída exagerada, se arrastra hacia adelante" },
    ],
  },
  10: {
    duration: 3.6, key: 1.9, view: [55, 25, 90, 70],
    actors: [
      { kind: "atk", num: 9, path: [[0, 80, 50], [1.9, 97, 58], [2.4, 99, 57]], fall: 2.0 },
      { kind: "def", num: 5, path: [[0, 118, 68], [1.9, 102, 61], [2.4, 103, 63]], fall: 2.05 },
    ],
    ball: [[0, 100, 20], [1.8, 100, 59], [2.6, 108, 76], [3.6, 112, 88]],
    marks: [{ t: 1.9, x: 100, y: 59, text: "Los dos van a la pelota mirándola — choque" }],
  },
  11: {
    duration: 3.8, key: 2.15, view: [0, 25, 110, 75],
    actors: [
      { kind: "atk", num: 9, path: [[0, 94, 62], [1.5, 58, 61], [2.15, 50, 60], [2.7, 46, 59]], fall: 2.2 },
      { kind: "gk", num: 1, path: [[0, 10, 60], [1.8, 42, 60], [2.15, 48.5, 61], [2.8, 50, 62]] },
      { kind: "def", num: 4, path: [[0, 96, 76], [3.8, 66, 70]] },
    ],
    ball: [[0, 92, 61], [1.5, 55, 60], [2.0, 47, 60], [2.6, 44, 58], [3.8, 38, 56]],
    lines: [{ x1: 48, y1: 30, x2: 48, y2: 90, from: 1.9, to: 3.8, label: "borde del área" }],
    marks: [{ t: 2.15, x: 48.5, y: 60.5, text: "Contacto justo en la línea — ¿dónde está la pelota?" }],
  },
  12: {
    duration: 3.6, key: 1.7, view: [55, 20, 110, 80],
    actors: [
      { kind: "atk", num: 7, path: [[0, 150, 50], [1.4, 118, 55], [2.4, 104, 57], [3.6, 94, 58]] },
      { kind: "def", num: 8, path: [[0, 148, 58], [1.4, 121, 58], [2.4, 108, 59], [3.6, 102, 60]], limb: { from: 1.3, to: 2.5, angle: 180, len: 4, kind: "arm" } },
      { kind: "atk", num: 11, path: [[0, 120, 90], [3.6, 88, 84]] },
    ],
    ball: [[0, 148, 50], [1.4, 116, 55], [2.4, 101, 57], [3.6, 92, 58]],
    marks: [{ t: 1.7, x: 118, y: 57, text: "Contragolpe claro: lo agarra de la camiseta" }],
  },
  13: {
    duration: 3, key: 1.0, view: [0, 25, 80, 70],
    actors: [
      { kind: "atk", num: 9, path: [[0, 44, 52], [3, 42, 52]] },
      { kind: "def", num: 3, path: [[0, 30, 60], [0.8, 28, 62], [3, 27, 63]], fall: 0.8, limb: { from: 0.6, to: 3, angle: 120, len: 4.5, kind: "arm" } },
      { kind: "gk", num: 1, path: [[0, 9, 60], [3, 9, 60]] },
    ],
    ball: [[0, 60, 40], [0.5, 44, 50], [1.0, 26, 66], [1.8, 36, 82], [3, 42, 92]],
    marks: [
      { t: 0.8, x: 28, y: 62, text: "Pierde el equilibrio y cae" },
      { t: 1.0, x: 26, y: 66, text: "La mano busca apoyo en el piso" },
    ],
  },
  14: {
    duration: 3.8, key: 2.0, view: [0, 15, 110, 80],
    actors: [
      { kind: "atk", num: 9, path: [[0, 60, 50], [1.5, 35, 55], [2.0, 30, 56], [2.6, 25, 58]], fall: 2.15 },
      { kind: "def", num: 5, path: [[0, 67, 52], [1.5, 40, 56], [2.0, 33.5, 56], [2.6, 32, 57]], limb: { from: 1.85, to: 2.25, angle: 180, len: 4, kind: "arm", double: true } },
      { kind: "gk", num: 1, path: [[0, 9, 60], [3.8, 11, 58]] },
    ],
    ball: [[0, 104, 18], [2.0, 30, 50], [2.6, 20, 46], [3.8, 12, 40]],
    marks: [{ t: 2.0, x: 31.5, y: 56, text: "Empuje con las dos manos en la espalda" }],
  },
  15: {
    duration: 3.6, key: 1.9, view: [40, 20, 120, 85],
    actors: [
      { kind: "atk", num: 10, path: [[0, 140, 40], [3.6, 120, 36]] },
      { kind: "def", num: 6, path: [[0, 96, 82], [1.7, 100, 80], [3.6, 101, 81]], limb: { from: 1.75, to: 2.0, angle: 0, len: 5, kind: "arm" } },
      { kind: "atk", num: 9, path: [[0, 108, 80], [1.7, 104.5, 80], [1.95, 105, 79], [3.6, 108, 78]], fall: 1.95 },
    ],
    ball: [[0, 142, 40], [3.6, 158, 32]],
    marks: [
      { t: 1.8, x: 104, y: 80, text: "Codazo en la cara, lejos de la pelota" },
    ],
  },
  16: {
    duration: 3.2, key: 1.0, view: [0, 10, 110, 100],
    actors: [
      { kind: "atk", num: 10, path: [[0, 70, 55], [1.0, 60, 56], [3.2, 58, 56]] },
      { kind: "atk", num: 11, path: [[0, 30, 100], [3.2, 30, 99]] },
      { kind: "def", num: 4, path: [[0, 50, 50], [1.0, 45, 52], [3.2, 42, 54]] },
      { kind: "def", num: 2, path: [[0, 52, 78], [1.0, 46, 80], [3.2, 44, 80]] },
      { kind: "gk", num: 1, path: [[0, 9, 60], [1.4, 8, 64], [3.2, 7, 67]] },
    ],
    ball: [[0, 68, 55], [1.0, 58, 56], [1.7, 3, 56], [3.2, 2, 56]],
    lines: [{ x1: 45, y1: 4, x2: 45, y2: 116, from: 1.0, to: 3.2, label: "línea al momento del remate" }],
    marks: [
      { t: 1.0, x: 30, y: 100, text: "El 11 está adelantado, parado lejos de la jugada" },
      { t: 1.7, x: 4, y: 56, text: "Gol" },
    ],
  },
  17: {
    duration: 3.6, key: 1.8, view: [55, 25, 90, 70],
    actors: [
      { kind: "atk", num: 7, path: [[0, 125, 55], [1.7, 100, 58], [2.1, 97, 59], [3.6, 95, 60]], fall: 2.0 },
      { kind: "def", num: 3, path: [[0, 108, 74], [1.7, 100, 63], [2.1, 99, 62], [3.6, 100, 62]], limb: { from: 1.7, to: 2.0, angle: 250, len: 3.5, kind: "leg" } },
    ],
    ball: [[0, 123, 55], [1.7, 98, 58], [3.6, 88, 64]],
    marks: [{ t: 1.8, x: 99, y: 60, text: "Falta clara pero blanda, sin fuerza" }],
  },
  18: {
    duration: 3.8, key: 2.5, view: [55, 25, 90, 70],
    actors: [
      { kind: "atk", num: 9, path: [[0, 88, 58], [1.6, 99, 60], [3.8, 100, 60]], fall: 1.7 },
      { kind: "def", num: 5, path: [[0, 114, 64], [1.6, 103, 62], [3.8, 104, 62]], fall: 1.75, limb: { from: 2.3, to: 2.7, angle: 190, len: 5, kind: "leg" } },
    ],
    ball: [[0, 90, 58], [1.6, 101, 60], [2.2, 110, 50], [3.8, 118, 44]],
    marks: [
      { t: 1.7, x: 101, y: 61, text: "Caen juntos forcejeando" },
      { t: 2.5, x: 100, y: 61, text: "Pisotón al tobillo en el piso" },
    ],
  },
  19: {
    duration: 3.6, key: 1.0, view: [0, 0, 80, 90],
    actors: [
      { kind: "atk", num: 5, path: [[0, 26, 52], [1.0, 22, 56], [1.8, 18, 58], [3.6, 18, 58]] },
      { kind: "def", num: 4, path: [[0, 24, 60], [1.0, 21, 61], [1.8, 20, 62], [3.6, 20, 62]], limb: { from: 0.8, to: 1.2, angle: 250, len: 3, kind: "arm" } },
      { kind: "atk", num: 10, path: [[0, 6, 6], [3.6, 7, 8]] },
      { kind: "gk", num: 1, path: [[0, 8, 60], [1.9, 7, 56], [3.6, 7, 56]] },
    ],
    ball: [[0, 5, 5], [0.9, 16, 40], [1.8, 18, 57], [2.3, 3, 62], [3.6, 2, 62]],
    marks: [
      { t: 1.0, x: 21.5, y: 58.5, text: "Leve empujón entre los dos, no cambia la disputa" },
      { t: 1.8, x: 18, y: 57, text: "Cabezazo" },
      { t: 2.3, x: 4, y: 62, text: "Gol" },
    ],
  },
  20: {
    duration: 4.2, key: 1.6, view: [0, 20, 110, 80],
    actors: [
      { kind: "atk", num: 9, path: [[0, 90, 60], [1.6, 60, 60], [2.8, 36, 60], [4.2, 30, 60]] },
      { kind: "def", num: 4, path: [[0, 92, 63], [1.6, 63, 62], [2.8, 40, 62], [4.2, 36, 63]], limb: { from: 1.2, to: 2.4, angle: 180, len: 4, kind: "arm" } },
      { kind: "gk", num: 1, path: [[0, 10, 60], [2.8, 20, 60], [4.2, 22, 60]] },
    ],
    ball: [[0, 88, 60], [1.6, 57, 60], [2.8, 33, 60], [3.4, 4, 44], [4.2, 0, 40]],
    marks: [
      { t: 1.6, x: 61, y: 61, text: "Último hombre: lo agarra de la camiseta" },
      { t: 2.9, x: 30, y: 58, text: "El delantero sigue y remata desviado" },
    ],
  },
};

const COLORS = {
  atk: { fill: "#e5484d", text: "#fff" },
  def: { fill: "#2f6fe0", text: "#fff" },
  gk: { fill: "#eab308", text: "#1a1a1a" },
  ref: { fill: "#111", text: "#fff" },
};

function at(keys, t) {
  if (!keys?.length) return null;
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    const [t1, x1, y1] = keys[i];
    if (t <= t1) {
      const [t0, x0, y0] = keys[i - 1];
      const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
    }
  }
  const last = keys[keys.length - 1];
  return [last[1], last[2]];
}

function Pitch() {
  const line = { fill: "none", stroke: "#fff", strokeOpacity: 0.75, strokeWidth: 0.6 };
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 20} y="0" width="20" height="120" fill={i % 2 ? "#2d8a45" : "#32954b"} />
      ))}
      <rect x="4" y="4" width="192" height="112" {...line} />
      <line x1="100" y1="4" x2="100" y2="116" {...line} />
      <circle cx="100" cy="60" r="14" {...line} />
      <rect x="4" y="30" width="44" height="60" {...line} />
      <rect x="4" y="45" width="12" height="30" {...line} />
      <circle cx="30" cy="60" r="0.8" fill="#fff" />
      <rect x="152" y="30" width="44" height="60" {...line} />
      <rect x="184" y="45" width="12" height="30" {...line} />
      <circle cx="170" cy="60" r="0.8" fill="#fff" />
      <rect x="0.5" y="52" width="3.5" height="16" fill="#fff" fillOpacity="0.25" stroke="#fff" strokeWidth="0.6" />
      <rect x="196" y="52" width="3.5" height="16" fill="#fff" fillOpacity="0.25" stroke="#fff" strokeWidth="0.6" />
    </>
  );
}

function Actor({ a, t }) {
  const pos = at(a.path, t);
  if (!pos) return null;
  const [x, y] = pos;
  const c = COLORS[a.kind];
  const down = a.fall != null && t >= a.fall;
  const limb = a.limb && t >= a.limb.from && t <= a.limb.to ? a.limb : null;
  let limbEl = null;
  if (limb) {
    const ang = ((limb.angle + (limb.wave ? Math.sin(t * 14) * 35 : 0)) * Math.PI) / 180;
    const ex = x + Math.cos(ang) * limb.len;
    const ey = y + Math.sin(ang) * limb.len;
    const w = limb.kind === "leg" ? 1.6 : 1.1;
    limbEl = (
      <g>
        <line x1={x} y1={y} x2={ex} y2={ey} stroke={c.fill} strokeWidth={w} strokeLinecap="round" />
        {limb.double && <line x1={x} y1={y + 1.6} x2={ex} y2={ey + 1.6} stroke={c.fill} strokeWidth={w} strokeLinecap="round" />}
        {limb.kind === "leg" && <circle cx={ex} cy={ey} r="0.9" fill="#fff" />}
      </g>
    );
  }
  const shoulder = a.shoulder && t >= a.shoulder.from && t <= a.shoulder.to;
  return (
    <g>
      <ellipse cx={x + 0.4} cy={y + 0.8} rx="2.6" ry="1.2" fill="#000" opacity="0.25" />
      {limbEl}
      {down ? (
        <ellipse cx={x} cy={y} rx="3.6" ry="1.8" fill={c.fill} stroke="#fff" strokeWidth="0.4" />
      ) : (
        <circle cx={x} cy={y} r="2.4" fill={c.fill} stroke="#fff" strokeWidth="0.4" />
      )}
      {shoulder && (
        <g>
          <circle cx={x + a.shoulder.dx} cy={y - 1.2} r="0.9" fill="#ffd400" />
          <text x={x + a.shoulder.dx} y={y - 3} fontSize="2.2" textAnchor="middle" fill="#ffd400" fontWeight="700">hombro</text>
        </g>
      )}
      {a.num !== "" && !down && (
        <text x={x} y={y + 0.9} fontSize="2.5" textAnchor="middle" fill={c.text} fontWeight="700">{a.num}</text>
      )}
      {a.badge === "yellow" && <rect x={x + 1.8} y={y - 4.2} width="1.6" height="2.2" rx="0.2" fill="#facc15" />}
    </g>
  );
}

const SPEEDS = [1, 0.5, 0.25];

export default function PlayReplay({ situationId }) {
  const script = S[situationId];
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const tRef = useRef(0);
  const reduceMotion = useRef(
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    tRef.current = 0;
    setT(0);
    setPlaying(!reduceMotion.current);
    if (reduceMotion.current && script) {
      tRef.current = script.key;
      setT(script.key);
    }
  }, [situationId, script]);

  useEffect(() => {
    if (!playing || !script) return;
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = Math.min(script.duration, tRef.current + dt * speed);
      tRef.current = next;
      setT(next);
      if (next >= script.duration) { setPlaying(false); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, script]);

  if (!script) return null;

  function seek(v) {
    const clamped = Math.max(0, Math.min(script.duration, v));
    tRef.current = clamped;
    setT(clamped);
  }
  function togglePlay() {
    if (!playing && tRef.current >= script.duration) seek(0);
    setPlaying((p) => !p);
  }

  const [vx, vy, vw, vh] = script.view || [0, 0, 200, 120];
  const ballPos = at(script.ball, t);
  const activeMark = [...(script.marks || [])].reverse().find((m) => t >= m.t);
  const ringMarks = (script.marks || []).filter((m) => t >= m.t && t <= m.t + 1.1);

  const btn = "p-2 rounded-card border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors";

  return (
    <div className="mb-4 -mx-6 -mt-6 card-bleed">
      <div className="relative bg-black rounded-t-2xl overflow-hidden">
        <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="w-full block max-h-[440px]" style={{ aspectRatio: "16 / 10" }} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Repetición animada de la jugada">
          <Pitch />
          {(script.lines || []).filter((l) => t >= l.from && t <= l.to).map((l, i) => (
            <g key={i}>
              <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#ffd400" strokeWidth="0.7" strokeDasharray="2 1.2" />
              <text x={l.x1 + 1} y={Math.max(l.y1, vy) + 10} fontSize="2.4" fill="#ffd400">{l.label}</text>
            </g>
          ))}
          {script.actors.map((a, i) => <Actor key={i} a={a} t={t} />)}
          {ballPos && (
            <g>
              <ellipse cx={ballPos[0] + 0.3} cy={ballPos[1] + 0.6} rx="1.2" ry="0.5" fill="#000" opacity="0.3" />
              <circle cx={ballPos[0]} cy={ballPos[1]} r="1.1" fill="#fff" stroke="#111" strokeWidth="0.3" />
            </g>
          )}
          {ringMarks.map((m, i) => (
            <circle key={i} cx={m.x} cy={m.y} r={3 + (t - m.t) * 5} fill="none" stroke="#ffd400" strokeWidth="0.6" opacity={Math.max(0, 1 - (t - m.t))} />
          ))}
        </svg>
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/70 text-[10px] font-semibold tracking-wider text-white">
          <span className={`w-1.5 h-1.5 rounded-full ${playing ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
          VAR · REPETICIÓN
        </div>
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white tabular-nums">
          {t.toFixed(2)}s · x{speed}
        </div>
        {activeMark && (
          <div className="absolute bottom-0 inset-x-0 px-3 py-1.5 bg-black/75 text-xs text-white">{activeMark.text}</div>
        )}
      </div>

      <div className="px-6 pt-3 space-y-2">
        <input
          type="range"
          min="0"
          max={script.duration}
          step="0.01"
          value={t}
          onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }}
          aria-label="Línea de tiempo de la repetición"
          className="w-full accent-[rgb(var(--c-accent))]"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={togglePlay} className={btn} aria-label={playing ? "Pausar" : "Reproducir"}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button onClick={() => { setPlaying(false); seek(tRef.current - 0.05); }} className={btn} aria-label="Cuadro anterior"><ChevronLeft size={15} /></button>
          <button onClick={() => { setPlaying(false); seek(tRef.current + 0.05); }} className={btn} aria-label="Cuadro siguiente"><ChevronRight size={15} /></button>
          <button onClick={() => { seek(0); setPlaying(true); }} className={btn} aria-label="Repetir desde el principio"><RotateCcw size={15} /></button>
          <button
            onClick={() => { setPlaying(false); seek(script.key); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-card border border-accent/40 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
          >
            <Crosshair size={13} /> Momento clave
          </button>
          <div className="ml-auto flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-card text-xs font-medium border transition-colors ${speed === s ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}
              >
                x{s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function hasReplay(id) {
  return Boolean(S[id]);
}
