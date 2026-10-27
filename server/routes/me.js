import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { AREAS, analysis, computeAdn, futotalCard } from "../utils/adn.js";
import { trainingItems } from "../utils/daily-match.js";

// Yo (Futotal 2.0): ADN futbolero, carta Futotal y sesiones de entrenamiento.
const router = Router();
router.use(requireAuth);

router.get("/adn", async (req, res) => {
  try {
    const range = ["week", "month", "all"].includes(req.query.range) ? req.query.range : "month";
    const groupId = Number(req.query.groupId) || null;
    if (groupId) {
      const ok = (await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, req.userId] })).rows[0];
      if (!ok) return res.status(403).json({ error: "No pertenecés a ese club" });
    }
    res.json(await analysis(req.userId, range, { groupId }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/card", async (req, res) => {
  try {
    const user = (await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [req.userId] })).rows[0];
    const card = await futotalCard(req.userId);
    const adn = await computeAdn(req.userId, "all");
    res.json({ username: user?.username, ...card, adn: adn.areas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/train", async (req, res) => {
  try {
    const area = String(req.query.area || "");
    if (!AREAS.includes(area)) return res.status(400).json({ error: "Área inválida" });
    res.json({ area, items: await trainingItems(area, `${todayStr()}|${req.userId}|${Date.now() >> 16}`) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
