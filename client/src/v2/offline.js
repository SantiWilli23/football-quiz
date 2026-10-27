import api from "../api.js";

// Partido del día sin señal. Con conexión, el paquete del día (las preguntas, sin
// respuestas correctas) se guarda en el teléfono. Sin conexión se juega con ese paquete,
// las elecciones quedan en una cola y se mandan solas al volver la red; recién ahí el
// servidor corrige y suma. Todo en try/catch: sin storage simplemente no hay modo offline.
const PKG = "fq_daily_pkg";
const QUEUE = "fq_daily_queue";

const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin storage */ } };

export function savePackage(date, items) {
  write(PKG, { date, items });
}

export function loadPackage(date) {
  const pkg = read(PKG);
  return pkg && pkg.date === date ? pkg : null;
}

export function getQueue() {
  const q = read(QUEUE);
  return q && Array.isArray(q.answers) ? q : null;
}

export function queueAnswer(date, entry) {
  const q = getQueue();
  const base = q && q.date === date ? q : { date, answers: [] };
  base.answers.push(entry);
  write(QUEUE, base);
  return base;
}

export function clearQueue() {
  try { localStorage.removeItem(QUEUE); } catch { /* sin storage */ }
}

// ¿Hay una partida completa esperando señal?
export function pendingMatch(total) {
  const q = getQueue();
  return q && q.answers.length >= total ? q : null;
}

// Manda la cola si la partida está completa. Devuelve el resultado, un error del
// servidor (y descarta la cola, porque reintentar no lo arregla) o null si no hay red.
export async function syncQueue(total = 17) {
  const q = pendingMatch(total);
  if (!q) return null;
  try {
    const { data } = await api.post("/daily/sync", { date: q.date, answers: q.answers });
    clearQueue();
    return { ...data, date: q.date };
  } catch (e) {
    if (e.response) {
      clearQueue();
      return { error: e.response.data?.error || "No se pudo enviar la partida." };
    }
    return null;
  }
}
