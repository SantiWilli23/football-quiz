import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr, mondayOf, quarterStart, quarterEnd, quarterKey } from "../utils/points.js";
import { rankingBetween } from "./stats.js";

const router = Router();
router.use(requireAuth);

// Liga del grupo: opt-in (ver POST /groups/:id/league/toggle, necesita 10+
// miembros para activarse) — antes vivía como un juego más en el catálogo
// de Juegos; ahora es una función del grupo, como Cartas. Una temporada por
// trimestre con una "fecha" por semana. Los puntos de cada semana salen del
// MISMO ranking del grupo (rankingBetween: trivia, duelos, Fichado,
// quiniela...), así que cualquier juego suma. Los miembros se reparten en
// EXACTAMENTE DOS divisiones (mitad de arriba / mitad de abajo por puntos
// acumulados); suben los 2 mejores de Segunda y bajan los 2 peores de
// Primera al cerrar el trimestre.
const DIVISION_NAMES = ["Primera", "Segunda"];
const MIN_MEMBERS = 10;

// Sobres de cartas al cerrar la temporada, según división y posición final
// (solo si el grupo activó league_packs_enabled). Primera reparte más que
// Segunda porque es la división de arriba.
function packsFor(divisionIndex, position) {
  if (divisionIndex === 0) {
    if (position === 1) return 5;
    if (position === 2) return 4;
    if (position === 3) return 3;
    if (position <= 6) return 2;
    return 1;
  }
  if (position === 1) return 3;
  if (position === 2) return 2;
  if (position === 3) return 1;
  return 0;
}

async function standingsFor(groupId, seasonStart, seasonEndMonday) {
  let cursor = mondayOf(seasonStart);
  const weeks = [];
  while (cursor <= seasonEndMonday) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  const totals = new Map();
  const weekPts = new Map();
  const series = new Map();
  const info = new Map();
  const thisMonday = seasonEndMonday;
  const weekly = await Promise.all(weeks.map((monday) => rankingBetween(groupId, monday < seasonStart ? seasonStart : monday, addDays(monday, 6))));
  for (const [wi, monday] of weeks.entries()) {
    const rows = weekly[wi];
    const seen = new Set();
    for (const r of rows) {
      const pts = Number(r.points || 0);
      info.set(r.id, r);
      totals.set(r.id, (totals.get(r.id) || 0) + pts);
      if (monday === thisMonday) weekPts.set(r.id, pts);
      if (!series.has(r.id)) series.set(r.id, []);
      series.get(r.id).push(pts);
      seen.add(r.id);
    }
    for (const id of info.keys()) {
      if (!seen.has(id)) series.get(id)?.push(0);
    }
  }

  const sorted = [...info.values()].sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0) || a.username.localeCompare(b.username));
  // Dos divisiones, mitad y mitad (la de arriba se lleva el extra si es impar).
  const half = Math.ceil(sorted.length / 2);
  const divisions = [sorted.slice(0, half), sorted.slice(half)];
  const out = divisions.map((rows, di) => {
    const ordered = [...rows].sort((a, b) => (weekPts.get(b.id) || 0) - (weekPts.get(a.id) || 0) || (totals.get(b.id) || 0) - (totals.get(a.id) || 0));
    return {
      name: DIVISION_NAMES[di],
      rows: ordered.map((r, i) => ({
        id: r.id,
        username: r.username,
        avatar: r.avatar,
        avatar_config: r.avatar_config,
        weekPoints: weekPts.get(r.id) || 0,
        seasonPoints: totals.get(r.id) || 0,
        weekSeries: series.get(r.id) || [],
        zone: divisions.length > 1 && ordered.length >= 4
          ? (i < 2 && di > 0 ? "sube" : i >= ordered.length - 2 && di < divisions.length - 1 ? "baja" : null)
          : null,
      })),
    };
  });
  return { weeks, divisions: out };
}

// Reparte los sobres de la temporada que ACABA de terminar, una sola vez
// (resolución perezosa: se dispara solo al consultar, como la copa semanal
// y el mercado de pases). Si ya hay una fila en league_rewards para esta
// temporada, se asume que ya se repartió y no se vuelve a calcular — no
// hay reintento fila por fila si el server se cae a mitad de camino, pero
// para un grupo de amigos el costo de esa rareza es bajo y evita recalcular
// la temporada entera en cada visita.
async function maybeGrantSeasonRewards(groupId, today) {
  const prevSeasonEnd = addDays(quarterStart(today), -1);
  const seasonKey = quarterKey(prevSeasonEnd);
  const already = (await db.execute({ sql: "SELECT 1 FROM league_rewards WHERE group_id = ? AND season_key = ? LIMIT 1", args: [groupId, seasonKey] })).rows[0];
  if (already) return;

  const prevSeasonStart = quarterStart(prevSeasonEnd);
  const { divisions } = await standingsFor(groupId, prevSeasonStart, mondayOf(prevSeasonEnd));
  if (divisions.every((d) => d.rows.length === 0)) return; // nadie jugó esa temporada: nada que repartir

  const grants = [];
  divisions.forEach((div, di) => {
    div.rows.forEach((r, i) => {
      const position = i + 1;
      const packs = packsFor(di, position);
      grants.push({ userId: r.id, division: di, position, packs });
    });
  });

  await db.batch(
    grants.flatMap(({ userId, division, position, packs }) => {
      const stmts = [{
        sql: "INSERT OR IGNORE INTO league_rewards (group_id, season_key, user_id, division, position, packs) VALUES (?, ?, ?, ?, ?, ?)",
        args: [groupId, seasonKey, userId, division, position, packs],
      }];
      for (let i = 0; i < packs; i++) {
        stmts.push({
          sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)",
          args: [userId, `liga-${seasonKey}`, `liga-div${division}-${i + 1}`],
        });
      }
      return stmts;
    }),
    "write"
  );
}

async function requireMember(req, res) {
  const groupId = Number(req.params.groupId);
  const ok = (await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, req.userId] })).rows[0];
  if (!ok) { res.status(403).json({ error: "No perteneces a este grupo" }); return null; }
  return groupId;
}

router.get("/:groupId", async (req, res) => {
  try {
    const groupId = await requireMember(req, res);
    if (groupId === null) return;

    const group = (await db.execute({ sql: "SELECT league_enabled, league_packs_enabled FROM groups_t WHERE id = ?", args: [groupId] })).rows[0];
    if (!group) return res.status(404).json({ error: "Grupo no encontrado" });

    const memberCount = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?", args: [groupId] })).rows[0].n);

    if (!group.league_enabled) {
      return res.json({ enabled: false, minMembers: MIN_MEMBERS, memberCount });
    }

    const today = todayStr();
    if (group.league_packs_enabled) {
      await maybeGrantSeasonRewards(groupId, today);
    }

    const start = quarterStart(today);
    const thisMonday = mondayOf(today);
    const { weeks, divisions } = await standingsFor(groupId, start, thisMonday);

    const q = Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1;
    res.json({
      enabled: true,
      packsEnabled: !!group.league_packs_enabled,
      memberCount,
      season: `Temporada ${q} · ${start.slice(0, 4)}`,
      seasonEnds: quarterEnd(today),
      matchday: weeks.length,
      week: { from: thisMonday, to: addDays(thisMonday, 6) },
      me: req.userId,
      divisions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
