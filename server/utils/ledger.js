import { db } from "../db/client.js";
import { monthOf } from "./points.js";
import { bus } from "./bus.js";

// Libro único de puntos de los clubes (Futotal 2.0). Cada punto que se gana queda
// escrito acá, al instante, una vez por club: de este libro salen las vistas
// Hoy / Mes / General de la tabla. Las reglas viven en un solo lugar.
//
// Fuentes «base» (cuentan en cualquier modo y valen el doble en clubes Total):
//   partido_dia  0–100 (0–200 en Total)
//   copa         campeón 200 · finalista 120 · semifinalista 60 · participar 20
// Fuentes «libres» (solo clubes Total, una vez por fuente y por día, con tope diario):
//   libre:<juego> 0–20, versus 30, draft 30, carrera 20
// Fuente «semanal» (solo Total, sin tope): dt_podio 60 / 40 / 20.
export const CLUB_MODES = ["clasico", "total"];
export const FREE_DAILY_CAP = 100;
export const COPA_POINTS = { campeon: 200, finalista: 120, semifinal: 60, participar: 20 };
export const FLAT_POINTS = { versus: 30, draft: 30, carrera: 20 };
export const DT_PODIO_POINTS = { 1: 60, 2: 40, 3: 20 };

const BASE_SOURCES = new Set(["partido_dia", "copa"]);

export function kindOf(source) {
  if (BASE_SOURCES.has(source)) return "base";
  if (source === "dt_podio") return "weekly";
  return "free";
}

export const freeGameSource = (game) => `libre:${String(game).replace(/[^a-z0-9_-]/gi, "").slice(0, 40)}`;
export const freeGamePoints = (hits) => Math.max(0, Math.min(20, Math.round(Number(hits) * 4 || 0)));

// Qué le toca a un jugador por una fuente en un club de este modo (sin tope diario).
export function pointsFor(mode, source, base) {
  const pts = Math.max(0, Math.round(Number(base) || 0));
  const kind = kindOf(source);
  if (kind === "base") return mode === "total" ? pts * 2 : pts;
  return mode === "total" ? pts : 0;
}

// ¿Cuenta el usuario en la tabla este día? Quien entró a mitad de mes aparece
// recién desde el mes siguiente (debuts_month).
const counts = (member, date) => !member.debuts_month || monthOf(date) >= member.debuts_month;

// Clubes del usuario con su temporada iniciada.
export async function activeClubsOf(userId) {
  return (await db.execute({
    sql: `SELECT g.id AS group_id, g.club_mode, g.season_started_at, m.debuts_month
          FROM group_members m JOIN groups_t g ON g.id = m.group_id
          WHERE m.user_id = ? AND g.season_started_at IS NOT NULL`,
    args: [userId],
  })).rows;
}

// Escribe los puntos de «source» en todos los clubes iniciados del usuario.
// Devuelve { credited: [{ groupId, points }], wouldHave } para que la pantalla diga
// qué pasó: wouldHave es lo que habría ganado y no va a ningún club (modo Clásico,
// pretemporada o sin club).
export async function creditPoints(userId, date, source, basePoints) {
  const clubs = await activeClubsOf(userId);
  const month = monthOf(date);
  const kind = kindOf(source);
  const credited = [];
  // Sin ningún club iniciado se informa lo que valdría en Clásico (lo mínimo seguro).
  const allModes = clubs.length ? clubs.map((c) => c.club_mode) : ["clasico"];
  const wouldHave = Math.max(...allModes.map((m) => pointsFor(m, source, basePoints)), 0);

  for (const club of clubs) {
    if (!counts(club, date)) continue;
    let pts = pointsFor(club.club_mode, source, basePoints);
    if (pts <= 0) continue;
    if (kind === "free") {
      const used = Number((await db.execute({
        sql: `SELECT COALESCE(SUM(points), 0) AS n FROM points_ledger
              WHERE user_id = ? AND group_id = ? AND date = ? AND source NOT IN ('partido_dia', 'copa', 'dt_podio')`,
        args: [userId, club.group_id, date],
      })).rows[0].n);
      pts = Math.min(pts, Math.max(0, FREE_DAILY_CAP - used));
      if (pts <= 0) continue;
    }
    const res = await db.execute({
      sql: "INSERT OR IGNORE INTO points_ledger (user_id, group_id, date, month, source, points) VALUES (?, ?, ?, ?, ?, ?)",
      args: [userId, club.group_id, date, month, source, pts],
    });
    if (res.rowsAffected > 0) {
      credited.push({ groupId: club.group_id, points: pts });
      bus.emit("points", { groupId: club.group_id, userId, points: pts, source });
    }
  }
  return { credited, wouldHave };
}

// Igual que creditPoints, pero para un solo club (la copa semanal se reparte por club).
export async function creditPointsToGroup(userId, groupId, date, source, basePoints) {
  const club = (await db.execute({
    sql: `SELECT g.club_mode, g.season_started_at, m.debuts_month FROM group_members m
          JOIN groups_t g ON g.id = m.group_id WHERE m.user_id = ? AND g.id = ?`,
    args: [userId, groupId],
  })).rows[0];
  if (!club || !club.season_started_at || !counts(club, date)) return { credited: false, points: 0 };
  const points = pointsFor(club.club_mode, source, basePoints);
  if (points <= 0) return { credited: false, points: 0 };
  const res = await db.execute({
    sql: "INSERT OR IGNORE INTO points_ledger (user_id, group_id, date, month, source, points) VALUES (?, ?, ?, ?, ?, ?)",
    args: [userId, groupId, date, monthOf(date), source, points],
  });
  if (res.rowsAffected > 0) bus.emit("points", { groupId, userId, points, source });
  return { credited: res.rowsAffected > 0, points };
}

// Tabla de un club: vista «hoy», «mes» o «general». Los miembros que todavía no
// debutan (entraron a mitad de mes) quedan fuera hasta su mes.
export async function clubTable(groupId, view, date) {
  let filter = "";
  const args = [groupId];
  if (view === "hoy") { filter = "AND l.date = ?"; args.push(date); }
  else if (view === "mes") { filter = "AND l.month = ?"; args.push(monthOf(date)); }
  const rows = (await db.execute({
    sql: `SELECT u.id AS user_id, u.username, u.avatar, u.avatar_config, m.debuts_month,
                 COALESCE(SUM(l.points), 0) AS points
          FROM group_members m JOIN users u ON u.id = m.user_id
          LEFT JOIN points_ledger l ON l.user_id = m.user_id AND l.group_id = m.group_id ${filter}
          WHERE m.group_id = ?
          GROUP BY u.id ORDER BY points DESC, u.username`,
    args: [...args.slice(1), args[0]],
  })).rows;
  const visible = rows.filter((r) => !r.debuts_month || monthOf(date) >= r.debuts_month);
  let rank = 0;
  let prev = null;
  return visible.map((r, i) => {
    if (r.points !== prev) { rank = i + 1; prev = r.points; }
    return { userId: r.user_id, username: r.username, avatar: r.avatar, avatar_config: r.avatar_config, points: Number(r.points), rank };
  });
}
