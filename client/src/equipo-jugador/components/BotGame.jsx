import { useEffect, useState } from "react";
import { createGame, applyMove, eliminateCurrentTurn, isEntityUsed, lastChainEntity } from "../engine/chainEngine.js";
import { pickBotMove } from "../engine/botEngine.js";
import { checkLink } from "../api.js";
import GameScreen from "./GameScreen.jsx";
import ResultScreen from "./ResultScreen.jsx";

const HUMAN_SEAT = 0;
const BOT_SEAT = 1;
const BOT_THINK_MS = 1300;

export default function BotGame({ onExit }) {
  const [name, setName] = useState("Vos");
  const [state, setState] = useState(null);
  const [attempting, setAttempting] = useState(false);
  const [attemptError, setAttemptError] = useState(null);
  const [botThinking, setBotThinking] = useState(false);

  function start() {
    setState(createGame(2, [name.trim() || "Vos", "Bot 🤖"]));
    setAttemptError(null);
  }

  async function handleAttempt(entity) {
    setAttemptError(null);

    if (isEntityUsed(state, entity.kind, entity.id)) {
      setAttemptError("Ya se usó antes en esta partida.");
      setState((s) => eliminateCurrentTurn(s, `Repitió a "${entity.label}", ya estaba usado.`));
      return;
    }

    if (state.expected === "start") {
      setState((s) => applyMove(s, entity));
      return;
    }

    setAttempting(true);
    try {
      const last = lastChainEntity(state);
      const playerId = entity.kind === "player" ? entity.id : last.id;
      const clubId = entity.kind === "club" ? entity.id : last.id;
      const valid = await checkLink(playerId, clubId);
      if (!valid) {
        setAttemptError("Ese jugador no jugó en ese equipo.");
        setState((s) => eliminateCurrentTurn(s, `Dijo "${entity.label}", pero no es correcto.`));
        return;
      }
      setState((s) => applyMove(s, entity));
    } catch {
      setAttemptError("Error de conexión, probá de nuevo.");
    } finally {
      setAttempting(false);
    }
  }

  function handleTimeout() {
    setState((s) => eliminateCurrentTurn(s, "Se le acabó el tiempo."));
  }

  // Turno del bot: piensa un toque (para que se sienta natural) y juega solo.
  useEffect(() => {
    if (!state || state.status !== "playing" || state.turnSeat !== BOT_SEAT) return;
    let cancelled = false;
    setBotThinking(true);

    const timer = setTimeout(async () => {
      const move = await pickBotMove(state).catch(() => null);
      if (cancelled) return;
      setBotThinking(false);
      if (!move) {
        setState((s) => eliminateCurrentTurn(s, "No encontró ninguna opción válida."));
        return;
      }
      setState((s) => applyMove(s, move));
    }, BOT_THINK_MS);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.turnSeat, state?.status]);

  if (!state) {
    return (
      <div className="bg-panel border border-border rounded-2xl p-6 space-y-4 max-w-md mx-auto">
        <p className="text-sm text-gray-400">Jugás vos contra un bot. Elegí tu nombre:</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          maxLength={20}
          className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
        />
        <div className="flex gap-2">
          <button onClick={start} className="flex-1 bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
            Empezar
          </button>
          <button onClick={onExit} className="px-4 bg-panel border border-border text-gray-400 rounded-2xl hover:text-white transition">
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "finished") {
    return (
      <ResultScreen
        state={state}
        mySeat={HUMAN_SEAT}
        mode="bot"
        onPlayAgain={() => setState(createGame(2, [name.trim() || "Vos", "Bot 🤖"]))}
        onExit={onExit}
      />
    );
  }

  return (
    <GameScreen
      state={state}
      mySeat={HUMAN_SEAT}
      isLocal={false}
      onAttempt={handleAttempt}
      onTimeout={handleTimeout}
      attemptError={attemptError}
      attempting={attempting}
      waitingMessage={botThinking ? "🤖 El bot está pensando…" : undefined}
    />
  );
}
