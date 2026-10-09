import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { simulateFixture, generateRoundRobin, dtWeeklyPoints, dtOutcomeFor, cpuBiasOf, CPU_DIFFICULTY_BIAS } from "../utils/dt-match.js";
import { squadPower, tacticsOf, isValidSquadState, MAX_SQUAD_STATE_BYTES } from "../utils/dt-squad.js";
import {
  advanceCompetitions, applyOverdue, clubInfo, compInfo, humansOf, infoOf, labelForFixture, monthStatus, nowSql, parseSql,
  pendingBudgetAdjustment, recordResult, refreshLeagueWeek, resolveAuto, resolveCpuOffer, settleWeeks, standingsFrom, startSeason,
  totalMonthsOf, touchMember, weekCode,
} from "../utils/dt-league-core.js";
import {
  EXPEL_AFTER_DAYS, expectedPosition, FINE_PER_DAY, tierFromLevel, WINDOW_LABEL, windowAt,
} from "../utils/dt-season.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_PATH = path.join(__dirname, "../data/dt-teams.json");
// Si faltara el archivo (por ejemplo un deploy sin server/data/), no tumbamos
// todo el server al arrancar: esta sección queda sin equipos disponibles en
// vez de tirar abajo el resto de la API.
const TEAMS = fs.existsSync(TEAMS_PATH) ? JSON.parse(fs.readFileSync(TEAMS_PATH, "utf-8")) : [];

const router = Router();
router.use(requireAuth);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I
const WALKOVER_DAYS = 3;
const ALLOWED_SPEEDS = [0.2, 0.5, 1, 2];

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
    sql: `SELECT m.id, m.user_id, m.team_id, m.joined_at, m.ready_month, m.ready_at, m.last_active_at, m.expelled_at, u.username
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

// El mes actual lo guarda la liga (current_month) y solo avanza cuando todos los humanos jugaron
// todos sus partidos del mes y apretaron "Listo" (ver tryAdvanceMonth en dt-league-core.js).
async function activeMonthOf(league) {
  return Number(league.current_month || 1);
}

// Si un partido humano-vs-humano en vivo quedó a mitad de camino más de WALKOVER_DAYS sin que el
// rival ausente se conecte, gana por walkover quien sí se presentó (o se resuelve solo si ninguno vino).
async function resolveWalkovers(league, members) {
  const info = await clubInfo(league, members);
  const humanTeams = new Set(humansOf(members).map((m) => m.team_id));
  const pending = await db.execute({
    sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND played = 0 AND live_started_at IS NOT NULL",
    args: [league.id, Number(league.season || 1)],
  });
  const tacticsResult = await db.execute({
    sql: "SELECT team_id, mentality, pressing, tempo, power FROM dt_league_tactics WHERE league_id = ?",
    args: [league.id],
  });
  const tacticsByTeam = Object.fromEntries(tacticsResult.rows.map((r) => [r.team_id, r]));
  const now = Date.now();
  for (const fx of pending.rows) {
    if (!humanTeams.has(fx.home_team_id) || !humanTeams.has(fx.away_team_id)) continue;
    const daysWaiting = (now - parseSql(fx.live_started_at)) / 86400000;
    if (daysWaiting < WALKOVER_DAYS) continue;
    const onlyHomeJoined = !!fx.live_home_joined && !fx.live_away_joined;
    const onlyAwayJoined = !!fx.live_away_joined && !fx.live_home_joined;
    if (onlyHomeJoined || onlyAwayJoined) {
      await recordResult(league, fx, onlyHomeJoined ? 3 : 0, onlyAwayJoined ? 3 : 0, { walkover: onlyHomeJoined ? "home" : "away", info });
    } else {
      const { homeGoals, awayGoals } = simulateFixture({
        homeTier: infoOf(info, fx.home_team_id).tier, awayTier: infoOf(info, fx.away_team_id).tier,
        homeTactics: tacticsByTeam[fx.home_team_id] || null, awayTactics: tacticsByTeam[fx.away_team_id] || null,
      });
      await recordResult(league, fx, homeGoals, awayGoals, { info });
    }
  }
}

// Pone al día la liga cada vez que alguien la toca. Devuelve la liga y los miembros ya actualizados.
async function refreshLeague(league) {
  let members = await loadMembers(league.id);
  if (league.status === "in_progress") {
    await resolveWalkovers(league, members);
    league = await resolveAuto(league, members);
    members = await loadMembers(league.id);
  }
  return { league, members };
}

function parseDraftOrder(league) {
  if (!league.draft_order) return null;
  try {
    const order = JSON.parse(league.draft_order);
    return Array.isArray(order) ? order : null;
  } catch {
    return null;
  }
}

// De quién es el turno: el primero del orden sorteado que todavía no eligió
// equipo. Se calcula siempre así, no hace falta guardar un índice aparte que
// se pueda desincronizar.
function currentDraftTurn(league, members) {
  const order = parseDraftOrder(league);
  if (!order) return null;
  const byUser = new Map(members.map((m) => [m.user_id, m]));
  for (const userId of order) {
    const m = byUser.get(userId);
    if (m && !m.team_id) return userId;
  }
  return null;
}

function serializeLeague(league, members, userId) {
  const league_teams = teamsForLeague(league.league_key);
  const takenIds = new Set(members.map((m) => m.team_id).filter(Boolean));
  const draftOrder = parseDraftOrder(league);
  return {
    id: league.id,
    name: league.name,
    leagueKey: league.league_key,
    inviteCode: league.invite_code,
    status: league.status,
    groupId: league.group_id ?? null,
    currentWeek: league.current_week,
    totalWeeks: league.total_weeks,
    weeksPerMonth: league.weeks_per_month,
    season: Number(league.season || 1),
    currentMonth: Number(league.current_month || 1),
    market: league.status === "in_progress" ? (windowAt(Number(league.current_week || 0)) || null) : null,
    marketLabel: league.status === "in_progress" ? (WINDOW_LABEL[windowAt(Number(league.current_week || 0))] || null) : null,
    cpuDifficulty: league.cpu_difficulty || "media",
    createdBy: league.created_by,
    isMine: league.created_by === userId,
    draftMode: !!league.draft_mode,
    draftOrder,
    draftTurnUserId: league.draft_mode ? currentDraftTurn(league, members) : null,
    members: members.map((m) => ({
      userId: m.user_id,
      username: m.username,
      teamId: m.team_id,
      isMe: m.user_id === userId,
      expelled: !!m.expelled_at,
    })),
    availableTeams: league_teams.filter((t) => !takenIds.has(t.id)),
    allTeams: league_teams,
  };
}

// Sortea y congela el orden de turnos apenas hay 2+ miembros en una liga en
// modo draft que todavía no lo tiene. Quien se sume al lobby después del
// sorteo entra sin turno propio (edge case aceptado: el draft es para armar
// el grupo antes de arrancar, no para sumar gente sobre la marcha).
async function rollDraftOrderIfNeeded(league, members) {
  if (!league.draft_mode || league.draft_order || league.status !== "lobby" || members.length < 2) return league;
  const order = members.map((m) => m.user_id).sort(() => Math.random() - 0.5);
  await db.execute({
    sql: "UPDATE dt_leagues SET draft_order = ? WHERE id = ?",
    args: [JSON.stringify(order), league.id],
  });
  return { ...league, draft_order: JSON.stringify(order) };
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
  const groupId = Number(req.body?.groupId);
  const weeksPerMonth = clamp(Number(req.body?.weeksPerMonth) || 4, 1, 20);
  const draftMode = !!req.body?.draftMode;
  if (!name) return res.status(400).json({ error: "Ponele un nombre a la liga" });
  if (!["premier", "laliga", "seriea", "bundesliga"].includes(leagueKey)) return res.status(400).json({ error: "Liga inválida" });
  if (!groupId) return res.status(400).json({ error: "Elegí a qué grupo pertenece esta liga" });

  const creatorMembership = await db.execute({
    sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
    args: [groupId, req.userId],
  });
  if (!creatorMembership.rows.length) return res.status(403).json({ error: "No pertenecés a ese grupo" });

  let inviteCode;
  for (let i = 0; i < 10; i++) {
    const candidate = genInviteCode();
    const exists = await db.execute({ sql: "SELECT 1 FROM dt_leagues WHERE invite_code = ?", args: [candidate] });
    if (!exists.rows.length) { inviteCode = candidate; break; }
  }
  if (!inviteCode) return res.status(500).json({ error: "No se pudo generar un código, probá de nuevo" });

  const result = await db.execute({
    sql: "INSERT INTO dt_leagues (name, league_key, invite_code, created_by, group_id, weeks_per_month, draft_mode) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [name, leagueKey, inviteCode, req.userId, groupId, weeksPerMonth, draftMode ? 1 : 0],
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

  let league = await loadLeagueByCode(code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.status !== "lobby") return res.status(400).json({ error: "Esa liga ya arrancó, no se puede sumar más gente" });

  // Ligas de antes de esta restricción (sin group_id) quedan abiertas por
  // código como siempre; las nuevas son solo para gente del mismo grupo.
  if (league.group_id) {
    const groupMembership = await db.execute({
      sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
      args: [league.group_id, req.userId],
    });
    if (!groupMembership.rows.length) {
      return res.status(403).json({ error: "Esta liga es solo para miembros de su grupo" });
    }
  }

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
  league = await rollDraftOrderIfNeeded(league, members);
  res.json({ league: serializeLeague(league, members, req.userId) });
});

router.get("/:code", async (req, res) => {
  let league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });

  const { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });

  league = await rollDraftOrderIfNeeded(league, members);

  let list = members;
  if (league.status === "in_progress") ({ league, members: list } = await refreshLeague(league));

  res.json({ league: serializeLeague(league, list, req.userId) });
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

  if (league.draft_mode && !league.draft_order) {
    return res.status(400).json({ error: "Esta liga es a draft — esperá a que se sume alguien más para sortear el orden de turnos." });
  }
  if (league.draft_mode && league.draft_order && !me.team_id) {
    const turnUserId = currentDraftTurn(league, members);
    if (turnUserId !== null && turnUserId !== req.userId) {
      const turnMember = members.find((m) => m.user_id === turnUserId);
      return res.status(400).json({ error: `Es el turno de ${turnMember?.username || "otro jugador"}, esperá tu turno.` });
    }
  }

  await db.execute({
    sql: "UPDATE dt_league_members SET team_id = ? WHERE league_id = ? AND user_id = ?",
    args: [teamId, league.id, req.userId],
  });

  const updatedMembers = await loadMembers(league.id);
  res.json({ league: serializeLeague(league, updatedMembers, req.userId) });
});

// Solo el creador puede arrancar la temporada, y solo cuando todos eligieron
// equipo. Arma el calendario de ida y vuelta con TODOS los equipos de la
// liga (los que nadie eligió quedan controlados por la CPU), agrupado en
// meses según weeks_per_month.
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

  await startSeason(league, members);

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

// Carrera del manager (plantel, formación, energía, cantera y tácticas). El cliente la guarda
// y el servidor conserva el JSON; de acá sale la fuerza real del once con la que se juegan
// sus partidos. Solo la ve y la edita el propio manager.
router.get("/:code/squad", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (!me.team_id) return res.json({ teamId: null, state: null, week: league.current_week });
  const row = (await db.execute({
    sql: "SELECT state, power FROM dt_league_squads WHERE league_id = ? AND user_id = ? AND team_id = ?",
    args: [league.id, req.userId, me.team_id],
  })).rows[0];
  let state = null;
  try { state = row ? JSON.parse(row.state) : null; } catch { state = null; }
  res.json({ teamId: me.team_id, state, power: row?.power ?? null, week: league.current_week, cpuDifficulty: league.cpu_difficulty || "media" });
});

router.put("/:code/squad", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (!me.team_id) return res.status(400).json({ error: "Todavía no elegiste equipo" });
  const state = req.body?.state;
  if (!isValidSquadState(state) || state.teamId !== me.team_id) return res.status(400).json({ error: "El plantel enviado no es válido" });
  const json = JSON.stringify(state);
  if (json.length > MAX_SQUAD_STATE_BYTES) return res.status(413).json({ error: "El plantel es demasiado grande" });

  const power = squadPower(state);
  await db.execute({
    sql: `INSERT INTO dt_league_squads (league_id, user_id, team_id, state, power)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(league_id, user_id) DO UPDATE SET
            team_id = excluded.team_id, state = excluded.state, power = excluded.power, updated_at = datetime('now')`,
    args: [league.id, req.userId, me.team_id, json, power],
  });
  // La táctica de la carrera y la fuerza del once pasan a la liga: es lo que usa el resultado de sus partidos.
  const t = tacticsOf(state);
  await db.execute({
    sql: `INSERT INTO dt_league_tactics (league_id, team_id, mentality, pressing, tempo, power)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(league_id, team_id) DO UPDATE SET
            mentality = excluded.mentality, pressing = excluded.pressing, tempo = excluded.tempo,
            power = excluded.power, updated_at = datetime('now')`,
    args: [league.id, me.team_id, t.mentality, t.pressing, t.tempo, power],
  });
  res.json({ ok: true, power });
});

// Dificultad de los clubes CPU: la cambia quien creó la liga, antes de que arranque.
router.post("/:code/difficulty", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó la liga puede cambiar la dificultad" });
  if (league.status !== "lobby") return res.status(400).json({ error: "La liga ya arrancó, no se puede cambiar la dificultad" });
  const id = String(req.body?.difficulty || "");
  if (!(id in CPU_DIFFICULTY_BIAS)) return res.status(400).json({ error: "Dificultad inválida" });
  await db.execute({ sql: "UPDATE dt_leagues SET cpu_difficulty = ? WHERE id = ?", args: [id, league.id] });
  res.json({ ok: true, cpuDifficulty: id });
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

// Todos los partidos del mes (el actual, o el que se pida por query), con liga, copas y torneos
// europeos, y lo necesario para que el cliente decida qué botón mostrar por partido.
router.get("/:code/fixtures", async (req, res) => {
  let league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  let { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (league.status === "in_progress") ({ league, members } = await refreshLeague(league));
  me = members.find((m) => m.user_id === req.userId) || me;

  const totalMonths = await totalMonthsOf(league);
  const activeMonth = await activeMonthOf(league);
  const month = req.query.month ? Number(req.query.month) : activeMonth;
  const season = Number(league.season || 1);

  const result = await db.execute({
    sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND month = ? ORDER BY week, id",
    args: [league.id, season, month],
  });

  const info = await clubInfo(league, members);
  const nameOf = (id) => TEAMS.find((t) => t.id === id)?.name || id;
  const memberByTeam = Object.fromEntries(humansOf(members).map((m) => [m.team_id, m]));

  // "El clásico" de cada jornada: el partido de liga sin jugar más importante (el de menor suma de
  // niveles, o sea los clubes más grandes), y a igualdad el que enfrenta a dos humanos.
  const byWeek = {};
  for (const r of result.rows) {
    if (r.played || r.comp !== "liga") continue;
    (byWeek[r.week] ||= []).push(r);
  }
  const clasicoIdByWeek = {};
  for (const [week, fixtures] of Object.entries(byWeek)) {
    let best = null;
    let bestScore = Infinity;
    for (const fx of fixtures) {
      const levelSum = infoOf(info, fx.home_team_id).level + infoOf(info, fx.away_team_id).level;
      const isPvp = !!memberByTeam[fx.home_team_id] && !!memberByTeam[fx.away_team_id];
      const score = levelSum - (isPvp ? 0.5 : 0);
      if (score < bestScore) { bestScore = score; best = fx; }
    }
    if (best) clasicoIdByWeek[week] = best.id;
  }

  res.json({
    month,
    activeMonth,
    totalMonths,
    totalWeeks: league.total_weeks,
    season,
    fixtures: result.rows.map((r) => {
      const homeManager = memberByTeam[r.home_team_id] || null;
      const awayManager = memberByTeam[r.away_team_id] || null;
      const bye = r.home_team_id === r.away_team_id;
      const isPvp = !!homeManager && !!awayManager;
      const myTeamId = me.team_id;
      const involvesMe = !!myTeamId && (r.home_team_id === myTeamId || r.away_team_id === myTeamId);
      const locked = r.month > activeMonth;
      const label = labelForFixture(league, r);
      const hi = infoOf(info, r.home_team_id), ai = infoOf(info, r.away_team_id);
      return {
        id: r.id,
        week: r.week,
        month: r.month,
        comp: r.comp || "liga",
        compLabel: label.compLabel,
        roundLabel: label.roundLabel,
        bye,
        homeTeamId: r.home_team_id,
        awayTeamId: r.away_team_id,
        homeTeamName: nameOf(r.home_team_id),
        awayTeamName: nameOf(r.away_team_id),
        homeLevel: hi.level, homeTier: hi.tier, awayLevel: ai.level, awayTier: ai.tier,
        homeManager: homeManager?.username || null,
        awayManager: awayManager?.username || null,
        homeGoals: r.home_goals,
        awayGoals: r.away_goals,
        winner: r.winner || null,
        played: !!r.played,
        walkover: r.walkover && r.walkover !== "bye" ? r.walkover : null,
        isPvp,
        involvesMe,
        locked,
        canPlaySolo: involvesMe && !isPvp && !r.played && !bye && !locked,
        canPlayLive: involvesMe && isPvp && !r.played && !locked,
        isClasico: clasicoIdByWeek[r.week] === r.id,
      };
    }),
  });
});

// Resuelve al instante un partido humano-vs-CPU: no hace falta esperar a nadie, así que el humano lo
// juega cuando quiera (dentro del mes actual). Si el rival también es humano, va por /live.
router.post("/:code/fixtures/:fixtureId/play", async (req, res) => {
  let league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  let { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (!me.team_id) return res.status(400).json({ error: "Todavía no elegiste equipo" });
  if (league.status !== "in_progress") return res.status(400).json({ error: "La liga no está en curso" });

  const fxResult = await db.execute({
    sql: "SELECT * FROM dt_league_fixtures WHERE id = ? AND league_id = ?",
    args: [req.params.fixtureId, league.id],
  });
  const fx = fxResult.rows[0];
  if (!fx) return res.status(404).json({ error: "Partido no encontrado" });
  if (fx.played) return res.status(400).json({ error: "Ese partido ya se jugó" });
  if (fx.home_team_id !== me.team_id && fx.away_team_id !== me.team_id) {
    return res.status(403).json({ error: "Ese partido no es tuyo" });
  }
  if (fx.month > Number(league.current_month || 1)) {
    return res.status(400).json({ error: "Ese mes todavía no empezó: primero tienen que cerrar el mes actual todos los jugadores." });
  }

  const humanTeams = new Set(humansOf(members).map((m) => m.team_id));
  const opponentTeamId = fx.home_team_id === me.team_id ? fx.away_team_id : fx.home_team_id;
  if (humanTeams.has(opponentTeamId)) {
    return res.status(400).json({ error: "Tu rival en este partido es otro jugador — se juega en vivo" });
  }

  const info = await clubInfo(league, members);
  const tacticsResult = await db.execute({
    sql: "SELECT team_id, mentality, pressing, tempo, power FROM dt_league_tactics WHERE league_id = ? AND team_id IN (?, ?)",
    args: [league.id, fx.home_team_id, fx.away_team_id],
  });
  const tacticsByTeam = Object.fromEntries(tacticsResult.rows.map((r) => [r.team_id, r]));

  // El rival es un club CPU: la dificultad de la liga le ajusta el nivel.
  const cpuBias = cpuBiasOf(league);
  const { homeGoals, awayGoals } = simulateFixture({
    homeTier: infoOf(info, fx.home_team_id).tier,
    awayTier: infoOf(info, fx.away_team_id).tier,
    homeTactics: tacticsByTeam[fx.home_team_id] || null,
    awayTactics: tacticsByTeam[fx.away_team_id] || null,
    homeRating: infoOf(info, fx.home_team_id).rating,
    awayRating: infoOf(info, fx.away_team_id).rating,
    homeBias: opponentTeamId === fx.home_team_id ? cpuBias : 0,
    awayBias: opponentTeamId === fx.away_team_id ? cpuBias : 0,
  });
  await recordResult(league, fx, homeGoals, awayGoals, { info });
  await touchMember(league.id, req.userId);
  const after = (await db.execute({ sql: "SELECT winner FROM dt_league_fixtures WHERE id = ?", args: [fx.id] })).rows[0];
  const { league: fresh } = await refreshLeague(league);

  res.json({ ok: true, homeGoals, awayGoals, winner: after?.winner || null, penalties: !!after?.winner && homeGoals === awayGoals, monthAdvanced: Number(fresh.current_month) !== Number(league.current_month) });
});

// Datos que necesita el cliente para conectarse al partido en vivo por WebSocket (ver server/dt-live.js).
router.get("/:code/fixtures/:fixtureId/live", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });

  const fxResult = await db.execute({
    sql: "SELECT * FROM dt_league_fixtures WHERE id = ? AND league_id = ?",
    args: [req.params.fixtureId, league.id],
  });
  const fx = fxResult.rows[0];
  if (!fx) return res.status(404).json({ error: "Partido no encontrado" });
  if (fx.played) return res.status(400).json({ error: "Ese partido ya se jugó" });
  if (fx.month > Number(league.current_month || 1)) return res.status(400).json({ error: "Ese mes todavía no empezó" });
  // No hace falta ser vos el que juega: cualquiera de la liga puede entrar a mirar en vivo.
  const humanTeams = new Set(humansOf(members).map((m) => m.team_id));
  if (!humanTeams.has(fx.home_team_id) || !humanTeams.has(fx.away_team_id)) {
    return res.status(400).json({ error: "Este partido no enfrenta a dos jugadores — jugalo con /play" });
  }

  res.json({ fixtureId: fx.id, allowedSpeeds: ALLOWED_SPEEDS });
});

router.get("/:code/standings", async (req, res) => {
  let league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  let { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (league.status === "in_progress") ({ league, members } = await refreshLeague(league));

  const teams = teamsForLeague(league.league_key);
  const rows = (await db.execute({
    sql: "SELECT home_team_id, away_team_id, home_goals, away_goals FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND comp = 'liga' AND played = 1",
    args: [league.id, Number(league.season || 1)],
  })).rows;
  const standings = standingsFrom(teams.map((t) => t.id), rows);
  const info = await clubInfo(league, members);
  const nameByTeam = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const managerByTeam = Object.fromEntries(humansOf(members).map((m) => [m.team_id, m.username]));

  res.json({
    standings: standings.map((s, i) => ({
      ...s,
      position: i + 1,
      teamName: nameByTeam[s.teamId] || s.teamId,
      manager: managerByTeam[s.teamId] || null,
      level: info[s.teamId]?.level ?? null,
      tier: info[s.teamId]?.tier ?? null,
      expectedPosition: info[s.teamId] ? expectedPosition(info[s.teamId].level, teams.length) : null,
    })),
  });
});

// Legacy: botón de conveniencia para poner al día la liga (resuelve lo que no necesita humanos).
router.post("/:code/advance", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (league.status !== "in_progress") return res.status(400).json({ error: "La liga no está en curso" });

  const { league: fresh } = await refreshLeague(league);
  res.json({ ok: true, activeMonth: Number(fresh.current_month || 1), totalMonths: await totalMonthsOf(fresh), finished: fresh.status === "finished" });
});

// ---- Mes: quién falta, "Listo", multas y expulsión ----
async function monthPayload(league, members, userId) {
  const st = await monthStatus(league, members);
  const humans = Object.values(st.humans);
  const total = await totalMonthsOf(league);
  const mine = st.humans[userId] || null;
  const doneCount = humans.filter((h) => h.done).length;
  const someoneWaiting = doneCount > 0 && doneCount < humans.length;
  let overdue = null;
  if (mine && !mine.done && someoneWaiting) {
    const me = members.find((m) => m.user_id === userId);
    const firstReady = Math.min(...members.filter((m) => st.humans[m.user_id]?.done).map((m) => parseSql(m.ready_at) || Date.now()));
    const since = Math.max(parseSql(me.last_active_at) || 0, parseSql(league.month_started_at) || 0, firstReady);
    overdue = { since: new Date(since).toISOString(), expelAt: new Date(since + EXPEL_AFTER_DAYS * 86400000).toISOString(), daysElapsed: Math.floor((Date.now() - since) / 86400000) };
  }
  const fines = await pendingBudgetAdjustment(league.id, userId);
  return {
    season: Number(league.season || 1),
    month: st.month,
    totalMonths: total,
    status: league.status,
    humans: humans.map((h) => ({ userId: h.userId, username: h.username, pendingMatches: h.pendingMatches, ready: h.ready, done: h.done })),
    me: mine,
    someoneWaiting,
    overdue,
    finePerDay: FINE_PER_DAY,
    expelAfterDays: EXPEL_AFTER_DAYS,
    pendingFines: fines.total,
  };
}

router.get("/:code/month", async (req, res) => {
  let league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  let { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (league.status === "in_progress") ({ league, members } = await refreshLeague(league));
  res.json(await monthPayload(league, members, req.userId));
});

// "Listo": quien ya jugó todos sus partidos del mes avisa que terminó. Cuando todos los humanos
// están listos, el mes pasa solo. Se puede deshacer hasta que el mes avance.
router.post("/:code/ready", async (req, res) => {
  let league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  let { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (league.status !== "in_progress") return res.status(400).json({ error: "La liga no está en curso" });
  if (!me.team_id) return res.status(400).json({ error: "Ya no tenés un club en esta liga" });
  const wantReady = req.body?.ready !== false;
  const month = Number(league.current_month || 1);

  if (wantReady) {
    const st = await monthStatus(league, members);
    const mine = st.humans[req.userId];
    if (mine && mine.pendingMatches > 0) {
      return res.status(400).json({ error: `Te faltan ${mine.pendingMatches} partido${mine.pendingMatches === 1 ? "" : "s"} de este mes (liga y copas) para poder cerrar el mes.` });
    }
    await db.execute({ sql: "UPDATE dt_league_members SET ready_month = ?, ready_at = datetime('now'), last_active_at = datetime('now') WHERE league_id = ? AND user_id = ?", args: [month, league.id, req.userId] });
  } else {
    await db.execute({ sql: "UPDATE dt_league_members SET ready_month = ?, ready_at = NULL, last_active_at = datetime('now') WHERE league_id = ? AND user_id = ?", args: [month - 1, league.id, req.userId] });
  }

  ({ league, members } = await refreshLeague(league));
  res.json({ ...(await monthPayload(league, members, req.userId)), monthAdvanced: Number(league.current_month) !== month });
});

// ---- Multas y ajustes de presupuesto que el club del manager todavía no aplicó ----
router.get("/:code/budget-adjustments", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  res.json(await pendingBudgetAdjustment(league.id, req.userId));
});

router.post("/:code/budget-adjustments/ack", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  res.json(await pendingBudgetAdjustment(league.id, req.userId, { markApplied: true }));
});

// ---- Ofertas de clubes CPU por jugadores del manager (mercados de verano e invierno) ----
router.get("/:code/cpu-offers", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  const rows = (await db.execute({
    sql: "SELECT * FROM dt_league_cpu_offers WHERE league_id = ? AND to_user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 30",
    args: [league.id, req.userId],
  })).rows;
  res.json({
    offers: rows.map((o) => ({
      id: o.id, teamId: o.team_id, teamName: TEAMS.find((t) => t.id === o.team_id)?.name || o.team_id,
      playerId: o.player_id, playerName: o.player_name, ovr: o.ovr, amount: o.amount, window: o.window, windowLabel: WINDOW_LABEL[o.window] || null,
    })),
  });
});

router.post("/:code/cpu-offers/:offerId/respond", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  const offer = await resolveCpuOffer(league, Number(req.params.offerId), req.userId, !!req.body?.accept);
  if (!offer) return res.status(404).json({ error: "Esa oferta ya no está disponible" });
  res.json({ ok: true, accepted: !!req.body?.accept });
});

// ---- Liga de puntaje: lo que va sumando cada humano frente a lo que se esperaba de su club ----
router.get("/:code/score", async (req, res) => {
  let league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  let { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (league.status === "in_progress") ({ league, members } = await refreshLeague(league));
  const season = Number(league.season || 1);
  const info = await clubInfo(league, members);
  const teams = teamsForLeague(league.league_key);
  const rows = (await db.execute({
    sql: "SELECT home_team_id, away_team_id, home_goals, away_goals FROM dt_league_fixtures WHERE league_id = ? AND season = ? AND comp = 'liga' AND played = 1",
    args: [league.id, season],
  })).rows;
  const table = standingsFrom(teams.map((t) => t.id), rows);
  const weekly = (await db.execute({
    sql: "SELECT user_id, week, points FROM dt_league_weekly_scores WHERE league_id = ? AND week >= ? AND week < ? ORDER BY week",
    args: [league.id, weekCode(season, 0), weekCode(season, 0) + 100],
  })).rows;
  const history = (await db.execute({ sql: "SELECT * FROM dt_league_history WHERE league_id = ? ORDER BY season DESC", args: [league.id] })).rows;

  const board = humansOf(members).map((m) => {
    const mine = weekly.filter((w) => w.user_id === m.user_id);
    const pos = table.findIndex((s) => s.teamId === m.team_id) + 1;
    const ci = info[m.team_id];
    return {
      userId: m.user_id, username: m.username, teamId: m.team_id,
      teamName: teams.find((t) => t.id === m.team_id)?.name || m.team_id,
      points: mine.reduce((s, w) => s + Number(w.points), 0),
      lastWeeks: mine.slice(-6).map((w) => ({ week: w.week % 100, points: Number(w.points) })),
      level: ci?.level ?? null, tier: ci?.tier ?? null,
      position: pos || null,
      expectedPosition: ci ? expectedPosition(ci.level, teams.length) : null,
      isMe: m.user_id === req.userId,
    };
  }).sort((a, b) => b.points - a.points);

  res.json({
    season,
    board,
    history: history.map((h) => ({
      season: h.season, userId: h.user_id, username: members.find((m) => m.user_id === h.user_id)?.username || "?",
      teamName: teams.find((t) => t.id === h.team_id)?.name || h.team_id, position: h.position, points: h.points,
    })),
  });
});

// Arranca la temporada siguiente (solo quien creó la liga, con la anterior terminada). El puntaje
// se reinicia pero queda el historial; los torneos europeos se arman con la tabla final.
router.post("/:code/next-season", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.created_by !== req.userId) return res.status(403).json({ error: "Solo quien creó la liga puede arrancar la temporada siguiente" });
  if (league.status !== "finished") return res.status(400).json({ error: "La temporada actual todavía no terminó" });
  const members = await loadMembers(league.id);
  await db.execute({ sql: "UPDATE dt_leagues SET season = season + 1 WHERE id = ?", args: [league.id] });
  const next = { ...league, season: Number(league.season || 1) + 1 };
  await startSeason(next, members);
  const fresh = await loadLeagueByCode(req.params.code);
  res.json({ league: serializeLeague(fresh, await loadMembers(league.id), req.userId) });
});

// Mercado de pases entre DTs: proponerle a otro manager de la liga
// intercambiar los clubes que dirigen de ahí en más. Sólo durante la
// temporada en curso, sólo entre dos managers con club asignado.
router.post("/:code/trade", async (req, res) => {
  const toUserId = Number(req.body?.toUserId);
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  if (league.status !== "in_progress") return res.status(400).json({ error: "Solo se puede negociar con la temporada en curso" });

  const { members, me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });
  if (!me.team_id) return res.status(400).json({ error: "Todavía no tenés un club para ofrecer" });
  if (toUserId === req.userId) return res.status(400).json({ error: "No podés proponerte un cambio a vos mismo" });

  const target = members.find((m) => m.user_id === toUserId);
  if (!target || !target.team_id) return res.status(400).json({ error: "Ese jugador no tiene un club en esta liga" });

  const existing = await db.execute({
    sql: `SELECT id FROM dt_league_trades WHERE league_id = ? AND status = 'pending'
          AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))`,
    args: [league.id, req.userId, toUserId, toUserId, req.userId],
  });
  if (existing.rows.length) return res.status(409).json({ error: "Ya hay una propuesta pendiente entre ustedes dos" });

  const result = await db.execute({
    sql: "INSERT INTO dt_league_trades (league_id, from_user_id, to_user_id) VALUES (?, ?, ?)",
    args: [league.id, req.userId, toUserId],
  });
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// Mis propuestas (mandadas y recibidas) en esta liga.
router.get("/:code/trades", async (req, res) => {
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });

  const result = await db.execute({
    sql: `SELECT t.*, uf.username AS from_username, ut.username AS to_username
          FROM dt_league_trades t
          JOIN users uf ON uf.id = t.from_user_id
          JOIN users ut ON ut.id = t.to_user_id
          WHERE t.league_id = ? AND (t.from_user_id = ? OR t.to_user_id = ?)
          ORDER BY t.created_at DESC LIMIT 20`,
    args: [league.id, req.userId, req.userId],
  });

  const nameByTeam = Object.fromEntries(teamsForLeague(league.league_key).map((t) => [t.id, t.name]));
  const { members } = await requireMembership(league, req.userId);
  const teamByUser = Object.fromEntries(members.map((m) => [m.user_id, m.team_id]));

  res.json({
    trades: result.rows.map((t) => ({
      id: t.id,
      status: t.status,
      fromUserId: t.from_user_id,
      fromUsername: t.from_username,
      fromTeamName: nameByTeam[teamByUser[t.from_user_id]] || null,
      toUserId: t.to_user_id,
      toUsername: t.to_username,
      toTeamName: nameByTeam[teamByUser[t.to_user_id]] || null,
      isMine: t.from_user_id === req.userId,
    })),
  });
});

router.post("/:code/trade/:tradeId/respond", async (req, res) => {
  const accept = !!req.body?.accept;
  const league = await loadLeagueByCode(req.params.code);
  if (!league) return res.status(404).json({ error: "No existe ninguna liga con ese código" });
  const { me } = await requireMembership(league, req.userId);
  if (!me) return res.status(403).json({ error: "No sos parte de esta liga" });

  const tradeResult = await db.execute({
    sql: "SELECT * FROM dt_league_trades WHERE id = ? AND league_id = ?",
    args: [req.params.tradeId, league.id],
  });
  const trade = tradeResult.rows[0];
  if (!trade) return res.status(404).json({ error: "Propuesta no encontrada" });
  if (trade.status !== "pending") return res.status(400).json({ error: "Esta propuesta ya se resolvió" });
  if (trade.to_user_id !== req.userId) return res.status(403).json({ error: "Esta propuesta no es para vos" });

  if (!accept) {
    await db.execute({
      sql: "UPDATE dt_league_trades SET status = 'rejected', resolved_at = datetime('now') WHERE id = ?",
      args: [trade.id],
    });
    return res.json({ ok: true, accepted: false });
  }

  const membersResult = await db.execute({
    sql: "SELECT user_id, team_id FROM dt_league_members WHERE league_id = ? AND user_id IN (?, ?)",
    args: [league.id, trade.from_user_id, trade.to_user_id],
  });
  const fromRow = membersResult.rows.find((m) => m.user_id === trade.from_user_id);
  const toRow = membersResult.rows.find((m) => m.user_id === trade.to_user_id);
  if (!fromRow?.team_id || !toRow?.team_id) {
    await db.execute({
      sql: "UPDATE dt_league_trades SET status = 'cancelled', resolved_at = datetime('now') WHERE id = ?",
      args: [trade.id],
    });
    return res.status(400).json({ error: "Uno de los dos ya no tiene un club para intercambiar" });
  }

  // El índice único (league_id, team_id) no deja tener dos filas con el mismo
  // club ni un instante: hay que pasar por NULL en el medio del intercambio.
  await db.execute({
    sql: "UPDATE dt_league_members SET team_id = NULL WHERE league_id = ? AND user_id = ?",
    args: [league.id, trade.from_user_id],
  });
  await db.execute({
    sql: "UPDATE dt_league_members SET team_id = ? WHERE league_id = ? AND user_id = ?",
    args: [fromRow.team_id, league.id, trade.to_user_id],
  });
  await db.execute({
    sql: "UPDATE dt_league_members SET team_id = ? WHERE league_id = ? AND user_id = ?",
    args: [toRow.team_id, league.id, trade.from_user_id],
  });
  await db.execute({
    sql: "UPDATE dt_league_trades SET status = 'accepted', resolved_at = datetime('now') WHERE id = ?",
    args: [trade.id],
  });

  res.json({ ok: true, accepted: true });
});

export default router;
