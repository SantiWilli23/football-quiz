import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { redesignOn } from "../utils/clubs.js";
import { REWARDS, activeTournament, claimRewards, claimedOf, progressOf, seasonInfo } from "../utils/tournament.js";
import { CARDS } from "./cards.js";

// Álbum de selecciones y banner de temporada (W7).
const router = Router();
router.use(requireAuth);

router.get("/current", async (req, res) => {
  try {
    if (!redesignOn()) return res.json({ tournament: null });
    const today = todayStr();
    const t = await activeTournament(today);
    if (!t) return res.json({ tournament: null });
    const progress = await progressOf(req.userId, t, CARDS);
    const claimed = await claimedOf(req.userId, t.id);
    const nextRoja = (await db.execute({ sql: "SELECT date, home_name, away_name, kickoff FROM events WHERE kit_key = 'seleccion_chile' AND date >= ? ORDER BY date LIMIT 1", args: [today] })).rows[0] || null;
    res.json({
      tournament: { id: t.id, name: t.name, starts: t.starts, ends: t.ends, ...seasonInfo(t, today) },
      nations: progress,
      rewards: REWARDS.map((r) => ({ key: r.key, label: r.label, pack: r.pack, ready: r.need(progress), claimed: claimed.has(r.key) })),
      nextRoja: nextRoja ? { date: nextRoja.date, home: nextRoja.home_name, away: nextRoja.away_name, kickoff: nextRoja.kickoff } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Cobra los premios cumplidos (se cobran solos al abrir el álbum, pero también se puede pedir).
router.post("/claim", async (req, res) => {
  try {
    const today = todayStr();
    const t = redesignOn() ? await activeTournament(today) : null;
    if (!t) return res.status(404).json({ error: "No hay un torneo activo" });
    const progress = await progressOf(req.userId, t, CARDS);
    res.json({ got: await claimRewards(req.userId, t, progress, today) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
