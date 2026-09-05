// Presupuesto y finanzas del club.
export function transferBudgetFor(team, lastLeaguePosition) {
  const base = team.prestige * 20;
  let bonus = 0;
  if (lastLeaguePosition) {
    if (lastLeaguePosition <= 3) bonus = 0.4;
    else if (lastLeaguePosition <= 6) bonus = 0.2;
    else if (lastLeaguePosition <= 10) bonus = 0;
    else if (lastLeaguePosition <= 17) bonus = -0.1;
    else bonus = -0.3;
  }
  return Math.round(base * (1 + bonus));
}

export function weeklyWageBill(squad) {
  return squad.reduce((sum, p) => sum + p.wage, 0);
}

export function seasonIncome(team, lastLeaguePosition) {
  const tvMoney = Math.round((21 - (lastLeaguePosition || 15)) * team.prestige * 0.6);
  const taquilla = Math.round(team.prestige * 1.5);
  let premio = 0;
  if (lastLeaguePosition && lastLeaguePosition <= 3) premio = 20;
  else if (lastLeaguePosition && lastLeaguePosition <= 6) premio = 10;
  return { tvMoney: Math.max(2, tvMoney), taquilla, premio, total: Math.max(2, tvMoney) + taquilla + premio };
}
