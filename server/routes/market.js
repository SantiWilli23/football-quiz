import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { redesignOn } from "../utils/clubs.js";
import { bid, cancel, historyOf, listOpen, publish } from "../utils/market.js";

// Mercado de cartas (Futotal 2.0): subastas entre miembros de un club (ver utils/market.js).
const router = Router();
router.use(requireAuth);
router.use((req, res, next) => (redesignOn() ? next() : res.status(404).json({ error: "No disponible" })));

const wrap = (fn) => async (req, res) => {
  try {
    const out = await fn(req);
    if (out?.error) return res.status(400).json(out);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
};

router.get("/history", wrap(async (req) => ({ history: await historyOf(String(req.query.name || "")) })));
router.get("/", wrap((req) => listOpen(req.userId)));
router.post("/", wrap((req) => publish(req.userId, String(req.body?.name || ""), req.body?.base)));
router.post("/:id/bid", wrap((req) => bid(req.userId, Number(req.params.id), req.body?.amount)));
router.post("/:id/cancel", wrap((req) => cancel(req.userId, Number(req.params.id))));

export default router;
