import { useCallback, useEffect, useRef, useState } from "react";

// Un id propio por juego+pestaña, persistido en sessionStorage. Si el socket
// se corta y el jugador vuelve a entrar (mismo código de sala) con este mismo
// id, el servidor le devuelve SU MISMO asiento en vez de sumarlo como jugador
// nuevo — así una desconexión no le hace perder su lugar en la partida.
function clientIdFor(gameName) {
  const key = `rr_clientid_${gameName}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(key, id);
  }
  return id;
}

// Hook de React sobre el relay de salas (server/ws-relay.js). El servidor solo
// agrupa sockets en una sala y reenvía mensajes "relay" a todos los demás —
// ideal para juegos donde un anfitrión controla el ritmo y el resto escucha.
export default function useRoomRelay(gameName) {
  const [status, setStatus] = useState("idle"); // idle | connecting | in-room | error
  const [roomCode, setRoomCode] = useState(null);
  const [role, setRole] = useState(null); // host | guest
  const [seat, setSeat] = useState(null); // 0, 1, 2... (útil para juegos de más de 2)
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);

  const wsUrl = () => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  };

  const connect = useCallback((openMsg) => {
    setStatus("connecting");
    setError(null);
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ ...openMsg, clientId: clientIdFor(gameName) }));
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "created") {
        setRoomCode(msg.room);
        setRole("host");
        setSeat(msg.seat ?? 0);
        setStatus("in-room");
      } else if (msg.type === "joined") {
        setRoomCode(msg.room);
        setRole("guest");
        setSeat(msg.seat ?? null);
        setStatus("in-room");
      } else if (msg.type === "error") {
        setError(msg.message);
        setStatus("error");
      } else {
        setLastMessage(msg);
      }
    };
    ws.onclose = () => {
      if (status !== "error") setStatus((s) => (s === "in-room" ? "closed" : s));
    };
    ws.onerror = () => setError("Error de conexión");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameName]);

  const createRoom = useCallback((maxPlayers) => connect({ type: "create", game: gameName, maxPlayers }), [connect, gameName]);
  const joinRoom = useCallback((code) => connect({ type: "join", game: gameName, room: code }), [connect, gameName]);

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "relay", payload }));
    }
  }, []);

  // Snapshot completo del estado del juego: el servidor lo cachea en la sala,
  // así que quien se une o reconecta lo recibe apenas entra (mensaje "state-sync").
  const publishState = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "state", payload }));
    }
  }, []);

  const leave = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "leave" })); } catch { /* noop */ }
      wsRef.current.close();
    }
    setStatus("idle");
    setRoomCode(null);
    setRole(null);
    setSeat(null);
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  return { status, roomCode, role, seat, error, lastMessage, createRoom, joinRoom, send, publishState, leave };
}
