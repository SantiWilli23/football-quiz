import { db } from "../db/client.js";
import { addDays, mondayOf, todayStr } from "./points.js";

// Amistoso entre clubes (Futotal 2.0): funciona con solo 2 clubes y es la puerta a la futura
// liga de clubes. Dura una semana (lunes a domingo). Gana el club con mejor media en el partido
// del día: el promedio de los promedios diarios, contando solo los días en que jugaron al menos
// 3 personas (2 si alguno de los clubes es chico). No suma puntos a la tabla.
export const MIN_PER_DAY = 3;
export const MIN_PER_DAY_SMALL = 2;
export const SMALL_CLUB = 5;

// El lunes en que arranca el amistoso: hoy si es lunes, si no el próximo.
export const startWeekFor = (today) => (mondayOf(today) === today ? today : addDays(mondayOf(today), 7));

async function sizeOf(groupId) {
  return Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?", args: [groupId] })).rows[0].n);
}

export async function clubWeek(groupId, monday, minPlayers) {
  const rows = (await db.execute({
    sql: `SELECT r.date, AVG(r.total) AS mean, COUNT(*) AS players FROM daily_match_results r
          JOIN group_members m ON m.user_id = r.user_id AND m.group_id = ?
          WHERE r.date BETWEEN ? AND ? GROUP BY r.date`,
    args: [groupId, monday, addDays(monday, 6)],
  })).rows.filter((r) => Number(r.players) >= minPlayers);
  const days = rows.map((r) => ({ date: r.date, mean: Number(r.mean), players: Number(r.players) }));
  return { avg: days.length ? Math.round((days.reduce((n, d) => n + d.mean, 0) / days.length) * 10) / 10 : null, days: days.length };
}

export async function scoreFriendly(f) {
  const small = Math.min(await sizeOf(f.group_a), await sizeOf(f.group_b)) < SMALL_CLUB;
  const min = small ? MIN_PER_DAY_SMALL : MIN_PER_DAY;
  const a = await clubWeek(f.group_a, f.week, min);
  const b = await clubWeek(f.group_b, f.week, min);
  const winner = a.avg == null || b.avg == null || a.avg === b.avg ? null : a.avg > b.avg ? f.group_a : f.group_b;
  return { a, b, winner, minPerDay: min };
}

const owns = async (groupId, userId) => !!(await db.execute({ sql: "SELECT 1 FROM groups_t WHERE id = ? AND created_by = ?", args: [groupId, userId] })).rows[0];

export async function challenge(groupA, inviteCode, userId, today = todayStr()) {
  if (!(await owns(groupA, userId))) return { error: "Solo quien creó el club puede desafiar", status: 403 };
  const a = (await db.execute({ sql: "SELECT id, season_started_at FROM groups_t WHERE id = ?", args: [groupA] })).rows[0];
  const b = (await db.execute({ sql: "SELECT id, name, season_started_at FROM groups_t WHERE invite_code = ?", args: [String(inviteCode || "").trim().toUpperCase()] })).rows[0];
  if (!b) return { error: "No existe un club con ese código", status: 404 };
  if (b.id === a.id) return { error: "No podés desafiar a tu propio club", status: 400 };
  if (!a.season_started_at || !b.season_started_at) return { error: "Los dos clubes tienen que tener la temporada iniciada", status: 409 };
  const week = startWeekFor(today);
  const dup = (await db.execute({
    sql: `SELECT 1 FROM club_friendlies WHERE week = ? AND status IN ('pending','accepted') AND ((group_a = ? AND group_b = ?) OR (group_a = ? AND group_b = ?))`,
    args: [week, a.id, b.id, b.id, a.id],
  })).rows[0];
  if (dup) return { error: "Ya hay un amistoso entre estos clubes esa semana", status: 409 };
  const ins = await db.execute({ sql: "INSERT INTO club_friendlies (group_a, group_b, week, status) VALUES (?, ?, ?, 'pending')", args: [a.id, b.id, week] });
  return { ok: true, id: Number(ins.lastInsertRowid), week, opponent: b.name };
}

export async function accept(friendlyId, userId, today = todayStr()) {
  const f = (await db.execute({ sql: "SELECT * FROM club_friendlies WHERE id = ?", args: [friendlyId] })).rows[0];
  if (!f || !(await owns(f.group_b, userId))) return { error: "Desafío no encontrado", status: 404 };
  if (f.status !== "pending") return { error: "Ese desafío ya se resolvió", status: 409 };
  const week = startWeekFor(today);
  await db.execute({ sql: "UPDATE club_friendlies SET status = 'accepted', week = ? WHERE id = ?", args: [week, f.id] });
  return { ok: true, week };
}

export async function decline(friendlyId, userId) {
  const f = (await db.execute({ sql: "SELECT * FROM club_friendlies WHERE id = ?", args: [friendlyId] })).rows[0];
  if (!f || (!(await owns(f.group_b, userId)) && !(await owns(f.group_a, userId)))) return { error: "Desafío no encontrado", status: 404 };
  if (f.status !== "pending") return { error: "Ese desafío ya se resolvió", status: 409 };
  await db.execute({ sql: "UPDATE club_friendlies SET status = 'declined' WHERE id = ?", args: [f.id] });
  return { ok: true };
}

// Cierra los amistosos cuya semana ya terminó: gana el mejor promedio y todo su club recibe la
// insignia «Amistoso ganado». Idempotente.
export async function closeDueFriendlies(today = todayStr()) {
  const due = (await db.execute({ sql: "SELECT * FROM club_friendlies WHERE status = 'accepted' AND week < ?", args: [addDays(mondayOf(today), 0)] })).rows
    .filter((f) => addDays(f.week, 6) < today);
  const out = [];
  for (const f of due) {
    const s = await scoreFriendly(f);
    await db.execute({ sql: "UPDATE club_friendlies SET status = 'closed', avg_a = ?, avg_b = ?, winner = ? WHERE id = ?", args: [s.a.avg, s.b.avg, s.winner, f.id] });
    if (s.winner) {
      const members = (await db.execute({ sql: "SELECT user_id FROM group_members WHERE group_id = ?", args: [s.winner] })).rows;
      for (const m of members) {
        await db.execute({ sql: "INSERT OR IGNORE INTO event_badges (user_id, date, kit_key, kind) VALUES (?, ?, 'amistoso', ?)", args: [m.user_id, addDays(f.week, 6), `amistoso-${f.id}`] });
      }
    }
    out.push({ id: f.id, winner: s.winner });
  }
  return out;
}

export async function friendliesOf(groupId, today = todayStr()) {
  const rows = (await db.execute({
    sql: `SELECT f.*, ga.name AS name_a, gb.name AS name_b FROM club_friendlies f
          JOIN groups_t ga ON ga.id = f.group_a JOIN groups_t gb ON gb.id = f.group_b
          WHERE (f.group_a = ? OR f.group_b = ?) AND f.status IN ('pending','accepted','closed') ORDER BY f.week DESC, f.id DESC LIMIT 6`,
    args: [groupId, groupId],
  })).rows;
  const out = [];
  for (const f of rows) {
    const live = f.status === "closed" ? { a: { avg: f.avg_a }, b: { avg: f.avg_b }, winner: f.winner } : f.status === "accepted" && f.week <= today ? await scoreFriendly(f) : null;
    out.push({
      id: f.id, status: f.status, week: f.week, daysLeft: f.status === "accepted" ? Math.max(0, Math.round((new Date(`${addDays(f.week, 6)}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86400000) + 1) : null,
      a: { id: f.group_a, name: f.name_a, avg: live?.a?.avg ?? null }, b: { id: f.group_b, name: f.name_b, avg: live?.b?.avg ?? null },
      winner: live?.winner ?? null, mine: f.group_a === groupId ? "a" : "b",
    });
  }
  return out;
}
