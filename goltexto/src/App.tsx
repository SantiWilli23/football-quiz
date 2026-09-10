import { useEffect, useMemo, useState } from "react";
import playersData from "./data/players.json";
import type { Guess, Player } from "./types/player";
import { scoreGuess } from "./utils/scoring";
import { attemptsFor, difficultyById, type DifficultyId } from "./utils/difficulty";
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
  const [difficulty, setDifficulty] = useState<DifficultyId>("normal");
  const [secret, setSecret] = useState<Player | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasSavedGame = useMemo(() => loadGame() != null, [screen]);
  const maxAttempts = attemptsFor(difficulty);
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
      difficulty,
      maxAttempts,
      guesses: guessesToStored(guesses),
      status,
      hintsUsed,
    });
  }, [secret, guesses, status, hintsUsed, mode, difficulty, maxAttempts, screen]);

  function startGame(nextDifficulty: DifficultyId, nextMode: "random" | "daily") {
    const nextSecret = nextMode === "daily" ? pickDailySecret(players) : pickRandomSecret(players);
    setSecret(nextSecret);
    setDifficulty(nextDifficulty);
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
    setDifficulty(saved.difficulty ?? "normal");
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

  // A diferencia de "restart", esto no borra la partida guardada: se puede
  // retomar más tarde con "Continuar partida" desde el inicio.
  function goHome() {
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

  const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);
  const lowOnAttempts = status === "playing" && attemptsLeft <= 2;

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goHome}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors -ml-1 px-1.5 py-1 rounded-lg hover:bg-panel"
            >
              ← Inicio
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent border border-accent/40 rounded-full px-2.5 py-1">
              {difficultyById(difficulty).label}
            </span>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight mb-1.5">Fichado</h1>
            <p className={`text-sm font-medium tabular-nums ${lowOnAttempts ? "text-white" : "text-gray-400"}`}>
              Intento {Math.min(attemptsUsed, maxAttempts)} / {maxAttempts}
              {mode === "daily" && <span className="text-gray-500 font-normal"> · Edición diaria #{dailyEditionNumber()}</span>}
            </p>
          </div>
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

            <div className="flex items-center justify-between mt-3 mb-6">
              <p className="text-xs text-gray-500 leading-snug">
                {revealedHints.length > 0 ? revealedHints.join(" · ") : "Sin pistas usadas."}
              </p>
              <button
                onClick={useHint}
                disabled={hintsUsed >= HINT_ORDER.length}
                className="text-xs font-medium border border-border rounded-full px-3.5 py-1.5 hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0 ml-3"
              >
                Pista (−1)
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
              onHome={goHome}
            />
          </div>
        )}

        <GuessList guesses={guesses} latestPlayerId={latestPlayerId} />
      </div>
    </div>
  );
}
