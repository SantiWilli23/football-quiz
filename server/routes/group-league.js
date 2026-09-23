import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr, mondayOf, quarterStart } from "../utils/points.js";
import { rankingBetween } from "./stats.js";

const router = Router();
router.use(requireAuth);

// Liga del grupo: una temporada por trimestre con una "fecha" por semana. Los
// puntos de cada semana salen del MISMO ranking del grupo (rankingBetween: trivia,
// duelos, Fichado, quiniela...), así que cualquier juego suma. Los miembros se
// reparten en divisiones de hasta 6 según los puntos acumulados; arriba de cada
// división (menos la primera) se sube y abajo (menos la última) se baja.
const DIVISION_SIZE = 6;
const DIVISION_NAMES = ["Primera", "Segunda", "Tercera", "Cuarta", "Quinta"];

router.get("/:groupId", async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const member = (await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, req.userId] })).rows[0];
    if (!member) return res.status(403).json({ error: "No perteneces a este grupo" });

    const today = todayStr();
    const start = quarterStart(today);
    let cursor = mondayOf(start);
    const thisMonday = mondayOf(today);
    const weeks = [];
    while (cursor <= thisMonday) {
      weeks.push(cursor);
      cursor = addDays(cursor, 7);
    }

    const totals = new Map();
    const weekPts = new Map();
    const info = new Map();
    for (const monday of weeks) {
      const from = monday < start ? start : monday;
      const rows = await rankingBetween(groupId, from, addDays(monday, 6));
      for (const r of rows) {
        info.set(r.id, r);
        totals.set(r.id, (totals.get(r.id) || 0) + Number(r.total_points || 0));
        if (monday === thisMonday) weekPts.set(r.id, Number(r.total_points || 0));
      }
    }

    const sorted = [...info.values()].sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0) || a.username.localeCompare(b.username));
    const divisions = [];
    for (let i = 0; i < sorted.length; i += DIVISION_SIZE) divisions.push(sorted.slice(i, i + DIVISION_SIZE));
    const out = divisions.map((rows, di) => {
      const ordered = [...rows].sort((a, b) => (weekPts.get(b.id) || 0) - (weekPts.get(a.id) || 0) || (totals.get(b.id) || 0) - (totals.get(a.id) || 0));
      return {
        name: DIVISION_NAMES[di] || `División ${di + 1}`,
        rows: ordered.map((r, i) => ({
          id: r.id,
          username: r.username,
          avatar: r.avatar,
          avatar_config: r.avatar_config,
          weekPoints: weekPts.get(r.id) || 0,
          seasonPoints: totals.get(r.id) || 0,
          zone: divisions.length > 1 && ordered.length >= 4
            ? (i < 2 && di > 0 ? "sube" : i >= ordered.length - 2 && di < divisions.length - 1 ? "baja" : null)
            : null,
        })),
      };
    });

    const q = Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1;
    res.json({
      season: `Temporada ${q} · ${start.slice(0, 4)}`,
      matchday: weeks.length,
      week: { from: thisMonday, to: addDays(thisMonday, 6) },
      me: req.userId,
      divisions: out,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
