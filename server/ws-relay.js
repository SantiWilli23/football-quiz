import { WebSocketServer } from "ws";

// Relay genérico de salas para multijugador online (Draft 8A2, Mentiroso,
// Supervivencia, Equipo-Jugador). El servidor no conoce las reglas de ningún
// juego: solo agrupa clientes en una sala con un código y reenvía cualquier
// mensaje "relay" del emisor a TODOS los demás en la sala (broadcast). Para
// juegos 1v1 esto equivale a "mandarle al otro"; para salas de más jugadores
// llega a todos por igual. La lógica de cada juego vive enteramente en el cliente.
//
// Cada jugador ocupa un "asiento" numerado (0, 1, 2...) en vez de solo
// host/guest, para que juegos de más de 2 (como Equipo-Jugador con hasta 4)
// puedan distinguir turnos. Si el cliente manda un `clientId` propio al crear
// o unirse, y se desconecta y vuelve a entrar con el mismo código de sala y
// el mismo clientId, recupera SU MISMO asiento en vez de sumarse como uno
// nuevo. Además, el último "state" que alguien haya mandado queda cacheado en
// memoria de la sala: quien se une (o reconecta) lo recibe al toque, así no
// pierde la partida en curso por una desconexión.

const MAX_PLAYERS_PER_ROOM = 16;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusión

function genRoomCode() {
  var code = "";
  for (var i = 0; i < 5; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return code;
}

function roleFor(seat) {
  return seat === 0 ? "host" : "guest";
}

export function attachWsRelay(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  // code -> { game, maxPlayers, sockets: Map<ws, seat>, seatByClientId: Map<clientId, seat>, nextSeat, lastState }
  const rooms = new Map();

  httpServer.on("upgrade", (req, socket, head) => {
    // Exacto (no startsWith): "/ws/dt-live" es otro relay (ver dt-live.js) y
    // no debe ser interceptado acá — startsWith("/ws") también lo matchea.
    if (req.url !== "/ws") return;
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
    const seat = room.sockets.get(ws);
    room.sockets.delete(ws);
    broadcastExcept(room, ws, { type: "opponent-left", role: roleFor(seat), seat, players: room.sockets.size });
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
        const clientId = msg.clientId ? String(msg.clientId).slice(0, 60) : null;
        let code;
        do { code = genRoomCode(); } while (rooms.has(code));
        const room = { game, sockets: new Map(), seatByClientId: new Map(), nextSeat: 1, maxPlayers, lastState: null };
        room.sockets.set(ws, 0);
        if (clientId) room.seatByClientId.set(clientId, 0);
        rooms.set(code, room);
        ws._room = room;
        ws._roomCode = code;
        send(ws, { type: "created", room: code, you: "host", seat: 0 });
        return;
      }

      if (msg.type === "join") {
        const code = String(msg.room || "").toUpperCase().slice(0, 8);
        const game = String(msg.game || "").slice(0, 40);
        const clientId = msg.clientId ? String(msg.clientId).slice(0, 60) : null;
        const room = rooms.get(code);
        if (!room) return send(ws, { type: "error", message: "Sala no encontrada" });
        if (room.game !== game) return send(ws, { type: "error", message: "Esa sala es de otro juego" });

        const reconnectSeat = clientId ? room.seatByClientId.get(clientId) : undefined;
        let seat;
        if (reconnectSeat != null) {
          seat = reconnectSeat;
        } else {
          const cap = room.maxPlayers || 2;
          if (room.sockets.size >= cap) return send(ws, { type: "error", message: "La sala ya está completa" });
          seat = room.nextSeat++;
          if (clientId) room.seatByClientId.set(clientId, seat);
        }

        room.sockets.set(ws, seat);
        ws._room = room;
        ws._roomCode = code;
        send(ws, { type: "joined", room: code, you: roleFor(seat), seat, players: room.sockets.size });
        if (room.lastState != null) send(ws, { type: "state-sync", payload: room.lastState });
        broadcastExcept(room, ws, { type: "opponent-joined", seat, players: room.sockets.size });
        return;
      }

      if (msg.type === "relay") {
        const room = ws._room;
        if (!room) return;
        const seat = room.sockets.get(ws);
        broadcastExcept(room, ws, { type: "relay", payload: msg.payload, from: roleFor(seat), seat });
        return;
      }

      if (msg.type === "state") {
        const room = ws._room;
        if (!room) return;
        room.lastState = msg.payload;
        const seat = room.sockets.get(ws);
        broadcastExcept(room, ws, { type: "state-sync", payload: msg.payload, from: roleFor(seat), seat });
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
