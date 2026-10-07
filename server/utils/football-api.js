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

// Sin FOOTBALL_API_KEY se usa la API pública de ESPN (no pide clave, trae la
// temporada actual completa). Las funciones de abajo la traducen al mismo
// formato de api-football, así que rutas y pantallas no notan la diferencia.
const useEspn = () => !process.env.FOOTBALL_API_KEY;

export function isConfigured() {
  return true;
}

const ESPN_BASE = "https://site.api.espn.com/apis";
const ESPN_SLUGS = { bundesliga: "ger.1", laliga: "esp.1", premier: "eng.1", serie_a: "ita.1", ligue1: "fra.1", chile: "chi.1" };

async function espnGet(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new FootballApiError(`No se pudo contactar a la API de fútbol: ${err.message}`, 502);
  }
  if (!response.ok) throw new FootballApiError(`La API de fútbol respondió ${response.status}`, 502);
  return response.json();
}

// Igual que cachedFetch, pero con un loader cualquiera en vez de api-football.
async function espnCached(cacheKey, ttlSeconds, loader) {
  const fresh = await readCache(cacheKey, ttlSeconds);
  if (fresh) return fresh;
  try {
    const data = await loader();
    await writeCache(cacheKey, data);
    return data;
  } catch (err) {
    const stale = await readCache(cacheKey, Infinity);
    if (stale) return stale;
    throw err;
  }
}

function espnStatusShort(status) {
  const name = status?.type?.name || "";
  const state = status?.type?.state;
  if (/POSTPONED/.test(name)) return "PST";
  if (/CANCELED|CANCELLED/.test(name)) return "CANC";
  if (/HALFTIME/.test(name)) return "HT";
  if (state === "pre") return "NS";
  if (state === "post") return /PEN/.test(name) ? "PEN" : /AET|EXTRA/.test(name) ? "AET" : "FT";
  if (state === "in") return status.period >= 3 ? "ET" : status.period === 2 ? "2H" : "1H";
  return "TBD";
}

function espnFixture(ev) {
  const comp = ev.competitions?.[0] || {};
  const side = (ha) => comp.competitors?.find((c) => c.homeAway === ha) || {};
  const home = side("home");
  const away = side("away");
  const short = espnStatusShort(ev.status);
  const started = short !== "NS" && short !== "TBD" && short !== "PST" && short !== "CANC";
  const team = (c) => ({ id: Number(c.team?.id), name: c.team?.displayName, logo: c.team?.logo, winner: c.winner ?? null });
  return {
    fixture: {
      id: Number(ev.id),
      date: ev.date,
      status: { short, elapsed: parseInt(ev.status?.displayClock, 10) || null },
      venue: { name: comp.venue?.fullName ?? null },
    },
    teams: { home: team(home), away: team(away) },
    goals: { home: started ? Number(home.score) : null, away: started ? Number(away.score) : null },
  };
}

async function espnScoreboard(leagueKey, date) {
  const slug = ESPN_SLUGS[leagueKey];
  const q = date ? `?dates=${date.replaceAll("-", "")}` : "";
  const json = await espnGet(`${ESPN_BASE}/site/v2/sports/soccer/${slug}/scoreboard${q}`);
  return (json.events || []).map(espnFixture);
}

async function espnStandings(leagueKey) {
  const json = await espnGet(`${ESPN_BASE}/v2/sports/soccer/${ESPN_SLUGS[leagueKey]}/standings`);
  const entries = json.children?.[0]?.standings?.entries || [];
  const rows = entries.map((e) => {
    const s = Object.fromEntries((e.stats || []).map((x) => [x.name, x.value]));
    return {
      rank: s.rank,
      team: { id: Number(e.team.id), name: e.team.displayName, logo: e.team.logos?.[0]?.href ?? null },
      all: { played: s.gamesPlayed, win: s.wins, draw: s.ties, lose: s.losses, goals: { for: s.pointsFor, against: s.pointsAgainst } },
      goalsDiff: s.pointDifferential,
      points: s.points,
      form: null,
    };
  }).sort((a, b) => a.rank - b.rank);
  return [{ league: { standings: [rows] } }];
}

async function espnScorers(leagueKey) {
  const json = await espnGet(`${ESPN_BASE}/site/v2/sports/soccer/${ESPN_SLUGS[leagueKey]}/statistics`);
  const goals = json.stats?.find((s) => s.name === "goalsLeaders")?.leaders || [];
  const assists = new Map((json.stats?.find((s) => s.name === "assistsLeaders")?.leaders || []).map((l) => [l.athlete.id, l.value]));
  return goals.slice(0, 20).map((l) => {
    const t = l.athlete.team;
    return {
      player: { id: Number(l.athlete.id), name: l.athlete.displayName, photo: null },
      statistics: [{
        team: t ? { id: Number(t.id), name: t.displayName, logo: t.logos?.[0]?.href ?? null } : null,
        goals: { total: l.value, assists: assists.get(l.athlete.id) ?? 0 },
        games: { appearences: parseInt(/Matches:\s*(\d+)/.exec(l.displayValue || "")?.[1], 10) || 0 },
      }],
    };
  });
}

async function espnLineups(fixtureId) {
  const json = await espnGet(`${ESPN_BASE}/site/v2/sports/soccer/all/summary?event=${fixtureId}`);
  return (json.rosters || []).map((r) => {
    const p = (x) => ({ player: { number: x.jersey ? Number(x.jersey) : null, name: x.athlete?.displayName, pos: x.position?.abbreviation ?? null } });
    return {
      team: { id: Number(r.team?.id), name: r.team?.displayName, logo: r.team?.logos?.[0]?.href ?? r.team?.logo ?? null },
      formation: r.formation ?? null,
      coach: null,
      startXI: (r.roster || []).filter((x) => x.starter).map(p),
      substitutes: (r.roster || []).filter((x) => !x.starter).map(p),
    };
  });
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

// ---- Ficha de equipo (ESPN) -------------------------------------------------
// Resultado de la liga pasada, plantilla, lesiones y títulos de liga. ESPN no
// tiene "palmarés": los títulos se cuentan mirando quién terminó 1º en la tabla
// final de cada temporada. Europa desde 2005-06; Chile desde 2020 (antes el
// campeonato se partía en torneos y la tabla no define al campeón).
const TITLES_FROM = { chile: 2020 };
const TITLES_FROM_DEFAULT = 2005;
const TTL_DAY = 24 * 3600;

async function espnStandingsFor(leagueKey, season) {
  const json = await espnGet(`${ESPN_BASE}/v2/sports/soccer/${ESPN_SLUGS[leagueKey]}/standings?season=${season}`);
  return json.children?.[0]?.standings?.entries || [];
}

const statOf = (entry, name) => (entry.stats || []).find((x) => x.name === name)?.value;

async function espnChampions(leagueKey) {
  const from = TITLES_FROM[leagueKey] ?? TITLES_FROM_DEFAULT;
  const last = currentSeason(leagueKey) - 1; // la temporada en curso todavía no tiene campeón
  const years = [];
  for (let y = from; y <= last; y++) years.push(y);
  const tables = await Promise.all(years.map((y) => espnStandingsFor(leagueKey, y).catch(() => [])));
  const champions = {};
  const missing = []; // temporadas sin tabla usable (ESPN a veces las trae vacías, con 0 puntos)
  tables.forEach((entries, i) => {
    const top = entries.find((e) => statOf(e, "rank") === 1);
    if (top && entries.length >= 10 && statOf(top, "points") > 0) {
      const id = String(top.team.id);
      (champions[id] ||= []).push(years[i]);
    } else {
      missing.push(years[i]);
    }
  });
  return { from, last, champions, missing };
}

async function espnTeamInfo(leagueKey, teamId) {
  const slug = ESPN_SLUGS[leagueKey];
  const [roster, lastTable, champs] = await Promise.all([
    espnGet(`${ESPN_BASE}/site/v2/sports/soccer/${slug}/teams/${teamId}/roster`),
    espnStandingsFor(leagueKey, currentSeason(leagueKey) - 1).catch(() => []),
    espnCached(`espn:champions:${leagueKey}`, 30 * TTL_DAY, () => espnChampions(leagueKey)).catch(() => null),
  ]);

  const season = currentSeason(leagueKey);
  const mine = lastTable.find((e) => String(e.team.id) === String(teamId));
  const lastSeason = mine
    ? {
        label: leagueKey === "chile" ? String(season - 1) : `${season - 1}-${String(season).slice(2)}`,
        position: statOf(mine, "rank"),
        of: lastTable.length,
        points: statOf(mine, "points"),
        won: statOf(mine, "wins"),
        drawn: statOf(mine, "ties"),
        lost: statOf(mine, "losses"),
        goals_for: statOf(mine, "pointsFor"),
        goals_against: statOf(mine, "pointsAgainst"),
      }
    : null;

  const squad = (roster.athletes || []).map((a) => ({
    name: a.displayName,
    number: a.jersey ? Number(a.jersey) : null,
    position: a.position?.abbreviation ?? null,
    age: a.age ?? null,
    nationality: a.citizenship ?? a.flag?.alt ?? null,
  }));
  const injuries = (roster.athletes || [])
    .filter((a) => Array.isArray(a.injuries) && a.injuries.length > 0)
    .map((a) => ({
      name: a.displayName,
      detail: a.injuries[0].type?.description || a.injuries[0].status || a.injuries[0].details?.type || "Lesionado",
      return_date: a.injuries[0].details?.returnDate ?? null,
    }));

  const years = champs?.champions?.[String(teamId)] || [];
  const coach = roster.coach?.[0];
  return {
    team: {
      id: Number(teamId),
      name: roster.team?.displayName,
      logo: roster.team?.logo ?? null,
      coach: coach ? `${coach.firstName ?? ""} ${coach.lastName ?? ""}`.trim() || null : null,
    },
    lastSeason,
    squad,
    injuries,
    titles: { count: years.length, years, from: champs?.from ?? null, until: champs?.last ?? null, missing: champs?.missing ?? [] },
  };
}

export async function getTeamInfo(leagueKey, teamId) {
  if (!LEAGUES[leagueKey]) throw new FootballApiError("Liga desconocida", 400);
  if (!useEspn()) throw new FootballApiError("La ficha de equipo solo está disponible con la fuente pública", 501);
  return espnCached(`espn:team:${leagueKey}:${teamId}`, 6 * 3600, () => espnTeamInfo(leagueKey, teamId));
}

export async function getLiveFixtures(leagueKey) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  if (useEspn()) {
    const data = await espnCached(`espn:live:${leagueKey}`, 60, async () =>
      (await espnScoreboard(leagueKey)).filter((f) => ["1H", "2H", "HT", "ET"].includes(f.fixture.status.short)));
    return { data, stale: false, demo: false };
  }
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
  if (useEspn()) {
    const data = await espnCached(`espn:fixtures:${leagueKey}:${date}`, TTL_SECONDS.fixtures, () => espnScoreboard(leagueKey, date));
    return { data, blocked_by_plan: false, demo: false };
  }

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
  if (useEspn()) {
    return { data: await espnCached(`espn:standings:${leagueKey}`, TTL_SECONDS.standings, () => espnStandings(leagueKey)), demo: false };
  }
  return seasonScopedFetch(`standings:${leagueKey}`, TTL_SECONDS.standings, "/standings", {
    league: league.id,
    season: currentSeason(leagueKey),
  });
}

export async function getTopScorers(leagueKey) {
  const league = LEAGUES[leagueKey];
  if (!league) throw new FootballApiError("Liga desconocida", 400);
  if (useEspn()) {
    return { data: await espnCached(`espn:scorers:${leagueKey}`, TTL_SECONDS.scorers, () => espnScorers(leagueKey)), demo: false };
  }
  return seasonScopedFetch(`scorers:${leagueKey}`, TTL_SECONDS.scorers, "/players/topscorers", {
    league: league.id,
    season: currentSeason(leagueKey),
  });
}

export async function getLineups(fixtureId) {
  if (useEspn()) {
    return { data: await espnCached(`espn:lineup:${fixtureId}`, TTL_SECONDS.lineup, () => espnLineups(fixtureId)), stale: false };
  }
  return cachedFetch(`lineup:${fixtureId}`, TTL_SECONDS.lineup, "/fixtures/lineups", {
    fixture: fixtureId,
  });
}

export { FootballApiError };
