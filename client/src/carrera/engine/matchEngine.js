import { effectiveOvr } from "./positions.js";

// Motor de simulación de partidos.
function squadOvr(players, lineupSlots) {
  const xi = (lineupSlots || [])
    .map((slot) => ({ p: players.find((pl) => pl.id === slot.playerId), pos: slot.slot }))
    .filter((x) => x.p);
  if (!xi.length) return 60;
  return xi.reduce((s, x) => s + effectiveOvr(x.p, x.pos), 0) / xi.length;
}

function mentalityScore(mentality) {
  // 1 (muy defensivo) a 5 (muy ofensivo) -> factor de ataque/defensa
  return { attack: 0.7 + mentality * 0.12, defense: 1.3 - mentality * 0.1 };
}

function slidersScore(sliders) {
  // sliders: { pressing, defLine, tempo, width, offDepth, duels, buildUp, transition } todos 0-100
  const pressBoost = sliders.pressing / 100;
  const tempoBoost = sliders.tempo / 100;
  return { pressBoost, tempoBoost };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clampRate(v) { return Math.max(0.001, Math.min(0.08, v)); }

// "Día del equipo": nadie rinde exactamente a su nivel de papel todos los
// partidos. Sin esto, el equipo mejor armado gana siempre y el juego se
// vuelve una formalidad — con esto un equipo parejo puede perder ante uno
// peor, como en la vida real.
function dayFormFactor() {
  // Distribución con forma de campana aproximada (suma de 3 uniformes),
  // centrada en 1.0, con cola hacia días muy malos/muy buenos.
  const noise = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ~[-1,1] concentrado al centro
  return clamp(1 + noise * 0.22, 0.68, 1.32);
}

// Genera eventos minuto a minuto para el partido del usuario.
export function simulateUserMatch({ myPlayers, myLineup, myMentality, mySliders, myFormScore, rivalOvr, rivalFormScore, isHome, rivalMentality = 3 }) {
  const myOvr = squadOvr(myPlayers, myLineup);
  const ms = mentalityScore(myMentality);
  const rms = mentalityScore(rivalMentality);
  const ss = slidersScore(mySliders || { pressing: 50, tempo: 50 });
  const homeBonus = isHome ? 2.2 : 0;

  // El "día" de cada equipo se sortea una sola vez por partido: representa
  // que hoy le salió todo (o nada) a un plantel completo, no minuto a minuto.
  const myDay = dayFormFactor();
  const rivalDay = dayFormFactor();

  const attackingPower = ((myOvr + homeBonus) * 0.4 + ms.attack * 20 + (myFormScore || 60) * 0.15) * myDay;
  const defensivePower = ((myOvr + homeBonus) * 0.4 + ms.defense * 15 + (myFormScore || 60) * 0.1) * myDay;
  const rivalAttack = (rivalOvr * 0.4 + rms.attack * 20 + (rivalFormScore || 60) * 0.15 + 6) * rivalDay;
  const rivalDefense = (rivalOvr * 0.4 + rms.defense * 15 + (rivalFormScore || 60) * 0.1 + 4) * rivalDay;

  const goalChancePerMin = clampRate((attackingPower - rivalDefense) / 900 + 0.0075 + ss.tempoBoost * 0.004);
  const concededChancePerMin = clampRate((rivalAttack - defensivePower) / 900 + 0.0075);

  const events = [];
  let myGoals = 0, rivalGoals = 0;
  let myShots = 0, rivalShots = 0, myShotsOnTarget = 0, rivalShotsOnTarget = 0;
  let myCorners = 0, rivalCorners = 0, myFouls = 0, rivalFouls = 0, myYellow = 0, rivalYellow = 0;
  let myPossession = clamp(48 + (myOvr - rivalOvr) * 0.55 + ss.tempoBoost * 4, 28, 74);

  const scorers = pickWeightedScorers(myPlayers, myLineup);
  let scorerIdx = 0;

  for (let min = 1; min <= 90; min++) {
    const fatigueFactor = min > 65 && ss.pressBoost > 0.6 ? 0.85 : 1;
    if (Math.random() < goalChancePerMin * fatigueFactor) {
      myGoals++;
      const scorer = scorers[scorerIdx % scorers.length];
      scorerIdx++;
      events.push({ min, type: "goal", team: "me", text: `⚽ GOL! ${scorer ? scorer.name : "Tu equipo"} marca. ${myGoals}-${rivalGoals}` });
    } else if (Math.random() < concededChancePerMin) {
      rivalGoals++;
      events.push({ min, type: "goal", team: "rival", text: `⚽ Gol del rival. ${myGoals}-${rivalGoals}` });
    } else if (Math.random() < goalChancePerMin * 2.5) {
      myShots++; if (Math.random() < 0.5) myShotsOnTarget++;
      events.push({ min, type: "shot", team: "me", text: "💨 Remate que se va cerca" });
    } else if (Math.random() < concededChancePerMin * 2.5) {
      rivalShots++; if (Math.random() < 0.5) rivalShotsOnTarget++;
      events.push({ min, type: "shot", team: "rival", text: "💨 Tiro del rival, atento el arquero" });
    } else if (Math.random() < 0.03) {
      if (Math.random() < 0.5) myCorners++; else rivalCorners++;
    } else if (Math.random() < 0.02 + ss.pressBoost * 0.015) {
      const mine = Math.random() < 0.5;
      if (mine) { myFouls++; if (Math.random() < 0.12) { myYellow++; events.push({ min, type: "card", team: "me", text: "🟨 Tarjeta amarilla para tu equipo" }); } }
      else { rivalFouls++; if (Math.random() < 0.12) { rivalYellow++; events.push({ min, type: "card", team: "rival", text: "🟨 Tarjeta amarilla para el rival" }); } }
    }
    if (min === 45) events.push({ min: 45, type: "half", team: null, text: "⏸ FIN DEL PRIMER TIEMPO" });
  }
  events.push({ min: 90, type: "full", team: null, text: `⏹ FINAL DEL PARTIDO: ${myGoals}-${rivalGoals}` });

  return {
    myGoals, rivalGoals, events, myOvr, rivalOvr, myDay, rivalDay,
    stats: {
      possession: Math.round(myPossession),
      shots: { me: myShots + myGoals, rival: rivalShots + rivalGoals },
      shotsOnTarget: { me: myShotsOnTarget + myGoals, rival: rivalShotsOnTarget + rivalGoals },
      corners: { me: myCorners, rival: rivalCorners },
      fouls: { me: myFouls, rival: rivalFouls },
      yellow: { me: myYellow, rival: rivalYellow },
    },
  };
}

function pickWeightedScorers(players, lineup) {
  const xi = (lineup || []).map((slot) => players.find((p) => p.id === slot.playerId)).filter(Boolean);
  const attackers = xi.filter((p) => ["ST", "LW", "RW", "CAM"].includes(p.position));
  const rest = xi.filter((p) => !attackers.includes(p));
  const weighted = [...attackers, ...attackers, ...attackers, ...rest];
  return weighted.length ? weighted : xi;
}

// Simulación rápida (estadística) para partidos que no involucran al usuario.
// También usa un factor de "día" por equipo, así el resto de la liga tiene
// sorpresas y las tablas no quedan siempre ordenadas por OVR.
export function simulateQuickMatch(teamAOvr, teamBOvr, homeAdvantage = 2.2) {
  const dayA = dayFormFactor();
  const dayB = dayFormFactor();
  const diff = (teamAOvr + homeAdvantage) * dayA - teamBOvr * dayB;
  const base = 1.35 + diff / 20;
  const golesA = poisson(clamp(base, 0.15, 4.4));
  const golesB = poisson(clamp(1.35 - diff / 24, 0.15, 4.4));
  return { golesA, golesB };
}

function poisson(lambda) {
  let l = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}
