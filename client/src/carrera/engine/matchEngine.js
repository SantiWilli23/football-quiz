// Motor de simulación de partidos.
function squadOvr(players, ids) {
  const xi = ids.map((id) => players.find((p) => p.id === id)).filter(Boolean);
  if (!xi.length) return 60;
  return xi.reduce((s, p) => s + p.ovr, 0) / xi.length;
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

// Genera eventos minuto a minuto para el partido del usuario.
export function simulateUserMatch({ myPlayers, myLineup, myMentality, mySliders, myFormScore, rivalOvr, rivalFormScore, isHome }) {
  const myOvr = squadOvr(myPlayers, myLineup);
  const ms = mentalityScore(myMentality);
  const ss = slidersScore(mySliders || { pressing: 50, tempo: 50 });
  const homeBonus = isHome ? 3 : 0;

  const attackingPower = (myOvr + homeBonus) * 0.4 + ms.attack * 20 + (myFormScore || 60) * 0.15;
  const defensivePower = (myOvr + homeBonus) * 0.4 + ms.defense * 15 + (myFormScore || 60) * 0.1;
  const rivalAttack = rivalOvr * 0.4 + (rivalFormScore || 60) * 0.15 + 8;
  const rivalDefense = rivalOvr * 0.4 + (rivalFormScore || 60) * 0.1 + 6;

  const goalChancePerMin = clampRate((attackingPower - rivalDefense) / 900 + 0.006 + ss.tempoBoost * 0.004);
  const concededChancePerMin = clampRate((rivalAttack - defensivePower) / 900 + 0.006);

  const events = [];
  let myGoals = 0, rivalGoals = 0;
  let myShots = 0, rivalShots = 0, myShotsOnTarget = 0, rivalShotsOnTarget = 0;
  let myCorners = 0, rivalCorners = 0, myFouls = 0, rivalFouls = 0, myYellow = 0, rivalYellow = 0;
  let myPossession = clamp(48 + (myOvr - rivalOvr) * 0.6 + ss.tempoBoost * 4, 30, 75);

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
    myGoals, rivalGoals, events,
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
  const xi = lineup.map((id) => players.find((p) => p.id === id)).filter(Boolean);
  const attackers = xi.filter((p) => ["ST", "LW", "RW", "CAM"].includes(p.position));
  const rest = xi.filter((p) => !attackers.includes(p));
  const weighted = [...attackers, ...attackers, ...attackers, ...rest];
  return weighted.length ? weighted : xi;
}

// Simulación rápida (estadística) para partidos que no involucran al usuario.
export function simulateQuickMatch(teamAOvr, teamBOvr, homeAdvantage = 3) {
  const diff = teamAOvr + homeAdvantage - teamBOvr;
  const base = 1.4 + diff / 22;
  const golesA = poisson(clamp(base, 0.2, 4.2));
  const golesB = poisson(clamp(1.4 - diff / 26, 0.2, 4.2));
  return { golesA, golesB };
}

function poisson(lambda) {
  let l = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clampRate(v) { return Math.max(0.001, Math.min(0.08, v)); }
