import { resolveTrainingDelta } from "./positions.js";

function rndInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function growthPerSeason(player) {
  const { age, ovr, potential } = player;
  const gap = potential - ovr;
  if (gap <= 0) return age < 28 ? 0 : -rndInt(1, 3);
  if (age <= 21) return Math.min(gap, rndInt(2, 5));
  if (age < 28) return Math.min(gap, rndInt(1, 3));
  if (age <= 32) {
    if (gap >= 3 && Math.random() < 0.5) return Math.min(gap, rndInt(1, 3));
    return -rndInt(1, 3);
  }
  return -rndInt(1, 3);
}

// Bonus para jóvenes titulares habituales: si un jugador <= 21 años jugó
// >= 18 partidos de titular en la temporada, gana +1 OVR extra de experiencia.
export function ageSquad(squad, playerStats = {}) {
  return squad
    .map((p) => {
      const age = p.age + 1;
      const base = growthPerSeason(p);
      const appearances = playerStats[p.id]?.appearances || 0;
      const youthBonus = p.age <= 21 && appearances >= 18 ? 1 : 0;
      const delta = base + youthBonus;
      const ovr = Math.max(35, Math.min(p.potential, p.ovr + delta));
      const contractYears = Math.max(0, p.contractYears - 1);
      // Evolución del valor de mercado: sube o baja según el progreso de OVR de la temporada.
      const prevValue = p.value;
      const value = Math.max(0.5, Math.round(p.value * (1 + delta * 0.07) * 20) / 20);
      return { ...p, age, ovr, contractYears, prevValue, value };
    })
    .filter((p) => p.age < 41);
}

export function releaseExpired(squad) {
  return squad.filter((p) => p.contractYears > 0);
}

export function applyPositionTrainings(squad, week) {
  const news = [];
  const updated = squad.map((p) => {
    if (!p.training || week < p.training.endWeek) return p;
    const delta = resolveTrainingDelta(p.position, p.training.targetPos);
    const ovr = Math.max(30, Math.min(99, p.ovr + delta));
    const arrow = delta > 0 ? "📈" : delta < 0 ? "📉" : "🎓";
    news.push(`${arrow} ${p.name} completó su reconversión a ${p.training.targetPos} (OVR ${ovr}, antes ${p.ovr}).`);
    return { ...p, position: p.training.targetPos, ovr, training: null };
  });
  return { squad: updated, news };
}

const YOUTH_FIRST = ["Alex", "Marco", "Leo", "Kai", "Theo", "Nico", "Dario", "Iker", "Owen", "Milan"];
const YOUTH_LAST = ["Ferreira", "Kowalski", "Traoré", "Larsson", "Petrov", "Duarte", "Novak", "Reyes", "Berg", "Costa"];

export function generateYouthProspects(team, count = 4) {
  const positions = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];
  const out = [];
  for (let i = 0; i < count; i++) {
    const ovr = 56 + Math.floor(Math.random() * 13);
    const potential = 78 + Math.floor(Math.random() * 16);
    out.push({
      id: `${team.id}_youth_${Date.now()}_${i}`,
      name: `${YOUTH_FIRST[Math.floor(Math.random() * YOUTH_FIRST.length)]} ${YOUTH_LAST[Math.floor(Math.random() * YOUTH_LAST.length)]}`,
      age: 16 + Math.floor(Math.random() * 4),
      nationality: "—",
      position: positions[Math.floor(Math.random() * positions.length)],
      ovr,
      potential,
      value: Math.min(5, Math.round(Math.pow(ovr - 40, 1.5) / 10)),
      wage: 2,
      teamId: team.id,
      attributes: { pace: ovr, shooting: ovr, passing: ovr, dribbling: ovr, defending: ovr, physical: ovr },
      contractYears: 3,
      isYouth: true,
    });
  }
  return out;
}
