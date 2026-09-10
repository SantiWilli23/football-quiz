export type DifficultyId = "facil" | "normal" | "dificil";

export interface DifficultyOption {
  id: DifficultyId;
  label: string;
  attempts: number;
  description: string;
}

export const DIFFICULTIES: DifficultyOption[] = [
  { id: "facil", label: "Fácil", attempts: 10, description: "Más margen para ir probando." },
  { id: "normal", label: "Normal", attempts: 7, description: "El balance justo." },
  { id: "dificil", label: "Difícil", attempts: 5, description: "Pocos tiros — pensá bien cada uno." },
];

export function difficultyById(id: DifficultyId): DifficultyOption {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

export function attemptsFor(id: DifficultyId): number {
  return difficultyById(id).attempts;
}
