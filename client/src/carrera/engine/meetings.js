// Reuniones del DT: una por semana. Cada semana se ofrecen 3 al azar (siempre las
// mismas para esa semana, así recargar la página no las cambia) de este catálogo.
//
// effects (todos opcionales):
//   morale          moral de todo el plantel
//   moraleStarters  moral de los titulares
//   moraleBench     moral de los que no son titulares
//   moraleStar      moral del mejor jugador
//   energy          energía de todo el plantel
//   sharpness       ritmo de competencia del equipo
//   board           confianza de la directiva
//   reputation      reputación del club
//   budget          millones de euros de presupuesto
//   youth           suben de nivel los chicos de la cantera (probabilidad por chico)

export const MEETINGS = [
  { id: "motivate", label: "Charla motivadora", desc: "Un discurso que levanta al vestuario.", tone: "emerald", effects: { morale: 8 }, news: "🗣️ Diste una charla motivadora al plantel. La moral general sube." },
  { id: "demand", label: "Exigir más nivel", desc: "Marcás la cancha: la directiva lo valora, el vestuario se tensa.", tone: "red", effects: { morale: -3, board: 3, sharpness: 4 }, news: "📢 Exigiste más nivel al plantel. La directiva valora tu carácter, aunque genera algo de tensión." },
  { id: "rest", label: "Día libre", desc: "Descanso total y el plantel lo agradece.", tone: "blue", effects: { morale: 12, energy: 8, sharpness: -4 }, news: "🌴 Le diste un día libre al plantel. La moral sube notablemente." },
  { id: "asado", label: "Asado del equipo", desc: "Un almuerzo para soltarse y hacer grupo.", tone: "amber", effects: { morale: 10, energy: 4, budget: -0.2 }, news: "🍖 Hubo asado de equipo: el grupo se unió más (cuesta €0.2M)." },
  { id: "video", label: "Análisis de video", desc: "Mirás los errores y los aciertos de los últimos partidos.", tone: "purple", effects: { morale: 2, sharpness: 6 }, news: "🎞️ Hiciste una sesión de video: el equipo llega más claro al próximo partido." },
  { id: "captains", label: "Reunión con los capitanes", desc: "Alineás el mensaje con los líderes del grupo.", tone: "accent", effects: { moraleStarters: 6, moraleBench: 1, board: 1 }, news: "🤝 Te reuniste con los capitanes: los titulares salen fortalecidos." },
  { id: "star", label: "Charla con la figura", desc: "Un cara a cara con tu mejor jugador.", tone: "amber", effects: { moraleStar: 18, moraleBench: -1 }, news: "⭐ Charlaste a solas con tu figura: sale convencido del proyecto." },
  { id: "bench", label: "Hablar con los suplentes", desc: "Mostrás que todos cuentan, aunque no jueguen.", tone: "blue", effects: { moraleBench: 10, moraleStarters: -1 }, news: "🪑 Hablaste con los suplentes: se sienten parte del plantel." },
  { id: "board", label: "Pedir presupuesto", desc: "Vas a la oficina de la directiva a pedir refuerzos.", tone: "pink", effects: { budget: 1.5, board: -3 }, news: "💼 Pediste más presupuesto: te dieron €1.5M, pero la directiva no quedó contenta." },
  { id: "plan", label: "Presentar el proyecto", desc: "Mostrás el plan deportivo a la directiva.", tone: "pink", effects: { board: 6, morale: -1 }, news: "📊 Presentaste el proyecto deportivo: la directiva te respalda más." },
  { id: "youth", label: "Charla con la cantera", desc: "Visitás a los juveniles y les marcás el camino.", tone: "emerald", effects: { youth: 0.25, morale: 2 }, news: "🌱 Hablaste con los chicos de la cantera: algunos dieron un salto." },
  { id: "fans", label: "Encuentro con hinchas", desc: "Saludás a la gente en la puerta del club.", tone: "red", effects: { reputation: 4, morale: 3 }, news: "🎽 Te juntaste con los hinchas: crece el cariño por el club." },
  { id: "recovery", label: "Sesión de recuperación", desc: "Hielo, pileta y masajes para todos.", tone: "cyan", effects: { energy: 14, morale: 1 }, news: "🧊 Hicieron una sesión de recuperación: el plantel llega con más energía." },
  { id: "closed", label: "Entrenamiento a puertas cerradas", desc: "Una semana dura, sin cámaras ni distracciones.", tone: "purple", effects: { sharpness: 9, energy: -6, morale: -2 }, news: "🔒 Entrenaron a puertas cerradas: más ritmo, pero el grupo termina cansado." },
];

export const MEETING_BY_ID = Object.fromEntries(MEETINGS.map((m) => [m.id, m]));

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 3 reuniones "al azar" para esta semana de esta temporada (estables por semana).
export function meetingsForWeek(s) {
  const seed = `${s.teamId}|${s.season}|${s.week}`;
  return [...MEETINGS]
    .map((m) => ({ m, k: hash(`${seed}|${m.id}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 3)
    .map((x) => x.m);
}

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

// Devuelve el parche de estado de la reunión (o null si no corresponde).
export function applyMeeting(s, id) {
  const meeting = MEETING_BY_ID[id];
  if (!meeting) return null;
  const fx = meeting.effects;
  const morale = { ...(s.morale || {}) };
  const fatigue = { ...(s.fatigue || {}) };
  const starters = new Set((s.lineup?.starters || []).map((x) => x.playerId).filter(Boolean));
  const best = [...s.squad].sort((a, b) => b.ovr - a.ovr)[0];

  s.squad.forEach((p) => {
    let dm = fx.morale || 0;
    if (starters.has(p.id)) dm += fx.moraleStarters || 0; else dm += fx.moraleBench || 0;
    if (best && p.id === best.id) dm += fx.moraleStar || 0;
    if (dm) morale[p.id] = clamp((morale[p.id] ?? 70) + dm);
    if (fx.energy) fatigue[p.id] = clamp((fatigue[p.id] ?? 100) + fx.energy);
  });

  const patch = {
    morale,
    fatigue,
    sharpness: fx.sharpness ? clamp((s.sharpness ?? 50) + fx.sharpness) : s.sharpness ?? 50,
    boardConfidence: clamp((s.boardConfidence ?? 60) + (fx.board || 0)),
    clubReputation: clamp((s.clubReputation ?? 50) + (fx.reputation || 0)),
    budget: fx.budget ? Math.max(0, Math.round((s.budget + fx.budget) * 20) / 20) : s.budget,
    lastMeetingWeek: s.week,
  };

  if (fx.youth && s.cantera?.youth?.length) {
    patch.cantera = {
      ...s.cantera,
      youth: s.cantera.youth.map((y) => (y.ovr < y.potential && Math.random() < fx.youth ? { ...y, ovr: y.ovr + 1 } : y)),
    };
  }
  return { patch, news: meeting.news };
}
