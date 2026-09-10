import type { Guess, Player } from "../types/player";
import type { DifficultyId } from "./difficulty";

const STORAGE_KEY = "fichado_game_v2";

export interface StoredGame {
  mode: "random" | "daily";
  dailyKey?: string;
  secretId: number;
  difficulty: DifficultyId;
  maxAttempts: number;
  guesses: { playerId: number; score: number }[];
  status: "playing" | "won" | "lost";
  hintsUsed: number;
}

/** Hash determinístico chico (no cripto) para usar la fecha como semilla. */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Número de edición diaria: cuántos días pasaron desde una fecha de referencia. */
export function dailyEditionNumber(dateKey: string = todayKey()): number {
  const epoch = Date.UTC(2025, 0, 1);
  const [y, m, d] = dateKey.split("-").map(Number);
  const current = Date.UTC(y, m - 1, d);
  return Math.floor((current - epoch) / 86400000) + 1;
}

/** Mismo jugador secreto para todo el mundo el mismo día (semilla = fecha). */
export function pickDailySecret(players: Player[], dateKey: string = todayKey()): Player {
  const idx = hashString(dateKey) % players.length;
  return players[idx];
}

export function pickRandomSecret(players: Player[]): Player {
  const idx = Math.floor(Math.random() * players.length);
  return players[idx];
}

export function saveGame(state: StoredGame): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage no disponible (modo privado, etc.) — el juego sigue andando, solo no persiste.
  }
}

export function loadGame(): StoredGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredGame) : null;
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

export function buildShareText(opts: {
  edition: number | null;
  mode: "random" | "daily";
  status: "won" | "lost";
  attemptsUsed: number;
  maxAttempts: number;
}): string {
  const title = opts.mode === "daily" && opts.edition != null ? `Fichado #${opts.edition}` : "Fichado";
  const result = opts.status === "won" ? `${opts.attemptsUsed}/${opts.maxAttempts} intentos` : `X/${opts.maxAttempts}`;
  return `${title} - ${result}`;
}

export function hintForAttribute(player: Player, attribute: keyof Player): string {
  const labels: Partial<Record<keyof Player, string>> = {
    league: "Liga",
    nationality: "Nacionalidad",
    position: "Posición",
    age: "Edad",
    team: "Equipo",
  };
  return `${labels[attribute] ?? attribute}: ${String(player[attribute])}`;
}

export function guessesToStored(guesses: Guess[]): StoredGame["guesses"] {
  return guesses.map((g) => ({ playerId: g.player.id, score: g.score }));
}
