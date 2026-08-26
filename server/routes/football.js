import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  FootballApiError,
  LEAGUES,
  getFixturesByDate,
  getLineups,
  getLiveFixtures,
  getStandings,
  getTopScorers,
  isConfigured,
} from "../utils/football-api.js";

const router = Router();
router.use(requireAuth);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function handleFootballError(err, res) {
  if (err instanceof FootballApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Error del servidor" });
}

function requireLeague(req, res) {
  const key = req.params.league;
  if (!LEAGUES[key]) {
    res.status(404).json({ error: "Liga desconocida" });
    return null;
  }
  return key;
}

// Simplifica lo que devuelve api-football a lo que la pantalla necesita, para
// no acoplar el cliente al formato exacto del proveedor (si el día de mañana
// se cambia de API, sólo se toca este mapeo).
function publicFixture(f) {
  return {
    id: f.fixture.id,
    date: f.fixture.date,
    status: f.fixture.status.short, // NS, 1H, HT, 2H, FT, PST, etc.
    minute: f.fixture.status.elapsed,
    venue: f.fixture.venue?.name ?? null,
    home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo, winner: f.teams.home.winner },
    away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo, winner: f.teams.away.winner },
    score: { home: f.goals.home, away: f.goals.away },
  };
}

router.get("/leagues", (req, res) => {
  res.json({
    configured: isConfigured(),
    leagues: Object.entries(LEAGUES).map(([key, l]) => ({ key, ...l })),
  });
});

router.get("/:league/live", async (req, res) => {
  const league = requireLeague(req, res);
  if (!league) return;
  try {
    const { data, stale } = await getLiveFixtures(league);
    res.json({ fixtures: data.map(publicFixture), stale });
  } catch (err) {
    handleFootballError(err, res);
  }
});

router.get("/:league/fixtures", async (req, res) => {
  const league = requireLeague(req, res);
  if (!league) return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : todayStr();
  try {
    const { data, stale } = await getFixturesByDate(league, date);
    res.json({ date, fixtures: data.map(publicFixture), stale });
  } catch (err) {
    handleFootballError(err, res);
  }
});

router.get("/:league/standings", async (req, res) => {
  const league = requireLeague(req, res);
  if (!league) return;
  try {
    const { data, stale } = await getStandings(league);
    const table = data[0]?.league?.standings?.[0] ?? [];
    res.json({
      stale,
      table: table.map((row) => ({
        position: row.rank,
        team: { id: row.team.id, name: row.team.name, logo: row.team.logo },
        played: row.all.played,
        won: row.all.win,
        drawn: row.all.draw,
        lost: row.all.lose,
        goals_for: row.all.goals.for,
        goals_against: row.all.goals.against,
        goal_diff: row.goalsDiff,
        points: row.points,
        form: row.form,
      })),
    });
  } catch (err) {
    handleFootballError(err, res);
  }
});

router.get("/:league/scorers", async (req, res) => {
  const league = requireLeague(req, res);
  if (!league) return;
  try {
    const { data, stale } = await getTopScorers(league);
    res.json({
      stale,
      scorers: data.map((entry) => ({
        player: { id: entry.player.id, name: entry.player.name, photo: entry.player.photo },
        team: entry.statistics[0]?.team
          ? { id: entry.statistics[0].team.id, name: entry.statistics[0].team.name, logo: entry.statistics[0].team.logo }
          : null,
        goals: entry.statistics[0]?.goals?.total ?? 0,
        assists: entry.statistics[0]?.goals?.assists ?? 0,
        appearances: entry.statistics[0]?.games?.appearences ?? 0,
      })),
    });
  } catch (err) {
    handleFootballError(err, res);
  }
});

router.get("/fixtures/:id/lineups", async (req, res) => {
  const fixtureId = Number(req.params.id);
  if (!fixtureId) return res.status(400).json({ error: "Falta el id del partido" });

  try {
    const { data, stale } = await getLineups(fixtureId);
    res.json({
      stale,
      lineups: data.map((team) => ({
        team: { id: team.team.id, name: team.team.name, logo: team.team.logo },
        formation: team.formation,
        coach: team.coach?.name ?? null,
        starters: team.startXI.map((p) => ({
          number: p.player.number,
          name: p.player.name,
          position: p.player.pos,
        })),
        substitutes: team.substitutes.map((p) => ({
          number: p.player.number,
          name: p.player.name,
          position: p.player.pos,
        })),
      })),
    });
  } catch (err) {
    handleFootballError(err, res);
  }
});

export default router;
