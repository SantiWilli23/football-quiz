import type { Player } from "../types/player";

// Categoría general de una posición. Nuestros datos ya vienen en categorías
// generales (Portero/Defensa/Mediocampista/Delantero), pero se soportan
// también códigos específicos (LB, CB, CAM, ST, etc.) por si la base se
// enriquece más adelante — así "CB" y "RB" siguen contando como "misma
// categoría" aunque no sean posición exacta.
const POSITION_CATEGORY: Record<string, string> = {
  portero: "GK", arquero: "GK", gk: "GK",
  defensa: "DEF", defensor: "DEF", cb: "DEF", lb: "DEF", rb: "DEF", rwb: "DEF", lwb: "DEF",
  mediocampista: "MID", volante: "MID", cdm: "MID", cm: "MID", cam: "MID", lm: "MID", rm: "MID",
  delantero: "FWD", st: "FWD", cf: "FWD", lw: "FWD", rw: "FWD",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function positionCategory(position: string): string {
  return POSITION_CATEGORY[normalize(position)] ?? normalize(position);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/**
 * Compara `guess` contra el jugador secreto y devuelve un score de
 * similitud entre 0 y 100 (100 sólo si es el mismo jugador). Función pura,
 * sin dependencias de UI — ver scoring.test.ts.
 *
 * Jerarquía de rangos (ver spec):
 *  - nada en común relevante            -> 0-15
 *  - un atributo menor compartido       -> 15-30
 *  - dos atributos relevantes           -> 40-65
 *  - compañeros de equipo, o
 *    compatriotas + misma posición exacta -> 80-98
 *  - el jugador secreto exacto          -> 100
 */
export function scoreGuess(secret: Player, guess: Player): number {
  if (guess.id === secret.id) return 100;

  const sameTeam = normalize(guess.team) === normalize(secret.team);
  const samePosition = normalize(guess.position) === normalize(secret.position);
  const sameCategory = positionCategory(guess.position) === positionCategory(secret.position);
  const sameNationality = normalize(guess.nationality) === normalize(secret.nationality);
  const sameLeague = normalize(guess.league) === normalize(secret.league);

  const ageDiff = Math.abs(guess.age - secret.age);
  // 1 si tienen la misma edad, 0 si difieren 15 años o más — un empujón
  // chico dentro del rango, nunca decide el rango por sí solo.
  const ageCloseness = clamp(1 - ageDiff / 15, 0, 1);

  // Tier 4: compañeros de equipo, o compatriotas con la posición exacta.
  if (sameTeam || (sameNationality && samePosition)) {
    let t = 0.5;
    if (sameTeam && sameNationality) t += 0.22;
    if (sameLeague) t += 0.1;
    t += ageCloseness * 0.16;
    return Math.round(lerp(80, 98, clamp(t, 0, 1)));
  }

  const minorMatches = [sameLeague, sameCategory, sameNationality].filter(Boolean).length;

  // Tier 3: dos (o los tres) atributos relevantes compartidos.
  if (minorMatches >= 2) {
    let t = 0.28;
    if (minorMatches >= 3) t += 0.22;
    if (samePosition) t += 0.15; // posición EXACTA (no solo categoría) empuja más
    t += ageCloseness * 0.25;
    return Math.round(lerp(40, 65, clamp(t, 0, 1)));
  }

  // Tier 2: un solo atributo menor compartido.
  if (minorMatches === 1) {
    let t = 0.15;
    if (samePosition) t += 0.2;
    t += ageCloseness * 0.3;
    return Math.round(lerp(15, 30, clamp(t, 0, 1)));
  }

  // Tier 1: nada relevante en común; sólo la cercanía de edad puede
  // moverlo un poco dentro del piso de la escala.
  const t = ageCloseness * 0.55;
  return Math.round(lerp(0, 15, clamp(t, 0, 1)));
}

/** Ordena intentos por score descendente (el más cercano arriba). */
export function sortByScoreDesc<T extends { score: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.score - a.score);
}
