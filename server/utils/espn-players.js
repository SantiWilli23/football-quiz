// Líderes de liga y ficha de carrera de un jugador, desde la API pública de ESPN
// (sin clave). Cache en memoria: son datos que casi no cambian entre partidos.
const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes";
const SLUGS = { bundesliga: "ger.1", laliga: "esp.1", premier: "eng.1", serie_a: "ita.1", ligue1: "fra.1", chile: "chi.1" };

const cache = new Map();
async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try {
    const data = await loader();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data;
    throw err;
  }
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

export const headshot = (id) => `https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`;
export const teamLogo = (id) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;

const matchesOf = (display) => parseInt(/Matches:\s*(\d+)/.exec(display || "")?.[1], 10) || 0;

function entry(l) {
  const t = l.athlete.team;
  return {
    id: Number(l.athlete.id),
    name: l.athlete.displayName,
    photo: headshot(l.athlete.id),
    team: t ? { id: Number(t.id), name: t.displayName, logo: t.logos?.[0]?.href ?? teamLogo(t.id) } : null,
    value: l.value,
    matches: matchesOf(l.displayValue),
  };
}

// Top 5 de goles, de asistencias y de participaciones en gol por partido.
export function getLeaders(leagueKey) {
  const slug = SLUGS[leagueKey];
  if (!slug) throw new Error("Liga desconocida");
  return cached(`leaders:${leagueKey}`, 60 * 60 * 1000, async () => {
    const json = await getJson(`${SITE}/${slug}/statistics`);
    const goals = (json.stats?.find((s) => s.name === "goalsLeaders")?.leaders || []).map(entry);
    const assists = (json.stats?.find((s) => s.name === "assistsLeaders")?.leaders || []).map(entry);
    const aById = new Map(assists.map((a) => [a.id, a]));
    const gById = new Map(goals.map((g) => [g.id, g]));

    // Unión de ambas listas: si falta en una, se asume 0 (no entró al top 50).
    const all = new Map();
    for (const g of goals) all.set(g.id, { ...g, goals: g.value, assists: aById.get(g.id)?.value ?? 0 });
    for (const a of assists) if (!all.has(a.id)) all.set(a.id, { ...a, goals: gById.get(a.id)?.value ?? 0, assists: a.value });
    const maxMatches = Math.max(1, ...[...all.values()].map((p) => p.matches));
    const minMatches = Math.max(3, Math.round(maxMatches * 0.4));
    const perGame = [...all.values()]
      .filter((p) => p.matches >= minMatches)
      .map((p) => ({ ...p, value: Math.round(((p.goals + p.assists) / p.matches) * 100) / 100 }))
      .sort((a, b) => b.value - a.value || b.goals - a.goals)
      .slice(0, 5);

    return {
      goals: goals.slice(0, 5).map((p) => ({ ...p, goals: p.value, assists: aById.get(p.id)?.value ?? 0 })),
      assists: assists.slice(0, 5).map((p) => ({ ...p, assists: p.value, goals: gById.get(p.id)?.value ?? 0 })),
      perGame,
      minMatches,
    };
  });
}

const STAT_NAMES = ["starts", "foulsCommitted", "foulsSuffered", "yellow", "red", "goals", "assists", "shots", "shotsOnTarget", "offsides"];
const statsOf = (arr) => Object.fromEntries(STAT_NAMES.map((n, i) => [n, Number(arr?.[i]) || 0]));

// Ficha de carrera: datos personales + cada club/selección con sus temporadas.
export function getPlayer(id) {
  return cached(`player:${id}`, 6 * 60 * 60 * 1000, async () => {
    const [bio, stats] = await Promise.all([getJson(`${WEB}/${id}`), getJson(`${WEB}/${id}/stats`)]);
    const a = bio.athlete;
    const options = stats.filters?.find((f) => f.name === "team")?.options || [];

    const careers = await Promise.all(
      options.map(async (o) => {
        const j = await getJson(`${WEB}/${id}/stats?team=${o.value}`).catch(() => null);
        const rows = j?.categories?.[0]?.statistics || [];
        const byYear = new Map();
        for (const r of rows) {
          const year = r.season?.year;
          const s = statsOf(r.stats);
          const cur = byYear.get(year) || { year, league: r.leagueSlug, starts: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
          for (const k of ["starts", "goals", "assists", "yellow", "red"]) cur[k] += s[k];
          byYear.set(year, cur);
        }
        const seasons = [...byYear.values()].sort((x, y) => y.year - x.year);
        const slug = rows[0]?.teamSlug || "";
        return {
          id: Number(o.value),
          name: o.displayValue,
          logo: teamLogo(o.value),
          national: !slug.includes("."),
          from: seasons.length ? seasons[seasons.length - 1].year : null,
          to: seasons.length ? seasons[0].year : null,
          seasons,
          totals: seasons.reduce((t, s) => ({ starts: t.starts + s.starts, goals: t.goals + s.goals, assists: t.assists + s.assists }), { starts: 0, goals: 0, assists: 0 }),
        };
      }),
    );
    careers.sort((x, y) => (y.to ?? 0) - (x.to ?? 0));

    return {
      id: Number(a.id),
      name: a.displayName,
      photo: headshot(a.id),
      position: a.position?.displayName ?? null,
      jersey: a.jersey ?? null,
      age: a.age ?? null,
      birth: a.displayDOB ?? null,
      birthPlace: a.displayBirthPlace ?? null,
      height: a.displayHeight ?? null,
      weight: a.displayWeight ?? null,
      nationality: a.citizenship ?? null,
      flag: a.flag?.href ?? null,
      active: a.active ?? null,
      team: a.team ? { id: Number(a.team.id), name: a.team.displayName, logo: a.team.logos?.[0]?.href ?? teamLogo(a.team.id) } : null,
      clubs: careers.filter((c) => !c.national),
      national: careers.filter((c) => c.national),
      // Solo clubes: ESPN trae pocas temporadas de selección y distorsionaría el total.
      totals: careers.filter((c) => !c.national).reduce((t, c) => ({ starts: t.starts + c.totals.starts, goals: t.goals + c.totals.goals, assists: t.assists + c.totals.assists }), { starts: 0, goals: 0, assists: 0 }),
    };
  });
}
