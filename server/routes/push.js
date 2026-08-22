import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { getVapidKeys, sendDailyReminder, sendToUser } from "../utils/push.js";

const router = Router();

// La clave pública no es secreta: el navegador la necesita para suscribirse.
router.get("/public-key", async (req, res) => {
  try {
    const { publicKey } = await getVapidKeys();
    res.json({ publicKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Disparador para un cron externo. Render free duerme el servicio cuando no
// hay tráfico, así que el temporizador interno no alcanza para garantizar el
// aviso: quien quiera puntualidad apunta un cron gratuito a este endpoint.
router.post("/send-daily", async (req, res) => {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "Falta configurar PUSH_CRON_SECRET" });
  }
  if (req.get("x-cron-secret") !== secret) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    res.json(await sendDailyReminder());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.use(requireAuth);

router.get("/status", async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT COUNT(*) AS total FROM push_subscriptions WHERE user_id = ?",
      args: [req.userId],
    });
    res.json({ subscriptions: Number(result.rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/subscribe", async (req, res) => {
  const { endpoint, keys } = req.body?.subscription || {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Suscripción inválida" });
  }

  try {
    // El endpoint es único por dispositivo: si ya existe se reasigna al usuario
    // actual, por si el teléfono lo comparten dos cuentas.
    await db.execute({
      sql: `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
              user_id = excluded.user_id,
              p256dh = excluded.p256dh,
              auth = excluded.auth`,
      args: [req.userId, endpoint, keys.p256dh, keys.auth],
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "Falta el endpoint" });

  try {
    await db.execute({
      sql: "DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?",
      args: [endpoint, req.userId],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Sirve para comprobar en el momento que las notificaciones llegan de verdad.
router.post("/test", async (req, res) => {
  try {
    const sent = await sendToUser(req.userId, {
      title: "Football Quiz",
      body: "Listo, las notificaciones funcionan.",
      url: "/",
    });
    if (sent === 0) {
      return res.status(400).json({ error: "No hay ningún dispositivo suscripto" });
    }
    res.json({ sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
