import { ATTR_LABELS } from "./attributeEffects.js";

// Los arqueros no se miden con Ritmo, Tiro o Regate: tienen sus propias estadísticas. El motor de partidos
// sigue usando los seis atributos de siempre; estas se calculan a partir del nivel (ovr) y del id del jugador,
// así que son estables en el tiempo, suben con el nivel y funcionan también en carreras ya guardadas.
export const GK_ATTR_LABELS = { reflexes: "Reflejos", diving: "Estirada", handling: "Manos", kicking: "Saque", positioning: "Posición", aerial: "Juego aéreo" };
const GK_ATTR_SHORT = { reflexes: "REF", diving: "EST", handling: "MAN", kicking: "SAQ", positioning: "POS", aerial: "AER" };
const SHORT = { pace: "RIT", shooting: "TIR", passing: "PAS", dribbling: "REG", defending: "DEF", physical: "FIS" };
// Cuánto se aleja cada estadística del nivel general: un arquero sale mejor en unas cosas que en otras.
const GK_OFFSET = { reflexes: 2, diving: 1, handling: 0, kicking: -6, positioning: 1, aerial: -3 };

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const isGk = (p) => p?.position === "GK";

export function attrLabelsOf(p, short = false) {
  if (isGk(p)) return short ? GK_ATTR_SHORT : GK_ATTR_LABELS;
  return short ? SHORT : ATTR_LABELS;
}

export function attrValuesOf(p) {
  if (!isGk(p)) return p?.attributes || {};
  const out = {};
  Object.keys(GK_ATTR_LABELS).forEach((k) => {
    const noise = (hash(`${p.id}|${k}`) % 11) - 5;
    out[k] = Math.max(35, Math.min(99, Math.round((p.ovr || 60) + GK_OFFSET[k] + noise)));
  });
  return out;
}

// [[clave, etiqueta]] listo para recorrer.
export const attrPairs = (p, short = false) => Object.entries(attrLabelsOf(p, short));
