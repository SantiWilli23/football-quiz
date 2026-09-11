import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db/client.js";
import { simulateFixtureEvents } from "./utils/dt-match.js";

// Partidos en vivo de la Liga Online DT: cuando un fixture es entre dos
// managers humanos, ninguno lo resuelve con un click — los dos tienen que
// estar conectados acá al mismo tiempo. El servidor es la única autoridad:
// arma el partido minuto a minuto una sola vez (con la táctica que cada uno
// dejó guardada) y lo va transmitiendo en tiempo real a ambos, al ritmo que
// elijan (0.2x a 2x). El resultado recién se graba en la base cuando termina.
//
// Si el proceso se reinicia a mitad de un partido en vivo, ese partido se
// pierde (nunca llegó a "final") y hay que volver a entrar — ver walkover en
// dt-league.js para el caso de un rival que nunca aparece.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_PATH = path.join(__dirname, "data/dt-teams.json");
const TEAMS = fs.existsSync(TEAMS_PATH) ? JSON.parse(fs.readFileSync(TEAMS_PATH, "utf-8")) : [];
const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

const ALLOWED_SPEEDS = [0.2, 0.5, 1, 2];
const BASE_TICK_SECONDS = 2; // a velocidad 1x: 2s reales por minuto simulado

const rooms = new Map(); // fixtureId -> room

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg) {
  room.sockets.forEach((_userId, ws) => send(ws, msg));
}

function connectedUserIds(room) {
  return [...new Set(room.sockets.values())];
}

export function attachDtLiveWs(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws/dt-live")) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token") || "";
    const fixtureId = Number(url.searchParams.get("fixtureId"));

    let userId;
    try {
      userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    } catch {
      send(ws, { type: "error", message: "Token inválido o vencido" });
      return ws.close();
    }
    if (!fixtureId) {
      send(ws, { type: "error", message: "Falta el partido" });
      return ws.close();
    }

    try {
      const fxResult = await db.execute({ sql: "SELECT * FROM dt_league_fixtures WHERE id = ?", args: [fixtureId] });
      const fx = fxResult.rows[0];
      if (!fx) { send(ws, { type: "error", message: "Partido no encontrado" }); return ws.close(); }
      if (fx.played) { send(ws, { type: "error", message: "Este partido ya se jugó" }); return ws.close(); }

      const membersResult = await db.execute({
        sql: `SELECT m.user_id, m.team_id, u.username FROM dt_league_members m
              JOIN users u ON u.id = m.user_id
              WHERE m.league_id = ? AND m.team_id IN (?, ?)`,
        args: [fx.league_id, fx.home_team_id, fx.away_team_id],
      });
      const homeMember = membersResult.rows.find((m) => m.team_id === fx.home_team_id);
      const awayMember = membersResult.rows.find((m) => m.team_id === fx.away_team_id);
      if (!homeMember || !awayMember) {
        send(ws, { type: "error", message: "Este partido no enfrenta a dos jugadores humanos" });
        return ws.close();
      }
      if (userId !== homeMember.user_id && userId !== awayMember.user_id) {
        send(ws, { type: "error", message: "No sos parte de este partido" });
        return ws.close();
      }

      let room = rooms.get(fixtureId);
      if (!room) {
        room = {
          fixtureId,
          leagueId: fx.league_id,
          fx,
          homeMember,
          awayMember,
          sockets: new Map(), // ws -> userId
          speed: ALLOWED_SPEEDS.includes(fx.speed) ? fx.speed : 1,
          started: false,
          finished: false,
          events: null,
          tickIndex: 0,
          timer: null,
        };
        rooms.set(fixtureId, room);
      }
      room.sockets.set(ws, userId);
      ws._fixtureId = fixtureId;

      const isHome = userId === homeMember.user_id;
      const joinedCol = isHome ? "live_home_joined" : "live_away_joined";
      if (!fx.live_started_at) {
        await db.execute({ sql: "UPDATE dt_league_fixtures SET live_started_at = datetime('now') WHERE id = ?", args: [fixtureId] });
      }
      await db.execute({ sql: `UPDATE dt_league_fixtures SET ${joinedCol} = 1 WHERE id = ?`, args: [fixtureId] });

      send(ws, {
        type: "joined",
        you: isHome ? "home" : "away",
        homeUsername: homeMember.username,
        awayUsername: awayMember.username,
        homeTeamId: fx.home_team_id,
        awayTeamId: fx.away_team_id,
        homeTeamName: TEAM_BY_ID[fx.home_team_id]?.name || fx.home_team_id,
        awayTeamName: TEAM_BY_ID[fx.away_team_id]?.name || fx.away_team_id,
        speed: room.speed,
        started: room.started,
      });
      broadcast(room, { type: "presence", connected: connectedUserIds(room) });

      const bothConnected =
        connectedUserIds(room).includes(homeMember.user_id) && connectedUserIds(room).includes(awayMember.user_id);
      if (bothConnected && !room.started) startRoom(room);

      ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (!msg || typeof msg.type !== "string") return;
        if (msg.type === "set_speed" && !room.started && ALLOWED_SPEEDS.includes(Number(msg.speed))) {
          room.speed = Number(msg.speed);
          broadcast(room, { type: "speed", speed: room.speed });
        }
      });

      ws.on("close", () => {
        room.sockets.delete(ws);
        broadcast(room, { type: "presence", connected: connectedUserIds(room) });
      });
    } catch (err) {
      console.error("dt-live error:", err);
      send(ws, { type: "error", message: "Error del servidor" });
      ws.close();
    }
  });

  return wss;
}

async function startRoom(room) {
  room.started = true;
  const homeTier = TEAM_BY_ID[room.fx.home_team_id]?.tier || 2;
  const awayTier = TEAM_BY_ID[room.fx.away_team_id]?.tier || 2;

  const tacticsResult = await db.execute({
    sql: "SELECT team_id, mentality, pressing, tempo FROM dt_league_tactics WHERE league_id = ? AND team_id IN (?, ?)",
    args: [room.leagueId, room.fx.home_team_id, room.fx.away_team_id],
  });
  const tacticsByTeam = Object.fromEntries(tacticsResult.rows.map((r) => [r.team_id, r]));

  const { homeGoals, awayGoals, events } = simulateFixtureEvents({
    homeTier,
    awayTier,
    homeTactics: tacticsByTeam[room.fx.home_team_id] || null,
    awayTactics: tacticsByTeam[room.fx.away_team_id] || null,
  });
  room.events = events;
  room.finalScore = { homeGoals, awayGoals };

  await db.execute({ sql: "UPDATE dt_league_fixtures SET speed = ? WHERE id = ?", args: [room.speed, room.fixtureId] });
  broadcast(room, { type: "kickoff", speed: room.speed });

  const intervalMs = Math.round((BASE_TICK_SECONDS / room.speed) * 1000);
  room.timer = setInterval(() => {
    if (room.tickIndex >= room.events.length) {
      clearInterval(room.timer);
      finishRoom(room);
      return;
    }
    const event = room.events[room.tickIndex];
    room.tickIndex++;
    broadcast(room, { type: "event", event });
  }, intervalMs);
}

async function finishRoom(room) {
  if (room.finished) return;
  room.finished = true;
  try {
    await db.execute({
      sql: "UPDATE dt_league_fixtures SET home_goals = ?, away_goals = ?, played = 1 WHERE id = ?",
      args: [room.finalScore.homeGoals, room.finalScore.awayGoals, room.fixtureId],
    });
  } catch (err) {
    console.error("dt-live: no se pudo guardar el resultado final", err);
  }
  broadcast(room, { type: "final", homeGoals: room.finalScore.homeGoals, awayGoals: room.finalScore.awayGoals });
  rooms.delete(room.fixtureId);
}
