import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../data/equipo-jugador-players.json");
const ALIASES_PATH = path.join(__dirname, "../data/club-aliases.json");

export function normalize(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// El dataset marca algunos pasos de carrera como "(cedido)" o "(cantera)" —
// son el MISMO club, solo que ese paso fue a préstamo o por la cantera; para
// este juego eso no importa (la pregunta es sólo "¿jugó ahí?"), así que se
// funden con el club base. Otros paréntesis SÍ son un club distinto con
// nombre repetido (ej. "Nacional (Uruguay)" vs. otro "Nacional") y quedan tal cual.
const MERGE_SUFFIXES = /\s*\((cedido|cantera)\)\s*$/i;

function canonicalClubName(rawName) {
  return rawName.replace(MERGE_SUFFIXES, "").trim();
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

// Bases ya desplegadas: antes de unificar los nombres de club, "Inter Milan" e
// "Inter de Milán" (o "PSG" y "Paris Saint-Germain") eran clubes distintos y
// cortaban las cadenas. Esto junta cada alias con su club canónico, moviendo
// sus pasos de carrera. Idempotente: si no queda nada por juntar, no hace nada.
async function mergeAliasClubs() {
  if (!fs.existsSync(ALIASES_PATH)) return 0;
  const alias = JSON.parse(fs.readFileSync(ALIASES_PATH, "utf-8")).alias || {};
  const canonicalOf = new Map(Object.entries(alias).map(([a, c]) => [normalize(a), normalize(c)]));
  const rows = (await db.execute("SELECT id, normalized_name FROM ej_clubs")).rows;
  const idByName = new Map(rows.map((r) => [r.normalized_name, r.id]));
  let merged = 0;
  for (const r of rows) {
    const target = canonicalOf.get(r.normalized_name);
    const targetId = target && target !== r.normalized_name ? idByName.get(target) : null;
    if (!targetId) continue;
    // OR IGNORE: si el jugador ya tenía ese paso en el club canónico, el duplicado queda sin mover y se borra abajo.
    await db.execute({ sql: "UPDATE OR IGNORE ej_player_clubs SET club_id = ? WHERE club_id = ?", args: [targetId, r.id] });
    await db.execute({ sql: "DELETE FROM ej_player_clubs WHERE club_id = ?", args: [r.id] });
    await db.execute({ sql: "DELETE FROM ej_clubs WHERE id = ?", args: [r.id] });
    merged++;
  }
  return merged;
}

// Idempotente y ACUMULATIVO: corre en cada arranque del server, pero nunca
// duplica nada — cada INSERT de jugador/club/paso de carrera usa
// ON CONFLICT DO NOTHING contra su propio UNIQUE. Antes cortaba apenas
// encontraba un solo jugador ya cargado, así que agregar gente nueva a
// equipo-jugador-players.json nunca llegaba a un server ya desplegado;
// ahora simplemente vuelve a recorrer el archivo y suma lo que falte.
export async function seedEquipoJugador() {
  if (!fs.existsSync(DATA_PATH)) {
    console.warn(`Equipo-Jugador: no se encontró ${DATA_PATH}, se omite el seed.`);
    return { skipped: true, players: 0 };
  }

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const jugadores = raw.jugadores || [];

  // Por lotes: antes cada jugador/club/paso era 2-3 consultas sueltas contra la base
  // remota (Turso), y con ~2000 jugadores el seed tardaba más de 15 minutos y Render
  // cortaba el deploy antes de abrir el puerto. Ahora se leen los ids existentes UNA
  // vez y sólo se insertan (en lotes) las filas que faltan.
  const BATCH = 300;
  const runBatched = async (stmts) => {
    for (let i = 0; i < stmts.length; i += BATCH) await db.batch(stmts.slice(i, i + BATCH), "write");
  };

  const existingPlayers = new Set((await db.execute("SELECT normalized_name FROM ej_players")).rows.map((r) => r.normalized_name));
  const existingClubs = new Set((await db.execute("SELECT normalized_name FROM ej_clubs")).rows.map((r) => r.normalized_name));

  const playerStmts = [];
  const clubStmts = [];
  const seenPlayers = new Set();
  const seenClubs = new Set();
  for (const j of jugadores) {
    const normalizedName = normalize(j.nombre);
    if (!normalizedName || !Array.isArray(j.carrera) || j.carrera.length === 0) continue;
    if (!existingPlayers.has(normalizedName) && !seenPlayers.has(normalizedName)) {
      seenPlayers.add(normalizedName);
      playerStmts.push({
        sql: `INSERT INTO ej_players (name, normalized_name, nationality, position, birth_year)
              VALUES (?, ?, ?, ?, ?) ON CONFLICT(normalized_name) DO NOTHING`,
        args: [j.nombre, normalizedName, j.nacionalidad || null, POSITION_MAP[j.posicion] || j.posicion || null, j.nacimiento || null],
      });
    }
    for (const stint of j.carrera) {
      if (!stint.club) continue;
      const clubName = canonicalClubName(stint.club);
      const normalizedClub = normalize(clubName);
      if (!existingClubs.has(normalizedClub) && !seenClubs.has(normalizedClub)) {
        seenClubs.add(normalizedClub);
        clubStmts.push({
          sql: "INSERT INTO ej_clubs (name, normalized_name) VALUES (?, ?) ON CONFLICT(normalized_name) DO NOTHING",
          args: [clubName, normalizedClub],
        });
      }
    }
  }
  await runBatched(clubStmts);
  await runBatched(playerStmts);

  const playerIds = new Map((await db.execute("SELECT id, normalized_name FROM ej_players")).rows.map((r) => [r.normalized_name, r.id]));
  const clubIds = new Map((await db.execute("SELECT id, normalized_name FROM ej_clubs")).rows.map((r) => [r.normalized_name, r.id]));
  const haveStints = new Set(
    (await db.execute("SELECT player_id, club_id, start_year FROM ej_player_clubs")).rows.map((r) => `${r.player_id}|${r.club_id}|${r.start_year ?? ""}`)
  );

  const stintStmts = [];
  for (const j of jugadores) {
    const playerId = playerIds.get(normalize(j.nombre));
    if (!playerId || !Array.isArray(j.carrera)) continue;
    for (const stint of j.carrera) {
      if (!stint.club) continue;
      const clubId = clubIds.get(normalize(canonicalClubName(stint.club)));
      if (!clubId) continue;
      const key = `${playerId}|${clubId}|${stint.inicio || ""}`;
      if (haveStints.has(key)) continue;
      haveStints.add(key);
      stintStmts.push({
        sql: `INSERT INTO ej_player_clubs (player_id, club_id, start_year, end_year)
              VALUES (?, ?, ?, ?) ON CONFLICT(player_id, club_id, start_year) DO NOTHING`,
        args: [playerId, clubId, stint.inicio || null, stint.fin || null],
      });
    }
  }
  await runBatched(stintStmts);
  const playersInserted = playerStmts.length;
  const stintsInserted = stintStmts.length;

  const mergedClubs = await mergeAliasClubs();
  if (mergedClubs > 0) console.log(`Equipo-Jugador: ${mergedClubs} clubes duplicados unificados.`);

  console.log(
    `Equipo-Jugador: seed completado — ${playersInserted} jugadores, ${clubIds.size} clubes, ${stintsInserted} pasos de carrera.`
  );
  return { skipped: false, players: playersInserted, clubs: clubIds.size, stints: stintsInserted };
}
