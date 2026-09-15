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

// El plan gratis de api-football sólo deja consultar tabla y goleadores de
// estas temporadas — probado a mano contra la API real. Fuera de este rango
// (o sea, la temporada actual) responde con un error de plan. Se usa como
// muestra cuando la temporada real falla por el plan, y se avisa siempre que
// se esté mostrando: no hay forma de que esto pase por datos en vivo sin que
// el usuario lo sepa.
const FALLBACK_SEASON = 2023;

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

class FootballApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// El plan gratis frena distintas cosas con el mismo formato de error
// ({"plan": "mensaje"}); esto detecta puntualmente el caso de temporada
// bloqueada, que es el único para el que existe una muestra alternativa.
function isSeasonPlanError(err) {
  return err instanceof FootballApiError && /access to this season/i.test(err.message);
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

// Pega directo a la API, sin caché. Tira FootballApiError con el detalle que
// haya mandado api-football si la respuesta viene con errores.
async function rawApiRequest(path, params) {
  if (!isConfigured()) {
    throw new FootballApiError("Falta configurar FOOTBALL_API_KEY en el servidor", 503);
  }

  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  let response;
  try {
    response = await fetch(url, { headers: { "x-apisports-key": process.env.FOOTBALL_API_KEY } });
  } catch (err) {
    throw new FootballApiError(`No se pudo contactar a la API de fútbol: ${err.message}`, 502);
  }
  if (!response.ok) {
    throw new FootballApiError(`La API de fútbol respondió ${response.status}`, 502);
  }

  const json = await response.json();
  const hasErrors = Array.isArray(json.errors) ? json.errors.length > 0 : json.errors && Object.keys(json.errors).length > 0;
  if (hasErrors) {
    throw new FootballApiError(JSON.stringify(json.errors), 502);
  }
  return json.response;
}

// Caché genérico, sin noción de temporada ni de plan (lo usan en vivo y
// alineaciones). Si la API falla y hay ALGO guardado aunque esté vencido, se
// devuelve eso antes que romper la pantalla.
async function cachedFetch(cacheKey, ttlSeconds, path, params = {}) {
  const fresh = await readCache(cacheKey, ttlSeconds);
  if (fresh) return { data: fresh, stale: false, demo: false };

  try {
    const data = await rawApiRequest(path, params);
    await writeCache(cacheKey, data);
    return { data, stale: false, demo: false };
  } catch (err) {
    const stale = await readCache(cacheKey, Infinity);
    if (stale) return { data: stale, stale: true, demo: false };
    throw err;
  }
}

// Caché para lo que sí depende de la temporada (tabla, goleadores). Intenta
// primero con la temporada real: el día que se active un plan pago, esto
// empieza a traer datos reales sin tocar una línea de código. Si el plan
// bloquea esa temporada, cae a la última que el plan gratis permite y lo
// marca como `demo` para que la pantalla lo diga.
async function seasonScopedFetch(cacheKey, ttlSeconds, path, params) {
  const cached = await readCache(cacheKey, ttlSeconds);
  if (cached) return cached;

  try {
    const data = await rawApiRequest(path, params);
    const result = { data, demo: false };
    await writeCache(cacheKey, result);
    return result;
  } catch (err) {
    if (isSeasonPlanError(err)) {
      try {
        const demoData = await rawApiRequest(path, { ...params, season: FALLBACK_SEASON });
        const result = { data: demoData, demo: true };
        await writeCache(cacheKey, result);
        return result;
      } catch {
        // sigue abajo: ni la temporada real ni la muestra funcionaron
      }
    }
    const stale = await readCache(cacheKey, Infinity);
    if (stale) return stale;
    throw err;
  }
}

export async function getLiveFixtures(leagueKey) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  // Ojo: sin `season`. api-football trata "en vivo" como una foto del momento
  // que no depende de temporada, y es el único filtro por liga que el plan
  // gratis no bloquea — pedirle una temporada de más lo rompe sin necesidad.
  return cachedFetch(`live:${leagueKey}`, TTL_SECONDS.live, "/fixtures", {
    league: league.id,
    live: "all",
  });
}

// A diferencia de "en vivo", este sí exige temporada — y el plan gratis sólo
// deja fechas de un margen de pocos días alrededor de hoy, lo que en la
// práctica choca con el rango de temporadas permitido (2022-2024): no hay
// ninguna combinación de fecha+temporada actual que el plan gratis deje
// pasar acá. Antes esto se devolvía como `blocked_by_plan` y la pantalla
// (Quiniela) se quedaba sin nada que mostrar — igual que standings/scorers,
// ahora cae a la MISMA fecha (mismo mes/día) pero de FALLBACK_SEASON, y se
// marca `demo: true` para que la pantalla lo diga. Así Quiniela siempre
// tiene partidos reales (de esa temporada) para predecir, sin depender de
// que alguien intervenga manualmente cada vez que cambia el año real.
export async function getFixturesByDate(leagueKey, date) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);

  const cacheKey = `fixtures:${leagueKey}:${date}`;
  const cached = await readCache(cacheKey, TTL_SECONDS.fixtures);
  if (cached) return cached;

  try {
    const data = await rawApiRequest("/fixtures", {
      league: league.id,
      season: currentSeason(leagueKey),
      date,
    });
    const result = { data, blocked_by_plan: false, demo: false };
    await writeCache(cacheKey, result);
    return result;
  } catch (err) {
    if (isSeasonPlanError(err)) {
      try {
        const result = { data: await demoFixturesFor(league, date), blocked_by_plan: false, demo: true };
        await writeCache(cacheKey, result);
        return result;
      } catch {
        const result = { data: [], blocked_by_plan: true, demo: false };
        await writeCache(cacheKey, result);
        return result;
      }
    }
    const stale = await readCache(cacheKey, Infinity);
    if (stale) return stale;
    throw err;
  }
}

// Probado a mano contra la API real: el plan gratis bloquea el filtro
// `date` en CUALQUIER temporada (hasta pedir season=2023 + date=2023-xx-xx
// tira "Free plans do not have access to this date"), pero pedir la
// temporada ENTERA sin `date` sí funciona — 380 partidos de una. Por eso el
// fallback no repite el mismo truco de "misma fecha, temporada vieja": trae
// la temporada de muestra completa una sola vez (caché larga, son datos que
// no cambian) y elige una fecha real de esa temporada de forma
// determinística a partir de la fecha pedida — mismo criterio que el
// secreto diario de Fichado, para que todos vean la misma "jornada de
// muestra" ese día sin tener que guardar nada.
function hashDateString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash;
}

async function getDemoSeasonFixtures(league) {
  const cacheKey = `demo-season:${league.id}:${FALLBACK_SEASON}`;
  const cached = await readCache(cacheKey, 30 * 24 * 3600); // un mes: son datos históricos fijos
  if (cached) return cached;
  const data = await rawApiRequest("/fixtures", { league: league.id, season: FALLBACK_SEASON });
  await writeCache(cacheKey, data);
  return data;
}

async function demoFixturesFor(league, date) {
  const season = await getDemoSeasonFixtures(league);
  const byDate = new Map();
  for (const fx of season) {
    const d = fx.fixture.date.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(fx);
  }
  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) return [];
  const pick = dates[hashDateString(date) % dates.length];
  return byDate.get(pick);
}

// La fecha que ve el cliente en un partido de muestra es la fecha REAL del
// partido dentro de la temporada de muestra (ej. "2023-12-19"), no la fecha
// de hoy que se usó para elegirlo — si /predict volviera a pasar esa fecha
// por demoFixturesFor() la hashearía de nuevo y probablemente caería en OTRA
// jornada de muestra, sin el partido que se está tratando de confirmar. Por
// eso la revalidación busca directo por id en toda la temporada, no por fecha.
export async function findDemoFixtureById(leagueKey, fixtureId) {
  const league = LEAGUES[leagueKey];
  if (!league) return null;
  const season = await getDemoSeasonFixtures(league);
  return season.find((fx) => fx.fixture.id === fixtureId) || null;
}

export async function getStandings(leagueKey) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  return seasonScopedFetch(`standings:${leagueKey}`, TTL_SECONDS.standings, "/standings", {
    league: league.id,
    season: currentSeason(leagueKey),
  });
}

export async function getTopScorers(leagueKey) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  return seasonScopedFetch(`scorers:${leagueKey}`, TTL_SECONDS.scorers, "/players/topscorers", {
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
