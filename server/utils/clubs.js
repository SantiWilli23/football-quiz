import { db } from "../db/client.js";

// Futotal 2.0 se enciende por etapas: con FUTOTAL2=1 los sobres ganados sin un club
// iniciado quedan guardados (máximo 3) hasta entrar a uno. Sin la bandera, la app se
// comporta como siempre y nada se bloquea.
export const redesignOn = () => process.env.FUTOTAL2 === "1";

export const MAX_LOCKED_PACKS = 3;
// El sobre de bienvenida del registro se abre aunque todavía no haya club.
const WELCOME = "%bienvenida%";

export async function hasActiveClub(userId) {
  const row = (await db.execute({
    sql: `SELECT 1 FROM group_members m JOIN groups_t g ON g.id = m.group_id
          WHERE m.user_id = ? AND g.season_started_at IS NOT NULL LIMIT 1`,
    args: [userId],
  })).rows[0];
  return !!row;
}

// Sobres sin abrir del usuario, separados en abribles y guardados. Los guardados
// son los primeros 3 que no son de bienvenida cuando no hay un club iniciado.
export async function packStatus(userId) {
  const rows = (await db.execute({
    sql: "SELECT id, source FROM card_packs WHERE user_id = ? AND opened_at IS NULL ORDER BY id",
    args: [userId],
  })).rows;
  if (!redesignOn() || (await hasActiveClub(userId))) return { openable: rows.map((r) => r.id), locked: [] };
  const isWelcome = (r) => String(r.source).includes("bienvenida");
  const welcome = rows.filter(isWelcome).map((r) => r.id);
  const locked = rows.filter((r) => !isWelcome(r)).slice(0, MAX_LOCKED_PACKS).map((r) => r.id);
  return { openable: welcome, locked };
}

// Al entrar a un club iniciado, los sobres guardados quedan abribles. Si el usuario
// venía sin club, lo que superaba el máximo de 3 se descarta (se marca abierto sin
// cartas, para que no reaparezca).
export async function unlockPacksFor(userId, hadActiveClub = false) {
  if (!redesignOn() || hadActiveClub) return { dropped: 0 };
  const rows = (await db.execute({
    sql: "SELECT id, source FROM card_packs WHERE user_id = ? AND opened_at IS NULL ORDER BY id",
    args: [userId],
  })).rows.filter((r) => !String(r.source).includes("bienvenida"));
  const extra = rows.slice(MAX_LOCKED_PACKS);
  for (const r of extra) {
    await db.execute({ sql: "UPDATE card_packs SET opened_at = datetime('now') WHERE id = ? AND opened_at IS NULL", args: [r.id] });
  }
  return { dropped: extra.length };
}

// Quien entra a un club con la temporada ya iniciada y no es el día 1 del mes aparece
// en la tabla recién desde el mes siguiente (juega y gana sobres igual). Devuelve el
// mes de debut ("YYYY-MM") o null si cuenta desde ya.
export function debutMonthFor(club, joinDate) {
  if (!club.season_started_at || joinDate.endsWith("-01")) return null;
  const [y, m] = joinDate.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
