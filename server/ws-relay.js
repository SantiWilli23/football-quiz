import { WebSocketServer } from "ws";

// Relay genérico de salas para multijugador online (Draft 8A2, Mentiroso).
// El servidor no conoce las reglas de ningún juego: solo empareja a dos
// clientes en una sala con un código y reenvía cualquier mensaje "relay"
// de un jugador al otro. La lógica del juego vive enteramente en el cliente.

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

  function otherSocket(room, ws) {
    for (const [sock] of room.sockets) {
      if (sock !== ws) return sock;
    }
    return null;
  }

  function cleanupSocket(ws) {
    const room = ws._room;
    if (!room) return;
    room.sockets.delete(ws);
    const peer = otherSocket(room, ws);
    if (peer) send(peer, { type: "opponent-left" });
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
        let code;
        do { code = genRoomCode(); } while (rooms.has(code));
        const room = { game: game, sockets: new Map() };
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
        if (room.sockets.size >= 2) return send(ws, { type: "error", message: "La sala ya está completa" });
        room.sockets.set(ws, "guest");
        ws._room = room;
        ws._roomCode = code;
        send(ws, { type: "joined", room: code, you: "guest" });
        const peer = otherSocket(room, ws);
        if (peer) { send(peer, { type: "opponent-joined" }); send(ws, { type: "opponent-joined" }); }
        return;
      }

      if (msg.type === "relay") {
        const room = ws._room;
        if (!room) return;
        const peer = otherSocket(room, ws);
        if (peer) send(peer, { type: "relay", payload: msg.payload });
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
