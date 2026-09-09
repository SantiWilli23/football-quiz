import { useEffect, useMemo, useState } from "react";
import playersData from "./data/players.json";
import type { Guess, MaxAttempts, Player } from "./types/player";
import { scoreGuess } from "./utils/scoring";
import {
  buildShareText, clearSavedGame, dailyEditionNumber, guessesToStored,
  hintForAttribute, loadGame, pickDailySecret, pickRandomSecret, saveGame, todayKey,
} from "./utils/gameUtils";
import StartScreen from "./components/StartScreen";
import GuessInput from "./components/GuessInput";
import GuessList from "./components/GuessList";
import EndScreen from "./components/EndScreen";

const players = playersData as Player[];
const HINT_ORDER: (keyof Player)[] = ["position", "league", "nationality", "age", "team"];

type Screen = "start" | "playing" | "ended";

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [mode, setMode] = useState<"random" | "daily">("random");
  const [maxAttempts, setMaxAttempts] = useState<MaxAttempts>(20);
  const [secret, setSecret] = useState<Player | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasSavedGame = useMemo(() => loadGame() != null, []);
  const attemptsUsed = guesses.length + hintsUsed;
  const guessedIds = useMemo(() => new Set(guesses.map((g) => g.player.id)), [guesses]);
  const latestPlayerId = guesses.length ? guesses[guesses.length - 1].player.id : null;
  const revealedHints = useMemo(
    () => (secret ? HINT_ORDER.slice(0, hintsUsed).map((attr) => hintForAttribute(secret, attr)) : []),
    [secret, hintsUsed]
  );

  useEffect(() => {
    if (!secret || screen !== "playing") return;
    saveGame({
      mode,
      dailyKey: mode === "daily" ? todayKey() : undefined,
      secretId: secret.id,
      maxAttempts,
      guesses: guessesToStored(guesses),
      status,
      hintsUsed,
    });
  }, [secret, guesses, status, hintsUsed, mode, maxAttempts, screen]);

  function startGame(nextMaxAttempts: MaxAttempts, nextMode: "random" | "daily") {
    const nextSecret = nextMode === "daily" ? pickDailySecret(players) : pickRandomSecret(players);
    setSecret(nextSecret);
    setMaxAttempts(nextMaxAttempts);
    setMode(nextMode);
    setGuesses([]);
    setHintsUsed(0);
    setStatus("playing");
    setErrorMessage(null);
    setScreen("playing");
  }

  function resumeGame() {
    const saved = loadGame();
    if (!saved) return;
    const found = players.find((p) => p.id === saved.secretId);
    if (!found) return;
    setSecret(found);
    setMode(saved.mode);
    setMaxAttempts(saved.maxAttempts);
    setHintsUsed(saved.hintsUsed);
    setStatus(saved.status);
    setGuesses(
      saved.guesses
        .map((g) => {
          const p = players.find((pl) => pl.id === g.playerId);
          return p ? { player: p, score: g.score } : null;
        })
        .filter((g): g is Guess => g != null)
    );
    setScreen(saved.status === "playing" ? "playing" : "ended");
  }

  function restart() {
    clearSavedGame();
    setScreen("start");
    setSecret(null);
  }

  function submitGuess(player: Player) {
    if (!secret || status !== "playing") return;
    setErrorMessage(null);

    if (guessedIds.has(player.id)) {
      setErrorMessage(`Ya probaste a ${player.name} — mirá la lista de intentos.`);
      return;
    }

    const score = scoreGuess(secret, player);
    const nextGuesses = [...guesses, { player, score }];
    setGuesses(nextGuesses);

    if (score >= 100) {
      setStatus("won");
      setScreen("ended");
      return;
    }
    if (nextGuesses.length + hintsUsed >= maxAttempts) {
      setStatus("lost");
      setScreen("ended");
    }
  }

  function useHint() {
    if (!secret || status !== "playing" || hintsUsed >= HINT_ORDER.length) return;
    const nextHints = hintsUsed + 1;
    setHintsUsed(nextHints);
    if (guesses.length + nextHints >= maxAttempts) {
      setStatus("lost");
      setScreen("ended");
    }
  }

  if (screen === "start" || !secret) {
    return <StartScreen onStart={startGame} hasSavedGame={hasSavedGame} onResume={resumeGame} />;
  }

  const shareText = buildShareText({
    edition: mode === "daily" ? dailyEditionNumber() : null,
    mode,
    status: status === "won" ? "won" : "lost",
    attemptsUsed,
    maxAttempts,
  });

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Fichado</h1>
          <p className="text-sm text-gray-500 mt-1">
            Intento {Math.min(attemptsUsed, maxAttempts)} / {maxAttempts}
            {mode === "daily" && ` · Edición diaria #${dailyEditionNumber()}`}
          </p>
        </header>

        {screen === "playing" && (
          <>
            <GuessInput
              players={players}
              guessedIds={guessedIds}
              disabled={status !== "playing"}
              onSubmit={submitGuess}
              errorMessage={errorMessage}
            />

            <div className="flex items-center justify-between mt-3 mb-5">
              <p className="text-xs text-gray-500">
                {revealedHints.length > 0 ? revealedHints.join(" · ") : "Sin pistas usadas."}
              </p>
              <button
                onClick={useHint}
                disabled={hintsUsed >= HINT_ORDER.length}
                className="text-xs border border-gray-400 px-3 py-1.5 hover:border-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0 ml-3"
              >
                Pista (−1 intento)
              </button>
            </div>
          </>
        )}

        {screen === "ended" && (
          <div className="mb-6">
            <EndScreen
              status={status === "won" ? "won" : "lost"}
              secret={secret}
              attemptsUsed={attemptsUsed}
              maxAttempts={maxAttempts}
              shareText={shareText}
              onRestart={restart}
            />
          </div>
        )}

        <GuessList guesses={guesses} latestPlayerId={latestPlayerId} />
      </div>
    </div>
  );
}
