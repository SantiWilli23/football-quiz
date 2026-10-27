import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr, monthOf } from "../utils/points.js";
import { CLUB_MODES, clubTable } from "../utils/ledger.js";
import { personalStreak } from "../utils/streak.js";
import { clubStreak, hasActiveClub, redesignOn, unlockPacksFor } from "../utils/clubs.js";
import { cupFor, settleLastCup } from "../utils/cup.js";
import { closeDueMonths, markSeen, pendingCeremonies } from "../utils/month.js";
import { accept as acceptFriendly, challenge as challengeClub, closeDueFriendlies, decline as declineFriendly, friendliesOf } from "../utils/friendly.js";
import { addDays, mondayOf } from "../utils/points.js";

// Futotal 2.0: los grupos son «clubes» con modo (clásico o total), pretemporada y
// temporada. La tabla sale del libro de puntos (utils/ledger.js).
const router = Router();
router.use(requireAuth);

const MIN_MEMBERS_TO_START = 2;
const isFirstOfMonth = (date) => date.endsWith("-01");

async function clubFor(groupId, userId) {
  const club = (await db.execute({
    sql: `SELECT g.id, g.name, g.created_by, g.club_mode, g.season_started_at, g.mode_changed_month,
                 (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS members
          FROM groups_t g JOIN group_members m ON m.group_id = g.id AND m.user_id = ?
          WHERE g.id = ?`,
    args: [userId, groupId],
  })).rows[0];
  return club || null;
}

// El cliente pregunta si el rediseño está encendido (lanzamiento por etapas, FUTOTAL2=1).
router.get("/features", (req, res) => res.json({ futotal2: redesignOn() }));

router.get("/", async (req, res) => {
  try {
    const main = (await db.execute({ sql: "SELECT group_id FROM user_main_club WHERE user_id = ?", args: [req.userId] })).rows[0];
    const rows = (await db.execute({
      sql: `SELECT g.id, g.name, g.avatar, g.club_mode, g.season_started_at, g.created_by,
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS members
            FROM groups_t g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = ? ORDER BY g.id`,
      args: [req.userId],
    })).rows;
    res.json({
      clubs: rows.map((c) => ({
        id: c.id, name: c.name, avatar: c.avatar, mode: c.club_mode, members: Number(c.members),
        started: !!c.season_started_at, preseason: !c.season_started_at,
        owner: c.created_by === req.userId, main: main?.group_id === c.id,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// El dueño inicia la temporada: desde ahí el club suma puntos. Mínimo 2 miembros.
router.post("/:id/start", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    if (club.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó el club puede iniciar la temporada" });
    if (club.season_started_at) return res.status(409).json({ error: "La temporada ya está iniciada" });
    if (Number(club.members) < MIN_MEMBERS_TO_START) return res.status(400).json({ error: `Hacen falta al menos ${MIN_MEMBERS_TO_START} miembros` });
    const today = todayStr();
    const members = (await db.execute({ sql: "SELECT user_id FROM group_members WHERE group_id = ?", args: [club.id] })).rows;
    const had = new Map();
    for (const m of members) had.set(m.user_id, await hasActiveClub(m.user_id));
    await db.execute({ sql: "UPDATE groups_t SET season_started_at = ? WHERE id = ?", args: [today, club.id] });
    // Los sobres guardados de cada miembro se desbloquean al entrar a un club iniciado.
    for (const m of members) await unlockPacksFor(m.user_id, had.get(m.user_id));
    res.json({ ok: true, startedAt: today });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// El modo solo cambia el día 1 de cada mes (o en pretemporada, cuando quieras).
router.post("/:id/mode", async (req, res) => {
  try {
    const mode = String(req.body?.mode || "");
    if (!CLUB_MODES.includes(mode)) return res.status(400).json({ error: "Modo inválido" });
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    if (club.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó el club cambia el modo" });
    const today = todayStr();
    if (club.season_started_at && !isFirstOfMonth(today)) {
      return res.status(409).json({ error: "El modo solo se cambia el día 1 de cada mes" });
    }
    if (club.season_started_at && club.mode_changed_month === monthOf(today)) {
      return res.status(409).json({ error: "El modo ya se cambió este mes" });
    }
    await db.execute({
      sql: "UPDATE groups_t SET club_mode = ?, mode_changed_month = ? WHERE id = ?",
      args: [mode, club.season_started_at ? monthOf(today) : club.mode_changed_month, club.id],
    });
    res.json({ ok: true, mode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Club principal: de ahí sale el súper sobre del podio del mes. La primera vez se
// elige libre, y después solo el día 1 de cada mes.
router.post("/main", async (req, res) => {
  try {
    const groupId = Number(req.body?.groupId);
    if (!Number.isInteger(groupId) || !(await clubFor(groupId, req.userId))) return res.status(404).json({ error: "Club no encontrado" });
    const today = todayStr();
    const current = (await db.execute({ sql: "SELECT group_id, changed_month FROM user_main_club WHERE user_id = ?", args: [req.userId] })).rows[0];
    if (current && current.group_id !== groupId && !isFirstOfMonth(today)) {
      return res.status(409).json({ error: "El club principal solo se cambia el día 1 de cada mes" });
    }
    await db.execute({
      sql: `INSERT INTO user_main_club (user_id, group_id, changed_month) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET group_id = excluded.group_id, changed_month = excluded.changed_month`,
      args: [req.userId, groupId, monthOf(today)],
    });
    res.json({ ok: true, groupId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/:id/table", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    const view = ["hoy", "mes", "general"].includes(req.query.view) ? req.query.view : "hoy";
    const today = todayStr();
    if (!club.season_started_at) {
      return res.json({ view, mode: club.club_mode, preseason: true, members: Number(club.members), table: [] });
    }
    // Si la copa de la semana pasada ya terminó y nadie la repartió, se reparte ahora.
    await settleLastCup(club.id).catch((e) => console.error("copa", e));
    res.json({ view, mode: club.club_mode, preseason: false, table: await clubTable(club.id, view, today) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/:id/streak", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    res.json(await clubStreak(club.id, todayStr()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Copa semanal automática: clasificación de lunes a jueves y llaves del viernes al domingo.
router.get("/:id/cup", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    const { raw, ...cup } = await cupFor(club.id);
    res.json(cup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ceremonias de fin de mes pendientes de ver (podio con trofeo, o «sin podio»).
let lastClose = 0;
router.get("/ceremony", async (req, res) => {
  try {
    if (Date.now() - lastClose > 5 * 60_000) { lastClose = Date.now(); await closeDueMonths().catch((e) => console.error("meses", e)); }
    res.json({ ceremonies: await pendingCeremonies(req.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/ceremony/seen", async (req, res) => {
  try {
    const groupId = Number(req.body?.groupId);
    const month = String(req.body?.month || "");
    if (!/^\d{4}-\d{2}$/.test(month) || !(await clubFor(groupId, req.userId))) return res.status(400).json({ error: "Datos inválidos" });
    await markSeen(req.userId, groupId, month);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Resumen del lunes: cómo terminó la semana pasada en el club.
router.get("/:id/recap", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    const monday = addDays(mondayOf(todayStr()), -7);
    const week = async (from) => (await db.execute({
      sql: `SELECT u.id AS user_id, u.username, COALESCE(SUM(l.points), 0) AS points FROM group_members m JOIN users u ON u.id = m.user_id
            LEFT JOIN points_ledger l ON l.user_id = m.user_id AND l.group_id = m.group_id AND l.date BETWEEN ? AND ?
            WHERE m.group_id = ? GROUP BY u.id ORDER BY points DESC, u.username`,
      args: [from, addDays(from, 6), club.id],
    })).rows.map((r, i) => ({ userId: r.user_id, username: r.username, points: Number(r.points), rank: i + 1 }));
    const now = await week(monday);
    const before = await week(addDays(monday, -7));
    const me = now.find((r) => r.userId === req.userId);
    const was = before.find((r) => r.userId === req.userId);
    const cup = (await cupFor(club.id, monday)).cup;
    res.json({
      week: monday, top: now.slice(0, 3).filter((r) => r.points > 0),
      me: me ? { ...me, previousRank: was?.rank ?? null, change: was ? was.rank - me.rank : null } : null,
      champion: cup.champion ? { userId: cup.champion.userId, username: cup.champion.username } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Amistosos entre clubes.
router.get("/:id/friendlies", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    await closeDueFriendlies().catch((e) => console.error("amistosos", e));
    res.json({ owner: club.created_by === req.userId, friendlies: await friendliesOf(club.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/:id/friendly", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    const out = await challengeClub(club.id, req.body?.code, req.userId);
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.status(201).json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/friendlies/:fid/:action", async (req, res) => {
  try {
    const fid = Number(req.params.fid);
    const out = req.params.action === "accept" ? await acceptFriendly(fid, req.userId) : req.params.action === "decline" ? await declineFriendly(fid, req.userId) : { error: "Acción inválida", status: 400 };
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Leyendas del club: las 5 mejores carreras de Cotrero de los miembros (la mejor de cada uno).
router.get("/:id/legends", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    const rows = (await db.execute({
      sql: `SELECT u.username, c.game, c.score, c.label, c.pos, c.name FROM career_scores c
            JOIN group_members m ON m.user_id = c.user_id AND m.group_id = ? JOIN users u ON u.id = c.user_id
            ORDER BY c.score DESC LIMIT 5`,
      args: [club.id],
    })).rows;
    res.json({ legends: rows.map((r, i) => ({ place: i + 1, username: r.username, name: r.name, score: Number(r.score), label: r.label, pos: r.pos, game: r.game })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/me/streak", async (req, res) => {
  try {
    res.json(await personalStreak(req.userId, todayStr()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
