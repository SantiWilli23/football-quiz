// Piel de temporada: la app se queda igual 363 días al año, pero durante
// unas pocas ventanas del calendario futbolero REAL (no el calendario propio
// de Futotal) se enciende un acento especial. Fechas hardcodeadas a propósito
// — no ameritan traerlas de una API para 2-3 eventos por año.
const WINDOWS = [
  { key: "mundial-2026", label: "Mundial 2026", from: "2026-06-11", to: "2026-07-19" },
  { key: "cierre-verano", label: "Cierre del mercado de verano", from: "2026-08-25", to: "2026-08-31" },
  { key: "cierre-invierno", label: "Cierre del mercado de invierno", from: "2027-01-25", to: "2027-01-31" },
];

export function useSeasonSkin(today = new Date().toISOString().slice(0, 10)) {
  const active = WINDOWS.find((w) => today >= w.from && today <= w.to);
  return active || null;
}
