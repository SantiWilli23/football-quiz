import webpush from "web-push";
import { db } from "../db/client.js";
import { todayStr } from "./points.js";

// Las claves VAPID identifican a este servidor ante los navegadores. Si no
// vienen por entorno se generan una vez y quedan guardadas en la base: así la
// función anda sin que nadie tenga que administrar secretos a mano, y no
// cambian entre reinicios (si cambiaran, todas las suscripciones se romperían).
let cachedKeys = null;

async function getSetting(key) {
  const result = await db.execute({ sql: "SELECT value FROM app_settings WHERE key = ?", args: [key] });
  return result.rows[0]?.value ?? null;
}

async function setSetting(key, value) {
  await db.execute({
    sql: "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

export async function getVapidKeys() {
  if (cachedKeys) return cachedKeys;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cachedKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
    return cachedKeys;
  }

  const storedPublic = await getSetting("vapid_public_key");
  const storedPrivate = await getSetting("vapid_private_key");
  if (storedPublic && storedPrivate) {
    cachedKeys = { publicKey: storedPublic, privateKey: storedPrivate };
    return cachedKeys;
  }

  const generated = webpush.generateVAPIDKeys();
  await setSetting("vapid_public_key", generated.publicKey);
  await setSetting("vapid_private_key", generated.privateKey);
  cachedKeys = generated;
  return cachedKeys;
}

async function configure() {
  const keys = await getVapidKeys();
  const contact = process.env.PUSH_CONTACT || "mailto:noreply@football-quiz.app";
  webpush.setVapidDetails(contact, keys.publicKey, keys.privateKey);
}

// Manda una notificación a todas las suscripciones de un usuario. Si el
// navegador contesta 404/410 la suscripción ya no existe (desinstalaron la app,
// limpiaron el sitio) y se borra para no reintentar por siempre.
export async function sendToUser(userId, payload) {
  const result = await db.execute({
    sql: "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    args: [userId],
  });
  // Sin dispositivos no hay nada que mandar, y así se evita generar y guardar
  // las claves VAPID por gente que nunca activó las notificaciones.
  if (result.rows.length === 0) return 0;

  await configure();

  let sent = 0;
  for (const row of result.rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.execute({ sql: "DELETE FROM push_subscriptions WHERE id = ?", args: [row.id] });
      } else {
        console.error("push fallido", err.statusCode, err.body);
      }
    }
  }
  return sent;
}

// Recordatorio diario: sólo a quien todavía no respondió nada hoy. Se manda
// una vez por día (push_log tiene la fecha con UNIQUE), así que aunque el
// disparador se ejecute varias veces nadie recibe dos avisos.
export async function sendDailyReminder({ force = false } = {}) {
  const today = todayStr();

  if (!force) {
    const already = await db.execute({
      sql: "SELECT id FROM push_log WHERE scheduled_date = ?",
      args: [today],
    });
    if (already.rows.length > 0) return { skipped: true, reason: "ya se envió hoy" };
  }

  const pending = await db.execute({
    sql: `SELECT DISTINCT ps.user_id
          FROM push_subscriptions ps
          WHERE ps.user_id NOT IN (
            SELECT a.user_id FROM answers a
            JOIN questions q ON q.id = a.question_id
            WHERE q.scheduled_date = ?
          )`,
    args: [today],
  });

  let sent = 0;
  for (const row of pending.rows) {
    sent += await sendToUser(row.user_id, {
      title: "Futotal",
      body: "Ya están las preguntas de hoy. ¿Las respondés antes que el grupo?",
      url: "/",
    });
  }

  try {
    await db.execute({
      sql: "INSERT INTO push_log (scheduled_date, sent_count) VALUES (?, ?)",
      args: [today, sent],
    });
  } catch {
    // Otra ejecución en paralelo ya registró el día: no es un error.
  }

  return { skipped: false, users: pending.rows.length, sent };
}
