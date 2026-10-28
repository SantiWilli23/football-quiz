import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr, monthOf } from "../utils/points.js";
import { CLUB_MODES, clubTable } from "../utils/ledger.js";
import { personalStreak } from "../utils/streak.js";
import { clubStreak, enabledGames, hasActiveClub, redesignOn, unlockPacksFor } from "../utils/clubs.js";
import { cupFor, settleLastCup } from "../utils/cup.js";
import { closeDueMonths, markSeen, pendingCeremonies } from "../utils/month.js";
import { accept as acceptFriendly, challenge as challengeClub, closeDueFriendlies, decline as declineFriendly, friendliesOf } from "../utils/friendly.js";
import { addDays, mondayOf } from "../utils/points.js";
import { matchFor } from "../utils/daily-match.js";

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
router.get("/features", (req, res) => res.json({ futotal2: redesignOn(), games: enabledGames() }));

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
    // Quiénes ya jugaron el partido de hoy: en la vista «Hoy» los demás salen como pendientes.
    const played = (await db.execute({
      sql: `SELECT r.user_id FROM daily_match_results r JOIN group_members m ON m.user_id = r.user_id AND m.group_id = ? WHERE r.date = ?`,
      args: [club.id, today],
    })).rows.map((r) => r.user_id);
    res.json({ view, mode: club.club_mode, preseason: false, table: await clubTable(club.id, view, today), playedToday: played });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Va antes de «/:id/streak»: si no, «me» se leería como el id de un club y devolvería 500.
router.get("/me/streak", async (req, res) => {
  try {
    res.json(await personalStreak(req.userId, todayStr()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Partidas libres de hoy (tope 100 por club Total): lo sumado en el club donde más se sumó.
router.get("/me/free", async (req, res) => {
  try {
    const row = (await db.execute({
      sql: `SELECT COALESCE(MAX(t), 0) AS pts FROM (SELECT SUM(points) AS t FROM points_ledger
            WHERE user_id = ? AND date = ? AND source LIKE 'libre:%' GROUP BY group_id)`,
      args: [req.userId, todayStr()],
    })).rows[0];
    res.json({ points: Number(row?.pts || 0), cap: 100 });
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
      sql: `SELECT u.username, c.game, c.score, c.label, c.pos, c.name, c.verified FROM career_scores c
            JOIN group_members m ON m.user_id = c.user_id AND m.group_id = ? JOIN users u ON u.id = c.user_id
            ORDER BY c.score DESC LIMIT 5`,
      args: [club.id],
    })).rows;
    res.json({ legends: rows.map((r, i) => ({ place: i + 1, username: r.username, name: r.name, score: Number(r.score), label: r.label, pos: r.pos, game: r.game, verified: Number(r.verified) === 1 })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Insignias del club: se ganan entre todos y cada una enciende una pieza del escudo.
// Se calculan al pedirlas (nada que migrar): salen del libro de puntos, los cierres de
// mes, los amistosos y los días en que jugaron todos.
export const BADGES = [
  { key: "temporada", label: "Temporada iniciada", text: "El club arrancó su primera temporada." },
  { key: "mes", label: "Primer mes cerrado", text: "Se cerró un mes completo con su podio." },
  { key: "copa", label: "Copa ganada", text: "Alguien del club ganó la copa semanal." },
  { key: "amistoso", label: "Amistoso ganado", text: "El club le ganó un amistoso a otro club." },
  { key: "racha", label: "Racha de 7", text: "7 días seguidos con todos jugando el partido del día." },
];

export function longestRun(dates) {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    const expected = prev ? new Date(`${prev}T12:00:00Z`) : null;
    if (expected) expected.setUTCDate(expected.getUTCDate() + 1);
    run = expected && expected.toISOString().slice(0, 10) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export async function badgesOf(club) {
  const has = async (sql, args) => !!(await db.execute({ sql, args })).rows[0];
  const members = Number(club.members);
  let bestRun = 0;
  if (members >= 2) {
    const rows = (await db.execute({
      sql: `SELECT r.date FROM daily_match_results r JOIN group_members m ON m.user_id = r.user_id AND m.group_id = ?
            GROUP BY r.date HAVING COUNT(DISTINCT r.user_id) >= ?`,
      args: [club.id, members],
    })).rows;
    bestRun = longestRun(rows.map((r) => r.date));
  }
  const earned = {
    temporada: !!club.season_started_at,
    mes: await has("SELECT 1 FROM month_closes WHERE group_id = ?", [club.id]),
    copa: await has("SELECT 1 FROM points_ledger WHERE group_id = ? AND source = 'copa' AND points >= 200", [club.id]),
    amistoso: await has("SELECT 1 FROM club_friendlies WHERE winner = ?", [club.id]),
    racha: bestRun >= 7,
  };
  return BADGES.map((b) => ({ ...b, earned: earned[b.key] }));
}

router.get("/:id/badges", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    if (!club) return res.status(404).json({ error: "Club no encontrado" });
    res.json({ badges: await badgesOf(club) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

async function memberOfClub(groupId, userId) {
  return !!(await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, userId] })).rows[0];
}

// Ficha de miembro: lo que cualquiera del club puede ver de otro.
router.get("/:id/members/:uid", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    const uid = Number(req.params.uid);
    if (!club || !(await memberOfClub(club.id, uid))) return res.status(404).json({ error: "Miembro no encontrado" });
    const today = todayStr();
    const user = (await db.execute({ sql: "SELECT id, username, avatar, avatar_config FROM users WHERE id = ?", args: [uid] })).rows[0];
    const ranks = {};
    if (club.season_started_at) {
      for (const view of ["hoy", "mes", "general"]) {
        const row = (await clubTable(club.id, view, today)).find((r) => r.userId === uid);
        ranks[view] = row ? { rank: row.rank, points: row.points } : null;
      }
    }
    const result = (await db.execute({ sql: "SELECT total, p1, p2, p3 FROM daily_match_results WHERE user_id = ? AND date = ?", args: [uid, today] })).rows[0];
    const mine = (await db.execute({ sql: "SELECT total FROM daily_match_results WHERE user_id = ? AND date = ?", args: [req.userId, today] })).rows[0];
    const trophies = (await db.execute({ sql: "SELECT month, place FROM club_trophies WHERE user_id = ? AND group_id = ? ORDER BY month DESC LIMIT 6", args: [uid, club.id] })).rows;
    const avg = (await db.execute({ sql: "SELECT AVG(total) AS a, COUNT(*) AS n FROM (SELECT total FROM daily_match_results WHERE user_id = ? ORDER BY date DESC LIMIT 30)", args: [uid] })).rows[0];
    const streak = await personalStreak(uid, today);
    res.json({
      user: { id: user.id, username: user.username, avatar: user.avatar, avatar_config: user.avatar_config },
      me: uid === req.userId,
      ranks,
      streak: streak.streak,
      average: Number(avg.n) ? Math.round(Number(avg.a)) : null,
      today: result ? { played: true, total: Number(result.total) } : { played: false },
      // Solo si ambos jugaron hoy se puede abrir el cara a cara.
      canCompare: !!result && !!mine && uid !== req.userId,
      myToday: mine ? Number(mine.total) : null,
      trophies: trophies.map((t) => ({ month: t.month, place: Number(t.place) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Cara a cara: pregunta por pregunta y con los tiempos, solo si los dos ya jugaron hoy
// (así no se regalan respuestas del partido a quien todavía no lo jugó).
router.get("/:id/head-to-head/:uid", async (req, res) => {
  try {
    const club = await clubFor(Number(req.params.id), req.userId);
    const uid = Number(req.params.uid);
    if (!club || uid === req.userId || !(await memberOfClub(club.id, uid))) return res.status(404).json({ error: "Miembro no encontrado" });
    const date = todayStr();
    const played = async (id) => (await db.execute({ sql: "SELECT total, p1, p2, p3 FROM daily_match_results WHERE user_id = ? AND date = ?", args: [id, date] })).rows[0];
    const [mine, theirs] = [await played(req.userId), await played(uid)];
    if (!mine || !theirs) return res.status(409).json({ error: "El cara a cara se abre cuando los dos jugaron el partido de hoy" });
    const items = await matchFor(date);
    const answers = async (id) => new Map((await db.execute({ sql: "SELECT idx, ok, ms, points FROM daily_match_answers WHERE user_id = ? AND date = ?", args: [id, date] })).rows.map((r) => [Number(r.idx), r]));
    const [a, b] = [await answers(req.userId), await answers(uid)];
    const other = (await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [uid] })).rows[0];
    const rows = items.map((it, idx) => {
      const x = a.get(idx);
      const y = b.get(idx);
      return {
        idx, part: it.part, kind: it.kind,
        me: x ? { ok: !!x.ok, ms: Number(x.ms) } : null,
        them: y ? { ok: !!y.ok, ms: Number(y.ms) } : null,
      };
    });
    res.json({
      date, username: other.username,
      totals: { me: Number(mine.total), them: Number(theirs.total) },
      parts: [1, 2, 3].map((p) => ({ part: p, me: Number(mine[`p${p}`]), them: Number(theirs[`p${p}`]) })),
      rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
