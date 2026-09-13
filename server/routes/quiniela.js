import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { LEAGUES, getFixturesByDate } from "../utils/football-api.js";
import { todayStr, addDays } from "../utils/points.js";

const EXACT_POINTS = 5;
const RESULT_POINTS = 2;

function resultOf(home, away) {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function pointsFor(predictedHome, predictedAway, actualHome, actualAway) {
  if (predictedHome === actualHome && predictedAway === actualAway) return EXACT_POINTS;
  return resultOf(predictedHome, predictedAway) === resultOf(actualHome, actualAway) ? RESULT_POINTS : 0;
}

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

function requireLeague(req, res) {
  const key = req.query.league || req.body?.league;
  if (!LEAGUES[key]) {
    res.status(400).json({ error: "Liga desconocida" });
    return null;
  }
  return key;
}

// Puntúa "perezoso": cualquier predicción mía sin puntuar cuyo partido ya
// tenga un estado final se resuelve acá mismo, comparando contra el
// resultado real que devuelva la API en ese momento (con su propio caché).
async function scorePendingPredictions(userId) {
  const pending = await db.execute({
    sql: "SELECT * FROM quiniela_predictions WHERE user_id = ? AND scored = 0",
    args: [userId],
  });
  if (pending.rows.length === 0) return;

  // Agrupa por liga+fecha para no pedir el mismo día dos veces.
  const byKey = new Map();
  for (const p of pending.rows) {
    const key = `${p.league}:${p.fixture_date}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(p);
  }

  for (const [key, preds] of byKey) {
    const [league, date] = key.split(":");
    let fixtures;
    try {
      const { data } = await getFixturesByDate(league, date);
      fixtures = data;
    } catch {
      continue; // la API falló para ese día — se reintenta la próxima vez que se pida
    }
    for (const pred of preds) {
      const fx = fixtures.find((f) => f.fixture.id === pred.fixture_id);
      if (!fx || !FINISHED_STATUSES.has(fx.fixture.status.short)) continue;
      const actualHome = fx.goals.home;
      const actualAway = fx.goals.away;
      if (actualHome === null || actualAway === null) continue;
      const points = pointsFor(pred.predicted_home, pred.predicted_away, actualHome, actualAway);
      await db.execute({
        sql: "UPDATE quiniela_predictions SET actual_home = ?, actual_away = ?, points = ?, scored = 1 WHERE id = ?",
        args: [actualHome, actualAway, points, pred.id],
      });
    }
  }
}

const router = Router();
router.use(requireAuth);

// Los siete próximos días de una liga, solo los partidos que todavía no
// arrancaron (los únicos en los que tiene sentido predecir). Si el primer
// día viene bloqueado por el plan de la API, ni se molesta en pedir el
// resto — es la misma limitación para todos los días.
router.get("/week", async (req, res) => {
  const league = requireLeague(req, res);
  if (!league) return;

  try {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i));
    const fixtures = [];
    let blockedByPlan = false;

    for (const date of dates) {
      const { data, blocked_by_plan } = await getFixturesByDate(league, date);
      if (blocked_by_plan) { blockedByPlan = true; break; }
      for (const fx of data) {
        if (fx.fixture.status.short !== "NS") continue;
        fixtures.push({
          id: fx.fixture.id,
          date: fx.fixture.date,
          home: { name: fx.teams.home.name, logo: fx.teams.home.logo },
          away: { name: fx.teams.away.name, logo: fx.teams.away.logo },
        });
      }
    }

    res.json({ league, fixtures, blocked_by_plan: blockedByPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/predict", async (req, res) => {
  const league = requireLeague(req, res);
  if (!league) return;
  const fixtureId = Number(req.body?.fixture_id);
  const fixtureDate = String(req.body?.fixture_date || "").slice(0, 10);
  const homeTeam = String(req.body?.home_team || "").slice(0, 80);
  const awayTeam = String(req.body?.away_team || "").slice(0, 80);
  const predictedHome = Number(req.body?.predicted_home);
  const predictedAway = Number(req.body?.predicted_away);

  if (!fixtureId || !fixtureDate || !homeTeam || !awayTeam) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }
  if (!Number.isInteger(predictedHome) || !Number.isInteger(predictedAway) || predictedHome < 0 || predictedAway < 0 || predictedHome > 20 || predictedAway > 20) {
    return res.status(400).json({ error: "Marcador inválido" });
  }

  try {
    // Se revalida en el momento que el partido siga sin arrancar — no alcanza
    // con confiar en lo que mandó el cliente, pudo haber arrancado mientras
    // tanto.
    const { data, blocked_by_plan } = await getFixturesByDate(league, fixtureDate);
    if (blocked_by_plan) return res.status(503).json({ error: "La quiniela no está disponible ahora mismo (plan de la API de fútbol)" });
    const fx = data.find((f) => f.fixture.id === fixtureId);
    if (!fx) return res.status(404).json({ error: "Ese partido no existe" });
    if (fx.fixture.status.short !== "NS") return res.status(400).json({ error: "Ese partido ya arrancó — es tarde para predecirlo" });

    await db.execute({
      sql: `INSERT INTO quiniela_predictions (user_id, league, fixture_id, fixture_date, home_team, away_team, predicted_home, predicted_away)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, fixture_id) DO UPDATE SET predicted_home = excluded.predicted_home, predicted_away = excluded.predicted_away`,
      args: [req.userId, league, fixtureId, fixtureDate, homeTeam, awayTeam, predictedHome, predictedAway],
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/mine", async (req, res) => {
  try {
    await scorePendingPredictions(req.userId);
    const result = await db.execute({
      sql: `SELECT * FROM quiniela_predictions WHERE user_id = ? ORDER BY fixture_date DESC, id DESC LIMIT 60`,
      args: [req.userId],
    });
    res.json({
      predictions: result.rows.map((p) => ({
        id: p.id,
        league: p.league,
        fixture_id: p.fixture_id,
        fixture_date: p.fixture_date,
        home_team: p.home_team,
        away_team: p.away_team,
        predicted_home: p.predicted_home,
        predicted_away: p.predicted_away,
        actual_home: p.actual_home,
        actual_away: p.actual_away,
        points: p.points,
        scored: !!p.scored,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
