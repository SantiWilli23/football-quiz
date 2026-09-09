// Genera goltexto/src/data/players.json a partir de la misma base de datos
// que usa Equipo-Jugador (server/data/equipo-jugador-players.json). Ese
// dataset no trae club actual/liga/edad directamente, así que este script:
//  1. determina el club "actual" de cada jugador (el tramo con fin=null, o
//     si no hay ninguno abierto, el más reciente)
//  2. mapea ese club a una liga conocida (mapa curado abajo)
//  3. descarta a los jugadores cuyo club actual no cae en el mapa, para no
//     mandar "Otra liga" genérico que empobrece el juego
//  4. calcula edad = REFERENCE_YEAR - año de nacimiento
"use strict";
const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "../../server/data/equipo-jugador-players.json");
const OUT = path.join(__dirname, "../src/data/players.json");
const REFERENCE_YEAR = 2025;
const MERGE_SUFFIX = /\s*\((cedido|cantera)\)\s*$/i;

const POSITION_MAP = {
  Portero: "Portero",
  Arquero: "Portero",
  Defensa: "Defensa",
  Defensor: "Defensa",
  Mediocampista: "Mediocampista",
  Volante: "Mediocampista",
  Delantero: "Delantero",
};

// Mapa club -> liga. Cubre los clubes que más aparecen como "club actual"
// en el dataset (top-5 europeas + algunas ligas grandes de fuera de Europa
// que el dataset trae con fuerza: Chile, Brasil, MLS, Arabia Saudita, Turquía).
const LEAGUE_MAP = {
  // Premier League
  Liverpool: "Premier League", "Manchester United": "Premier League", Arsenal: "Premier League",
  Chelsea: "Premier League", "Manchester City": "Premier League", "Aston Villa": "Premier League",
  "Tottenham Hotspur": "Premier League", "Newcastle United": "Premier League", Everton: "Premier League",
  "West Ham United": "Premier League", Bournemouth: "Premier League", Brighton: "Premier League",
  Fulham: "Premier League", "Nottingham Forest": "Premier League", "Crystal Palace": "Premier League",
  Wolverhampton: "Premier League", Brentford: "Premier League", "Leicester City": "Premier League",
  Southampton: "Premier League", "Ipswich Town": "Premier League",
  // La Liga
  "Real Madrid": "La Liga", Barcelona: "La Liga", "Atletico Madrid": "La Liga", "Real Betis": "La Liga",
  "Real Sociedad": "La Liga", Sevilla: "La Liga", Villarreal: "La Liga", "Athletic Club": "La Liga",
  Girona: "La Liga", Valencia: "La Liga", "Celta de Vigo": "La Liga", Osasuna: "La Liga",
  "Rayo Vallecano": "La Liga", Getafe: "La Liga", Mallorca: "La Liga", "Las Palmas": "La Liga",
  Alaves: "La Liga", Espanyol: "La Liga", Leganes: "La Liga", Valladolid: "La Liga",
  // Serie A
  Juventus: "Serie A", "AC Milan": "Serie A", "Inter Milan": "Serie A", Napoli: "Serie A", Roma: "Serie A",
  Atalanta: "Serie A", Lazio: "Serie A", Udinese: "Serie A", Cagliari: "Serie A", Torino: "Serie A",
  Fiorentina: "Serie A", Bologna: "Serie A", Genoa: "Serie A", Empoli: "Serie A",
  // Bundesliga
  "Bayern Munich": "Bundesliga", "Borussia Dortmund": "Bundesliga", "Bayer Leverkusen": "Bundesliga",
  "RB Leipzig": "Bundesliga", "Werder Bremen": "Bundesliga", "Eintracht Frankfurt": "Bundesliga",
  "VfB Stuttgart": "Bundesliga", "Borussia Monchengladbach": "Bundesliga", "Sturm Graz": "Bundesliga",
  // Ligue 1
  "Paris Saint-Germain": "Ligue 1", Monaco: "Ligue 1", Marseille: "Ligue 1", Lyon: "Ligue 1",
  Nice: "Ligue 1", Lille: "Ligue 1", Lens: "Ligue 1", Rennes: "Ligue 1",
  // Eredivisie / Liga Portugal
  Ajax: "Eredivisie", "PSV Eindhoven": "Eredivisie", Feyenoord: "Eredivisie",
  Porto: "Liga Portugal", Benfica: "Liga Portugal", Sporting: "Liga Portugal",
  // Chile
  "Colo-Colo": "Primera Division de Chile", "Universidad Catolica": "Primera Division de Chile",
  "Universidad de Chile": "Primera Division de Chile", "Union Espanola": "Primera Division de Chile",
  OHiggins: "Primera Division de Chile", "Union La Calera": "Primera Division de Chile",
  "Coquimbo Unido": "Primera Division de Chile", "Deportes Antofagasta": "Primera Division de Chile",
  Cobresal: "Primera Division de Chile", Palestino: "Primera Division de Chile",
  Huachipato: "Primera Division de Chile", "Everton de Vina": "Primera Division de Chile",
  Cobreloa: "Primera Division de Chile",
  // Brasil / Argentina
  Flamengo: "Brasileirao", Corinthians: "Brasileirao", Palmeiras: "Brasileirao",
  "Vasco da Gama": "Brasileirao", Internacional: "Brasileirao", "Atletico Mineiro": "Brasileirao",
  Botafogo: "Brasileirao", Fluminense: "Brasileirao", Santos: "Brasileirao",
  "Boca Juniors": "Liga Argentina", "River Plate": "Liga Argentina", "Rosario Central": "Liga Argentina",
  // MLS
  "Inter Miami": "MLS", "Los Angeles FC": "MLS", "LA Galaxy": "MLS", "Chicago Fire": "MLS",
  "Toronto FC": "MLS", "New York Cosmos": "MLS", "Atlanta United": "MLS",
  // Liga MX
  Monterrey: "Liga MX", Toluca: "Liga MX", "Club America": "Liga MX", Tigres: "Liga MX", Chivas: "Liga MX",
  // Saudi / Turquia / Qatar / Japon
  "Al Hilal": "Saudi Pro League", "Al Nassr": "Saudi Pro League", "Al Ahli": "Saudi Pro League",
  "Al Ittihad": "Saudi Pro League", "Al Sadd": "Liga de Qatar",
  Fenerbahce: "Super Lig", Galatasaray: "Super Lig",
  "Vissel Kobe": "J1 League",
};

function canonicalClub(name) {
  return name.replace(MERGE_SUFFIX, "").trim();
}

function currentClub(jugador) {
  const stints = jugador.carrera.map((c) => ({ ...c, club: canonicalClub(c.club) }));
  const active = stints.find((c) => c.fin == null);
  if (active) return active.club;
  return stints.slice().sort((a, b) => (b.fin || 0) - (a.fin || 0))[0]?.club || null;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(SOURCE, "utf-8"));
  const out = [];
  let nextId = 1;

  for (const j of raw.jugadores) {
    if (!Array.isArray(j.carrera) || !j.carrera.length || !j.nacimiento) continue;
    const club = currentClub(j);
    const league = club ? LEAGUE_MAP[club] : null;
    if (!club || !league) continue;

    const position = POSITION_MAP[j.posicion] || j.posicion;
    if (!position) continue;

    out.push({
      id: nextId++,
      name: j.nombre,
      team: club,
      league,
      nationality: j.nacionalidad,
      position,
      age: REFERENCE_YEAR - j.nacimiento,
    });
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  const byLeague = {};
  out.forEach((p) => { byLeague[p.league] = (byLeague[p.league] || 0) + 1; });
  console.log(`Goltexto: ${out.length} jugadores generados en ${OUT}`);
  console.log("Por liga:", byLeague);
}

main();
