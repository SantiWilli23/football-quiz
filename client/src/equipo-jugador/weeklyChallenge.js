// Reto semanal de Equipo-Jugador: gana el que más rondas de 4 jugadores
// online ganó en la semana. Se cuenta local (por dispositivo/sesión) y se
// manda al ranking real del grupo cada vez que suma una victoria más.
const WINS_KEY = "ej_weekly_wins";

function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNumber = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function loadWins() {
  const week = isoWeekKey();
  try {
    const raw = JSON.parse(localStorage.getItem(WINS_KEY) || "null");
    if (!raw || raw.week !== week) return { week, count: 0 };
    return raw;
  } catch {
    return { week, count: 0 };
  }
}

function submitChallengeScore(score) {
  try {
    const token = localStorage.getItem("fq_token");
    const groupId = localStorage.getItem("fq_active_group");
    if (!token || !groupId) return;
    fetch("/api/challenges/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gameKey: "equipo_jugador", groupId: Number(groupId), score }),
    }).catch(() => {});
  } catch {
    /* sin sesión o localStorage no disponible: no rompe el juego */
  }
}

// Llamar cuando ESTE dispositivo ganó una ronda online de 4 jugadores.
// Devuelve el total acumulado en la semana.
export function registerFourPlayerWin() {
  const current = loadWins();
  const next = { week: current.week, count: current.count + 1 };
  try { localStorage.setItem(WINS_KEY, JSON.stringify(next)); } catch { /* noop */ }
  submitChallengeScore(next.count);
  return next.count;
}

export function currentWeeklyWins() {
  return loadWins().count;
}
