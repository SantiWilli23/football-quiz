// Progresión y envejecimiento de jugadores al final de cada temporada.
function growthPerSeason(player) {
  const { age, ovr, potential } = player;
  const gap = potential - ovr;
  if (gap <= 0) return age <= 27 ? 0 : -1;
  if (age <= 21) return Math.min(gap, Math.floor(Math.random() * 3) + 2);
  if (age <= 24) return Math.min(gap, Math.floor(Math.random() * 3) + 1);
  if (age <= 27) return Math.min(gap, Math.floor(Math.random() * 2));
  if (age <= 30) return Math.random() > 0.7 ? -1 : 0;
  if (age <= 33) return -Math.floor(Math.random() * 2);
  return -(Math.floor(Math.random() * 2) + 1);
}

export function ageSquad(squad) {
  return squad
    .map((p) => {
      const age = p.age + 1;
      const delta = growthPerSeason(p);
      const ovr = Math.max(35, Math.min(p.potential, p.ovr + delta));
      const contractYears = Math.max(0, p.contractYears - 1);
      return { ...p, age, ovr, contractYears };
    })
    .filter((p) => p.age < 41);
}

export function releaseExpired(squad) {
  return squad.filter((p) => p.contractYears > 0);
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
