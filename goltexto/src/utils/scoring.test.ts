import { describe, expect, it } from "vitest";
import { finalScore, scoreGuess, sortByScoreDesc } from "./scoring";
import type { Player } from "../types/player";

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: 1,
    name: "Jugador Base",
    team: "Team A",
    league: "Liga A",
    nationality: "Pais A",
    position: "Delantero",
    age: 25,
    ...overrides,
  };
}

describe("scoreGuess", () => {
  it("devuelve 100 cuando es el mismo jugador (mismo id)", () => {
    const secret = makePlayer({ id: 7, name: "Secreto" });
    const guess = makePlayer({ id: 7, name: "Secreto" });
    expect(scoreGuess(secret, guess)).toBe(100);
  });

  it("devuelve entre 0 y 15 cuando no comparten nada relevante", () => {
    const secret = makePlayer({ id: 1, team: "Team A", league: "Liga A", nationality: "Pais A", position: "Delantero", age: 30 });
    const guess = makePlayer({ id: 2, team: "Team Z", league: "Liga Z", nationality: "Pais Z", position: "Portero", age: 19 });
    const score = scoreGuess(secret, guess);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(15);
  });

  it("devuelve entre 15 y 30 cuando comparten un solo atributo menor (misma liga nomás)", () => {
    const secret = makePlayer({ id: 1, team: "Team A", league: "Liga X", nationality: "Pais A", position: "Delantero" });
    const guess = makePlayer({ id: 2, team: "Team Z", league: "Liga X", nationality: "Pais Z", position: "Portero" });
    const score = scoreGuess(secret, guess);
    expect(score).toBeGreaterThanOrEqual(15);
    expect(score).toBeLessThanOrEqual(30);
  });

  it("devuelve entre 40 y 65 cuando comparten dos atributos relevantes (liga + nacionalidad)", () => {
    const secret = makePlayer({ id: 1, team: "Team A", league: "Liga X", nationality: "Pais X", position: "Delantero" });
    const guess = makePlayer({ id: 2, team: "Team Z", league: "Liga X", nationality: "Pais X", position: "Portero" });
    const score = scoreGuess(secret, guess);
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThanOrEqual(65);
  });

  it("devuelve entre 80 y 98 cuando son compañeros de equipo", () => {
    const secret = makePlayer({ id: 1, team: "Team A", league: "Liga X", nationality: "Pais A", position: "Delantero" });
    const guess = makePlayer({ id: 2, team: "Team A", league: "Liga Z", nationality: "Pais Z", position: "Portero" });
    const score = scoreGuess(secret, guess);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(98);
  });

  it("devuelve entre 80 y 98 cuando son compatriotas con la misma posición exacta", () => {
    const secret = makePlayer({ id: 1, team: "Team A", league: "Liga X", nationality: "Pais A", position: "Delantero" });
    const guess = makePlayer({ id: 2, team: "Team Z", league: "Liga Z", nationality: "Pais A", position: "Delantero" });
    const score = scoreGuess(secret, guess);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(98);
  });

  it("nunca devuelve negativos ni pasa de 100, incluso con diferencias extremas de edad", () => {
    const secret = makePlayer({ id: 1, age: 18, team: "Team A", league: "Liga A", nationality: "Pais A", position: "Delantero" });
    const guess = makePlayer({ id: 2, age: 45, team: "Team Z", league: "Liga Z", nationality: "Pais Z", position: "Portero" });
    const score = scoreGuess(secret, guess);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("compartir más atributos dentro del mismo tramo da un score mayor o igual", () => {
    const secret = makePlayer({ id: 1, team: "Team A", league: "Liga X", nationality: "Pais X", position: "Delantero" });
    const twoMatches = makePlayer({ id: 2, team: "Team Z", league: "Liga X", nationality: "Pais X", position: "Portero" });
    const threeMatches = makePlayer({ id: 3, team: "Team Z", league: "Liga X", nationality: "Pais X", position: "Delantero" });
    expect(scoreGuess(secret, threeMatches)).toBeGreaterThanOrEqual(scoreGuess(secret, twoMatches));
  });

  it("es simétrico en la detección de coincidencias (no depende del orden de los campos, solo de los valores)", () => {
    const a = makePlayer({ id: 1, team: "Team A" });
    const b = makePlayer({ id: 2, team: "Team A" });
    // mismo resultado sin importar cuál se pasa como "secreto"
    expect(scoreGuess(a, b) >= 80).toBe(scoreGuess(b, a) >= 80);
  });
});

describe("sortByScoreDesc", () => {
  it("ordena de mayor a menor score", () => {
    const items = [{ score: 10 }, { score: 90 }, { score: 50 }];
    expect(sortByScoreDesc(items).map((i) => i.score)).toEqual([90, 50, 10]);
  });
});

describe("finalScore", () => {
  const base = { status: "won" as const, maxAttempts: 8, pointsMultiplier: 1, bestGuessScore: 0 };

  it("da el máximo (100) cuando ganás al primer intento sin pistas", () => {
    expect(finalScore({ ...base, guessesUsed: 1, hintsUsed: 0 })).toBe(100);
  });

  it("da menos puntos cuantos más intentos gastás", () => {
    const few = finalScore({ ...base, guessesUsed: 2, hintsUsed: 0 });
    const many = finalScore({ ...base, guessesUsed: 7, hintsUsed: 0 });
    expect(few).toBeGreaterThan(many);
  });

  it("usar una pista cuesta lo mismo que 3 intentos", () => {
    const withHint = finalScore({ ...base, guessesUsed: 3, hintsUsed: 1 });
    const equivalentGuesses = finalScore({ ...base, guessesUsed: 6, hintsUsed: 0 });
    expect(withHint).toBe(equivalentGuesses);
  });

  it("la misma partida vale más en difícil que en fácil (multiplicador)", () => {
    const facil = finalScore({ ...base, guessesUsed: 3, hintsUsed: 0, pointsMultiplier: 1 });
    const dificil = finalScore({ ...base, guessesUsed: 3, hintsUsed: 0, pointsMultiplier: 1.6 });
    expect(dificil).toBeGreaterThan(facil);
  });

  it("perder sin haber acertado nada da 0 puntos", () => {
    expect(finalScore({ ...base, status: "lost", guessesUsed: 8, hintsUsed: 0, bestGuessScore: 0 })).toBe(0);
  });

  it("perder por poco (score alto en el mejor intento) da algo de consuelo", () => {
    const close = finalScore({ ...base, status: "lost", guessesUsed: 8, hintsUsed: 0, bestGuessScore: 90 });
    expect(close).toBeGreaterThan(0);
  });
});
