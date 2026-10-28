import { db } from "../db/client.js";

// Futotal 2.0 se enciende por etapas: con FUTOTAL2=1 los sobres ganados sin un club
// iniciado quedan guardados (máximo 3) hasta entrar a uno. Sin la bandera, la app se
// comporta como siempre y nada se bloquea.
export const redesignOn = () => process.env.FUTOTAL2 === "1";

// Juegos fusionados que ya se abren por /jugar/<juego>. Con FUTOTAL2_JUEGOS (lista separada por
// comas) se abren de a uno; sin la variable, con el rediseño encendido están todos. Los que no
// figuran siguen en su ruta de siempre, sin redirección.
export const MERGED_GAMES = ["quien_es", "que_club", "mas_o_menos", "trivia", "var", "bingo", "cotrero", "draft"];
export function enabledGames() {
  if (!redesignOn()) return [];
  const raw = process.env.FUTOTAL2_JUEGOS;
  if (raw == null || raw.trim() === "") return MERGED_GAMES;
  const asked = raw.split(",").map((x) => x.trim()).filter(Boolean);
  return MERGED_GAMES.filter((g) => asked.includes(g));
}

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

// Racha del club: días seguidos en que TODOS los miembros jugaron el partido del día.
// El día en curso no corta la racha (todavía puede completarse).
export async function clubStreak(groupId, today) {
  const members = (await db.execute({ sql: "SELECT user_id FROM group_members WHERE group_id = ?", args: [groupId] })).rows.map((r) => r.user_id);
  if (members.length < 2) return { streak: 0, todayDone: false, members: members.length };
  const rows = (await db.execute({
    sql: `SELECT r.date, COUNT(DISTINCT r.user_id) AS n FROM daily_match_results r
          JOIN group_members m ON m.user_id = r.user_id AND m.group_id = ? GROUP BY r.date`,
    args: [groupId],
  })).rows;
  const full = new Set(rows.filter((r) => Number(r.n) >= members.length).map((r) => r.date));
  const step = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const todayDone = full.has(today);
  let day = todayDone ? today : step(today, -1);
  let streak = 0;
  while (full.has(day) && streak < 1500) { streak += 1; day = step(day, -1); }
  return { streak, todayDone, members: members.length };
}

// Si hoy jugaron todos los miembros de un club, cada uno recibe un sobre extra (una
// vez por día y por club, gracias al UNIQUE de card_packs).
export async function grantClubStreakPacks(groupId, date) {
  const { todayDone, members } = await clubStreak(groupId, date);
  if (!todayDone || members < 2) return 0;
  const ids = (await db.execute({ sql: "SELECT user_id FROM group_members WHERE group_id = ?", args: [groupId] })).rows;
  let granted = 0;
  for (const r of ids) {
    const res = await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [r.user_id, date, `racha-club${groupId}`] });
    granted += res.rowsAffected;
  }
  return granted;
}
