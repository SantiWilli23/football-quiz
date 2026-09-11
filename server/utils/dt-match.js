// Simulación liviana de partidos para la Liga Online DT: no hay planteles
// individuales acá (eso es todo el modo Carrera single-player, que vive en
// el cliente), así que cada club se resuelve por su "jerarquía" (tier) +
// la táctica que haya elegido su DT humano. Mismo estilo estadístico
// (Poisson + factor de forma del día) que usa matchEngine.js del lado
// del cliente, para que los resultados se sientan parecidos en toda la app.

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function tierToOvr(tier) {
  return tier === 1 ? 84 : tier === 2 ? 77 : 70;
}

function dayFormFactor() {
  const noise = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  return clamp(1 + noise * 0.22, 0.68, 1.32);
}

function poisson(lambda) {
  let l = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}

// tactics: { mentality: 1-5, pressing: 0-100, tempo: 0-100 } o null (default).
function effectiveRating(tier, tactics) {
  const base = tierToOvr(tier);
  if (!tactics) return base;
  const mentalityMod = (tactics.mentality - 3) * 1.2;
  const pressMod = ((tactics.pressing ?? 50) - 50) / 100 * 2;
  const tempoMod = ((tactics.tempo ?? 50) - 50) / 100 * 1.5;
  return base + mentalityMod + pressMod + tempoMod;
}

export function simulateFixture({ homeTier, awayTier, homeTactics, awayTactics }) {
  const homeOvr = effectiveRating(homeTier, homeTactics);
  const awayOvr = effectiveRating(awayTier, awayTactics);
  const homeDay = dayFormFactor();
  const awayDay = dayFormFactor();
  const homeAdvantage = 2.2;

  const diff = (homeOvr + homeAdvantage) * homeDay - awayOvr * awayDay;
  const baseHome = 1.35 + diff / 20;
  const baseAway = 1.35 - diff / 24;

  return {
    homeGoals: poisson(clamp(baseHome, 0.15, 4.4)),
    awayGoals: poisson(clamp(baseAway, 0.15, 4.4)),
  };
}

// Doble round-robin (ida y vuelta): cada entrada de la lista devuelta es una
// semana, con pares [homeTeamId, awayTeamId]. Si hay número impar de equipos
// se agrega un "bye" (null) que se descarta al armar la fixture real.
export function generateRoundRobin(teamIds) {
  const ids = teamIds.slice();
  if (ids.length % 2 !== 0) ids.push(null);
  const n = ids.length;
  const half = n / 2;
  const rounds = [];
  let arr = ids.slice();

  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== null && b !== null) round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }

  const second = rounds.map((round) => round.map(([a, b]) => [b, a]));
  return [...rounds, ...second];
}
