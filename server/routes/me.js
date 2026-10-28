import { Router } from "express";
import { grant, safely } from "../utils/achievements.js";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { redesignOn } from "../utils/clubs.js";
import { AREAS, analysis, computeAdn, futotalCard } from "../utils/adn.js";
import { trainingItems } from "../utils/daily-match.js";

// Yo (Futotal 2.0): ADN futbolero, carta Futotal y sesiones de entrenamiento.
const router = Router();
router.use(requireAuth);

// Sobre de bienvenida del registro: se abre aunque todavía no haya club, y trae una carta
// asegurada del club favorito. Uno por cuenta.
router.post("/welcome", async (req, res) => {
  try {
    const club = String(req.body?.club || "").trim().slice(0, 60);
    if (!club) return res.status(400).json({ error: "Elegí un club" });
    const ins = await db.execute({
      sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source, theme) VALUES (?, 'bienvenida', 'bienvenida', ?)",
      args: [req.userId, `club:${club}`],
    });
    res.json({ ok: true, granted: ins.rowsAffected > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/adn", async (req, res) => {
  try {
    const range = ["week", "month", "all"].includes(req.query.range) ? req.query.range : "month";
    const groupId = Number(req.query.groupId) || null;
    if (groupId) {
      const ok = (await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, req.userId] })).rows[0];
      if (!ok) return res.status(403).json({ error: "No pertenecés a ese club" });
    }
    const result = await analysis(req.userId, range, { groupId });
    if (redesignOn() && Object.values(result.areas || {}).length >= 6 && Object.values(result.areas).every((a) => a.score !== null && a.score !== undefined)) {
      await safely(grant(req.userId, "adn_completo"));
    }
    res.json(result);
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
