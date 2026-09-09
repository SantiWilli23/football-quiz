const KEY = "equipo_jugador_history";
const MAX_ENTRIES = 30;

export function getMatchHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveMatchResult({ mode, winnerName, iWon, playerNames, chainLength }) {
  try {
    const entry = {
      id: `${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      date: Date.now(),
      mode,
      winnerName: winnerName || null,
      iWon: iWon ?? null,
      playerNames,
      chainLength,
    };
    const list = [entry, ...getMatchHistory()].slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* almacenamiento lleno o no disponible: se ignora */
  }
}

export function clearMatchHistory() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
