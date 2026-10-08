// Ancho de la barra lateral: compacta (solo íconos), normal o ancha. Se guarda
// en este dispositivo; el menú y Ajustes se avisan con un evento.
export const SIDEBAR_SIZES = [
  { id: "compacta", label: "Compacta", hint: "Solo íconos", px: 72 },
  { id: "normal", label: "Normal", hint: "El de siempre", px: 256 },
  { id: "ancha", label: "Ancha", hint: "Más aire para los textos", px: 320 },
];
const KEY = "fq_sidebar_size";
const OLD_KEY = "fq_sidebar_collapsed"; // el plegado de antes equivale a "compacta"

export function readSidebarSize() {
  try {
    const v = localStorage.getItem(KEY);
    if (SIDEBAR_SIZES.some((s) => s.id === v)) return v;
    return localStorage.getItem(OLD_KEY) === "1" ? "compacta" : "normal";
  } catch {
    return "normal";
  }
}

export function setSidebarSize(id) {
  try { localStorage.setItem(KEY, id); } catch { /* sin storage */ }
  window.dispatchEvent(new Event("fq-sidebar-size"));
}
