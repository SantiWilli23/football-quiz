// IA de fichajes de equipos rivales (versión inicial, se expande en fases siguientes).
// Por ahora sólo reporta movimientos "de ambiente" en el feed de noticias del Dashboard.
const VERBS = ["ficha a", "se interesa en", "sondea a", "negocia con"];

// Ofertas que llegan de otros clubes por jugadores propios: mucho más
// probables si el jugador está listado como transferible o a préstamo,
// pero también puede pasar (rara vez) con una figura del plantel sin listar.
export function generateIncomingOffers(squad, teams, myTeamId, week) {
  const offers = [];
  const buyers = teams.filter((t) => t.id !== myTeamId);
  if (!buyers.length) return offers;

  squad.forEach((p) => {
    if (p.training) return;
    let chance = 0;
    if (p.transferListed) chance = 0.35;
    else if (p.loanListed) chance = 0.18;
    else if (p.ovr >= 82) chance = 0.03;
    else if (p.ovr >= 76) chance = 0.015;
    if (Math.random() >= chance) return;

    const buyer = buyers[Math.floor(Math.random() * buyers.length)];
    const isLoan = p.loanListed && (!p.transferListed || Math.random() < 0.4);
    const factor = p.transferListed ? 0.75 + Math.random() * 0.35 : 0.7 + Math.random() * 0.3;
    const amount = isLoan ? 0 : Math.round(p.value * factor * 20) / 20;

    offers.push({
      id: `off_${p.id}_${week}_${Math.floor(Math.random() * 1e6)}`,
      playerId: p.id,
      playerName: p.name,
      teamId: buyer.id,
      teamName: buyer.name,
      amount,
      isLoan,
      week,
      status: "pending",
    });
  });
  return offers;
}

export function generateMarketRumors(teams, players, count = 3) {
  const rumors = [];
  for (let i = 0; i < count; i++) {
    const team = teams[Math.floor(Math.random() * teams.length)];
    const pool = players.filter((p) => p.teamId !== team.id && p.ovr >= 74);
    if (!pool.length) continue;
    const player = pool[Math.floor(Math.random() * pool.length)];
    const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
    rumors.push(`📰 ${team.name} ${verb} ${player.name}`);
  }
  return rumors;
}
