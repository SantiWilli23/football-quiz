import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../data/equipo-jugador-players.json");

export function normalize(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const POSITION_MAP = {
  "Portero": "Arquero",
  "Arquero": "Arquero",
  "Defensa": "Defensa",
  "Defensor": "Defensa",
  "Mediocampista": "Mediocampista",
  "Volante": "Mediocampista",
  "Delantero": "Delantero",
};

// Idempotente: si ya hay jugadores cargados, no vuelve a insertar (el seed
// corre en cada arranque del server, junto con el resto de las preguntas).
export async function seedEquipoJugador() {
  const existing = await db.execute("SELECT COUNT(*) as c FROM ej_players");
  const already = Number(existing.rows[0].c);
  if (already > 0) {
    return { skipped: true, players: already };
  }

  if (!fs.existsSync(DATA_PATH)) {
    console.warn(`Equipo-Jugador: no se encontró ${DATA_PATH}, se omite el seed.`);
    return { skipped: true, players: 0 };
  }

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const jugadores = raw.jugadores || [];

  const clubIds = new Map(); // normalized_name -> id
  let playersInserted = 0;
  let stintsInserted = 0;

  for (const j of jugadores) {
    const normalizedName = normalize(j.nombre);
    if (!normalizedName || !Array.isArray(j.carrera) || j.carrera.length === 0) continue;

    const position = POSITION_MAP[j.posicion] || j.posicion || null;

    const playerRes = await db.execute({
      sql: `INSERT INTO ej_players (name, normalized_name, nationality, position, birth_year)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(normalized_name) DO NOTHING`,
      args: [j.nombre, normalizedName, j.nacionalidad || null, position, j.nacimiento || null],
    });
    if (playerRes.rowsAffected > 0) playersInserted++;

    const playerIdRes = await db.execute({
      sql: "SELECT id FROM ej_players WHERE normalized_name = ?",
      args: [normalizedName],
    });
    const playerId = playerIdRes.rows[0]?.id;
    if (!playerId) continue;

    for (const stint of j.carrera) {
      const clubName = stint.club;
      if (!clubName) continue;
      const normalizedClub = normalize(clubName);

      let clubId = clubIds.get(normalizedClub);
      if (!clubId) {
        await db.execute({
          sql: `INSERT INTO ej_clubs (name, normalized_name) VALUES (?, ?)
                ON CONFLICT(normalized_name) DO NOTHING`,
          args: [clubName, normalizedClub],
        });
        const clubIdRes = await db.execute({
          sql: "SELECT id FROM ej_clubs WHERE normalized_name = ?",
          args: [normalizedClub],
        });
        clubId = clubIdRes.rows[0]?.id;
        if (!clubId) continue;
        clubIds.set(normalizedClub, clubId);
      }

      const stintRes = await db.execute({
        sql: `INSERT INTO ej_player_clubs (player_id, club_id, start_year, end_year)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(player_id, club_id, start_year) DO NOTHING`,
        args: [playerId, clubId, stint.inicio || null, stint.fin || null],
      });
      if (stintRes.rowsAffected > 0) stintsInserted++;
    }
  }

  console.log(
    `Equipo-Jugador: seed completado — ${playersInserted} jugadores, ${clubIds.size} clubes, ${stintsInserted} pasos de carrera.`
  );
  return { skipped: false, players: playersInserted, clubs: clubIds.size, stints: stintsInserted };
}
