import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RECONNECT_ATTEMPTS = 5;

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
//
// Si la conexión se corta a mitad de partida (red inestable, el server
// reinicia, se cuelga el proxy), el hook reintenta reconectarse solo unas
// pocas veces con backoff, usando el mismo código de sala — el servidor le
// devuelve el mismo asiento por el clientId y reenvía el último estado
// cacheado, así la partida sigue donde estaba.
export default function useRoomRelay(gameName) {
  const [status, setStatus] = useState("idle"); // idle | connecting | in-room | reconnecting | closed | error
  const [roomCode, setRoomCode] = useState(null);
  const [role, setRole] = useState(null); // host | guest
  const [seat, setSeat] = useState(null); // 0, 1, 2... (útil para juegos de más de 2)
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const roomCodeRef = useRef(null);
  const gameNameRef = useRef(gameName);
  const intentionalCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  useEffect(() => { gameNameRef.current = gameName; }, [gameName]);

  const wsUrl = () => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  };

  const connect = useCallback((openMsg, opts = {}) => {
    if (!opts.silent) setStatus("connecting");
    setError(null);
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ ...openMsg, clientId: clientIdFor(gameNameRef.current) }));
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "created") {
        roomCodeRef.current = msg.room;
        reconnectAttemptsRef.current = 0;
        setRoomCode(msg.room);
        setRole(msg.you || "host");
        setSeat(msg.seat ?? 0);
        setStatus("in-room");
      } else if (msg.type === "joined") {
        roomCodeRef.current = msg.room;
        reconnectAttemptsRef.current = 0;
        setRoomCode(msg.room);
        setRole(msg.you || "guest");
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
      wsRef.current = null;
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        return;
      }
      // Solo reintentamos si llegamos a estar en una sala (si nunca conectamos,
      // el error ya se mostró por otra vía y reintentar no tiene sentido).
      if (roomCodeRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        setStatus("reconnecting");
        const delay = Math.min(800 * reconnectAttemptsRef.current, 4000);
        reconnectTimerRef.current = setTimeout(() => {
          connect({ type: "join", game: gameNameRef.current, room: roomCodeRef.current }, { silent: true });
        }, delay);
      } else if (roomCodeRef.current) {
        setStatus("closed");
      }
    };
    ws.onerror = () => setError("Error de conexión");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = useCallback((maxPlayers) => connect({ type: "create", game: gameNameRef.current, maxPlayers }), [connect]);
  const joinRoom = useCallback((code) => connect({ type: "join", game: gameNameRef.current, room: code }), [connect]);

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
    intentionalCloseRef.current = true;
    roomCodeRef.current = null;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "leave" })); } catch { /* noop */ }
      wsRef.current.close();
    }
    setStatus("idle");
    setRoomCode(null);
    setRole(null);
    setSeat(null);
  }, []);

  // Reintenta manualmente después de agotar los intentos automáticos.
  const retry = useCallback(() => {
    if (!roomCodeRef.current) return;
    reconnectAttemptsRef.current = 0;
    connect({ type: "join", game: gameNameRef.current, room: roomCodeRef.current });
  }, [connect]);

  useEffect(() => () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
  }, []);

  return { status, roomCode, role, seat, error, lastMessage, createRoom, joinRoom, send, publishState, leave, retry };
}
