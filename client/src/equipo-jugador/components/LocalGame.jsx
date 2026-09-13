import { useState } from "react";
import { createGame, applyMove, eliminateCurrentTurn, isEntityUsed, lastChainEntity } from "../engine/chainEngine.js";
import { checkLink } from "../api.js";
import GameScreen from "./GameScreen.jsx";
import ResultScreen from "./ResultScreen.jsx";

export default function LocalGame({ onExit }) {
  const [names, setNames] = useState(["Jugador 1", "Jugador 2"]);
  const [state, setState] = useState(null);
  const [attempting, setAttempting] = useState(false);
  const [attemptError, setAttemptError] = useState(null);

  function start() {
    setState(createGame(2, names.map((n) => n.trim() || n)));
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

  if (!state) {
    return (
      <div className="bg-panel border border-border rounded-2xl p-6 space-y-4 max-w-md mx-auto">
        <p className="text-sm text-gray-400">Nombre de cada jugador (mismo dispositivo, turnos alternados):</p>
        {names.map((n, i) => (
          <input
            key={i}
            value={n}
            onChange={(e) => setNames((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))}
            placeholder={`Jugador ${i + 1}`}
            maxLength={20}
            className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
          />
        ))}
        <div className="flex gap-2">
          <button onClick={start} className="flex-1 bg-accent text-onaccent font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
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
        mySeat={null}
        onPlayAgain={() => setState(createGame(2, names))}
        onExit={onExit}
      />
    );
  }

  return (
    <GameScreen
      state={state}
      mySeat={null}
      isLocal
      onAttempt={handleAttempt}
      onTimeout={handleTimeout}
      attemptError={attemptError}
      attempting={attempting}
    />
  );
}
