import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getLiveMatch } from "../utils/live-feed.js";

// Partido en vivo con el modelo único (utils/live-match.js): marcador, minuto, alineaciones
// ubicadas, eventos, estadísticas y comentarios. Se actualiza cada ~15 s para quien mira.
const router = Router();
router.use(requireAuth);
const limiter = rateLimit({ windowMs: 60_000, max: 90 });

router.get("/:league/:id", limiter, async (req, res) => {
  try {
    res.json(await getLiveMatch(req.params.league, req.params.id));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error("live", err.message);
    res.status(502).json({ error: "No se pudo traer el partido. Probá de nuevo en unos segundos." });
  }
});

export default router;
