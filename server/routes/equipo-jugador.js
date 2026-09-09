import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { normalize } from "../db/seed-equipo-jugador.js";

const router = Router();
router.use(requireAuth);

function parseExclude(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

// Autocompletado: el cliente siempre elige de esta lista (nunca texto libre),
// así que no hace falta parsear/matchear nombres escritos a mano en ningún lado.
router.get("/players", async (req, res) => {
  const q = normalize(req.query.q || "");
  const exclude = parseExclude(req.query.exclude);
  if (q.length < 2) return res.json({ players: [] });

  const excludeClause = exclude.length ? `AND id NOT IN (${exclude.map(() => "?").join(",")})` : "";
  const result = await db.execute({
    sql: `SELECT id, name, nationality, position, birth_year FROM ej_players
          WHERE normalized_name LIKE ? ${excludeClause}
          ORDER BY LENGTH(name) ASC LIMIT 8`,
    args: [`%${q}%`, ...exclude],
  });
  res.json({ players: result.rows });
});

router.get("/clubs", async (req, res) => {
  const q = normalize(req.query.q || "");
  const exclude = parseExclude(req.query.exclude);
  if (q.length < 2) return res.json({ clubs: [] });

  const excludeClause = exclude.length ? `AND id NOT IN (${exclude.map(() => "?").join(",")})` : "";
  const result = await db.execute({
    sql: `SELECT id, name FROM ej_clubs
          WHERE normalized_name LIKE ? ${excludeClause}
          ORDER BY LENGTH(name) ASC LIMIT 8`,
    args: [`%${q}%`, ...exclude],
  });
  res.json({ clubs: result.rows });
});

// Jugador inicial al azar (con el que arranca la cadena). Se prefieren
// jugadores con 2+ clubes para que la partida tenga margen para desarrollarse.
router.get("/players/random", async (req, res) => {
  const exclude = parseExclude(req.query.exclude);
  const excludeClause = exclude.length ? `AND p.id NOT IN (${exclude.map(() => "?").join(",")})` : "";
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.nationality, p.position, p.birth_year, COUNT(pc.id) as club_count
          FROM ej_players p JOIN ej_player_clubs pc ON pc.player_id = p.id
          WHERE 1=1 ${excludeClause}
          GROUP BY p.id
          HAVING club_count >= 2
          ORDER BY RANDOM() LIMIT 1`,
    args: exclude,
  });
  const player = result.rows[0];
  if (!player) return res.status(404).json({ error: "No quedan jugadores disponibles" });
  res.json({ player });
});

// ¿Jugó este jugador en este club? Es la única validación que importa:
// alcanza para ambos sentidos de la cadena (jugador -> equipo y equipo -> jugador),
// porque el vínculo es el mismo par (player_id, club_id) sin importar el orden.
router.post("/check-link", async (req, res) => {
  const playerId = Number(req.body?.playerId);
  const clubId = Number(req.body?.clubId);
  if (!Number.isInteger(playerId) || !Number.isInteger(clubId)) {
    return res.status(400).json({ error: "playerId y clubId son requeridos" });
  }
  const result = await db.execute({
    sql: "SELECT 1 FROM ej_player_clubs WHERE player_id = ? AND club_id = ? LIMIT 1",
    args: [playerId, clubId],
  });
  res.json({ valid: result.rows.length > 0 });
});

export default router;
