import { db } from "../db/client.js";

// Las recompensas de los juegos (juego diario, podio semanal, Copa semanal) son
// SOBRES DE CARTAS, no puntos de ranking. La calidad de un sobre queda en su
// `source` (ver qualityOf en routes/cards.js): "top-…" y "bueno-…" tienen mejores
// probabilidades; sin prefijo es el sobre normal. UNIQUE(user_id, date, source)
// hace idempotente cada entrega.
export const PACK_NAMES = { top: "top", bueno: "bueno", normal: "normal" };

export function packSource(quality, base) {
  if (quality === "top") return `top-${base}`;
  if (quality === "bueno") return `bueno-${base}`;
  return base;
}

// Devuelve true si se entregó un sobre nuevo (false si ya estaba entregado).
export async function grantPack(userId, date, quality, base) {
  if (!quality) return false;
  const res = await db.execute({
    sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)",
    args: [userId, date, packSource(quality, base)],
  });
  return res.rowsAffected > 0;
}

// Calidad del sobre del juego diario según qué tan bien salió la partida (0 a 1):
// jugar suma un sobre normal, buen rendimiento uno bueno y casi perfecto uno top.
export function dailyPackQuality(fraction) {
  const f = Number(fraction);
  if (!Number.isFinite(f) || f <= 0) return null;
  if (f >= 0.85) return "top";
  if (f >= 0.5) return "bueno";
  return "normal";
}

// Podio semanal del grupo: 1° top, 2° bueno, 3° normal.
export const WEEKLY_PODIUM_PACKS = { 1: "top", 2: "bueno", 3: "normal" };
