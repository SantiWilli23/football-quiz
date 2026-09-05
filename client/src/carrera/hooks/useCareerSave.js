const KEY = "futotal_career_save";

export function loadCareer() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCareer(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, version: 1 }));
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
