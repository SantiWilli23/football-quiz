// Cliente mínimo para el relay de salas online (ver server/ws-relay.js).
// El servidor solo empareja dos sockets en una sala y reenvía mensajes "relay"
// entre ellos — toda la lógica del juego vive acá, en el cliente.
function createOnlineRelay(gameName, callbacks) {
  callbacks = callbacks || {};
  var ws = null;
  var closedByUs = false;

  function wsUrl() {
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/ws";
  }

  function connect(onOpenMsg) {
    closedByUs = false;
    ws = new WebSocket(wsUrl());
    ws.onopen = function () { ws.send(JSON.stringify(onOpenMsg)); };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "created" && callbacks.onCreated) callbacks.onCreated(msg.room);
      else if (msg.type === "joined" && callbacks.onJoined) callbacks.onJoined(msg.room);
      else if (msg.type === "opponent-joined" && callbacks.onOpponentJoined) callbacks.onOpponentJoined();
      else if (msg.type === "opponent-left" && callbacks.onOpponentLeft) callbacks.onOpponentLeft();
      else if (msg.type === "relay" && callbacks.onMessage) callbacks.onMessage(msg.payload);
      else if (msg.type === "error" && callbacks.onError) callbacks.onError(msg.message);
    };
    ws.onclose = function () {
      if (!closedByUs && callbacks.onDisconnected) callbacks.onDisconnected();
    };
    ws.onerror = function () {
      if (callbacks.onError) callbacks.onError("Error de conexión");
    };
  }

  return {
    createRoom: function () { connect({ type: "create", game: gameName }); },
    joinRoom: function (code) { connect({ type: "join", game: gameName, room: code }); },
    send: function (payload) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "relay", payload: payload }));
    },
    close: function () {
      closedByUs = true;
      if (ws) { try { ws.send(JSON.stringify({ type: "leave" })); } catch (e) {} try { ws.close(); } catch (e) {} }
      ws = null;
    }
  };
}
