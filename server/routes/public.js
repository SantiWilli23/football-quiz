import { Router } from "express";
import { rateLimit } from "../middleware/rateLimit.js";
import { redesignOn } from "../utils/clubs.js";
import { todayStr } from "../utils/points.js";
import { activeFused } from "../utils/juegos.js";
import { rng, dailySeed } from "../utils/futgames.js";
import { masMenosItems, penalItems, quienItems } from "../utils/daily-match.js";

// Rutas sin sesión (Futotal 2.0): la portada se juega antes de registrarse.
const router = Router();
const limiter = rateLimit({ windowMs: 60_000, max: 40 });

// El cliente pregunta si el rediseño está encendido (también sin iniciar sesión).
router.get("/features", (req, res) => res.json({ futotal2: redesignOn(), juegos: redesignOn() ? activeFused() : [] }));

// Partido de práctica: 6 preguntas (2 + 2 + 2) iguales para todos ese día. Se corrige en el
// teléfono y no da puntos, así que las respuestas viajan con las preguntas.
router.get("/practice", limiter, async (req, res) => {
  try {
    const rand = rng(dailySeed(todayStr(), "practica-portada"));
    const items = [...quienItems(rand, 2), ...masMenosItems(rand, 2), ...(await penalItems(rand, 2))];
    res.json({ date: todayStr(), items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
