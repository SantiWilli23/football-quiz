// Energía y días de la semana del Modo DT.
//
// Cada semana tiene 7 días y el partido se juega el sábado. Los días previos se
// pueden simular uno por uno eligiendo qué hace el plantel: eso mueve la energía de
// cada jugador (que ya pesa en el partido, ver squadOvr en matchEngine) y el "ritmo"
// del equipo (qué tan afinado llega al partido). Si se juega el partido sin simular los
// días, los que faltan pasan solos con trabajo liviano.

export const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const MATCH_DAY = 5; // sábado
export const SEASON_WEEKS = 38;

// energy: cambio de energía por día. sharpness: cambio del ritmo de competencia.
export const ACTIVITIES = {
  descanso:    { label: "Descanso", desc: "Todos recuperan fuerzas, pero el equipo pierde ritmo.", energy: 14, sharpness: -3, tone: "blue" },
  recuperacion: { label: "Recuperación", desc: "Trabajo regenerativo: muy buena energía, ritmo estable.", energy: 10, sharpness: 0, tone: "emerald" },
  ligero:      { label: "Entrenamiento ligero", desc: "Mantiene el ritmo sin gastar mucho.", energy: 5, sharpness: 2, tone: "accent" },
  tactico:     { label: "Trabajo táctico", desc: "Ensayo de jugadas: sube el ritmo con poco desgaste.", energy: -3, sharpness: 5, tone: "purple" },
  intenso:     { label: "Entrenamiento intenso", desc: "Sube mucho el ritmo, pero cansa a todos.", energy: -10, sharpness: 8, tone: "red" },
};
export const DEFAULT_ACTIVITY = "ligero";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Fecha de calendario de un día de la temporada: arranca el 10 de agosto.
export function seasonStartDate(season = 1) {
  return new Date(Date.UTC(2026 + (season - 1), 7, 10));
}

export function dateOfDay(season, week, day) {
  const d = seasonStartDate(season);
  d.setUTCDate(d.getUTCDate() + week * 7 + day);
  return d;
}

export const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function currentDate(s) {
  return dateOfDay(s.season || 1, s.week || 0, s.day || 0);
}

export function energyOf(s, id) {
  return s.fatigue?.[id] ?? 100;
}

// Energía promedio de los titulares (o de todo el plantel si no hay lineup).
export function squadEnergy(s) {
  const ids = (s.lineup?.starters || []).map((x) => x.playerId).filter(Boolean);
  const list = ids.length ? ids : (s.squad || []).map((p) => p.id);
  if (!list.length) return 100;
  return Math.round(list.reduce((n, id) => n + energyOf(s, id), 0) / list.length);
}

export function energyTone(v) {
  if (v >= 70) return "emerald";
  if (v >= 45) return "amber";
  return "red";
}

// Aplica un día de actividad. Los lesionados solo recuperan (nunca gastan energía).
export function applyDayActivity(s, activityId) {
  const act = ACTIVITIES[activityId] || ACTIVITIES[DEFAULT_ACTIVITY];
  const injured = new Set((s.injuries || []).filter((i) => i.returnWeek > s.week).map((i) => i.playerId));
  const fatigue = { ...(s.fatigue || {}) };
  (s.squad || []).forEach((p) => {
    const cur = fatigue[p.id] ?? 100;
    const delta = injured.has(p.id) ? Math.max(0, act.energy) * 0.5 : act.energy;
    fatigue[p.id] = clamp(Math.round(cur + delta), 0, 100);
  });
  return {
    fatigue,
    sharpness: clamp((s.sharpness ?? 50) + act.sharpness, 0, 100),
    day: (s.day || 0) + 1,
    dayLog: [...(s.dayLog || []).slice(-13), { week: s.week, day: s.day || 0, activity: activityId }],
  };
}

// Bonus de forma del equipo para el partido, según qué tan afinado llega (-8..+8).
export function formScoreFromSharpness(sharpness = 50) {
  return 65 + Math.round(((sharpness ?? 50) - 50) * 0.16);
}

// Resumen para mostrar: cómo llega el equipo al partido.
export function matchReadiness(s) {
  const energy = squadEnergy(s);
  const sharp = s.sharpness ?? 50;
  const score = Math.round(energy * 0.6 + sharp * 0.4);
  return { energy, sharpness: sharp, score, label: score >= 75 ? "Llega afinado" : score >= 55 ? "Llega bien" : score >= 40 ? "Llega justo" : "Llega cansado" };
}
