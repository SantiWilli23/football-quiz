// Calificación por partido (de 1 a 10) calculada con las estadísticas oficiales de cada
// jugador en cada partido de ESPN (la API pública no publica una nota, pero sí goles,
// asistencias, tiros, atajadas, tarjetas, faltas y el resultado). Se arma una nota que
// tiene en cuenta la posición: un arquero o un defensor sube con la valla invicta y las
// atajadas, un mediocampista con asistencias y pases de gol, un delantero con goles y
// tiros. Así el ranking por calificación no queda lleno de delanteros.
const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const SLUGS = { bundesliga: "ger.1", laliga: "esp.1", premier: "eng.1", serie_a: "ita.1", ligue1: "fra.1", chile: "chi.1" };
const HEADSHOT = (id) => `https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`;

const WINDOW_DAYS = 45; // partidos de las últimas ~6 semanas
const MAX_MATCHES = 110;
const CONCURRENCY = 6;
const TTL_MS = 3 * 60 * 60 * 1000;
const POS_LABEL = { GK: "Arquero", DEF: "Defensor", MID: "Mediocampista", FWD: "Delantero" };

const cache = new Map();

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

// Grupo de posición a partir de la abreviatura de ESPN (G, CD-L, LB, CM-R, CF-L, SUB...).
export function positionGroup(abbr) {
  const a = String(abbr || "").toUpperCase();
  if (a === "G") return "GK";
  if (/^(CD|SW|LB|RB|WB|LWB|RWB|D)/.test(a)) return "DEF";
  if (/^(F|CF|LF|RF|ST|SS)/.test(a)) return "FWD";
  return "MID"; // CM, DM, AM, LM, RM, M y los suplentes (se desconoce su puesto)
}

const stat = (p, name) => Number((p.stats || []).find((s) => s.name === name)?.value) || 0;

// Nota de un jugador en un partido. `teamGoals` y `rivalGoals` son los del equipo del jugador.
export function rateMatch(p, group, teamGoals, rivalGoals) {
  const goals = stat(p, "totalGoals");
  const assists = stat(p, "goalAssists");
  const shots = stat(p, "totalShots");
  const onTarget = stat(p, "shotsOnTarget");
  let r = 6.0;
  r += goals * 1.0 + assists * 0.7;
  r += onTarget * 0.12 + Math.max(0, shots - onTarget) * 0.03;
  if (group === "GK") r += stat(p, "saves") * 0.28 - stat(p, "goalsConceded") * 0.3;
  if (teamGoals > rivalGoals) r += 0.35;
  else if (teamGoals < rivalGoals) r -= 0.25;
  if (rivalGoals === 0) r += group === "GK" || group === "DEF" ? 0.6 : group === "MID" ? 0.25 : 0.1;
  else if (rivalGoals >= 3 && (group === "GK" || group === "DEF")) r -= 0.4;
  r -= stat(p, "yellowCards") * 0.25 + stat(p, "redCards") * 1.5 + stat(p, "ownGoals") * 1.2;
  r -= Math.min(0.4, stat(p, "foulsCommitted") * 0.04) + stat(p, "offsides") * 0.04;
  r += Math.min(0.3, stat(p, "foulsSuffered") * 0.03);
  if (!p.starter) r = 6 + (r - 6) * 0.7; // el suplente jugó menos: su nota se acerca al promedio
  return Math.min(10, Math.max(4, r));
}

// Los 5 mejores, con tope de 2 por posición para que no sean todos delanteros.
function pickVaried(sorted, size = 5, perGroup = 2) {
  const counts = {};
  const picked = [];
  for (const p of sorted) {
    if (picked.length >= size) break;
    if ((counts[p.group] || 0) >= perGroup) continue;
    counts[p.group] = (counts[p.group] || 0) + 1;
    picked.push(p);
  }
  for (const p of sorted) {
    if (picked.length >= size) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked.sort((a, b) => b.value - a.value);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i]); } catch { out[i] = null; }
    }
  }));
  return out;
}

// ESPN rechaza los rangos largos de fechas: se pide el tablero día por día.
async function recentEvents(slug) {
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => ymd(new Date(Date.now() - i * 86400000)));
  const boards = await mapLimit(days, 8, (d) => getJson(`${SITE}/${slug}/scoreboard?dates=${d}`));
  const seen = new Set();
  return boards.flatMap((b) => b?.events || [])
    .filter((e) => e.status?.type?.completed && !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_MATCHES);
}

// Top 5 por calificación promedio de la liga, con al menos la mitad de los partidos del que más jugó.
export function getRatedLeaders(leagueKey) {
  const slug = SLUGS[leagueKey];
  if (!slug) throw new Error("Liga desconocida");
  const hit = cache.get(leagueKey);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.data);
  return (async () => {
    try {
      const events = await recentEvents(slug);
      const summaries = await mapLimit(events, CONCURRENCY, (e) => getJson(`${SITE}/${slug}/summary?event=${e.id}`));
      const players = new Map();
      for (const sm of summaries) {
        const comp = sm?.header?.competitions?.[0];
        if (!comp?.status?.type?.completed || !sm.rosters) continue;
        const score = Object.fromEntries(comp.competitors.map((c) => [String(c.team.id), Number(c.score) || 0]));
        for (const roster of sm.rosters) {
          const teamId = String(roster.team.id);
          const rivalId = Object.keys(score).find((k) => k !== teamId);
          for (const p of roster.roster || []) {
            if (!stat(p, "appearances") && !p.starter) continue;
            const group = positionGroup(p.starter ? p.position?.abbreviation : "SUB");
            const rating = rateMatch(p, group, score[teamId] ?? 0, score[rivalId] ?? 0);
            const id = Number(p.athlete.id);
            const cur = players.get(id) || {
              id, name: p.athlete.displayName, photo: HEADSHOT(id),
              team: { id: Number(roster.team.id), name: roster.team.displayName, logo: roster.team.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${roster.team.id}.png` },
              matches: 0, sum: 0, goals: 0, assists: 0, starts: 0, groups: {},
            };
            cur.matches += 1;
            cur.sum += rating;
            cur.goals += stat(p, "totalGoals");
            cur.assists += stat(p, "goalAssists");
            if (p.starter) { cur.starts += 1; cur.groups[group] = (cur.groups[group] || 0) + 1; }
            players.set(id, cur);
          }
        }
      }
      const all = [...players.values()];
      const maxMatches = Math.max(1, ...all.map((p) => p.matches));
      const minMatches = Math.max(2, Math.ceil(maxMatches * 0.5));
      const rated = all
        .filter((p) => p.matches >= minMatches && p.starts >= Math.ceil(p.matches / 2))
        .map((p) => {
          const group = Object.entries(p.groups).sort((a, b) => b[1] - a[1])[0]?.[0] || "MID";
          return {
            id: p.id, name: p.name, photo: p.photo, team: p.team, matches: p.matches,
            goals: p.goals, assists: p.assists, position: POS_LABEL[group], group,
            value: Math.round((p.sum / p.matches) * 100) / 100,
          };
        })
        .sort((a, b) => b.value - a.value || b.matches - a.matches);
      const ratings = pickVaried(rated);
      const data = { ratings, minMatches, matchesAnalyzed: events.length };
      cache.set(leagueKey, { at: Date.now(), data });
      return data;
    } catch (err) {
      if (hit) return hit.data;
      throw err;
    }
  })();
}
