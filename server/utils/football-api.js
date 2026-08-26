import { db } from "../db/client.js";

// api-football.com. Es la única API con plan gratis que además cubre la
// Primera División de Chile junto con las cinco grandes ligas europeas — el
// resto (football-data.org, TheSportsDB) sólo tiene Europa.
const BASE_URL = "https://v3.football.api-sports.io";

// IDs fijos de api-football para las ligas pedidas. No cambian temporada a
// temporada, sólo la "season" (el año) que se calcula abajo.
export const LEAGUES = {
  bundesliga: { id: 78, name: "Bundesliga", country: "Alemania" },
  laliga: { id: 140, name: "La Liga", country: "España" },
  premier: { id: 39, name: "Premier League", country: "Inglaterra" },
  serie_a: { id: 135, name: "Serie A", country: "Italia" },
  ligue1: { id: 61, name: "Ligue 1", country: "Francia" },
  chile: { id: 265, name: "Primera División", country: "Chile" },
};

// Cuánto se guarda cada tipo de dato antes de volver a pedirlo. Los partidos
// en vivo cambian minuto a minuto; la tabla y los goleadores casi no se
// mueven entre partido y partido. Ajustable por entorno si el límite diario
// del plan gratis queda corto.
const TTL_SECONDS = {
  live: Number(process.env.FOOTBALL_TTL_LIVE) || 180,
  fixtures: 600,
  standings: 3600,
  scorers: 3600,
  lineup: 300,
};

export function isConfigured() {
  return !!process.env.FOOTBALL_API_KEY;
}

// La temporada de las ligas europeas arranca en agosto y cruza el año
// calendario; la chilena es de calendario. api-football pide el año en que
// arrancó la temporada en ambos casos, así que hay que calcularlo distinto.
export function currentSeason(leagueKey) {
  const now = new Date();
  const year = now.getFullYear();
  if (leagueKey === "chile") return year;
  return now.getMonth() >= 6 ? year : year - 1; // julio en adelante ya es la temporada nueva
}

async function readCache(key, ttlSeconds) {
  const result = await db.execute({ sql: "SELECT payload, fetched_at FROM football_cache WHERE cache_key = ?", args: [key] });
  const row = result.rows[0];
  if (!row) return null;
  const ageMs = Date.now() - new Date(row.fetched_at + "Z").getTime();
  if (ageMs > ttlSeconds * 1000) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

async function writeCache(key, payload) {
  await db.execute({
    sql: `INSERT INTO football_cache (cache_key, payload, fetched_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    args: [key, JSON.stringify(payload)],
  });
}

class FootballApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Pide a la API real, sirviendo del caché si todavía es válido. Si la API
// falla (caída, límite diario agotado) y hay ALGO en caché aunque esté
// vencido, se devuelve eso antes que romper la pantalla — un dato viejo es
// mejor que una pantalla vacía.
async function cachedFetch(cacheKey, ttlSeconds, path, params = {}) {
  const fresh = await readCache(cacheKey, ttlSeconds);
  if (fresh) return { data: fresh, stale: false };

  if (!isConfigured()) {
    throw new FootballApiError("Falta configurar FOOTBALL_API_KEY en el servidor", 503);
  }

  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  let response;
  try {
    response = await fetch(url, {
      headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY },
    });
  } catch (err) {
    const stale = await readCache(cacheKey, Infinity);
    if (stale) return { data: stale, stale: true };
    throw new FootballApiError(`No se pudo contactar a la API de fútbol: ${err.message}`, 502);
  }

  if (!response.ok) {
    const stale = await readCache(cacheKey, Infinity);
    if (stale) return { data: stale, stale: true };
    throw new FootballApiError(`La API de fútbol respondió ${response.status}`, 502);
  }

  const json = await response.json();
  if (Array.isArray(json.errors) ? json.errors.length > 0 : json.errors && Object.keys(json.errors).length > 0) {
    const stale = await readCache(cacheKey, Infinity);
    if (stale) return { data: stale, stale: true };
    throw new FootballApiError(JSON.stringify(json.errors), 502);
  }

  await writeCache(cacheKey, json.response);
  return { data: json.response, stale: false };
}

export async function getLiveFixtures(leagueKey) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  return cachedFetch(`live:${leagueKey}`, TTL_SECONDS.live, "/fixtures", {
    league: league.id,
    season: currentSeason(leagueKey),
    live: "all",
  });
}

export async function getFixturesByDate(leagueKey, date) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  return cachedFetch(`fixtures:${leagueKey}:${date}`, TTL_SECONDS.fixtures, "/fixtures", {
    league: league.id,
    season: currentSeason(leagueKey),
    date,
  });
}

export async function getStandings(leagueKey) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  return cachedFetch(`standings:${leagueKey}`, TTL_SECONDS.standings, "/standings", {
    league: league.id,
    season: currentSeason(leagueKey),
  });
}

export async function getTopScorers(leagueKey) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  return cachedFetch(`scorers:${leagueKey}`, TTL_SECONDS.scorers, "/players/topscorers", {
    league: league.id,
    season: currentSeason(leagueKey),
  });
}

export async function getLineups(fixtureId) {
  return cachedFetch(`lineup:${fixtureId}`, TTL_SECONDS.lineup, "/fixtures/lineups", {
    fixture: fixtureId,
  });
}

export { FootballApiError };
