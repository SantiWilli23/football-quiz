import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

// Medición simple (Futotal 2.0): eventos con nombre y datos chicos. Sirve para ver
// si la gente vuelve y qué parte del club juega el partido del día.
const router = Router();
router.use(requireAuth);
const limiter = rateLimit({ windowMs: 60_000, max: 120 });

const NAME_RE = /^[a-z0-9_.:-]{1,48}$/;

router.post("/", limiter, async (req, res) => {
  const name = String(req.body?.name || "");
  if (!NAME_RE.test(name)) return res.status(400).json({ error: "Nombre de evento inválido" });
  const props = req.body?.props ? JSON.stringify(req.body.props).slice(0, 1000) : null;
  try {
    await db.execute({ sql: "INSERT INTO analytics_events (user_id, name, props) VALUES (?, ?, ?)", args: [req.userId, name, props] });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
