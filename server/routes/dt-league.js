import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { simulateFixture, generateRoundRobin } from "../utils/dt-match.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_PATH = path.join(__dirname, "../data/dt-teams.json");
// Si faltara el archivo (por ejemplo un deploy sin server/data/), no tumbamos
// todo el server al arrancar: esta sección queda sin equipos disponibles en
// vez de tirar abajo el resto de la API.
const TEAMS = fs.existsSync(TEAMS_PATH) ? JSON.parse(fs.readFileSync(TEAMS_PATH, "utf-8")) : [];

const router = Router();
router.use(requireAuth);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

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

async function requireMembership(league, userId) {
  const members = await loadMembers(league.id);
  const me = members.find((m) => m.user_id === userId);
  return { members, me };
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
    totalWeeks: league.total_weeks,
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

async function loadStandings(leagueId, teamIds) {
  const standings = {};
  teamIds.forEach((id) => { standings[id] = { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }; });

  const result = await db.execute({
    sql: "SELECT home_team_id, away_team_id, home_goals, away_goals FROM dt_league_fixtures WHERE league_id = ? AND played = 1",
    args: [leagueId],
  });

  result.rows.forEach((r) => {
    const h = standings[r.home_team_id], a = standings[r.away_team_id];
    if (!h || !a) return;
    h.played += 1; a.played += 1;
    h.gf += r.home_goals; h.ga += r.away_goals;
    a.gf += r.away_goals; a.ga += r.home_goals;
    if (r.home_goals > r.away_goals) { h.won += 1; h.pts += 3; a.lost += 1; }
    else if (r.home_goals < r.away_goals) { a.won += 1; a.pts += 3; h.lost += 1; }
    else { h.drawn += 1; a.drawn += 1; h.pts += 1; a.pts += 1; }
  });

  return Object.values(standings).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
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

  const { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });

  res.json({ league: serializeLeague(league, members, req.userId) });
});

router.post("/:code/team", async (req, res) => {
  const teamId = String(req.body?.teamId || "");
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.status !== "lobby") return res.status(400).json({ error: "La liga ya arrancó, no podés cambiar de equipo" });

  const validTeam = teamsForLeague(league.league_key).find((t) => t.id === teamId);
  if (!validTeam) return res.status(400).json({ error: "Ese equipo no pertenece a esta liga" });

  const { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });

  const takenBy = members.find((m) => m.team_id === teamId && m.user_id !== req.userId);
  if (takenBy) return res.status(409).json({ error: `${validTeam.name} ya lo eligió ${takenBy.username}` });

  await db.execute({
    sql: "UPDATE dt_league_members SET team_id = ? WHERE league_id = ? AND user_id = ?",
    args: [teamId, league.id, req.userId],
  });

  const updatedMembers = await loadMembers(league.id);
  res.json({ league: serializeLeague(league, updatedMembers, req.userId) });
});

// Solo el creador puede arrancar la temporada, y solo cuando todos eligieron
// equipo. Arma el calendario de ida y vuelta con TODOS los equipos de la
// liga (los que nadie eligió quedan controlados por la CPU).
router.post("/:code/start", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó la liga puede arrancarla" });
  if (league.status !== "lobby") return res.status(400).json({ error: "Esta liga ya arrancó" });

  const { members } = await requireMembership(league, req.userId);
  if (members.some((m) => !m.team_id)) {
    return res.status(400).json({ error: "Todavía hay jugadores sin elegir equipo" });
  }
  if (members.length < 2) {
    return res.status(400).json({ error: "Hace falta al menos otro jugador además de vos" });
  }

  const allTeamIds = teamsForLeague(league.league_key).map((t) => t.id);
  const rounds = generateRoundRobin(allTeamIds);

  const fixtures = [];
  rounds.forEach((round, idx) => {
    round.forEach(([home, away]) => fixtures.push({ week: idx + 1, home, away }));
  });

  for (let i = 0; i < fixtures.length; i += 50) {
    const chunk = fixtures.slice(i, i + 50);
    const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
    const args = chunk.flatMap((fx) => [league.id, fx.week, fx.home, fx.away]);
    await db.execute({
      sql: `INSERT INTO dt_league_fixtures (league_id, week, home_team_id, away_team_id) VALUES ${placeholders}`,
      args,
    });
  }

  await db.execute({
    sql: "UPDATE dt_leagues SET status = 'in_progress', total_weeks = ? WHERE id = ?",
    args: [rounds.length, league.id],
  });

  const updated = await loadLeagueByCode(req.params.code);
  res.json({ league: serializeLeague(updated, members, req.userId) });
});

// Táctica del club que dirige el usuario (mentalidad/pressing/tempo).
router.get("/:code/tactics", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (!me.team_id) return res.json({ tactics: null });

  const result = await db.execute({
    sql: "SELECT mentality, pressing, tempo FROM dt_league_tactics WHERE league_id = ? AND team_id = ?",
    args: [league.id, me.team_id],
  });
  res.json({ tactics: result.rows[0] || { mentality: 3, pressing: 50, tempo: 50 } });
});

router.post("/:code/tactics", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (!me.team_id) return res.status(400).json({ error: "Todavía no elegiste equipo" });

  const toInt = (value, fallback) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback);
  const mentality = clamp(toInt(req.body?.mentality, 3), 1, 5);
  const pressing = clamp(toInt(req.body?.pressing, 50), 0, 100);
  const tempo = clamp(toInt(req.body?.tempo, 50), 0, 100);

  await db.execute({
    sql: `INSERT INTO dt_league_tactics (league_id, team_id, mentality, pressing, tempo)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(league_id, team_id) DO UPDATE SET
            mentality = excluded.mentality, pressing = excluded.pressing, tempo = excluded.tempo,
            updated_at = datetime('now')`,
    args: [league.id, me.team_id, mentality, pressing, tempo],
  });

  res.json({ ok: true, tactics: { mentality, pressing, tempo } });
});

router.get("/:code/fixtures", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });

  const week = req.query.week ? Number(req.query.week) : Math.min(league.current_week + 1, league.total_weeks || 1);
  const result = await db.execute({
    sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND week = ? ORDER BY id",
    args: [league.id, week],
  });

  const nameByTeam = Object.fromEntries(teamsForLeague(league.league_key).map((t) => [t.id, t.name]));
  res.json({
    week,
    totalWeeks: league.total_weeks,
    fixtures: result.rows.map((r) => ({
      id: r.id,
      homeTeamId: r.home_team_id,
      awayTeamId: r.away_team_id,
      homeTeamName: nameByTeam[r.home_team_id] || r.home_team_id,
      awayTeamName: nameByTeam[r.away_team_id] || r.away_team_id,
      homeGoals: r.home_goals,
      awayGoals: r.away_goals,
      played: !!r.played,
    })),
  });
});

router.get("/:code/standings", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });

  const teams = teamsForLeague(league.league_key);
  const standings = await loadStandings(league.id, teams.map((t) => t.id));
  const nameByTeam = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const managerByTeam = Object.fromEntries(members.filter((m) => m.team_id).map((m) => [m.team_id, m.username]));

  res.json({
    standings: standings.map((s, i) => ({
      ...s,
      position: i + 1,
      teamName: nameByTeam[s.teamId] || s.teamId,
      manager: managerByTeam[s.teamId] || null,
    })),
  });
});

// Solo el creador puede avanzar la jornada: resuelve todos los partidos de
// la semana siguiente (humano vs CPU, CPU vs CPU, humano vs humano — todos
// se resuelven igual, con la táctica que cada uno haya dejado cargada).
router.post("/:code/advance", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó la liga puede avanzar la jornada" });
  if (league.status !== "in_progress") return res.status(400).json({ error: "La liga no está en curso" });

  const nextWeek = league.current_week + 1;
  if (nextWeek > league.total_weeks) return res.status(400).json({ error: "La temporada ya terminó" });

  const teams = teamsForLeague(league.league_key);
  const tierByTeam = Object.fromEntries(teams.map((t) => [t.id, t.tier]));

  const tacticsResult = await db.execute({
    sql: "SELECT team_id, mentality, pressing, tempo FROM dt_league_tactics WHERE league_id = ?",
    args: [league.id],
  });
  const tacticsByTeam = Object.fromEntries(tacticsResult.rows.map((r) => [r.team_id, r]));

  const fixturesResult = await db.execute({
    sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND week = ? AND played = 0",
    args: [league.id, nextWeek],
  });

  for (const fx of fixturesResult.rows) {
    const { homeGoals, awayGoals } = simulateFixture({
      homeTier: tierByTeam[fx.home_team_id] || 2,
      awayTier: tierByTeam[fx.away_team_id] || 2,
      homeTactics: tacticsByTeam[fx.home_team_id] || null,
      awayTactics: tacticsByTeam[fx.away_team_id] || null,
    });
    await db.execute({
      sql: "UPDATE dt_league_fixtures SET home_goals = ?, away_goals = ?, played = 1 WHERE id = ?",
      args: [homeGoals, awayGoals, fx.id],
    });
  }

  const finished = nextWeek >= league.total_weeks;
  await db.execute({
    sql: "UPDATE dt_leagues SET current_week = ?, status = ? WHERE id = ?",
    args: [nextWeek, finished ? "finished" : "in_progress", league.id],
  });

  res.json({ ok: true, week: nextWeek, finished });
});

export default router;
