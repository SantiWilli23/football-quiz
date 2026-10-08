import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { LEAGUES, FootballApiError, getStandings, currentSeason } from "../utils/football-api.js";
import { SEASON_CHAMPION_POINTS, SEASON_RELEGATED_POINTS } from "../utils/points-config.js";
import { windowStatus, regionOfLeague } from "../utils/season-windows.js";

const router = Router();
router.use(requireAuth);

// Las 5 grandes de Europa y la Primera chilena (hoy un todos-contra-todos de
// ida y vuelta de 16 equipos, así que la heurística de fin de temporada de
// abajo le sirve igual). En Chile bajan 2; en las europeas se piden 3.
const ALLOWED_LEAGUES = Object.keys(LEAGUES);
const RELEGATED_COUNT = (league) => (league === "chile" ? 2 : 3);

// Solo se predice al inicio o al final de la temporada de cada región (ver
// utils/season-windows.js). Lo que se predice al final vale la mitad.
const PHASE_FACTOR = { inicio: 1, final: 0.5 };

function handleFootballError(err, res) {
  if (err instanceof FootballApiError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Error del servidor" });
}

async function tableFor(league) {
  const { data, demo } = await getStandings(league);
  const table = (data[0]?.league?.standings?.[0] ?? []).map((row) => ({
    id: row.team.id,
    name: row.team.name,
    played: row.all.played,
    rank: row.rank,
  }));
  return { table, demo };
}

// Tabla para armar el picker de campeón/descenso.
router.get("/:league/table", async (req, res) => {
  const league = req.params.league;
  if (!ALLOWED_LEAGUES.includes(league)) return res.status(404).json({ error: "Liga desconocida" });
  try {
    const { table, demo } = await tableFor(league);
    res.json({ table, demo, relegatedCount: RELEGATED_COUNT(league), window: windowStatus(regionOfLeague(league)) });
  } catch (err) {
    handleFootballError(err, res);
  }
});

router.post("/:league/predict", async (req, res) => {
  const league = req.params.league;
  if (!ALLOWED_LEAGUES.includes(league)) return res.status(404).json({ error: "Liga desconocida" });

  const win = windowStatus(regionOfLeague(league));
  if (!win.open) {
    return res.status(403).json({ error: `Las predicciones de ${win.label} abren solo en las vacaciones de verano (próxima: ${win.next.date})` });
  }

  const count = RELEGATED_COUNT(league);
  const championTeamId = Number(req.body?.championTeamId);
  const championTeamName = String(req.body?.championTeamName || "");
  const relegated = Array.isArray(req.body?.relegated) ? req.body.relegated.slice(0, count) : [];
  if (!championTeamId || !championTeamName) return res.status(400).json({ error: "Falta elegir un campeón" });
  if (relegated.length !== count || relegated.some((t) => !t?.id || !t?.name)) {
    return res.status(400).json({ error: `Elegí exactamente ${count} equipos que crees que descienden` });
  }
  if (relegated.some((t) => Number(t.id) === championTeamId)) {
    return res.status(400).json({ error: "Un equipo no puede ser campeón y descender a la vez" });
  }

  const seasonYear = currentSeason(league);

  try {
    const existing = await db.execute({
      sql: "SELECT scored FROM season_predictions WHERE user_id = ? AND league = ? AND season_year = ?",
      args: [req.userId, league, seasonYear],
    });
    if (existing.rows[0]?.scored) {
      return res.status(409).json({ error: "Esta temporada ya se resolvió, no se puede cambiar la predicción" });
    }

    await db.execute({
      sql: `INSERT INTO season_predictions
              (user_id, league, season_year, champion_team_id, champion_team_name, relegated_team_ids, relegated_team_names, phase)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, league, season_year) DO UPDATE SET
              phase = excluded.phase,
              champion_team_id = excluded.champion_team_id,
              champion_team_name = excluded.champion_team_name,
              relegated_team_ids = excluded.relegated_team_ids,
              relegated_team_names = excluded.relegated_team_names`,
      args: [
        req.userId,
        league,
        seasonYear,
        championTeamId,
        championTeamName,
        JSON.stringify(relegated.map((t) => Number(t.id))),
        JSON.stringify(relegated.map((t) => t.name)),
        win.phase,
      ],
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

const CHAMPION_POINTS = SEASON_CHAMPION_POINTS;
const RELEGATED_POINTS = SEASON_RELEGATED_POINTS; // por cada equipo que sí bajó, hasta 3 = 21

// Intenta resolver una predicción pendiente contra la tabla real. No hace
// nada (devuelve la fila tal cual) si la tabla es de muestra (demo) o si
// todavía quedan bastantes partidos por jugar.
async function tryScore(pred) {
  if (pred.scored) return pred;
  let table, demo;
  try {
    ({ table, demo } = await tableFor(pred.league));
  } catch {
    return pred;
  }
  if (demo || table.length < 3) return pred;

  // "Temporada casi terminada": a nadie le quedan más de 2 partidos. Con
  // todos contra todos ida y vuelta, el total de fecha es (equipos-1)*2.
  const totalRounds = (table.length - 1) * 2;
  const allNearDone = table.every((t) => t.played >= totalRounds - 2);
  if (!allNearDone) return pred;

  const sorted = [...table].sort((a, b) => a.rank - b.rank);
  const champion = sorted[0];
  const relegatedActual = sorted.slice(-RELEGATED_COUNT(pred.league));
  const relegatedActualIds = relegatedActual.map((t) => t.id);

  const predictedRelegatedIds = JSON.parse(pred.relegated_team_ids || "[]");
  const championHit = champion.id === pred.champion_team_id;
  const relegatedHits = predictedRelegatedIds.filter((id) => relegatedActualIds.includes(id)).length;
  const raw = (championHit ? CHAMPION_POINTS : 0) + relegatedHits * RELEGATED_POINTS;
  const points = Math.round(raw * (PHASE_FACTOR[pred.phase] ?? 1));

  await db.execute({
    sql: `UPDATE season_predictions SET
            actual_champion_team_id = ?, actual_relegated_team_ids = ?, points = ?, scored = 1
          WHERE id = ?`,
    args: [champion.id, JSON.stringify(relegatedActualIds), points, pred.id],
  });

  return {
    ...pred,
    actual_champion_team_id: champion.id,
    actual_champion_team_name: champion.name,
    actual_relegated_team_ids: JSON.stringify(relegatedActualIds),
    actual_relegated_team_names: JSON.stringify(relegatedActual.map((t) => t.name)),
    points,
    scored: 1,
  };
}

router.get("/mine", async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM season_predictions WHERE user_id = ? ORDER BY created_at DESC",
      args: [req.userId],
    });

    const predictions = [];
    for (const row of result.rows) {
      predictions.push(await tryScore(row));
    }

    res.json({ predictions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
