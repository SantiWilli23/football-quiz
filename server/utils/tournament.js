import { db } from "../db/client.js";
import { addDays } from "./points.js";

// Álbum de selecciones (W7). Recibe la lista de cartas para no depender de routes/cards.js.
export const MIN_NATION_CARDS = 5; // una selección con menos cartas en el juego no entra al álbum
export const SQUAD = 11;
const POS = new Set(["GK", "DEF", "MID", "FWD"]);

export function nationCounts(cards) {
  const by = new Map();
  for (const c of cards) {
    if (c.special || !POS.has(c.pos) || !c.nationality) continue;
    by.set(c.nationality, (by.get(c.nationality) || 0) + 1);
  }
  return by;
}
export const eligibleNations = (cards) => [...nationCounts(cards)].filter(([, n]) => n >= MIN_NATION_CARDS).map(([name, n]) => ({ name, cards: n })).sort((a, b) => b.cards - a.cards || a.name.localeCompare(b.name));

export async function activeTournament(date) {
  const row = (await db.execute({ sql: "SELECT * FROM tournaments WHERE starts <= ? AND ends >= ? ORDER BY starts LIMIT 1", args: [date, date] })).rows[0];
  return row ? { id: Number(row.id), name: row.name, starts: row.starts, ends: row.ends, groupsEnd: row.groups_end, nations: JSON.parse(row.nations_json) } : null;
}

const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

export function seasonInfo(t, date) {
  const total = daysBetween(t.starts, t.ends) + 1;
  const day = Math.min(total, Math.max(1, daysBetween(t.starts, date) + 1));
  const groupsEnd = t.groupsEnd || addDays(t.starts, Math.floor(total * 0.6) - 1);
  return { day, total, phase: date <= groupsEnd ? "Fase de grupos" : "Fase final" };
}

// Progreso por selección = cartas distintas que tienes / min(11, cartas que existen de esa selección).
export async function progressOf(userId, t, cards) {
  const counts = nationCounts(cards);
  const byName = new Map(cards.map((c) => [c.name, c]));
  const owned = (await db.execute({ sql: "SELECT player_name FROM user_cards WHERE user_id = ?", args: [userId] })).rows.map((r) => byName.get(r.player_name)).filter(Boolean);
  const have = new Map();
  for (const c of owned) if (!c.special && POS.has(c.pos)) have.set(c.nationality, (have.get(c.nationality) || 0) + 1);
  return t.nations.map((name) => {
    const target = Math.min(SQUAD, counts.get(name) || 0);
    const n = Math.min(have.get(name) || 0, target);
    return { name, owned: n, target, complete: target > 0 && n >= target };
  });
}

export const REWARDS = [
  { key: "una", label: "1 selección completa", pack: "normal", need: (p) => p.filter((x) => x.complete).length >= 1 },
  { key: "cuatro", label: "4 selecciones completas", pack: "bueno", need: (p) => p.length > 1 && p.filter((x) => x.complete).length >= Math.min(4, p.length - 1) },
  { key: "chile", label: "Chile completa", pack: "top", need: (p) => p.some((x) => x.name === "Chile" && x.complete) },
  { key: "todas", label: "Todas las selecciones", pack: null, need: (p) => p.length > 0 && p.every((x) => x.complete) },
];

export async function claimedOf(userId, tid) {
  return new Set((await db.execute({ sql: "SELECT reward FROM tournament_claims WHERE user_id = ? AND tournament_id = ?", args: [userId, tid] })).rows.map((r) => r.reward));
}

// Entrega los premios que ya se cumplieron y no se habían cobrado. Cada uno se cobra una sola vez
// (aunque después se vendan cartas o se reabra la página).
export async function claimRewards(userId, t, progress, date) {
  const done = await claimedOf(userId, t.id);
  const got = [];
  for (const r of REWARDS) {
    if (done.has(r.key) || !r.need(progress)) continue;
    const ins = await db.execute({ sql: "INSERT OR IGNORE INTO tournament_claims (user_id, tournament_id, reward) VALUES (?, ?, ?)", args: [userId, t.id, r.key] });
    if (!ins.rowsAffected) continue;
    if (r.pack) await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [userId, date, `${r.pack}-torneo${t.id}-${r.key}`] });
    else await db.execute({ sql: "INSERT OR IGNORE INTO event_badges (user_id, date, kit_key, kind) VALUES (?, ?, ?, 'torneo')", args: [userId, date, `torneo-${t.id}`] });
    got.push({ key: r.key, label: r.label, pack: r.pack });
  }
  return got;
}
