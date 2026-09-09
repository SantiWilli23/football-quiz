import { useEffect, useRef, useState } from "react";
import { Check, Copy, Users } from "lucide-react";
import useRoomRelay from "../../hooks/useRoomRelay.js";
import { createGame, applyMove, eliminateCurrentTurn, isEntityUsed, lastChainEntity, TURN_SECONDS } from "../engine/chainEngine.js";
import { checkLink } from "../api.js";
import GameScreen from "./GameScreen.jsx";
import ResultScreen from "./ResultScreen.jsx";

const GAME_NAME = "equipo-jugador";

export default function OnlineGame({ onExit }) {
  const { status, roomCode, role, seat, error, lastMessage, createRoom, joinRoom, send, publishState, leave } = useRoomRelay(GAME_NAME);
  const isHost = role === "host";

  const [setupMode, setSetupMode] = useState(null); // null | "create" | "join"
  const [myName, setMyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerCount, setPlayerCount] = useState(2);
  const [copied, setCopied] = useState(false);

  const [phase, setPhase] = useState("setup"); // setup | lobby | playing | finished
  const [roster, setRoster] = useState([]); // [{seat, name}]
  const [game, setGame] = useState(null);
  const [attempting, setAttempting] = useState(false);
  const [attemptError, setAttemptError] = useState(null);

  const gameRef = useRef(null);
  const rosterRef = useRef([]);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { rosterRef.current = roster; }, [roster]);

  // ---- Anunciarse apenas se entra a la sala ----
  useEffect(() => {
    if (status !== "in-room") return;
    setPhase("lobby");
    send({ type: "intro", seat, name: myName || `Jugador ${seat + 1}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function publish(nextPhase, nextRoster, nextGame) {
    publishState({ phase: nextPhase, roster: nextRoster, playerCount, game: nextGame ?? null });
  }

  // ---- Procesar mensajes entrantes ----
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "state-sync") {
      const p = lastMessage.payload;
      if (!p) return;
      setPhase(p.phase);
      setRoster(p.roster || []);
      if (p.game) setGame(p.game);
      return;
    }

    if (lastMessage.type === "opponent-left" && isHost) {
      const updated = rosterRef.current.filter((r) => r.seat !== lastMessage.seat);
      setRoster(updated);
      publish(phase, updated, gameRef.current);
      return;
    }

    if (lastMessage.type !== "relay") return;
    const msg = lastMessage.payload;
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "intro" && isHost) {
      const updated = rosterRef.current.some((r) => r.seat === msg.seat)
        ? rosterRef.current.map((r) => (r.seat === msg.seat ? { ...r, name: msg.name } : r))
        : [...rosterRef.current, { seat: msg.seat, name: msg.name }];
      setRoster(updated);
      publish("lobby", updated, null);
      return;
    }

    if (msg.type === "move" && isHost) {
      processMove(msg.seat, msg.entity);
      return;
    }

    if (msg.type === "timeout-report" && isHost) {
      resolveTimeout(msg.seat);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  // ---- Respaldo del host: si nadie reporta el timeout (p. ej. el jugador en
  // turno se desconectó), el host igual lo resuelve mirando el reloj real. ----
  useEffect(() => {
    if (!isHost || phase !== "playing" || !game || game.status !== "playing") return;
    const elapsed = Date.now() - game.turnStartedAt;
    const remaining = Math.max(0, TURN_SECONDS * 1000 - elapsed) + 2000;
    const seatAtSchedule = game.turnSeat;
    const t = setTimeout(() => resolveTimeout(seatAtSchedule), remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, game?.turnStartedAt, game?.status]);

  function resolveTimeout(seatThatTimedOut) {
    const current = gameRef.current;
    if (!current || current.status !== "playing" || current.turnSeat !== seatThatTimedOut) return;
    const next = eliminateCurrentTurn(current, "Se le acabó el tiempo.");
    setGame(next);
    publish(next.status === "finished" ? "finished" : "playing", rosterRef.current, next);
    if (next.status === "finished") setPhase("finished");
  }

  async function processMove(seatMoving, entity) {
    const current = gameRef.current;
    if (!current || current.status !== "playing" || current.turnSeat !== seatMoving) return;

    if (isEntityUsed(current, entity.kind, entity.id)) {
      const next = eliminateCurrentTurn(current, `Repitió a "${entity.label}", ya estaba usado.`);
      setGame(next);
      publish(next.status === "finished" ? "finished" : "playing", rosterRef.current, next);
      if (next.status === "finished") setPhase("finished");
      return;
    }

    if (current.expected === "start") {
      const next = applyMove(current, entity);
      setGame(next);
      publish("playing", rosterRef.current, next);
      return;
    }

    const last = lastChainEntity(current);
    const playerId = entity.kind === "player" ? entity.id : last.id;
    const clubId = entity.kind === "club" ? entity.id : last.id;
    const valid = await checkLink(playerId, clubId).catch(() => false);

    // Puede haber pasado tiempo por el await: verificamos que el turno siga siendo el mismo.
    const stillCurrent = gameRef.current;
    if (!stillCurrent || stillCurrent.status !== "playing" || stillCurrent.turnSeat !== seatMoving) return;

    if (!valid) {
      const next = eliminateCurrentTurn(stillCurrent, `Dijo "${entity.label}", pero no es correcto.`);
      setGame(next);
      publish(next.status === "finished" ? "finished" : "playing", rosterRef.current, next);
      if (next.status === "finished") setPhase("finished");
      return;
    }

    const next = applyMove(stillCurrent, entity);
    setGame(next);
    publish("playing", rosterRef.current, next);
  }

  function handleAttempt(entity) {
    setAttemptError(null);
    if (isHost) {
      setAttempting(true);
      processMove(seat, entity).finally(() => setAttempting(false));
    } else {
      send({ type: "move", seat, entity });
    }
  }

  function handleTimeout() {
    if (isHost) resolveTimeout(seat);
    else send({ type: "timeout-report", seat });
  }

  function handleStart() {
    if (!isHost || roster.length < playerCount) return;
    const names = Array.from({ length: playerCount }, (_, i) => roster.find((r) => r.seat === i)?.name || `Jugador ${i + 1}`);
    const initial = createGame(playerCount, names);
    setGame(initial);
    setPhase("playing");
    publish("playing", roster, initial);
  }

  function handleCreate() {
    createRoom(playerCount);
  }

  function handleJoin() {
    if (joinCode.trim().length < 4) return;
    joinRoom(joinCode.trim().toUpperCase());
  }

  function handleCopy() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleLeave() {
    leave();
    setSetupMode(null);
    setPhase("setup");
    setRoster([]);
    setGame(null);
  }

  // ---- Pantallas ----

  if (status === "idle" && !setupMode) {
    return (
      <div className="max-w-md mx-auto space-y-3">
        <input
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          placeholder="Tu nombre"
          maxLength={20}
          className="w-full bg-panel border border-border rounded-2xl px-4 py-3.5 text-sm"
        />
        <button
          onClick={() => setSetupMode("create")}
          className="w-full bg-panel border border-border rounded-2xl p-4 text-left hover:border-accent/40 transition-colors"
        >
          <p className="font-semibold text-sm">Crear sala</p>
          <p className="text-xs text-gray-500 mt-0.5">Vos elegís 2 o 4 jugadores y compartís el código.</p>
        </button>
        <button
          onClick={() => setSetupMode("join")}
          className="w-full bg-panel border border-border rounded-2xl p-4 text-left hover:border-accent/40 transition-colors"
        >
          <p className="font-semibold text-sm">Unirse a una sala</p>
          <p className="text-xs text-gray-500 mt-0.5">Pedile el código a quien la creó.</p>
        </button>
        <button onClick={onExit} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2">Volver</button>
      </div>
    );
  }

  if (status === "idle" && setupMode === "create") {
    return (
      <div className="max-w-md mx-auto bg-panel border border-border rounded-2xl p-6 space-y-4">
        <p className="text-sm font-semibold">Cantidad de jugadores</p>
        <div className="flex gap-2">
          {[2, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`flex-1 py-2.5 rounded-2xl border text-sm font-medium ${
                playerCount === n ? "border-accent bg-accent/10 text-accent" : "border-border text-gray-400"
              }`}
            >
              {n} jugadores
            </button>
          ))}
        </div>
        <button onClick={handleCreate} disabled={!myName.trim()} className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 disabled:opacity-40 transition">
          Crear sala
        </button>
        <button onClick={() => setSetupMode(null)} className="w-full text-center text-xs text-gray-500 hover:text-gray-300">Atrás</button>
      </div>
    );
  }

  if (status === "idle" && setupMode === "join") {
    return (
      <div className="max-w-md mx-auto bg-panel border border-border rounded-2xl p-6 space-y-4">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="CÓDIGO"
          maxLength={8}
          className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm tracking-widest uppercase text-center"
        />
        <button
          onClick={handleJoin}
          disabled={joinCode.trim().length < 4 || !myName.trim()}
          className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 disabled:opacity-40 transition"
        >
          Unirse
        </button>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button onClick={() => setSetupMode(null)} className="w-full text-center text-xs text-gray-500 hover:text-gray-300">Atrás</button>
      </div>
    );
  }

  if (status === "connecting") {
    return <p className="text-sm text-gray-500 text-center py-10">Conectando…</p>;
  }

  if (status === "in-room" && phase === "lobby") {
    return (
      <div className="max-w-md mx-auto bg-panel border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Código de sala</p>
            <p className="text-3xl font-bold tracking-widest">{roomCode}</p>
          </div>
          <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-gray-400" />
            <p className="text-sm font-medium">{roster.length}/{playerCount} en la sala</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roster.map((r) => (
              <span key={r.seat} className="text-xs px-3 py-1.5 rounded-full border border-border bg-bg">
                {r.name}{r.seat === seat ? " (vos)" : ""}
              </span>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={roster.length < playerCount}
            className="w-full bg-accent text-black font-semibold py-3 rounded-2xl hover:brightness-110 disabled:opacity-40 transition"
          >
            {roster.length < playerCount ? "Esperando a más jugadores…" : "Empezar"}
          </button>
        ) : (
          <p className="text-sm text-gray-500 text-center">Esperando a que el anfitrión empiece la partida…</p>
        )}
        <button onClick={handleLeave} className="w-full text-center text-xs text-gray-500 hover:text-gray-300">Salir de la sala</button>
      </div>
    );
  }

  if (phase === "playing" && game) {
    return <GameScreen state={game} mySeat={seat} isLocal={false} onAttempt={handleAttempt} onTimeout={handleTimeout} attemptError={attemptError} attempting={attempting} />;
  }

  if (phase === "finished" && game) {
    return <ResultScreen state={game} mySeat={seat} onExit={handleLeave} />;
  }

  return <p className="text-sm text-gray-500 text-center py-10">Cargando…</p>;
}
