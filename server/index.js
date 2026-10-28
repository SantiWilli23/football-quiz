import "dotenv/config";
import { redesignOn } from "./utils/clubs.js";
import draftRouter from "./routes/draft.js";
import { enabledGames } from "./utils/clubs.js";
import torneoRouter from "./routes/torneo.js";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import http from "node:http";

import { initSchema } from "./db/client.js";
import { attachWsRelay } from "./ws-relay.js";
import { attachDtLiveWs } from "./dt-live.js";
import authRoutes from "./routes/auth.js";
import groupsRoutes from "./routes/groups.js";
import questionsRoutes from "./routes/questions.js";
import bonusRoutes from "./routes/bonus.js";
import modeBRoutes from "./routes/mode-b.js";
import statsRoutes from "./routes/stats.js";
import pushRoutes from "./routes/push.js";
import duelsRoutes from "./routes/duels.js";
import duelTournamentsRoutes from "./routes/duel-tournaments.js";
import footballRoutes from "./routes/football.js";
import equipoJugadorRoutes from "./routes/equipo-jugador.js";
import challengesRoutes from "./routes/challenges.js";
import dtLeagueRoutes from "./routes/dt-league.js";
import groupCupRoutes from "./routes/group-cup.js";
import wordleRoutes from "./routes/wordle.js";
import { featureGate } from "./utils/features.js";
import unMinutoRoutes from "./routes/un-minuto.js";
import dailyChallengeRoutes from "./routes/daily-challenge.js";
import quienEsRoutes from "./routes/quien-es.js";
import cardsRoutes from "./routes/cards.js";
import cardsExtrasRoutes from "./routes/cards-extras.js";
import weeklyCupRoutes from "./routes/weekly-cup.js";
import pollsRoutes from "./routes/polls.js";
import arbitrajeVarRoutes from "./routes/arbitraje-var.js";
import dailyGamesRoutes from "./routes/daily-games.js";
import onlineGamesRoutes from "./routes/online-games.js";
import gameHistoryRoutes from "./routes/game-history.js";
import futgamesRoutes from "./routes/futgames.js";
import traspasosRoutes from "./routes/traspasos.js";
import dorsalRoutes from "./routes/dorsal.js";
import subastaRoutes from "./routes/subasta.js";
import mediaRoutes from "./routes/media.js";
import aQuienMeComproRoutes from "./routes/a-quien-me-compro.js";
import clubsRoutes from "./routes/clubs.js";
import dailyMatchRoutes from "./routes/daily-match.js";
import liveRoutes from "./routes/live.js";
import eventsRoutes from "./routes/events.js";
import meRoutes from "./routes/me.js";
import publicRoutes from "./routes/public.js";
import clubStreamRoutes from "./routes/club-stream.js";
import careersRoutes from "./routes/careers.js";
import { adminRouter, jobsRouter } from "./routes/admin.js";
import { startJobs } from "./utils/jobs.js";
import analyticsRoutes from "./routes/analytics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.JWT_SECRET) {
  console.error("Falta JWT_SECRET en el entorno. Definilo en .env");
  process.exit(1);
}

const app = express();
// Render sirve detrás de su propio proxy: sin esto, req.ip devuelve la IP
// del proxy para todo el mundo y el rate limiting (ver middleware/rateLimit.js)
// terminaría agrupando a todos los usuarios bajo una sola IP.
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupsRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/daily", dailyMatchRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/me", meRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/club-stream", clubStreamRoutes);
app.use("/api/careers", careersRoutes);
app.use("/api/admin", adminRouter);
app.use("/api/torneo", torneoRouter);
app.use("/api/draft", draftRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/analytics", analyticsRoutes);
// Futotal 2.0, etapa A de la limpieza: Trivia, Modo B, banco de preguntas, retos del día, encuestas y
// torneos de duelos ya no existen para quien juega. Las lecturas siguen funcionando (para poder revisar
// o exportar lo que había) y toda escritura responde 410. Con FUTOTAL2=0 no cambia nada.
const retired = (req, res, next) => {
  if (!redesignOn() || req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  res.status(410).json({ error: "Este modo ya no está en Futotal." });
};

app.use("/api/questions", retired, questionsRoutes);
app.use("/api/bonus", retired, bonusRoutes);
app.use("/api/mode-b", retired, modeBRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/duels", duelsRoutes);
app.use("/api/duel-tournaments", retired, duelTournamentsRoutes);
app.use("/api/football", footballRoutes);
app.use("/api/equipo-jugador", equipoJugadorRoutes);
app.use("/api/challenges", challengesRoutes);
app.use("/api/dt-league", dtLeagueRoutes);
app.use("/api/group-cup", groupCupRoutes);
app.use("/api/wordle", wordleRoutes);
app.use("/api/un-minuto", unMinutoRoutes);
app.use("/api/daily-challenge", retired, dailyChallengeRoutes);
app.use("/api/quien-es", quienEsRoutes);
app.use("/api/cards", cardsRoutes);
app.use("/api/cards-extras", cardsExtrasRoutes);
app.use("/api/weekly-cup", weeklyCupRoutes);
app.use("/api/polls", retired, pollsRoutes);
app.use("/api/arbitraje-var", arbitrajeVarRoutes);
app.use("/api/daily-games", dailyGamesRoutes);
app.use("/api/online-games", onlineGamesRoutes);
app.use("/api/game-history", gameHistoryRoutes);
app.use("/api/futgames", futgamesRoutes);
app.use("/api/traspasos", traspasosRoutes);
app.use("/api/dorsal", dorsalRoutes);
app.use("/api/subasta", subastaRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/a-quien-me-compro", aQuienMeComproRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Cotrero rehecho (Futotal 2.0): las páginas estáticas viejas redirigen a la nueva. Con ?legacy=1 se
// abren igual, para terminar una carrera que quedó guardada en el teléfono.
app.get("/draft-europeo.html", (req, res, next) => {
  if (req.query.legacy === "1" || !enabledGames().includes("draft")) return next();
  res.redirect(302, "/jugar/draft/solo");
});
app.get(["/cotrero.html", "/cotrero-medio.html"], (req, res, next) => {
  if (req.query.legacy === "1" || !enabledGames().includes("cotrero")) return next();
  res.redirect(302, req.path.includes("medio") ? "/jugar/cotrero/medio" : "/jugar/cotrero/simple");
});

const clientDist = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const httpServer = http.createServer(app);
attachWsRelay(httpServer);
attachDtLiveWs(httpServer);

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
    httpServer.listen(PORT, () => {
      console.log(`Futotal API escuchando en el puerto ${PORT} (con WS relay en /ws)`);
      startReminderTimer();
      startJobs();
    });
  })
  .catch((err) => {
    console.error("Error inicializando la base de datos:", err);
    process.exit(1);
  });
