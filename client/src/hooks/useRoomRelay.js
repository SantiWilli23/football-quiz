import { useCallback, useEffect, useRef, useState } from "react";

// Hook de React sobre el relay de salas (server/ws-relay.js). El servidor solo
// agrupa sockets en una sala y reenvía mensajes "relay" a todos los demás —
// ideal para juegos donde un anfitrión controla el ritmo y el resto escucha.
export default function useRoomRelay(gameName) {
  const [status, setStatus] = useState("idle"); // idle | connecting | in-room | error
  const [roomCode, setRoomCode] = useState(null);
  const [role, setRole] = useState(null); // host | guest
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

    ws.onopen = () => ws.send(JSON.stringify(openMsg));
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
        setStatus("in-room");
      } else if (msg.type === "joined") {
        setRoomCode(msg.room);
        setRole("guest");
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
  }, []);

  const createRoom = useCallback((maxPlayers) => connect({ type: "create", game: gameName, maxPlayers }), [connect, gameName]);
  const joinRoom = useCallback((code) => connect({ type: "join", game: gameName, room: code }), [connect, gameName]);

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "relay", payload }));
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
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  return { status, roomCode, role, error, lastMessage, createRoom, joinRoom, send, leave };
}
