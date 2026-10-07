import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { ONLINE_POINTS_PER_OPPONENT } from "../utils/points-config.js";

const router = Router();
router.use(requireAuth);

// Las partidas online se juegan por un relay que no conoce las reglas: el
// cliente del ganador avisa acá, igual que con los retos. Una partida (sala o
// token) cuenta una sola vez por jugador.
const ONLINE_GAMES = new Set(["quien_es_vivo", "supervivencia", "equipo_jugador", "mentiroso", "draft_europeo"]);

router.post("/win", async (req, res) => {
  const gameKey = String(req.body?.gameKey || "");
  const groupId = Number(req.body?.groupId);
  const room = String(req.body?.room || "").slice(0, 80);
  const opponents = Math.floor(Number(req.body?.opponents));
  if (!ONLINE_GAMES.has(gameKey)) return res.status(400).json({ error: "Juego online desconocido" });
  if (!Number.isInteger(groupId) || !room || !(opponents >= 1 && opponents <= 15)) return res.status(400).json({ error: "Datos inválidos" });
  try {
    const member = (await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, req.userId] })).rows[0];
    if (!member) return res.status(403).json({ error: "No pertenecés a ese grupo" });
    const points = opponents * ONLINE_POINTS_PER_OPPONENT;
    const ins = await db.execute({
      sql: "INSERT OR IGNORE INTO online_game_points (user_id, group_id, game_key, room, date, opponents, points) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [req.userId, groupId, gameKey, room, todayStr(), opponents, points],
    });
    res.status(201).json({ points, newly: ins.rowsAffected > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
