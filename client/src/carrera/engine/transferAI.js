// IA de fichajes de equipos rivales (versión inicial, se expande en fases siguientes).
// Por ahora sólo reporta movimientos "de ambiente" en el feed de noticias del Dashboard.
const VERBS = ["ficha a", "se interesa en", "sondea a", "negocia con"];

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
