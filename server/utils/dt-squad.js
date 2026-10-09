// Plantel de cada manager de la Liga Online DT. El cliente guarda su carrera (plantel,
// formación, energía, cantera, tácticas) y el servidor la conserva por liga y usuario.
// Para resolver los partidos se calcula acá la fuerza del once titular, con la misma idea
// que el motor del Modo DT: nivel de los titulares, moral, energía y ritmo del equipo.
export const MAX_SQUAD_STATE_BYTES = 1800000;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Fuerza (escala del nivel de un club: ~70 chico, ~77 medio, ~84 grande) o null si no hay once.
export function squadPower(state) {
  const squad = Array.isArray(state?.squad) ? state.squad : [];
  const starters = Array.isArray(state?.lineup?.starters) ? state.lineup.starters : [];
  const xi = starters.map((s) => squad.find((p) => p && p.id === s.playerId)).filter(Boolean);
  if (xi.length < 7) return null;
  const morale = state.morale || {};
  const fatigue = state.fatigue || {};
  const total = xi.reduce((sum, p) => {
    const m = Number(morale[p.id] ?? 70);
    const f = Number(fatigue[p.id] ?? 100);
    const mBonus = m >= 85 ? 2 : m <= 35 ? -4 : 0;
    const fBonus = f <= 30 ? -6 : f <= 55 ? -2.5 : 0;
    return sum + (Number(p.ovr) || 60) + mBonus + fBonus;
  }, 0);
  // El ritmo de competencia (0-100) suma o resta hasta ~2 puntos.
  const sharp = (clamp(Number(state.sharpness ?? 50), 0, 100) - 50) / 25;
  return Math.round(clamp(total / xi.length + sharp, 50, 92) * 10) / 10;
}

// Táctica de la carrera en el formato de la liga (mentalidad 1-5, pressing y tempo 0-100).
export function tacticsOf(state) {
  return {
    mentality: Math.round(clamp(Number(state?.mentality ?? 3), 1, 5)),
    pressing: Math.round(clamp(Number(state?.sliders?.pressing ?? 50), 0, 100)),
    tempo: Math.round(clamp(Number(state?.sliders?.tempo ?? 50), 0, 100)),
  };
}

// Valida lo mínimo para no guardar basura: objeto con plantel de tamaño razonable.
export function isValidSquadState(state) {
  return !!state && typeof state === "object" && !Array.isArray(state)
    && Array.isArray(state.squad) && state.squad.length >= 11 && state.squad.length <= 120
    && state.lineup && Array.isArray(state.lineup.starters);
}
