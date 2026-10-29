import { db } from "../db/client.js";
import { unlockedCount } from "./achievements.js";
import { computeAdn, AREAS } from "./adn.js";

// Progresión del perfil (Futotal 2.0): nivel y experiencia a partir de lo que ya se juega, un título
// (el de tu mejor área del ADN o el del rango) y celebraciones de gol que se desbloquean por nivel.
// No guarda experiencia: se calcula, así que no puede quedar descuadrada.
export const XP_PER_MATCH = 10;
export const XP_PER_ACHIEVEMENT = 40;
export const MAX_LEVEL = 50;
// Experiencia necesaria para llegar al nivel `l`: 0, 60, 180, 360, 600… (triangular).
export const xpAt = (l) => 30 * (l - 1) * l;

export const RANKS = [
  [1, "Aficionado"], [3, "Hincha"], [6, "Titular"], [10, "Capitán"], [15, "Crack"], [22, "Figura"], [30, "Leyenda"], [40, "Inmortal"],
];
export const ADN_TITLES = { chile: "Experto chileno", europa: "Ojo europeo", leyendas: "Historiador del fútbol", actualidad: "Al día", mercado: "Crack del mercado", velocidad: "Rayo" };

export const CELEBRATIONS = [
  { id: "clasica", label: "Clásica", level: 1 },
  { id: "fuegos", label: "Fuegos artificiales", level: 3 },
  { id: "confeti", label: "Confeti", level: 6 },
  { id: "estrella", label: "Lluvia de estrellas", level: 10 },
  { id: "leyenda", label: "Leyenda", level: 20 },
];

export function levelOf(xp) {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpAt(l + 1)) l += 1;
  return l;
}
export const rankOf = (level) => [...RANKS].reverse().find(([l]) => level >= l)[1];

export async function xpOf(userId) {
  const m = (await db.execute({ sql: "SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS pts FROM daily_match_results WHERE user_id = ?", args: [userId] })).rows[0];
  const ach = await unlockedCount(userId);
  return { matches: Number(m.n), matchPoints: Number(m.pts), achievements: ach, xp: Number(m.n) * XP_PER_MATCH + Number(m.pts) + ach * XP_PER_ACHIEVEMENT };
}

export async function chosenCelebration(userId) {
  const r = (await db.execute({ sql: "SELECT id FROM user_celebration WHERE user_id = ?", args: [userId] })).rows[0];
  return r?.id || "clasica";
}

export async function progreso(userId) {
  const x = await xpOf(userId);
  const level = levelOf(x.xp);
  const next = level >= MAX_LEVEL ? null : xpAt(level + 1);
  let bestArea = null;
  try {
    const adn = await computeAdn(userId, "all");
    const scored = AREAS.filter((a) => adn[a] && adn[a].score !== null && adn[a].score !== undefined).sort((a, b) => adn[b].score - adn[a].score);
    if (scored.length && adn[scored[0]].score >= 60) bestArea = scored[0];
  } catch { /* sin ADN todavía */ }
  const celebration = await chosenCelebration(userId);
  return {
    level, xp: x.xp, from: xpAt(level), next, rank: rankOf(level),
    title: bestArea ? ADN_TITLES[bestArea] : rankOf(level), titleFromAdn: !!bestArea,
    matches: x.matches, achievements: x.achievements,
    celebration, celebrations: CELEBRATIONS.map((c) => ({ ...c, unlocked: level >= c.level })),
  };
}

export async function chooseCelebration(userId, id) {
  const c = CELEBRATIONS.find((x) => x.id === id);
  if (!c) return { error: "Esa celebración no existe" };
  const { level } = await progreso(userId);
  if (level < c.level) return { error: `Se desbloquea en el nivel ${c.level}` };
  await db.execute({ sql: "INSERT INTO user_celebration (user_id, id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET id = excluded.id", args: [userId, id] });
  return { ok: true, celebration: id };
}
