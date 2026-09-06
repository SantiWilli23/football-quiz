import { effectiveOvr } from "./positions.js";

function squadOvr(players, lineupSlots, morale = {}) {
  const xi = (lineupSlots || [])
    .map((slot) => ({ p: players.find((pl) => pl.id === slot.playerId), pos: slot.slot }))
    .filter((x) => x.p);
  if (!xi.length) return 60;
  return xi.reduce((s, x) => {
    const eff = effectiveOvr(x.p, x.pos);
    const m = morale[x.p.id] ?? 70;
    const mBonus = m >= 85 ? 2 : m <= 35 ? -4 : 0;
    return s + eff + mBonus;
  }, 0) / xi.length;
}

function mentalityScore(mentality) {
  return { attack: 0.7 + mentality * 0.12, defense: 1.3 - mentality * 0.1 };
}

function slidersScore(sliders) {
  const pressBoost = sliders.pressing / 100;
  const tempoBoost = sliders.tempo / 100;
  return { pressBoost, tempoBoost };
}

function trainingMods(focus) {
  switch (focus) {
    case "defense":  return { atkMod: -2, defMod: 5,  pressMod: 0,    fatThreshold: 65 };
    case "attack":   return { atkMod: 5,  defMod: -2, pressMod: 0,    fatThreshold: 65 };
    case "pressing": return { atkMod: 0,  defMod: 0,  pressMod: 0.15, fatThreshold: 65 };
    case "fitness":  return { atkMod: 0,  defMod: 0,  pressMod: 0,    fatThreshold: 80 };
    default:         return { atkMod: 0,  defMod: 0,  pressMod: 0,    fatThreshold: 65 };
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function clampRate(v) { return Math.max(0.001, Math.min(0.08, v)); }

export function dayFormFactor() {
  const noise = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  return clamp(1 + noise * 0.22, 0.68, 1.32);
}

function computeRates({
  myPlayers, lineup, myMentality, mySliders, myFormScore,
  rivalOvr, rivalFormScore, isHome, rivalMentality = 3,
  morale, trainingFocus, myDay, rivalDay,
}) {
  const myOvr = squadOvr(myPlayers, lineup, morale);
  const ms = mentalityScore(myMentality);
  const rms = mentalityScore(rivalMentality);
  const ss = slidersScore(mySliders || { pressing: 50, tempo: 50 });
  const tm = trainingMods(trainingFocus);
  const homeBonus = isHome ? 2.2 : 0;

  const attackingPower = ((myOvr + homeBonus) * 0.4 + ms.attack * 20 + (myFormScore || 60) * 0.15 + tm.atkMod) * myDay;
  const defensivePower = ((myOvr + homeBonus) * 0.4 + ms.defense * 15 + (myFormScore || 60) * 0.1 + tm.defMod) * myDay;
  const rivalAttack = (rivalOvr * 0.4 + rms.attack * 20 + (rivalFormScore || 60) * 0.15 + 6) * rivalDay;
  const rivalDefense = (rivalOvr * 0.4 + rms.defense * 15 + (rivalFormScore || 60) * 0.1 + 4) * rivalDay;

  const effectivePressBoost = ss.pressBoost + tm.pressMod;
  const goalChancePerMin = clampRate((attackingPower - rivalDefense) / 900 + 0.0075 + ss.tempoBoost * 0.004);
  const concededChancePerMin = clampRate((rivalAttack - defensivePower) / 900 + 0.0075);
  const myPossessionBase = clamp(48 + (myOvr - rivalOvr) * 0.55 + ss.tempoBoost * 4, 28, 74);

  return { goalChancePerMin, concededChancePerMin, effectivePressBoost, tm, myPossessionBase };
}

// Simula un tiempo (1-45 o 46-90) con una alineación dada. Permite hacer
// cambios reales en el entretiempo: cada mitad recibe su propia lineup.
export function simulateHalf({
  myPlayers, lineup, myMentality, mySliders, myFormScore,
  rivalOvr, rivalFormScore, isHome, rivalMentality = 3,
  morale = {}, trainingFocus = "balanced", myDay, rivalDay, half,
}) {
  const rates = computeRates({
    myPlayers, lineup, myMentality, mySliders, myFormScore,
    rivalOvr, rivalFormScore, isHome, rivalMentality, morale, trainingFocus, myDay, rivalDay,
  });
  const { goalChancePerMin, concededChancePerMin, effectivePressBoost, tm } = rates;

  const minStart = half === 1 ? 1 : 46;
  const minEnd = half === 1 ? 45 : 90;

  const xi = (lineup || []).map((slot) => myPlayers.find((p) => p.id === slot.playerId)).filter(Boolean);
  const scorers = pickWeightedScorers(myPlayers, lineup);
  let scorerIdx = 0;

  const events = [];
  let myGoals = 0, rivalGoals = 0;
  let myShots = 0, rivalShots = 0, myShotsOnTarget = 0, rivalShotsOnTarget = 0;
  let myCorners = 0, rivalCorners = 0, myFouls = 0, rivalFouls = 0, myYellow = 0, rivalYellow = 0;
  const playerMatchStats = {};

  for (let min = minStart; min <= minEnd; min++) {
    const fatigueFactor = min > tm.fatThreshold && effectivePressBoost > 0.6 ? 0.85 : 1;

    if (Math.random() < goalChancePerMin * fatigueFactor) {
      myGoals++;
      const scorer = scorers[scorerIdx % scorers.length];
      scorerIdx++;
      const otherXi = xi.filter((p) => p.id !== scorer?.id);
      const assister = Math.random() < 0.6 && otherXi.length
        ? otherXi[Math.floor(Math.random() * otherXi.length)]
        : null;
      if (scorer?.id) {
        playerMatchStats[scorer.id] = playerMatchStats[scorer.id] || { goals: 0, assists: 0, yellowCards: 0 };
        playerMatchStats[scorer.id].goals++;
      }
      if (assister?.id) {
        playerMatchStats[assister.id] = playerMatchStats[assister.id] || { goals: 0, assists: 0, yellowCards: 0 };
        playerMatchStats[assister.id].assists++;
      }
      events.push({
        min, type: "goal", team: "me", scorerId: scorer?.id, assistId: assister?.id,
        text: `⚽ GOL! ${scorer ? scorer.name : "Tu equipo"} marca${assister ? ` (asist. ${assister.name.split(" ").slice(-1)[0]})` : ""}.`,
      });
    } else if (Math.random() < concededChancePerMin) {
      rivalGoals++;
      events.push({ min, type: "goal", team: "rival", text: "⚽ Gol del rival." });
    } else if (Math.random() < goalChancePerMin * 2.5) {
      myShots++; if (Math.random() < 0.5) myShotsOnTarget++;
      events.push({ min, type: "shot", team: "me", text: "💨 Remate que se va cerca" });
    } else if (Math.random() < concededChancePerMin * 2.5) {
      rivalShots++; if (Math.random() < 0.5) rivalShotsOnTarget++;
      events.push({ min, type: "shot", team: "rival", text: "💨 Tiro del rival, atento el arquero" });
    } else if (Math.random() < 0.03) {
      if (Math.random() < 0.5) myCorners++; else rivalCorners++;
    } else if (Math.random() < 0.02 + effectivePressBoost * 0.015) {
      const mine = Math.random() < 0.5;
      if (mine) {
        myFouls++;
        if (Math.random() < 0.12) {
          myYellow++;
          const cardPlayer = xi[Math.floor(Math.random() * xi.length)];
          if (cardPlayer?.id) {
            playerMatchStats[cardPlayer.id] = playerMatchStats[cardPlayer.id] || { goals: 0, assists: 0, yellowCards: 0 };
            playerMatchStats[cardPlayer.id].yellowCards++;
          }
          events.push({ min, type: "card", team: "me", cardPlayerId: cardPlayer?.id, text: "🟨 Tarjeta amarilla para tu equipo" });
        }
      } else {
        rivalFouls++;
        if (Math.random() < 0.12) {
          rivalYellow++;
          events.push({ min, type: "card", team: "rival", text: "🟨 Tarjeta amarilla para el rival" });
        }
      }
    }
  }

  if (half === 1) {
    events.push({ min: 45, type: "half", team: null, text: "⏸ FIN DEL PRIMER TIEMPO" });
  }

  return {
    myGoals, rivalGoals, events,
    myShots, rivalShots, myShotsOnTarget, rivalShotsOnTarget,
    myCorners, rivalCorners, myFouls, rivalFouls, myYellow, rivalYellow,
    playerMatchStats,
    starterIds: (lineup || []).filter((s) => s.playerId).map((s) => s.playerId),
    possessionBase: rates.myPossessionBase,
  };
}

// Combina el resultado de las dos mitades (posiblemente con cambios) en un resultado final único.
export function combineHalves(h1, h2) {
  const myGoals = h1.myGoals + h2.myGoals;
  const rivalGoals = h1.rivalGoals + h2.rivalGoals;
  const events = [...h1.events, ...h2.events, { min: 90, type: "full", team: null, text: `⏹ FINAL DEL PARTIDO: ${myGoals}-${rivalGoals}` }];

  const playerMatchStats = { ...h1.playerMatchStats };
  Object.entries(h2.playerMatchStats).forEach(([id, st]) => {
    const cur = playerMatchStats[id] || { goals: 0, assists: 0, yellowCards: 0 };
    playerMatchStats[id] = {
      goals: cur.goals + st.goals,
      assists: cur.assists + st.assists,
      yellowCards: cur.yellowCards + st.yellowCards,
    };
  });

  const starterIds = Array.from(new Set([...h1.starterIds, ...h2.starterIds]));

  return {
    myGoals, rivalGoals, events, playerMatchStats, starterIds,
    stats: {
      possession: Math.round((h1.possessionBase + h2.possessionBase) / 2),
      shots: { me: h1.myShots + h2.myShots + myGoals, rival: h1.rivalShots + h2.rivalShots + rivalGoals },
      shotsOnTarget: { me: h1.myShotsOnTarget + h2.myShotsOnTarget + myGoals, rival: h1.rivalShotsOnTarget + h2.rivalShotsOnTarget + rivalGoals },
      corners: { me: h1.myCorners + h2.myCorners, rival: h1.rivalCorners + h2.rivalCorners },
      fouls: { me: h1.myFouls + h2.myFouls, rival: h1.rivalFouls + h2.rivalFouls },
      yellow: { me: h1.myYellow + h2.myYellow, rival: h1.rivalYellow + h2.rivalYellow },
    },
  };
}

export function simulateUserMatch({
  myPlayers, myLineup, myMentality, mySliders, myFormScore,
  rivalOvr, rivalFormScore, isHome, rivalMentality = 3,
  morale = {}, trainingFocus = "balanced",
}) {
  const myOvr = squadOvr(myPlayers, myLineup, morale);
  const ms = mentalityScore(myMentality);
  const rms = mentalityScore(rivalMentality);
  const ss = slidersScore(mySliders || { pressing: 50, tempo: 50 });
  const tm = trainingMods(trainingFocus);
  const homeBonus = isHome ? 2.2 : 0;

  const myDay = dayFormFactor();
  const rivalDay = dayFormFactor();

  const attackingPower = ((myOvr + homeBonus) * 0.4 + ms.attack * 20 + (myFormScore || 60) * 0.15 + tm.atkMod) * myDay;
  const defensivePower = ((myOvr + homeBonus) * 0.4 + ms.defense * 15 + (myFormScore || 60) * 0.1  + tm.defMod) * myDay;
  const rivalAttack    = (rivalOvr * 0.4 + rms.attack  * 20 + (rivalFormScore || 60) * 0.15 + 6) * rivalDay;
  const rivalDefense   = (rivalOvr * 0.4 + rms.defense * 15 + (rivalFormScore || 60) * 0.1  + 4) * rivalDay;

  const effectivePressBoost = ss.pressBoost + tm.pressMod;
  const goalChancePerMin    = clampRate((attackingPower - rivalDefense) / 900 + 0.0075 + ss.tempoBoost * 0.004);
  const concededChancePerMin = clampRate((rivalAttack - defensivePower) / 900 + 0.0075);

  const events = [];
  let myGoals = 0, rivalGoals = 0;
  let myShots = 0, rivalShots = 0, myShotsOnTarget = 0, rivalShotsOnTarget = 0;
  let myCorners = 0, rivalCorners = 0, myFouls = 0, rivalFouls = 0, myYellow = 0, rivalYellow = 0;
  let myPossession = clamp(48 + (myOvr - rivalOvr) * 0.55 + ss.tempoBoost * 4, 28, 74);

  const scorers = pickWeightedScorers(myPlayers, myLineup);
  const xi = (myLineup || []).map(slot => myPlayers.find(p => p.id === slot.playerId)).filter(Boolean);
  let scorerIdx = 0;

  const playerMatchStats = {};

  for (let min = 1; min <= 90; min++) {
    const fatigueFactor = min > tm.fatThreshold && effectivePressBoost > 0.6 ? 0.85 : 1;

    if (Math.random() < goalChancePerMin * fatigueFactor) {
      myGoals++;
      const scorer = scorers[scorerIdx % scorers.length];
      scorerIdx++;
      const otherXi = xi.filter(p => p.id !== scorer?.id);
      const assister = Math.random() < 0.6 && otherXi.length
        ? otherXi[Math.floor(Math.random() * otherXi.length)]
        : null;
      if (scorer?.id) {
        playerMatchStats[scorer.id] = playerMatchStats[scorer.id] || { goals: 0, assists: 0, yellowCards: 0 };
        playerMatchStats[scorer.id].goals++;
      }
      if (assister?.id) {
        playerMatchStats[assister.id] = playerMatchStats[assister.id] || { goals: 0, assists: 0, yellowCards: 0 };
        playerMatchStats[assister.id].assists++;
      }
      events.push({
        min, type: "goal", team: "me", scorerId: scorer?.id, assistId: assister?.id,
        text: `⚽ GOL! ${scorer ? scorer.name : "Tu equipo"} marca${assister ? ` (asist. ${assister.name.split(" ").slice(-1)[0]})` : ""}. ${myGoals}-${rivalGoals}`,
      });
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
    } else if (Math.random() < 0.02 + effectivePressBoost * 0.015) {
      const mine = Math.random() < 0.5;
      if (mine) {
        myFouls++;
        if (Math.random() < 0.12) {
          myYellow++;
          const cardPlayer = xi[Math.floor(Math.random() * xi.length)];
          if (cardPlayer?.id) {
            playerMatchStats[cardPlayer.id] = playerMatchStats[cardPlayer.id] || { goals: 0, assists: 0, yellowCards: 0 };
            playerMatchStats[cardPlayer.id].yellowCards++;
          }
          events.push({ min, type: "card", team: "me", cardPlayerId: cardPlayer?.id, text: "🟨 Tarjeta amarilla para tu equipo" });
        }
      } else {
        rivalFouls++;
        if (Math.random() < 0.12) {
          rivalYellow++;
          events.push({ min, type: "card", team: "rival", text: "🟨 Tarjeta amarilla para el rival" });
        }
      }
    }
    if (min === 45) events.push({ min: 45, type: "half", team: null, text: "⏸ FIN DEL PRIMER TIEMPO" });
  }
  events.push({ min: 90, type: "full", team: null, text: `⏹ FINAL DEL PARTIDO: ${myGoals}-${rivalGoals}` });

  const starterIds = (myLineup || []).filter(s => s.playerId).map(s => s.playerId);

  return {
    myGoals, rivalGoals, events, myOvr, rivalOvr, myDay, rivalDay,
    playerMatchStats, starterIds,
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
