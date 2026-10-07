// Guardado local de los tres juegos diarios (Tateti, Pirámide, Torta): la
// partida del día (para retomarla si se recarga y para no dejar rejugar el
// diario) y las estadísticas de cada juego. Todo en localStorage, envuelto en
// try/catch porque puede no estar disponible (modo privado, etc.).

const PREFIX = "futgames:";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* sin almacenamiento: la partida sigue, solo no se guarda */ }
}

export const loadGame = (game, date) => read(`${game}:${date}`, null);
export const saveGame = (game, date, state) => write(`${game}:${date}`, state);

const EMPTY_STATS = { played: 0, won: 0, streak: 0, maxStreak: 0, lastDate: null, dist: {} };

export const loadStats = (game) => ({ ...EMPTY_STATS, ...read(`${game}:stats`, {}) });

function previousDay(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Registra una partida terminada (una sola vez por día). `bucket` es la
// clave de la distribución (aciertos, intentos usados, etc.).
export function recordResult(game, date, { won, bucket }) {
  const s = loadStats(game);
  if (s.lastDate === date) return s;
  const streak = won ? (s.lastDate === previousDay(date) ? s.streak + 1 : 1) : 0;
  const next = {
    played: s.played + 1,
    won: s.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    lastDate: date,
    dist: { ...s.dist, [bucket]: (s.dist[bucket] || 0) + 1 },
  };
  write(`${game}:stats`, next);
  return next;
}
