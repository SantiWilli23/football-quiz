import { WebSocketServer } from "ws";

// Relay genérico de salas para multijugador online (Draft 8A2, Mentiroso,
// Supervivencia). El servidor no conoce las reglas de ningún juego: solo
// agrupa clientes en una sala con un código y reenvía cualquier mensaje
// "relay" del emisor a TODOS los demás en la sala (broadcast). Para juegos
// 1v1 (2 sockets) esto equivale a "mandarle al otro"; para salas de más
// jugadores (supervivencia grupal) llega a todos por igual. La lógica de
// cada juego vive enteramente en el cliente.

const MAX_PLAYERS_PER_ROOM = 16;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusión

function genRoomCode() {
  var code = "";
  for (var i = 0; i < 5; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return code;
}

export function attachWsRelay(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map(); // code -> { game, sockets: Map<ws, role> }

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws")) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  function send(ws, msg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  function broadcastExcept(room, ws, msg) {
    for (const [sock] of room.sockets) {
      if (sock !== ws) send(sock, msg);
    }
  }

  function cleanupSocket(ws) {
    const room = ws._room;
    if (!room) return;
    const role = room.sockets.get(ws);
    room.sockets.delete(ws);
    broadcastExcept(room, ws, { type: "opponent-left", role });
    if (room.sockets.size === 0) rooms.delete(ws._roomCode);
    ws._room = null;
  }

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "create") {
        const game = String(msg.game || "").slice(0, 40);
        if (!game) return send(ws, { type: "error", message: "Falta el juego" });
        const maxPlayers = Math.max(2, Math.min(MAX_PLAYERS_PER_ROOM, Number(msg.maxPlayers) || 2));
        let code;
        do { code = genRoomCode(); } while (rooms.has(code));
        const room = { game: game, sockets: new Map(), maxPlayers };
        room.sockets.set(ws, "host");
        rooms.set(code, room);
        ws._room = room;
        ws._roomCode = code;
        send(ws, { type: "created", room: code, you: "host" });
        return;
      }

      if (msg.type === "join") {
        const code = String(msg.room || "").toUpperCase().slice(0, 8);
        const game = String(msg.game || "").slice(0, 40);
        const room = rooms.get(code);
        if (!room) return send(ws, { type: "error", message: "Sala no encontrada" });
        if (room.game !== game) return send(ws, { type: "error", message: "Esa sala es de otro juego" });
        const cap = room.maxPlayers || 2;
        if (room.sockets.size >= cap) return send(ws, { type: "error", message: "La sala ya está completa" });
        room.sockets.set(ws, "guest");
        ws._room = room;
        ws._roomCode = code;
        send(ws, { type: "joined", room: code, you: "guest", players: room.sockets.size });
        broadcastExcept(room, ws, { type: "opponent-joined", players: room.sockets.size });
        return;
      }

      if (msg.type === "relay") {
        const room = ws._room;
        if (!room) return;
        broadcastExcept(room, ws, { type: "relay", payload: msg.payload, from: room.sockets.get(ws) });
        return;
      }

      if (msg.type === "leave") {
        cleanupSocket(ws);
        return;
      }
    });

    ws.on("close", () => cleanupSocket(ws));
    ws.on("error", () => cleanupSocket(ws));
  });

  // Ping periódico para cortar conexiones muertas (proxies/Render pueden cortar sockets inactivos).
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wss.on("close", () => clearInterval(interval));

  return wss;
}
