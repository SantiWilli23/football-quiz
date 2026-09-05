// Equipos jugables: Premier League y La Liga.
export const teams = [
  // === PREMIER LEAGUE ===
  { id: "mancity", name: "Manchester City", shortName: "MCI", league: "premier", tier: 1, budget: 180, boardObjective: "ganar_liga", prestige: 10, colors: { primary: "#6CABDD", secondary: "#1C2C5B" } },
  { id: "liverpool", name: "Liverpool", shortName: "LIV", league: "premier", tier: 1, budget: 130, boardObjective: "ganar_liga", prestige: 10, colors: { primary: "#C8102E", secondary: "#F6EB61" } },
  { id: "arsenal", name: "Arsenal", shortName: "ARS", league: "premier", tier: 1, budget: 120, boardObjective: "top4", prestige: 9, colors: { primary: "#EF0107", secondary: "#FFFFFF" } },
  { id: "chelsea", name: "Chelsea", shortName: "CHE", league: "premier", tier: 1, budget: 150, boardObjective: "top4", prestige: 9, colors: { primary: "#034694", secondary: "#FFFFFF" } },
  { id: "manutd", name: "Manchester United", shortName: "MUN", league: "premier", tier: 1, budget: 100, boardObjective: "top4", prestige: 9, colors: { primary: "#DA291C", secondary: "#FFE500" } },
  { id: "tottenham", name: "Tottenham Hotspur", shortName: "TOT", league: "premier", tier: 1, budget: 100, boardObjective: "top4", prestige: 9, colors: { primary: "#132257", secondary: "#FFFFFF" } },
  { id: "newcastle", name: "Newcastle United", shortName: "NEW", league: "premier", tier: 1, budget: 90, boardObjective: "top4", prestige: 7, colors: { primary: "#241F20", secondary: "#FFFFFF" } },
  { id: "astonvilla", name: "Aston Villa", shortName: "AVL", league: "premier", tier: 1, budget: 80, boardObjective: "top6", prestige: 7, colors: { primary: "#95BFE5", secondary: "#670E36" } },
  { id: "westham", name: "West Ham United", shortName: "WHU", league: "premier", tier: 2, budget: 55, boardObjective: "top8", prestige: 6, colors: { primary: "#7A263A", secondary: "#1BB1E7" } },
  { id: "brighton", name: "Brighton", shortName: "BHA", league: "premier", tier: 2, budget: 60, boardObjective: "top8", prestige: 6, colors: { primary: "#0057B8", secondary: "#FFFFFF" } },
  { id: "fulham", name: "Fulham", shortName: "FUL", league: "premier", tier: 2, budget: 45, boardObjective: "top10", prestige: 5, colors: { primary: "#FFFFFF", secondary: "#000000" } },
  { id: "brentford", name: "Brentford", shortName: "BRE", league: "premier", tier: 2, budget: 40, boardObjective: "top10", prestige: 5, colors: { primary: "#E30613", secondary: "#FFFFFF" } },
  { id: "nforest", name: "Nottingham Forest", shortName: "NFO", league: "premier", tier: 2, budget: 40, boardObjective: "top10", prestige: 5, colors: { primary: "#DD0000", secondary: "#FFFFFF" } },
  { id: "everton", name: "Everton", shortName: "EVE", league: "premier", tier: 2, budget: 35, boardObjective: "top10", prestige: 6, colors: { primary: "#003399", secondary: "#FFFFFF" } },
  { id: "crystalpalace", name: "Crystal Palace", shortName: "CRY", league: "premier", tier: 2, budget: 35, boardObjective: "salvarse", prestige: 5, colors: { primary: "#1B458F", secondary: "#C4122E" } },
  { id: "wolves", name: "Wolverhampton", shortName: "WOL", league: "premier", tier: 2, budget: 40, boardObjective: "top10", prestige: 5, colors: { primary: "#FDB913", secondary: "#231F20" } },
  { id: "bournemouth", name: "Bournemouth", shortName: "BOU", league: "premier", tier: 3, budget: 30, boardObjective: "salvarse", prestige: 4, colors: { primary: "#DA291C", secondary: "#000000" } },
  { id: "ipswich", name: "Ipswich Town", shortName: "IPS", league: "premier", tier: 3, budget: 20, boardObjective: "salvarse", prestige: 3, colors: { primary: "#0044A9", secondary: "#FFFFFF" } },
  { id: "leicester", name: "Leicester City", shortName: "LEI", league: "premier", tier: 3, budget: 25, boardObjective: "salvarse", prestige: 5, colors: { primary: "#003090", secondary: "#FDBE11" } },
  { id: "southampton", name: "Southampton", shortName: "SOU", league: "premier", tier: 3, budget: 20, boardObjective: "salvarse", prestige: 4, colors: { primary: "#D71920", secondary: "#FFFFFF" } },

  // === LA LIGA ===
  { id: "realmadrid", name: "Real Madrid", shortName: "RMA", league: "laliga", tier: 1, budget: 250, boardObjective: "ganar_liga", prestige: 10, colors: { primary: "#FEBE10", secondary: "#FFFFFF" } },
  { id: "barcelona", name: "Barcelona", shortName: "BAR", league: "laliga", tier: 1, budget: 150, boardObjective: "ganar_liga", prestige: 10, colors: { primary: "#A50044", secondary: "#004D98" } },
  { id: "atletico", name: "Atlético de Madrid", shortName: "ATM", league: "laliga", tier: 1, budget: 120, boardObjective: "top3", prestige: 9, colors: { primary: "#CB3524", secondary: "#FFFFFF" } },
  { id: "athletic", name: "Athletic Club", shortName: "ATH", league: "laliga", tier: 2, budget: 50, boardObjective: "top6", prestige: 7, colors: { primary: "#EE2523", secondary: "#FFFFFF" } },
  { id: "realsociedad", name: "Real Sociedad", shortName: "RSO", league: "laliga", tier: 2, budget: 45, boardObjective: "top6", prestige: 6, colors: { primary: "#0067B1", secondary: "#FFFFFF" } },
  { id: "villarreal", name: "Villarreal", shortName: "VIL", league: "laliga", tier: 2, budget: 55, boardObjective: "top6", prestige: 7, colors: { primary: "#FFCD00", secondary: "#005995" } },
  { id: "realbetis", name: "Real Betis", shortName: "BET", league: "laliga", tier: 2, budget: 50, boardObjective: "top8", prestige: 6, colors: { primary: "#00954C", secondary: "#FFFFFF" } },
  { id: "sevilla", name: "Sevilla", shortName: "SEV", league: "laliga", tier: 2, budget: 50, boardObjective: "top8", prestige: 7, colors: { primary: "#D4022E", secondary: "#FFFFFF" } },
  { id: "girona", name: "Girona", shortName: "GIR", league: "laliga", tier: 2, budget: 35, boardObjective: "top10", prestige: 5, colors: { primary: "#CD1421", secondary: "#FFFFFF" } },
  { id: "valencia", name: "Valencia", shortName: "VAL", league: "laliga", tier: 2, budget: 35, boardObjective: "top10", prestige: 6, colors: { primary: "#FF7900", secondary: "#000000" } },
  { id: "celtavigo", name: "Celta de Vigo", shortName: "CEL", league: "laliga", tier: 2, budget: 30, boardObjective: "salvarse", prestige: 5, colors: { primary: "#75AADB", secondary: "#FFFFFF" } },
  { id: "osasuna", name: "Osasuna", shortName: "OSA", league: "laliga", tier: 3, budget: 20, boardObjective: "salvarse", prestige: 4, colors: { primary: "#D81E2F", secondary: "#002663" } },
  { id: "rayo", name: "Rayo Vallecano", shortName: "RAY", league: "laliga", tier: 3, budget: 15, boardObjective: "salvarse", prestige: 3, colors: { primary: "#FF0000", secondary: "#FFFFFF" } },
  { id: "getafe", name: "Getafe", shortName: "GET", league: "laliga", tier: 3, budget: 15, boardObjective: "salvarse", prestige: 3, colors: { primary: "#005DA4", secondary: "#FFFFFF" } },
  { id: "mallorca", name: "Mallorca", shortName: "MAL", league: "laliga", tier: 3, budget: 18, boardObjective: "salvarse", prestige: 3, colors: { primary: "#C8102E", secondary: "#000000" } },
  { id: "laspalmas", name: "Las Palmas", shortName: "LPA", league: "laliga", tier: 3, budget: 15, boardObjective: "salvarse", prestige: 3, colors: { primary: "#FFED00", secondary: "#003DA5" } },
  { id: "alaves", name: "Deportivo Alavés", shortName: "ALA", league: "laliga", tier: 3, budget: 12, boardObjective: "salvarse", prestige: 3, colors: { primary: "#1A47A0", secondary: "#FFFFFF" } },
  { id: "leganes", name: "Leganés", shortName: "LEG", league: "laliga", tier: 3, budget: 12, boardObjective: "salvarse", prestige: 2, colors: { primary: "#003DA5", secondary: "#FFFFFF" } },
  { id: "espanyol", name: "Espanyol", shortName: "ESP", league: "laliga", tier: 3, budget: 20, boardObjective: "salvarse", prestige: 4, colors: { primary: "#0044A6", secondary: "#FFFFFF" } },
  { id: "valladolid", name: "Valladolid", shortName: "VLL", league: "laliga", tier: 3, budget: 12, boardObjective: "salvarse", prestige: 2, colors: { primary: "#6B007B", secondary: "#FFFFFF" } },
];

// Escudos reales verificados (mismos que usa Cotrero). El resto de los
// equipos no tiene una URL de escudo confirmada todavía, así que muestran
// un cuadrado con los colores reales del club en su lugar.
export const CLUB_LOGOS = {
  realmadrid: "https://r2.thesportsdb.com/images/media/team/badge/vwvwrw1473502969.png",
  barcelona: "https://r2.thesportsdb.com/images/media/team/badge/wq9sir1639406443.png",
  atletico: "https://r2.thesportsdb.com/images/media/team/badge/0ulh3q1719984315.png",
  realsociedad: "https://r2.thesportsdb.com/images/media/team/badge/vptvpr1473502986.png",
  mancity: "https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png",
  liverpool: "https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png",
  arsenal: "https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png",
  brighton: "https://r2.thesportsdb.com/images/media/team/badge/ywypts1448810904.png",
};

export function badgeFor(teamId) {
  return CLUB_LOGOS[teamId] || null;
}

export function teamById(id) {
  return teams.find((t) => t.id === id) || null;
}

export function teamsByLeague(league) {
  return teams.filter((t) => t.league === league);
}
