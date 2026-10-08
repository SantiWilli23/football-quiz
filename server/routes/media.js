import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/client.js";
import { normalize } from "../utils/futgames.js";

// Imágenes que la base de Futotal no trae: la cara de un futbolista y el escudo de un
// club, ambos por nombre. Se buscan una vez en el buscador público de ESPN y el
// resultado (también si no hay) se guarda para no volver a preguntar.
const router = Router();
router.use(requireAuth);

const SEARCH = "https://site.web.api.espn.com/apis/common/v3/search";
const headshot = (id) => `https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`;
const teamLogo = (id) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;

async function search(name, type) {
  const res = await fetch(`${SEARCH}?query=${encodeURIComponent(name)}&limit=6&type=${type}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = await res.json();
  return (data.items || []).filter((p) => p.sport === "soccer");
}

async function findPlayer(name) {
  const wanted = normalize(name);
  const items = await search(name, "player");
  const hit = items.find((p) => normalize(p.displayName) === wanted) || (items.length === 1 ? items[0] : null);
  return hit ? headshot(hit.id) : null;
}

async function findClub(name) {
  const wanted = normalize(name);
  const items = await search(name, "team");
  const hit = items.find((t) => normalize(t.displayName) === wanted)
    || items.find((t) => { const n = normalize(t.displayName); return n.includes(wanted) || wanted.includes(n); });
  return hit ? teamLogo(hit.id) : null;
}

const memory = new Map(); // "tabla|clave" -> url | null

async function cachedLookup(table, name, finder) {
  const key = normalize(name);
  const mk = `${table}|${key}`;
  if (memory.has(mk)) return memory.get(mk);
  const row = (await db.execute({ sql: `SELECT url FROM ${table} WHERE name_key = ?`, args: [key] })).rows[0];
  if (row) {
    const url = row.url || null;
    memory.set(mk, url);
    return url;
  }
  let url = null;
  try {
    url = await finder(name);
  } catch {
    return null; // fallo de red: no se guarda, se reintenta después
  }
  memory.set(mk, url);
  await db.execute({ sql: `INSERT OR REPLACE INTO ${table} (name_key, url) VALUES (?, ?)`, args: [key, url || ""] });
  return url;
}

const nameOf = (req) => String(req.query.name || "").trim().slice(0, 80);

router.get("/player", async (req, res) => {
  const name = nameOf(req);
  if (!name) return res.status(400).json({ error: "Falta el nombre" });
  res.json({ url: await cachedLookup("player_photos", name, findPlayer) });
});

router.get("/club", async (req, res) => {
  const name = nameOf(req);
  if (!name) return res.status(400).json({ error: "Falta el nombre" });
  res.json({ url: await cachedLookup("club_crests", name, findClub) });
});

export default router;
