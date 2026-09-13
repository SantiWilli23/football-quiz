import { useEffect, useState } from "react";
import ChainView from "./ChainView.jsx";
import TimerBar from "./TimerBar.jsx";
import AutocompleteInput from "./AutocompleteInput.jsx";
import { TURN_SECONDS, lastChainEntity } from "../engine/chainEngine.js";
import { searchPlayers, searchClubs } from "../api.js";

export default function GameScreen({ state, mySeat, isLocal, onAttempt, onTimeout, attemptError, attempting, waitingMessage }) {
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [passGateOpen, setPassGateOpen] = useState(isLocal);

  const myTurn = mySeat == null ? true : state.turnSeat === mySeat;
  const interactive = myTurn && (!isLocal || !passGateOpen);

  // Reinicia el reloj y (en local) vuelve a pedir "pasar el dispositivo" cada vez que cambia el turno.
  useEffect(() => {
    setSecondsLeft(TURN_SECONDS);
    if (isLocal) setPassGateOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turnSeat, state.chain.length]);

  useEffect(() => {
    if (!interactive || state.status !== "playing") return;
    if (secondsLeft <= 0) {
      onTimeout();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, interactive, state.status]);

  const expectedKind = state.expected === "start" ? "player" : state.expected;
  const excludeIds = expectedKind === "player" ? state.usedPlayerIds : state.usedClubIds;
  const last = lastChainEntity(state);

  const prompt =
    state.expected === "start"
      ? "Decí cualquier futbolista para arrancar la cadena"
      : expectedKind === "club"
      ? `¿En qué equipo jugó ${last?.label}?`
      : `¿Quién jugó en ${last?.label}?`;

  return (
    <div className="space-y-4">
      <TimerBar secondsLeft={Math.max(0, secondsLeft)} totalSeconds={TURN_SECONDS} />

      <div className="bg-panel border border-border rounded-2xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Cadena</p>
        <ChainView chain={state.chain} playerNames={state.playerNames} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {state.playerNames.map((name, i) => (
          <span
            key={i}
            className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${
              !state.alive[i]
                ? "border-red-500/30 text-red-400 bg-red-500/5 opacity-60 line-through"
                : state.turnSeat === i
                ? "border-accent bg-accent/15 text-accent font-semibold"
                : "border-border text-gray-400"
            }`}
          >
            {state.turnSeat === i && state.status === "playing" && "▶ "}
            {name}
            {mySeat === i && " (vos)"}
          </span>
        ))}
      </div>

      {state.lastEliminated != null && state.status === "playing" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 text-sm text-red-300">
          ❌ {state.playerNames[state.lastEliminated]} quedó eliminado{state.lastEliminationReason ? ` — ${state.lastEliminationReason}` : ""}
        </div>
      )}

      {isLocal && passGateOpen && myTurn && state.status === "playing" && (
        <div className="bg-panel border border-accent/30 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-400 mb-1">Pasá el dispositivo a</p>
          <p className="text-xl font-bold mb-4">{state.playerNames[state.turnSeat]}</p>
          <button
            onClick={() => setPassGateOpen(false)}
            className="bg-accent text-onaccent font-semibold px-6 py-2.5 rounded-2xl hover:brightness-110 transition"
          >
            Listo, es mi turno
          </button>
        </div>
      )}

      {interactive && state.status === "playing" && (
        <div className="bg-panel border border-border rounded-2xl p-4 space-y-3">
          <p className="text-sm font-medium">{prompt}</p>
          <AutocompleteInput
            placeholder={expectedKind === "player" ? "Buscar jugador…" : "Buscar equipo…"}
            searchFn={(q) => (expectedKind === "player" ? searchPlayers(q, excludeIds) : searchClubs(q, excludeIds))}
            onSelect={(opt) => onAttempt({ id: opt.id, label: opt.name, kind: expectedKind })}
            disabled={attempting}
            renderExtra={expectedKind === "player" ? (opt) => [opt.nationality, opt.position].filter(Boolean).join(" · ") : undefined}
          />
          {attemptError && <p className="text-xs text-red-400">{attemptError}</p>}
        </div>
      )}

      {!interactive && myTurn === false && state.status === "playing" && (
        <p className="text-sm text-gray-500 text-center py-2">
          {waitingMessage || `Esperando a ${state.playerNames[state.turnSeat]}…`}
        </p>
      )}
    </div>
  );
}
