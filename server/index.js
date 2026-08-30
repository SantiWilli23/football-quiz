import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

import { initSchema } from "./db/client.js";
import authRoutes from "./routes/auth.js";
import groupsRoutes from "./routes/groups.js";
import questionsRoutes from "./routes/questions.js";
import bonusRoutes from "./routes/bonus.js";
import modeBRoutes from "./routes/mode-b.js";
import statsRoutes from "./routes/stats.js";
import pushRoutes from "./routes/push.js";
import duelsRoutes from "./routes/duels.js";
import footballRoutes from "./routes/football.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.JWT_SECRET) {
  console.error("Falta JWT_SECRET en el entorno. Definilo en .env");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupsRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/bonus", bonusRoutes);
app.use("/api/mode-b", modeBRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/duels", duelsRoutes);
app.use("/api/football", footballRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const clientDist = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const PORT = process.env.PORT || 4000;

// Recordatorio diario. Es un temporizador dentro del proceso, con la salvedad
// de que en un plan gratuito el servicio se duerme cuando no hay tráfico: si
// está dormido a la hora señalada, el aviso sale cuando despierta. Para que
// llegue puntual hay que apuntar un cron externo a POST /api/push/send-daily.
const REMINDER_HOUR = Number(process.env.REMINDER_HOUR ?? 19);
const CHECK_EVERY_MS = 15 * 60 * 1000;

function startReminderTimer() {
  const tick = async () => {
    if (new Date().getHours() < REMINDER_HOUR) return;
    try {
      const { sendDailyReminder } = await import("./utils/push.js");
      const result = await sendDailyReminder();
      if (!result.skipped) {
        console.log(`Recordatorio diario enviado a ${result.sent} dispositivos.`);
      }
    } catch (err) {
      console.error("No se pudo enviar el recordatorio diario:", err.message);
    }
  };

  setInterval(tick, CHECK_EVERY_MS).unref();
  tick();
}

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Futotal API escuchando en el puerto ${PORT}`);
      startReminderTimer();
    });
  })
  .catch((err) => {
    console.error("Error inicializando la base de datos:", err);
    process.exit(1);
  });
