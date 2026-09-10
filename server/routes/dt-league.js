import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAMS = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/dt-teams.json"), "utf-8"));

const router = Router();
router.use(requireAuth);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I

function genInviteCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function teamsForLeague(leagueKey) {
  return TEAMS.filter((t) => t.league === leagueKey);
}

async function loadLeagueByCode(code) {
  const result = await db.execute({
    sql: "SELECT * FROM dt_leagues WHERE invite_code = ?",
    args: [code.toUpperCase()],
  });
  return result.rows[0] || null;
}

async function loadMembers(leagueId) {
  const result = await db.execute({
    sql: `SELECT m.id, m.user_id, m.team_id, m.joined_at, u.username
          FROM dt_league_members m JOIN users u ON u.id = m.user_id
          WHERE m.league_id = ? ORDER BY m.joined_at ASC`,
    args: [leagueId],
  });
  return result.rows;
}

function serializeLeague(league, members, userId) {
  const league_teams = teamsForLeague(league.league_key);
  const takenIds = new Set(members.map((m) => m.team_id).filter(Boolean));
  return {
    id: league.id,
    name: league.name,
    leagueKey: league.league_key,
    inviteCode: league.invite_code,
    status: league.status,
    currentWeek: league.current_week,
    createdBy: league.created_by,
    isMine: league.created_by === userId,
    members: members.map((m) => ({
      userId: m.user_id,
      username: m.username,
      teamId: m.team_id,
      isMe: m.user_id === userId,
    })),
    availableTeams: league_teams.filter((t) => !takenIds.has(t.id)),
    allTeams: league_teams,
  };
}

// Crea la liga y el creador queda adentro como primer miembro (sin equipo aún).
router.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 60);
  const leagueKey = String(req.body?.leagueKey || "");
  if (!name) return res.status(400).json({ error: "Ponele un nombre a la liga" });
  if (!["premier", "laliga"].includes(leagueKey)) return res.status(400).json({ error: "Liga inválida" });

  let inviteCode;
  for (let i = 0; i < 10; i++) {
    const candidate = genInviteCode();
    const exists = await db.execute({ sql: "SELECT 1 FROM dt_leagues WHERE invite_code = ?", args: [candidate] });
    if (!exists.rows.length) { inviteCode = candidate; break; }
  }
  if (!inviteCode) return res.status(500).json({ error: "No se pudo generar un código, probá de nuevo" });

  const result = await db.execute({
    sql: "INSERT INTO dt_leagues (name, league_key, invite_code, created_by) VALUES (?, ?, ?, ?)",
    args: [name, leagueKey, inviteCode, req.userId],
  });
  await db.execute({
    sql: "INSERT INTO dt_league_members (league_id, user_id) VALUES (?, ?)",
    args: [Number(result.lastInsertRowid), req.userId],
  });

  const league = await loadLeagueByCode(inviteCode);
  const members = await loadMembers(league.id);
  res.status(201).json({ league: serializeLeague(league, members, req.userId) });
});

// Ligas de las que el usuario forma parte (para mostrarlas al entrar a la sección).
router.get("/mine", async (req, res) => {
  const result = await db.execute({
    sql: `SELECT l.id, l.name, l.league_key, l.invite_code, l.status, l.current_week,
                 (SELECT team_id FROM dt_league_members WHERE league_id = l.id AND user_id = ?) as my_team_id,
                 (SELECT COUNT(*) FROM dt_league_members WHERE league_id = l.id) as member_count
          FROM dt_leagues l
          WHERE l.id IN (SELECT league_id FROM dt_league_members WHERE user_id = ?)
          ORDER BY l.created_at DESC`,
    args: [req.userId, req.userId],
  });
  res.json({
    leagues: result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      leagueKey: r.league_key,
      inviteCode: r.invite_code,
      status: r.status,
      currentWeek: r.current_week,
      myTeamId: r.my_team_id,
      memberCount: r.member_count,
    })),
  });
});

router.post("/join", async (req, res) => {
  const code = String(req.body?.inviteCode || "").trim();
  if (!code) return res.status(400).json({ error: "Falta el código de invitación" });

  const league = await loadLeagueByCode(code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.status !== "lobby") return res.status(400).json({ error: "Esa liga ya arrancó, no se puede sumar más gente" });

  const already = await db.execute({
    sql: "SELECT 1 FROM dt_league_members WHERE league_id = ? AND user_id = ?",
    args: [league.id, req.userId],
  });
  if (!already.rows.length) {
    await db.execute({
      sql: "INSERT INTO dt_league_members (league_id, user_id) VALUES (?, ?)",
      args: [league.id, req.userId],
    });
  }

  const members = await loadMembers(league.id);
  res.json({ league: serializeLeague(league, members, req.userId) });
});

router.get("/:code", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });

  const members = await loadMembers(league.id);
  const isMember = members.some((m) => m.user_id === req.userId);
  if (!isMember) return res.status(403).json({ error: "No sos parte de esta liga" });

  res.json({ league: serializeLeague(league, members, req.userId) });
});

router.post("/:code/team", async (req, res) => {
  const teamId = String(req.body?.teamId || "");
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.status !== "lobby") return res.status(400).json({ error: "La liga ya arrancó, no podés cambiar de equipo" });

  const validTeam = teamsForLeague(league.league_key).find((t) => t.id === teamId);
  if (!validTeam) return res.status(400).json({ error: "Ese equipo no pertenece a esta liga" });

  const members = await loadMembers(league.id);
  const isMember = members.some((m) => m.user_id === req.userId);
  if (!isMember) return res.status(403).json({ error: "No sos parte de esta liga" });

  const takenBy = members.find((m) => m.team_id === teamId && m.user_id !== req.userId);
  if (takenBy) return res.status(409).json({ error: `${validTeam.name} ya lo eligió ${takenBy.username}` });

  await db.execute({
    sql: "UPDATE dt_league_members SET team_id = ? WHERE league_id = ? AND user_id = ?",
    args: [teamId, league.id, req.userId],
  });

  const updatedMembers = await loadMembers(league.id);
  res.json({ league: serializeLeague(league, updatedMembers, req.userId) });
});

// Solo el creador puede arrancar la temporada, y solo cuando todos eligieron equipo.
router.post("/:code/start", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó la liga puede arrancarla" });
  if (league.status !== "lobby") return res.status(400).json({ error: "Esta liga ya arrancó" });

  const members = await loadMembers(league.id);
  if (members.some((m) => !m.team_id)) {
    return res.status(400).json({ error: "Todavía hay jugadores sin elegir equipo" });
  }
  if (members.length < 2) {
    return res.status(400).json({ error: "Hace falta al menos otro jugador además de vos" });
  }

  await db.execute({
    sql: "UPDATE dt_leagues SET status = 'in_progress' WHERE id = ?",
    args: [league.id],
  });

  const updated = await loadLeagueByCode(req.params.code);
  res.json({ league: serializeLeague(updated, members, req.userId) });
});

export default router;
