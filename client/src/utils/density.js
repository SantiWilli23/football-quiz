// Densidad de las tarjetas: "comoda" es el aire de siempre; "compacta" reduce
// el padding (ver .card-pad en index.css). Se guarda en este dispositivo.
export const DENSITIES = [
  { id: "comoda", label: "Cómoda", hint: "Más aire entre elementos." },
  { id: "compacta", label: "Compacta", hint: "Más contenido en pantalla." },
];
const KEY = "fq_density";

export function readDensity() {
  try {
    return localStorage.getItem(KEY) === "compacta" ? "compacta" : "comoda";
  } catch {
    return "comoda";
  }
}

export function setDensity(id) {
  document.documentElement.setAttribute("data-density", id);
  try { localStorage.setItem(KEY, id); } catch { /* sin storage: dura hasta recargar */ }
}

export function applyStoredDensity() {
  document.documentElement.setAttribute("data-density", readDensity());
}
