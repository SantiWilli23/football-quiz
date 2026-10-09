// Modo de pantalla: "telefono" (pensado para tocar con el pulgar), "computador" (el diseño de
// siempre) o "auto" (teléfono si la pantalla es chica, computador si no). Se guarda en este
// dispositivo y se aplica como data-device="phone|desktop" en <html>, que es lo que usan los
// estilos de teléfono (index.css) y la variante `phone:` de Tailwind.
export const DEVICE_MODES = [
  { id: "auto", label: "Automático", hint: "Teléfono en pantallas chicas, computador en las grandes." },
  { id: "telefono", label: "Teléfono", hint: "Botones grandes, una columna y menú abajo, pensado para el pulgar." },
  { id: "computador", label: "Computador", hint: "El diseño de siempre, con menú lateral." },
];

const KEY = "fq_device";
const PHONE_MAX_WIDTH = 767;

export function readDeviceMode() {
  try {
    const v = localStorage.getItem(KEY);
    return DEVICE_MODES.some((m) => m.id === v) ? v : "auto";
  } catch {
    return "auto";
  }
}

export function effectiveDevice(mode = readDeviceMode()) {
  if (mode === "telefono") return "phone";
  if (mode === "computador") return "desktop";
  return window.innerWidth <= PHONE_MAX_WIDTH ? "phone" : "desktop";
}

export function applyDevice(mode = readDeviceMode()) {
  document.documentElement.setAttribute("data-device", effectiveDevice(mode));
}

export function setDeviceMode(mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Sin localStorage la elección dura hasta cerrar la página.
  }
  applyDevice(mode);
  window.dispatchEvent(new Event("fq:device"));
}

// En "auto" el modo sigue al ancho de la pantalla (por ejemplo al girar el teléfono).
export function watchDevice() {
  const onResize = () => { if (readDeviceMode() === "auto") applyDevice("auto"); };
  window.addEventListener("resize", onResize);
}

// Una computadora en modo teléfono muestra la app dentro de un marco del tamaño de un teléfono
// (la misma página en un iframe), así los estilos responsive se comportan como en un teléfono de verdad.
export function shouldFrameAsPhone() {
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }
  return !inIframe && readDeviceMode() === "telefono" && window.innerWidth > 900;
}
