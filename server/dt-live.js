import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db/client.js";
import { simulateFixtureEvents, dtWeeklyPoints, dtOutcomeFor } from "./utils/dt-match.js";

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
  room.sockets.forEach((_info, ws) => send(ws, msg));
}

// Solo cuenta a los dos que juegan (para decidir si ya arranca el partido);
// los espectadores no cuentan como "conectado" a estos efectos.
function connectedUserIds(room) {
  return [...new Set([...room.sockets.values()].filter((s) => s.role !== "spectator").map((s) => s.userId))];
}

function spectatorCount(room) {
  return [...room.sockets.values()].filter((s) => s.role === "spectator").length;
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

      const isHome = userId === homeMember.user_id;
      const isAway = userId === awayMember.user_id;
      let isSpectator = false;
      if (!isHome && !isAway) {
        // No juega este partido, pero si es de la misma liga (otro DT del
        // grupo) puede entrar a mirarlo — no participa, no elige velocidad,
        // y no cuenta para que arranque el partido.
        const leagueMembership = await db.execute({
          sql: "SELECT 1 FROM dt_league_members WHERE league_id = ? AND user_id = ?",
          args: [fx.league_id, userId],
        });
        if (leagueMembership.rows.length === 0) {
          send(ws, { type: "error", message: "No sos parte de este partido" });
          return ws.close();
        }
        isSpectator = true;
      }

      let room = rooms.get(fixtureId);
      if (!room) {
        const leagueResult = await db.execute({ sql: "SELECT group_id FROM dt_leagues WHERE id = ?", args: [fx.league_id] });
        room = {
          fixtureId,
          leagueId: fx.league_id,
          groupId: leagueResult.rows[0]?.group_id || null,
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
      const role = isHome ? "home" : isAway ? "away" : "spectator";
      room.sockets.set(ws, { userId, role });
      ws._fixtureId = fixtureId;

      if (!isSpectator) {
        const joinedCol = isHome ? "live_home_joined" : "live_away_joined";
        if (!fx.live_started_at) {
          await db.execute({ sql: "UPDATE dt_league_fixtures SET live_started_at = datetime('now') WHERE id = ?", args: [fixtureId] });
        }
        await db.execute({ sql: `UPDATE dt_league_fixtures SET ${joinedCol} = 1 WHERE id = ?`, args: [fixtureId] });
      }

      send(ws, {
        type: "joined",
        you: role,
        homeUsername: homeMember.username,
        awayUsername: awayMember.username,
        homeTeamId: fx.home_team_id,
        awayTeamId: fx.away_team_id,
        homeTeamName: TEAM_BY_ID[fx.home_team_id]?.name || fx.home_team_id,
        awayTeamName: TEAM_BY_ID[fx.away_team_id]?.name || fx.away_team_id,
        speed: room.speed,
        started: room.started,
        events: isSpectator ? room.events?.slice(0, room.tickIndex) ?? [] : undefined,
      });
      broadcast(room, { type: "presence", connected: connectedUserIds(room), spectators: spectatorCount(room) });

      const bothConnected =
        connectedUserIds(room).includes(homeMember.user_id) && connectedUserIds(room).includes(awayMember.user_id);
      if (bothConnected && !room.started) startRoom(room);

      ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (!msg || typeof msg.type !== "string") return;
        const sender = room.sockets.get(ws);
        if (sender?.role === "spectator") return; // solo mira, no toca nada
        if (msg.type === "set_speed" && !room.started && ALLOWED_SPEEDS.includes(Number(msg.speed))) {
          room.speed = Number(msg.speed);
          broadcast(room, { type: "speed", speed: room.speed });
        }
      });

      ws.on("close", () => {
        room.sockets.delete(ws);
        broadcast(room, { type: "presence", connected: connectedUserIds(room), spectators: spectatorCount(room) });
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
  room.homeTier = homeTier;
  room.awayTier = awayTier;

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
    if (room.groupId) {
      const { homeGoals, awayGoals } = room.finalScore;
      const homePoints = dtWeeklyPoints(room.homeTier, room.awayTier, dtOutcomeFor(homeGoals, awayGoals));
      const awayPoints = dtWeeklyPoints(room.awayTier, room.homeTier, dtOutcomeFor(awayGoals, homeGoals));
      for (const [userId, points] of [[room.homeMember.user_id, homePoints], [room.awayMember.user_id, awayPoints]]) {
        await db.execute({
          sql: `INSERT INTO dt_league_weekly_scores (league_id, group_id, user_id, week, points)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(league_id, user_id, week) DO NOTHING`,
          args: [room.leagueId, room.groupId, userId, room.fx.week, points],
        });
      }
    }
  } catch (err) {
    console.error("dt-live: no se pudo guardar el resultado final", err);
  }
  broadcast(room, { type: "final", homeGoals: room.finalScore.homeGoals, awayGoals: room.finalScore.awayGoals });
  rooms.delete(room.fixtureId);
}
