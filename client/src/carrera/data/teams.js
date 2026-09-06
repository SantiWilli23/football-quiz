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

// Escudos reales verificados contra la API pública de TheSportsDB. Sólo
// quedan sin confirmar Alavés (la única coincidencia encontrada era la del
// equipo femenino) y Valladolid (la búsqueda no devolvió resultado) — esos
// dos siguen mostrando el escudo placeholder con los colores del club.
export const CLUB_LOGOS = {
  // Premier League
  mancity: "https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png",
  liverpool: "https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png",
  arsenal: "https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png",
  chelsea: "https://r2.thesportsdb.com/images/media/team/badge/pbf4ul1782638263.png",
  manutd: "https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png",
  tottenham: "https://r2.thesportsdb.com/images/media/team/badge/dfyfhl1604094109.png",
  newcastle: "https://r2.thesportsdb.com/images/media/team/badge/lhwuiz1621593302.png",
  astonvilla: "https://www.thesportsdb.com/images/media/team/badge/uwzw561787679026.png",
  westham: "https://r2.thesportsdb.com/images/media/team/badge/yutyxs1467459956.png",
  brighton: "https://r2.thesportsdb.com/images/media/team/badge/ywypts1448810904.png",
  fulham: "https://r2.thesportsdb.com/images/media/team/badge/xwwvyt1448811086.png",
  brentford: "https://r2.thesportsdb.com/images/media/team/badge/grv1aw1546453779.png",
  nforest: "https://r2.thesportsdb.com/images/media/team/badge/1i2kvh1719918076.png",
  everton: "https://r2.thesportsdb.com/images/media/team/badge/eqayrf1523184794.png",
  crystalpalace: "https://r2.thesportsdb.com/images/media/team/badge/ia6i3m1656014992.png",
  wolves: "https://r2.thesportsdb.com/images/media/team/badge/u9qr031621593327.png",
  bournemouth: "https://r2.thesportsdb.com/images/media/team/badge/y08nak1534071116.png",
  ipswich: "https://r2.thesportsdb.com/images/media/team/badge/mdj1ey1634670785.png",
  leicester: "https://r2.thesportsdb.com/images/media/team/badge/xtxwtu1448813356.png",
  southampton: "https://r2.thesportsdb.com/images/media/team/badge/ggqtd01621593274.png",

  // La Liga
  realmadrid: "https://r2.thesportsdb.com/images/media/team/badge/vwvwrw1473502969.png",
  barcelona: "https://r2.thesportsdb.com/images/media/team/badge/wq9sir1639406443.png",
  atletico: "https://r2.thesportsdb.com/images/media/team/badge/0ulh3q1719984315.png",
  athletic: "https://r2.thesportsdb.com/images/media/team/badge/68w7fe1639408210.png",
  realsociedad: "https://r2.thesportsdb.com/images/media/team/badge/vptvpr1473502986.png",
  villarreal: "https://r2.thesportsdb.com/images/media/team/badge/vrypqy1473503073.png",
  realbetis: "https://r2.thesportsdb.com/images/media/team/badge/2oqulv1663245386.png",
  sevilla: "https://r2.thesportsdb.com/images/media/team/badge/vpsqqx1473502977.png",
  girona: "https://r2.thesportsdb.com/images/media/team/badge/kfu7zu1659897499.png",
  valencia: "https://r2.thesportsdb.com/images/media/team/badge/dm8l6o1655594864.png",
  celtavigo: "https://r2.thesportsdb.com/images/media/team/badge/xfjtku1690436219.png",
  osasuna: "https://r2.thesportsdb.com/images/media/team/badge/rvspvt1473502960.png",
  rayo: "https://r2.thesportsdb.com/images/media/team/badge/nzhu941655595465.png",
  getafe: "https://r2.thesportsdb.com/images/media/team/badge/eyh2891655594452.png",
  mallorca: "https://r2.thesportsdb.com/images/media/team/badge/ssptsx1473503730.png",
  laspalmas: "https://r2.thesportsdb.com/images/media/team/badge/mmhyb11616443601.png",
  leganes: "https://r2.thesportsdb.com/images/media/team/badge/tm0adr1616443898.png",
  espanyol: "https://r2.thesportsdb.com/images/media/team/badge/867nzz1681703222.png",
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
