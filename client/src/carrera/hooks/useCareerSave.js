const KEY = "futotal_career_save";
// v2: el lineup titular pasó de ser una lista de ids a slots de formación
// ({ slot, playerId }) — una partida vieja con el formato anterior rompería
// el motor de partidos, así que se descarta en vez de intentar migrarla.
const SAVE_VERSION = 2;

export function loadCareer() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCareer(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, version: SAVE_VERSION }));
  } catch {
    /* almacenamiento lleno o no disponible: se ignora */
  }
}

export function clearCareer() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
