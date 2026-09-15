export type DifficultyId = "facil" | "normal" | "dificil";

export interface DifficultyOption {
  id: DifficultyId;
  label: string;
  attempts: number;
  description: string;
  /** Multiplicador de puntos — un secreto difícil vale más (ver scoring.ts). */
  pointsMultiplier: number;
}

// Las tres dificultades ahora tienen los mismos 8 intentos — lo que cambia
// no es cuánto margen tenés, sino QUIÉN puede tocarte de secreto: en fácil
// el pool son puros cracks archiconocidos, en difícil puede tocarte
// cualquiera de la base (ver playerPoolFor en gameUtils.ts).
export const ATTEMPTS = 8;

export const DIFFICULTIES: DifficultyOption[] = [
  { id: "facil", label: "Fácil", attempts: ATTEMPTS, description: "El secreto siempre es una figura conocida.", pointsMultiplier: 1 },
  { id: "normal", label: "Normal", attempts: ATTEMPTS, description: "Figuras y jugadores de buen nivel, mezclados.", pointsMultiplier: 1.3 },
  { id: "dificil", label: "Difícil", attempts: ATTEMPTS, description: "Puede tocarte cualquiera de la base — hasta un suplente.", pointsMultiplier: 1.6 },
];

export function difficultyById(id: DifficultyId): DifficultyOption {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

export function attemptsFor(id: DifficultyId): number {
  return difficultyById(id).attempts;
}

export function pointsMultiplierFor(id: DifficultyId): number {
  return difficultyById(id).pointsMultiplier;
}
