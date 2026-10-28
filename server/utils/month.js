import { db } from "../db/client.js";
import { grant, safely } from "./achievements.js";
import { addDays, monthOf, todayStr } from "./points.js";
import { clubTable } from "./ledger.js";

// Cierre de mes (Futotal 2.0): el 1° de cada mes se cierra la tabla de cada club con temporada
// iniciada. Los tres primeros reciben el trofeo (queda en la vitrina) y, si ese es su club
// principal, un Sobre Élite con una carta de 90 o más asegurada. Es idempotente: cerrar dos
// veces el mismo mes no repite nada.
export const ELITE_THEME = "elite";
export const PODIUM = 3;

export const prevMonthOf = (date) => monthOf(addDays(`${monthOf(date)}-01`, -1));

export async function isClosed(groupId, month) {
  return !!(await db.execute({ sql: "SELECT 1 FROM month_closes WHERE group_id = ? AND month = ?", args: [groupId, month] })).rows[0];
}

// Lo que pasó en un mes: el podio (los empates comparten puesto) según el libro de puntos.
export async function podiumOf(groupId, month) {
  const table = await clubTable(groupId, "mes", `${month}-15`);
  return table.filter((r) => r.points > 0 && r.rank <= PODIUM);
}

export async function closeMonth(groupId, month) {
  if (await isClosed(groupId, month)) return { closed: false, reason: "ya estaba cerrado" };
  const club = (await db.execute({ sql: "SELECT season_started_at, name FROM groups_t WHERE id = ?", args: [groupId] })).rows[0];
  if (!club?.season_started_at || club.season_started_at > `${month}-31`) return { closed: false, reason: "sin temporada ese mes" };
  const podium = await podiumOf(groupId, month);
  const first = `${month}-01`;
  const awarded = [];
  for (const r of podium) {
    await db.execute({ sql: "INSERT OR IGNORE INTO club_trophies (user_id, group_id, month, place, points) VALUES (?, ?, ?, ?, ?)", args: [r.userId, groupId, month, r.rank, r.points] });
    await safely(grant(r.userId, "podio_mes"));
    if (r.rank === 1) await safely(grant(r.userId, "campeon_mes"));
    const main = (await db.execute({ sql: "SELECT group_id FROM user_main_club WHERE user_id = ?", args: [r.userId] })).rows[0];
    let elite = false;
    if (main?.group_id === groupId) {
      const res = await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source, theme) VALUES (?, ?, ?, ?)", args: [r.userId, first, `top-elite-${month}`, ELITE_THEME] });
      elite = res.rowsAffected > 0;
    }
    awarded.push({ userId: r.userId, place: r.rank, points: r.points, elite });
  }
  await db.execute({ sql: "INSERT INTO month_closes (group_id, month, podium_json) VALUES (?, ?, ?)", args: [groupId, month, JSON.stringify(awarded)] });
  return { closed: true, month, club: club.name, podium: awarded };
}

// Cierra todo lo que ya terminó: cada club iniciado cuyo mes anterior (o anteriores) sigue abierto.
export async function closeDueMonths(today = todayStr()) {
  const upTo = prevMonthOf(today);
  const clubs = (await db.execute("SELECT id, season_started_at FROM groups_t WHERE season_started_at IS NOT NULL")).rows;
  const done = [];
  for (const c of clubs) {
    let month = monthOf(c.season_started_at);
    for (let guard = 0; month <= upTo && guard < 36; guard++) {
      const r = await closeMonth(c.id, month);
      if (r.closed) done.push(r);
      const [y, m] = month.split("-").map(Number);
      month = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
  }
  return done;
}

// Ceremonias pendientes de ver para una persona: podio (con trofeo) o fin de mes sin podio.
export async function pendingCeremonies(userId) {
  const closes = (await db.execute({
    sql: `SELECT c.group_id, c.month, c.podium_json, g.name FROM month_closes c
          JOIN group_members m ON m.group_id = c.group_id AND m.user_id = ?
          JOIN groups_t g ON g.id = c.group_id
          WHERE NOT EXISTS (SELECT 1 FROM month_seen s WHERE s.user_id = ? AND s.group_id = c.group_id AND s.month = c.month)
          ORDER BY c.month DESC LIMIT 6`,
    args: [userId, userId],
  })).rows;
  return closes.map((c) => {
    const podium = JSON.parse(c.podium_json);
    const mine = podium.find((p) => p.userId === userId);
    return { groupId: c.group_id, club: c.name, month: c.month, place: mine?.place || null, elite: !!mine?.elite, podium: podium.map((p) => ({ place: p.place, points: p.points, userId: p.userId })) };
  });
}

export async function markSeen(userId, groupId, month) {
  await db.execute({ sql: "INSERT OR IGNORE INTO month_seen (user_id, group_id, month) VALUES (?, ?, ?)", args: [userId, groupId, month] });
}
