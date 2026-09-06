const INJURY_TYPES = [
  { name: "Golpe leve",          weeksOut: 1,  prob: 0.50 },
  { name: "Contractura",         weeksOut: 2,  prob: 0.25 },
  { name: "Desgarro muscular",   weeksOut: 4,  prob: 0.15 },
  { name: "Esguince grave",      weeksOut: 6,  prob: 0.07 },
  { name: "Fractura",            weeksOut: 10, prob: 0.03 },
];

function pickType() {
  let r = Math.random(), cum = 0;
  for (const t of INJURY_TYPES) { cum += t.prob; if (r < cum) return t; }
  return INJURY_TYPES[0];
}

// ~2.5% de chance por titular por partido
export function rollMatchInjuries(lineupStarters, week) {
  const injuries = [];
  lineupStarters.forEach(slot => {
    if (!slot.playerId) return;
    if (Math.random() < 0.025) {
      const type = pickType();
      injuries.push({
        id: `inj_${slot.playerId}_${week}_${Math.floor(Math.random() * 1e6)}`,
        playerId: slot.playerId,
        type: type.name,
        weeksOut: type.weeksOut,
        returnWeek: week + type.weeksOut,
      });
    }
  });
  return injuries;
}

export function isInjured(injuries, playerId, currentWeek) {
  return (injuries || []).some(i => i.playerId === playerId && i.returnWeek > currentWeek);
}

export function getInjury(injuries, playerId) {
  return (injuries || []).find(i => i.playerId === playerId) || null;
}

export function recoverInjuries(injuries, currentWeek) {
  return (injuries || []).filter(i => i.returnWeek > currentWeek);
}
