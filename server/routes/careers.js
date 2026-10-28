import { Router } from "express";
import { grant, safely } from "../utils/achievements.js";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

// Carreras de Cotrero (Futotal 2.0, «Leyendas del club»). Cotrero es una página estática que
// calcula su puntaje en el teléfono, así que el servidor NO puede recalcularlo: acepta un
// resumen acotado (puntaje con tope, etiquetas de una lista cerrada) y guarda solo la mejor
// carrera de cada persona. Es un salón de la fama entre amigos, no un ranking que da puntos.
const router = Router();
router.use(requireAuth);
const limiter = rateLimit({ windowMs: 60_000, max: 10 });

const GAMES = new Set(["cotrero", "cotrero_medio"]);
const LABELS = new Set(["Promesa", "Jugador de paso", "Jugador correcto", "Crack", "Jugador de Primera", "Ídolo", "Leyenda"]);
export const MAX_CAREER_SCORE = 3000;

router.post("/score", limiter, async (req, res) => {
  const game = String(req.body?.game || "");
  const score = Math.round(Number(req.body?.score));
  const label = String(req.body?.label || "").slice(0, 30);
  if (!GAMES.has(game) || !Number.isFinite(score) || score < 0) return res.status(400).json({ error: "Carrera inválida" });
  try {
    if (label === "Leyenda") await safely(grant(req.userId, "leyenda_cotrero"));
    const name = String(req.body?.name || "").replace(/[<>]/g, "").slice(0, 40);
    const pos = String(req.body?.position || "").replace(/[<>]/g, "").slice(0, 24);
    await db.execute({
      sql: `INSERT INTO career_scores (user_id, game, score, label, pos, name) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, game) DO UPDATE SET score = excluded.score, label = excluded.label, pos = excluded.pos, name = excluded.name, created_at = datetime('now')
            WHERE excluded.score > career_scores.score`,
      args: [req.userId, game, Math.min(score, MAX_CAREER_SCORE), LABELS.has(label) ? label : null, pos || null, name || null],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
