// Motor de simulación de partidos ÚNICO para toda la app. Antes cada juego
// con partidos (DT League, Cartas, y lo que use Cotrero/Presidente más
// adelante) tenía su propia fórmula de goles esperados, con su propio nivel
// de realismo — la de Cartas, por ejemplo, llegó a dar goleadas de 6-0/7-0
// contra rivales flojos antes de que se la parchara a mano. Ahora todos
// llaman a este mismo núcleo (Poisson + factor de forma del día), y solo
// difieren en cómo calculan el OVR de entrada (DT suma tácticas, Cartas
// suma química de plantel, etc.) — eso queda en cada juego, esto de acá
// es el "¿cuántos goles mete cada uno?" común a todos.

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// Ruido acotado (media 0, ±32% en los extremos) que representa el "día" de
// cada equipo — mismo equipo, mismo rival, pero no siempre juega igual.
export function dayFormFactor() {
  const noise = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  return clamp(1 + noise * 0.22, 0.68, 1.32);
}

export function poisson(lambda) {
  let l = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}

// Sortea `count` minutos distintos entre 1 y 90 (sin pisar el 45, reservado
// para el marcador de entretiempo).
export function pickMinutes(count) {
  const minutes = new Set();
  while (minutes.size < count) {
    const m = 1 + Math.floor(Math.random() * 90);
    if (m !== 45) minutes.add(m);
  }
  return [...minutes].sort((a, b) => a - b);
}

// De un OVR efectivo por lado a cuántos goles espera meter cada uno. Curva
// capada (0.15 a 4.4 goles esperados) para que una diferencia enorme de
// nivel no termine en un marcador absurdo — el mismo tope que ya se probó
// necesario en Cartas.
function expectedGoals({ ovrHome, ovrAway, homeAdvantage, homeDay, awayDay }) {
  const diff = (ovrHome + homeAdvantage) * homeDay - ovrAway * awayDay;
  return {
    home: clamp(1.35 + diff / 20, 0.15, 4.4),
    away: clamp(1.35 - diff / 24, 0.15, 4.4),
  };
}

// Resultado final nomás (sin línea de tiempo) — para partidos que se
// resuelven de una, sin necesidad de reproducirlos minuto a minuto.
export function simulateMatchScore({ ovrHome, ovrAway, homeAdvantage = 2.2 }) {
  const homeDay = dayFormFactor();
  const awayDay = dayFormFactor();
  const { home, away } = expectedGoals({ ovrHome, ovrAway, homeAdvantage, homeDay, awayDay });
  return { homeGoals: poisson(home), awayGoals: poisson(away) };
}

// Igual que simulateMatchScore, pero además arma la línea de tiempo con un
// minuto por gol (y el corte de entretiempo) — lo que necesita la cancha
// animada para reproducir el partido en vez de tirar el resultado de una.
export function simulateMatchEvents({ ovrHome, ovrAway, homeAdvantage = 2.2 }) {
  const homeDay = dayFormFactor();
  const awayDay = dayFormFactor();
  const { home, away } = expectedGoals({ ovrHome, ovrAway, homeAdvantage, homeDay, awayDay });
  const homeGoals = poisson(home);
  const awayGoals = poisson(away);

  const timeline = [
    ...pickMinutes(homeGoals).map((min) => ({ min, team: "home" })),
    ...pickMinutes(awayGoals).map((min) => ({ min, team: "away" })),
  ].sort((a, b) => a.min - b.min);

  const events = [];
  let runningHome = 0, runningAway = 0;
  let halfInserted = false;
  timeline.forEach(({ min, team }) => {
    if (!halfInserted && min > 45) {
      events.push({ min: 45, team: null, type: "half", text: "⏸ Fin del primer tiempo" });
      halfInserted = true;
    }
    if (team === "home") runningHome++; else runningAway++;
    events.push({
      min, team, type: "goal",
      text: team === "home" ? `⚽ Gol de local. ${runningHome}-${runningAway}` : `⚽ Gol de visitante. ${runningHome}-${runningAway}`,
    });
  });
  if (!halfInserted) events.push({ min: 45, team: null, type: "half", text: "⏸ Fin del primer tiempo" });
  events.push({ min: 90, team: null, type: "final", text: `⏹ Final: ${homeGoals}-${awayGoals}` });

  return { homeGoals, awayGoals, events };
}
