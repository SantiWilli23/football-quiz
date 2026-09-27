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

// Ligas "de vitrina": no son jugables como modo aparte (no vale la pena
// sumar una pestaña más a Fichado por cada una), pero sí queremos que la
// pista de "Liga" diga la liga real del club en vez de un genérico "Otra" —
// y que dos jugadores de la MISMA liga acá abajo cuenten como "misma liga"
// para el número de parecido, cosa que antes nunca pasaba (ambos daban ""
// y el chequeo de sameLeague exige que no esté vacío). No es exhaustiva:
// cubre las ligas con más jugadores actuales en la base, no cada club del
// mundo — lo que quede afuera sigue mostrando "Otra".
const DISPLAY_LEAGUES = {
  ligue1: {
    label: "Ligue 1",
    clubs: ["Paris Saint-Germain", "Marseille", "Lyon", "Monaco", "Lille", "Nice", "Rennes", "Nantes", "Lens", "Toulouse", "Reims", "Montpellier", "Strasbourg", "Brest", "Le Havre", "Angers", "Auxerre", "Saint-Étienne", "Saint-Etienne"],
  },
  superlig: {
    label: "Süper Lig",
    clubs: ["Galatasaray", "Fenerbahce", "Fenerbahçe", "Besiktas", "Beşiktaş", "Trabzonspor", "Basaksehir", "Başakşehir", "Sivasspor"],
  },
  liga_portugal: {
    label: "Liga Portugal",
    clubs: ["Benfica", "Porto", "Sporting CP", "Sporting", "Braga", "Vitória de Guimarães", "Vitoria Guimaraes", "Boavista", "Famalicão", "Famalicao"],
  },
  eredivisie: {
    label: "Eredivisie",
    clubs: ["Ajax", "PSV Eindhoven", "PSV", "Feyenoord", "AZ Alkmaar", "Twente"],
  },
  saudi: {
    label: "Saudi Pro League",
    clubs: ["Al Hilal", "Al Nassr", "Al Ahli", "Al Ittihad", "Al Shabab", "Al-Taawoun", "Al Taawoun", "Al Qadsiah"],
  },
  mls: {
    label: "MLS",
    clubs: ["Inter Miami", "LA Galaxy", "Los Angeles FC", "LAFC", "Chicago Fire", "Atlanta United", "Seattle Sounders"],
  },
  primera_argentina: {
    label: "Liga Profesional Argentina",
    clubs: ["River Plate", "Boca Juniors", "Racing Club", "Independiente", "San Lorenzo", "Vélez Sarsfield", "Velez Sarsfield"],
  },
  brasileirao: {
    label: "Brasileirão",
    clubs: ["Flamengo", "Palmeiras", "Corinthians", "Botafogo", "Fluminense", "Internacional", "São Paulo", "Sao Paulo", "Grêmio", "Gremio", "Santos", "Vasco da Gama", "Atlético Mineiro", "Atletico Mineiro", "Cruzeiro"],
  },
  primera_chile: {
    label: "Primera División de Chile",
    clubs: ["Colo-Colo", "Universidad Católica", "Universidad Catolica", "Universidad de Chile", "Unión Española", "Union Espanola", "O'Higgins", "OHiggins", "Unión La Calera", "Union La Calera", "Cobresal", "Palestino", "Huachipato"],
  },
  scottish: {
    label: "Premiership de Escocia",
    clubs: ["Celtic", "Rangers"],
  },
  greek: {
    label: "Super League de Grecia",
    clubs: ["Olympiacos", "Panathinaikos"],
  },
  belgian: {
    label: "Pro League de Bélgica",
    clubs: ["Anderlecht", "Club Brugge", "Genk"],
  },
};

const CLUB_TO_DISPLAY_LEAGUE = new Map();
for (const [key, { clubs }] of Object.entries(DISPLAY_LEAGUES)) {
  for (const club of clubs) CLUB_TO_DISPLAY_LEAGUE.set(normalize(club), key);
}

// Clave de liga "ancha": la jugable si el club está en una de las 4, si no
// una de las de vitrina de arriba, si no null. Se usa tanto para mostrar el
// nombre real en la pista como para el número de parecido.
export function wideLeagueKeyForClub(clubName) {
  return leagueForClub(clubName) || CLUB_TO_DISPLAY_LEAGUE.get(normalize(clubName)) || null;
}

export function wideLeagueLabelForClub(clubName) {
  const key = wideLeagueKeyForClub(clubName);
  if (!key) return null;
  return LEAGUES.find((l) => l.key === key)?.label || DISPLAY_LEAGUES[key]?.label || null;
}
