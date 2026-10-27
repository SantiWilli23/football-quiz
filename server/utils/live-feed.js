import { ESPN_SLUGS } from "./football-api.js";
import { normalizeEspnSummary } from "./live-match.js";

// Un solo consultor por partido: sin importar cuántos usuarios miren el mismo partido, al
// proveedor se le pide como mucho una vez por ventana. Todos comparten la misma copia y, si
// el proveedor falla, se sigue sirviendo la última buena marcada como vieja (nunca se hace
// pasar un dato viejo por actual).
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";
export const TTL_MS = { live: 15_000, pre: 120_000, finished: 600_000 };
const STALE_LIMIT_MS = 5 * 60_000;

const cache = new Map(); // "liga|id" -> { model, at }
const inflight = new Map();

export const knownSlug = (league) => ESPN_SLUGS[league] || (Object.values(ESPN_SLUGS).includes(league) ? league : null);

async function defaultFetch(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

function ttlFor(model) {
  if (model.live) return TTL_MS.live;
  if (model.finished) return TTL_MS.finished;
  return TTL_MS.pre;
}

export function clearLiveCache() {
  cache.clear();
  inflight.clear();
}

// Devuelve el partido normalizado. `stale: true` si es una copia vieja porque la fuente falló.
export async function getLiveMatch(league, id, { fetchJson = defaultFetch, now = Date.now } = {}) {
  const slug = knownSlug(league);
  if (!slug || !/^\d{4,12}$/.test(String(id))) {
    const err = new Error("Partido o liga inválidos");
    err.status = 400;
    throw err;
  }
  const key = `${slug}|${id}`;
  const hit = cache.get(key);
  if (hit && now() - hit.at < ttlFor(hit.model)) return { ...hit.model, stale: false, ageSeconds: Math.round((now() - hit.at) / 1000) };

  if (!inflight.has(key)) {
    inflight.set(key, (async () => {
      try {
        const json = await fetchJson(`${ESPN_URL}/${slug}/summary?event=${id}`);
        const model = normalizeEspnSummary(json, { leagueKey: slug, now: new Date(now()) });
        cache.set(key, { model, at: now() });
        return { ...model, stale: false, ageSeconds: 0 };
      } catch (err) {
        if (hit && now() - hit.at < STALE_LIMIT_MS) return { ...hit.model, stale: true, ageSeconds: Math.round((now() - hit.at) / 1000), error: "La fuente no responde: se muestra la última actualización." };
        throw err;
      } finally {
        inflight.delete(key);
      }
    })());
  }
  return inflight.get(key);
}
