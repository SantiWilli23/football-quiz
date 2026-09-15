// Mapeo club → liga para el apartado de liga de Fulbodle. Los nombres de
// club en equipo-jugador-players.json vienen de fuentes distintas y no
// siempre coinciden letra por letra con los nombres "oficiales" que usa
// Carrera DT (client/src/carrera/data/teams.js) — por eso hay un mapa de
// alias además del normalizador. Solo cubre los clubes de las 4 ligas
// jugables; cualquier otro club simplemente no entra en ningún filtro de
// liga (sigue apareciendo en el modo "Todos").
export const LEAGUES = [
  { key: "premier", label: "Premier League" },
  { key: "laliga", label: "La Liga" },
  { key: "seriea", label: "Serie A" },
  { key: "bundesliga", label: "Bundesliga" },
];

function normalize(s) {
  return String(s || "")
    .replace(/\s*\((cantera|cedido)\)\s*$/i, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// { liga: { nombreCanónico: [alias1, alias2, ...] } } — el nombre canónico
// ya está en la lista y no hace falta repetirlo como alias.
const CANONICAL_BY_LEAGUE = {
  premier: [
    "Manchester City", "Liverpool", "Arsenal", "Chelsea", "Manchester United",
    ["Tottenham Hotspur", ["Tottenham"]],
    ["Newcastle United", ["Newcastle"]],
    "Aston Villa",
    ["West Ham United", ["West Ham"]],
    "Brighton", "Fulham", "Brentford", "Nottingham Forest", "Everton",
    "Crystal Palace", "Wolverhampton", "Bournemouth", "Ipswich Town",
    "Leicester City", "Southampton",
  ],
  laliga: [
    "Real Madrid", "Barcelona",
    ["Atlético de Madrid", ["Atletico Madrid", "Atletico de Madrid"]],
    ["Athletic Club", ["Athletic Bilbao"]],
    "Real Sociedad", "Villarreal",
    ["Real Betis", ["Betis"]],
    "Sevilla", "Girona", "Valencia",
    "Celta de Vigo", "Osasuna", "Rayo Vallecano", "Getafe",
    ["Mallorca", ["Real Mallorca"]],
    "Las Palmas",
    ["Deportivo Alavés", ["Alaves", "Alavés", "Deportivo Alaves"]],
    ["Leganés", ["Leganes"]],
    "Espanyol",
    ["Valladolid", ["Real Valladolid"]],
  ],
  seriea: [
    ["Inter de Milán", ["Inter Milan", "Inter"]],
    "Juventus", "AC Milan", "Napoli",
    ["AS Roma", ["Roma"]],
    "Atalanta", "Lazio", "Fiorentina", "Bologna", "Torino", "Udinese", "Genoa",
    "Monza", "Cagliari",
    ["Hellas Verona", ["Verona"]],
    "Empoli", "Lecce", "Parma", "Como", "Venezia",
  ],
  bundesliga: [
    ["Bayern Múnich", ["Bayern Munich", "Bayern"]],
    "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig", "Eintracht Frankfurt",
    ["VfB Stuttgart", ["Stuttgart"]],
    ["Borussia Mönchengladbach", ["Borussia Monchengladbach", "Monchengladbach", "Mönchengladbach"]],
    ["VfL Wolfsburg", ["Wolfsburg", "Wolfsburgo", "VfL Wolfsburgo"]],
    ["SC Friburgo", ["Freiburg"]],
    ["Union Berlín", ["Union Berlin"]],
    "Werder Bremen",
    ["Mainz 05", ["Mainz"]],
    ["TSG Hoffenheim", ["Hoffenheim"]],
    ["FC Augsburgo", ["Augsburgo", "Augsburg"]],
    ["VfL Bochum", ["Bochum"]],
    "Heidenheim",
    ["St. Pauli", ["Sankt Pauli"]],
    "Holstein Kiel",
  ],
};

const CLUB_TO_LEAGUE = new Map();
for (const [league, entries] of Object.entries(CANONICAL_BY_LEAGUE)) {
  for (const entry of entries) {
    const [canonical, aliases] = Array.isArray(entry) ? entry : [entry, []];
    CLUB_TO_LEAGUE.set(normalize(canonical), league);
    for (const alias of aliases) CLUB_TO_LEAGUE.set(normalize(alias), league);
  }
}

export function leagueForClub(clubName) {
  return CLUB_TO_LEAGUE.get(normalize(clubName)) || null;
}
