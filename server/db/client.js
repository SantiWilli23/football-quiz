import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbUrl = process.env.DATABASE_URL || "file:./data/football.db";

if (dbUrl.startsWith("file:")) {
  const filePath = dbUrl.slice("file:".length);
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
}

export const db = createClient({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function initSchema() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await db.execute(statement);
  }
  await migrateQuestionsTable();
  await migrateSpecialQuestionsTable();
  await migrateModeBKindConstraint();
  await migrateAvatarConfig();
  await migrateDuelDifficulty();
  await migrateDuelWildcard();
  await migrateGameHistoryScore();
  await migrateDtTacticsPower();
  await migrateDtCpuDifficulty();
  await migrateDuelTournamentMatch();
  await migrateGroupMemberRival();
  await migrateGroupCards();
  await migrateGroupWeeklyGames();
  await migrateGroupLeague();
  await migrateDtLeagueColumns();
  await migrateDtLeagueDraft();
  await migrateDtSeason();
  await migrateWordleLeague();
  await migrateFichadoBonusHints();
  await migrateCupMatchEvents();
  await migrateSeasonPredictionPhase();
  await migrateFichadoFailHints();
}

// Fichado: pistas gratis ganadas por intentos fallidos (cada 2 fallos, una).
async function migrateFichadoFailHints() {
  const info = await db.execute("PRAGMA table_info(fichado_games)");
  if (info.rows.length === 0) return; // instalación nueva: ya sale del schema.sql
  if (info.rows.some((r) => r.name === "fail_hints")) return;
  await db.execute("ALTER TABLE fichado_games ADD COLUMN fail_hints INTEGER NOT NULL DEFAULT 0");
}

// Campeón y descenso: en qué ventana se hizo la predicción ("inicio" o
// "final"). Las de final de temporada valen la mitad: ya se sabe mucho más.
async function migrateSeasonPredictionPhase() {
  const info = await db.execute("PRAGMA table_info(season_predictions)");
  if (info.rows.length === 0) return;
  if (info.rows.some((r) => r.name === "phase")) return;
  await db.execute("ALTER TABLE season_predictions ADD COLUMN phase TEXT NOT NULL DEFAULT 'inicio'");
}

// Comodín de racha: pistas gratis que no cuentan como intento gastado.
// Copa semanal en modo "cartas": se guarda la línea de tiempo del partido
// simulado (JSON) para poder repetirlo en la cancha animada.
async function migrateCupMatchEvents() {
  const info = await db.execute("PRAGMA table_info(cup_matches)");
  if (info.rows.length === 0) return;
  if (info.rows.some((r) => r.name === "events")) return;
  await db.execute("ALTER TABLE cup_matches ADD COLUMN events TEXT");
}

async function migrateFichadoBonusHints() {
  const info = await db.execute("PRAGMA table_info(fichado_games)");
  if (info.rows.length === 0) return; // instalación nueva: ya sale del schema.sql
  if (info.rows.some((r) => r.name === "bonus_hints")) return;
  await db.execute("ALTER TABLE fichado_games ADD COLUMN bonus_hints INTEGER NOT NULL DEFAULT 0");
}

// Fulbodle sumó un apartado de liga (premier/laliga/seriea/bundesliga)
// además del jugador secreto general — cada uno necesita su propia fila
// por día, así que "league" entra a la UNIQUE de ambas tablas. SQLite no
// deja agregar una columna a una UNIQUE existente con ALTER TABLE, así que
// hay que reconstruirlas (mismo patrón que migrateModeBKindConstraint).
async function migrateWordleLeague() {
  const guessesInfo = await db.execute("PRAGMA table_info(wordle_guesses)");
  if (guessesInfo.rows.length === 0) return; // instalación nueva: ya sale del schema.sql
  if (guessesInfo.rows.some((r) => r.name === "league")) return;

  await db.execute("PRAGMA foreign_keys = OFF");

  await db.execute(`
    CREATE TABLE wordle_guesses_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      league TEXT NOT NULL DEFAULT 'global',
      attempt_number INTEGER NOT NULL,
      guess_name TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, date, league, attempt_number)
    )
  `);
  await db.execute(`
    INSERT INTO wordle_guesses_new (id, user_id, date, attempt_number, guess_name, is_correct, created_at)
    SELECT id, user_id, date, attempt_number, guess_name, is_correct, created_at FROM wordle_guesses
  `);
  await db.execute("DROP TABLE wordle_guesses");
  await db.execute("ALTER TABLE wordle_guesses_new RENAME TO wordle_guesses");

  await db.execute(`
    CREATE TABLE wordle_results_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      league TEXT NOT NULL DEFAULT 'global',
      attempts INTEGER NOT NULL,
      points INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, date, league)
    )
  `);
  await db.execute(`
    INSERT INTO wordle_results_new (id, user_id, date, attempts, points, created_at)
    SELECT id, user_id, date, attempts, points, created_at FROM wordle_results
  `);
  await db.execute("DROP TABLE wordle_results");
  await db.execute("ALTER TABLE wordle_results_new RENAME TO wordle_results");

  await db.execute("PRAGMA foreign_keys = ON");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_wordle_guesses_user_date ON wordle_guesses(user_id, date)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_wordle_results_date ON wordle_results(date)");
}

// Temporada online: mes actual con "Listo", temporada, actividad de cada manager y copas en el calendario.
async function migrateDtSeason() {
  const leagues = await db.execute("PRAGMA table_info(dt_leagues)");
  if (leagues.rows.length) {
    const names = new Set(leagues.rows.map((r) => r.name));
    if (!names.has("current_month")) {
      await db.execute("ALTER TABLE dt_leagues ADD COLUMN current_month INTEGER NOT NULL DEFAULT 1");
      // Ligas que ya venían jugándose: el mes actual es el primero con algo sin jugar.
      await db.execute("UPDATE dt_leagues SET current_month = COALESCE((SELECT MIN(month) FROM dt_league_fixtures f WHERE f.league_id = dt_leagues.id AND f.played = 0), (SELECT MAX(month) FROM dt_league_fixtures f WHERE f.league_id = dt_leagues.id), 1)");
    }
    if (!names.has("season")) await db.execute("ALTER TABLE dt_leagues ADD COLUMN season INTEGER NOT NULL DEFAULT 1");
    if (!names.has("month_started_at")) await db.execute("ALTER TABLE dt_leagues ADD COLUMN month_started_at TEXT");
  }
  const members = await db.execute("PRAGMA table_info(dt_league_members)");
  if (members.rows.length) {
    const names = new Set(members.rows.map((r) => r.name));
    if (!names.has("ready_month")) await db.execute("ALTER TABLE dt_league_members ADD COLUMN ready_month INTEGER NOT NULL DEFAULT 0");
    if (!names.has("ready_at")) await db.execute("ALTER TABLE dt_league_members ADD COLUMN ready_at TEXT");
    if (!names.has("last_active_at")) await db.execute("ALTER TABLE dt_league_members ADD COLUMN last_active_at TEXT");
    if (!names.has("expelled_at")) await db.execute("ALTER TABLE dt_league_members ADD COLUMN expelled_at TEXT");
  }
  const fixtures = await db.execute("PRAGMA table_info(dt_league_fixtures)");
  if (fixtures.rows.length) {
    const names = new Set(fixtures.rows.map((r) => r.name));
    if (!names.has("comp")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN comp TEXT NOT NULL DEFAULT 'liga'");
    if (!names.has("round")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN round INTEGER NOT NULL DEFAULT 0");
    if (!names.has("season")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN season INTEGER NOT NULL DEFAULT 1");
    if (!names.has("winner")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN winner TEXT");
    if (!names.has("scored")) {
      await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN scored INTEGER NOT NULL DEFAULT 0");
      await db.execute("UPDATE dt_league_fixtures SET scored = 1 WHERE played = 1");
    }
  }
}

// Draft de liga: orden de turnos para elegir equipo, opcional por liga.
// Columnas nuevas y nullable/con default, entran con ALTER TABLE.
async function migrateDtLeagueDraft() {
  const info = await db.execute("PRAGMA table_info(dt_leagues)");
  if (info.rows.length === 0) return;
  const names = new Set(info.rows.map((r) => r.name));
  if (!names.has("draft_mode")) await db.execute("ALTER TABLE dt_leagues ADD COLUMN draft_mode INTEGER NOT NULL DEFAULT 0");
  if (!names.has("draft_order")) await db.execute("ALTER TABLE dt_leagues ADD COLUMN draft_order TEXT");
}

// La Liga Online DT nació con avance semanal manual por el creador. Estas
// columnas nuevas habilitan: meses configurables (weeks_per_month), partidos
// en vivo humano-vs-humano con velocidad elegida (speed) y walkover a los 3
// días si el rival nunca se conecta (live_started_at / live_*_joined / walkover).
async function migrateDtLeagueColumns() {
  const leaguesInfo = await db.execute("PRAGMA table_info(dt_leagues)");
  if (leaguesInfo.rows.length && !leaguesInfo.rows.some((r) => r.name === "weeks_per_month")) {
    await db.execute("ALTER TABLE dt_leagues ADD COLUMN weeks_per_month INTEGER NOT NULL DEFAULT 4");
  }

  const fixturesInfo = await db.execute("PRAGMA table_info(dt_league_fixtures)");
  if (fixturesInfo.rows.length) {
    const names = new Set(fixturesInfo.rows.map((r) => r.name));
    if (!names.has("month")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN month INTEGER NOT NULL DEFAULT 1");
    if (!names.has("speed")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN speed REAL NOT NULL DEFAULT 1");
    if (!names.has("live_started_at")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN live_started_at TEXT");
    if (!names.has("live_home_joined")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN live_home_joined INTEGER NOT NULL DEFAULT 0");
    if (!names.has("live_away_joined")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN live_away_joined INTEGER NOT NULL DEFAULT 0");
    if (!names.has("walkover")) await db.execute("ALTER TABLE dt_league_fixtures ADD COLUMN walkover TEXT");
  }

  if (leaguesInfo.rows.length && !leaguesInfo.rows.some((r) => r.name === "group_id")) {
    await db.execute("ALTER TABLE dt_leagues ADD COLUMN group_id INTEGER REFERENCES groups_t(id)");
  }
}

// Los duelos nacieron sin niveles de dificultad. Son columnas nuevas con valor
// por defecto, así que entran con ALTER TABLE; el CHECK se omite acá (SQLite no
// deja agregarlo después) y la validación queda en la ruta, que ya la hacía.
async function migrateDuelDifficulty() {
  for (const table of ["duel_questions", "duels"]) {
    const info = await db.execute(`PRAGMA table_info(${table})`);
    if (info.rows.length === 0) continue;
    if (info.rows.some((r) => r.name === "difficulty")) continue;
    await db.execute(`ALTER TABLE ${table} ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'dificil'`);
  }
}

// Comodín semanal: cada lado de un duelo puede jugarse "doble o nada" (ver
// duels.js). Columnas nuevas nullable-por-default, entran con ALTER TABLE.
async function migrateDuelWildcard() {
  const info = await db.execute("PRAGMA table_info(duels)");
  if (info.rows.length === 0) return;
  const names = new Set(info.rows.map((r) => r.name));
  if (!names.has("challenger_wildcard")) await db.execute("ALTER TABLE duels ADD COLUMN challenger_wildcard INTEGER NOT NULL DEFAULT 0");
  if (!names.has("opponent_wildcard")) await db.execute("ALTER TABLE duels ADD COLUMN opponent_wildcard INTEGER NOT NULL DEFAULT 0");
}

// Fuerza del plantel real de cada manager (ver dt-squad.js), guardada junto a su táctica.
async function migrateDtTacticsPower() {
  const info = await db.execute("PRAGMA table_info(dt_league_tactics)");
  if (info.rows.length === 0) return;
  if (info.rows.some((r) => r.name === "power")) return;
  await db.execute("ALTER TABLE dt_league_tactics ADD COLUMN power REAL");
}

// Dificultad de los clubes CPU de la Liga Online DT (facil, media o dificil).
async function migrateDtCpuDifficulty() {
  const info = await db.execute("PRAGMA table_info(dt_leagues)");
  if (info.rows.length === 0) return;
  if (info.rows.some((r) => r.name === "cpu_difficulty")) return;
  await db.execute("ALTER TABLE dt_leagues ADD COLUMN cpu_difficulty TEXT NOT NULL DEFAULT 'media'");
}

// Historial de juegos: puntuación 1-1000, duración y si fue un pleno (rendimiento máximo).
async function migrateGameHistoryScore() {
  const info = await db.execute("PRAGMA table_info(game_history)");
  if (info.rows.length === 0) return;
  const names = new Set(info.rows.map((r) => r.name));
  if (!names.has("score")) await db.execute("ALTER TABLE game_history ADD COLUMN score INTEGER");
  if (!names.has("seconds")) await db.execute("ALTER TABLE game_history ADD COLUMN seconds INTEGER NOT NULL DEFAULT 0");
  if (!names.has("pleno")) await db.execute("ALTER TABLE game_history ADD COLUMN pleno INTEGER NOT NULL DEFAULT 0");
}

// Torneo de duelos: cada cruce del bracket crea un duelo normal, marcado
// con a qué cruce pertenece para poder avanzar de ronda solo cuando se
// resuelve (ver duel-tournaments.js). Columna nueva y nullable.
async function migrateDuelTournamentMatch() {
  const info = await db.execute("PRAGMA table_info(duels)");
  if (info.rows.length === 0) return;
  if (info.rows.some((r) => r.name === "tournament_match_id")) return;
  await db.execute("ALTER TABLE duels ADD COLUMN tournament_match_id INTEGER REFERENCES duel_tournament_matches(id)");
}

// Rivalidades: cada miembro puede marcar a otro del mismo grupo como su
// "archienemigo" (ver groups.js). Columna nueva y nullable.
async function migrateGroupMemberRival() {
  const info = await db.execute("PRAGMA table_info(group_members)");
  if (info.rows.length === 0) return;
  if (info.rows.some((r) => r.name === "rival_id")) return;
  await db.execute("ALTER TABLE group_members ADD COLUMN rival_id INTEGER REFERENCES users(id)");
}

// Cartas es un módulo opt-in por grupo: solo existe si un admin lo activó
// (y el grupo tenía 3+ miembros al momento de activarlo). Una vez activado
// queda así aunque el grupo baje de 3 después.
// Juegos semanales: opt-in por grupo (los activa quien lo creó). Sin esto, los
// juegos semanales no dan puntos en ese grupo.
async function migrateGroupWeeklyGames() {
  const info = await db.execute("PRAGMA table_info(groups_t)");
  if (info.rows.length === 0) return;
  if (info.rows.some((r) => r.name === "weekly_games_enabled")) return;
  await db.execute("ALTER TABLE groups_t ADD COLUMN weekly_games_enabled INTEGER NOT NULL DEFAULT 0");
}

async function migrateGroupCards() {
  const info = await db.execute("PRAGMA table_info(groups_t)");
  if (info.rows.length === 0) return;
  if (info.rows.some((r) => r.name === "cards_enabled")) return;
  await db.execute("ALTER TABLE groups_t ADD COLUMN cards_enabled INTEGER NOT NULL DEFAULT 0");
}

// Liga del grupo: igual que Cartas, es opt-in por grupo (ver groups.js) y
// necesita 10+ miembros al momento de activarla (dos divisiones necesitan
// gente de sobra para que cada una tenga sentido). `league_packs_enabled`
// es un segundo interruptor, aparte, para dar sobres de cartas según la
// posición y división al cerrar la temporada — se puede tener la liga
// activada sin repartir sobres.
async function migrateGroupLeague() {
  const info = await db.execute("PRAGMA table_info(groups_t)");
  if (info.rows.length === 0) return;
  if (!info.rows.some((r) => r.name === "league_enabled")) {
    await db.execute("ALTER TABLE groups_t ADD COLUMN league_enabled INTEGER NOT NULL DEFAULT 0");
  }
  if (!info.rows.some((r) => r.name === "league_packs_enabled")) {
    await db.execute("ALTER TABLE groups_t ADD COLUMN league_packs_enabled INTEGER NOT NULL DEFAULT 0");
  }
}

// Instalaciones anteriores tienen `users` sin la columna del avatar dibujado.
// Es una columna nueva y nullable, así que entra con un ALTER TABLE simple.
async function migrateAvatarConfig() {
  const info = await db.execute("PRAGMA table_info(users)");
  if (!info.rows.some((r) => r.name === "avatar_config")) {
    await db.execute("ALTER TABLE users ADD COLUMN avatar_config TEXT");
  }
  // Foto de perfil (data URL ya reducida por el cliente) y datos extra del
  // perfil (frase, equipo del corazón, banner) como JSON. Columnas nullable.
  const names = new Set((await db.execute("PRAGMA table_info(users)")).rows.map((r) => r.name));
  if (!names.has("photo")) await db.execute("ALTER TABLE users ADD COLUMN photo TEXT");
  if (!names.has("profile")) await db.execute("ALTER TABLE users ADD COLUMN profile TEXT");
}

// Las tablas de predicciones y reacciones nacieron con un CHECK que sólo
// admitía los tres tipos originales de pregunta. Al sumarse la pregunta que
// escribe el propio grupo ('grupal') hay que rehacerlas: SQLite no permite
// modificar un CHECK con ALTER TABLE. Se detecta mirando el SQL guardado.
async function migrateModeBKindConstraint() {
  for (const table of ["mode_b_predictions", "mode_b_reactions"]) {
    const info = await db.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      args: [table],
    });
    const createSql = info.rows[0]?.sql;
    if (!createSql || createSql.includes("grupal")) continue;

    const columns = (await db.execute(`PRAGMA table_info(${table})`)).rows
      .map((r) => r.name)
      .join(", ");

    await db.execute("PRAGMA foreign_keys = OFF");
    await db.execute(createSql.replace(table, `${table}_new`).replace(/'personalidad'/, "'personalidad', 'grupal'"));
    await db.execute(`INSERT INTO ${table}_new (${columns}) SELECT ${columns} FROM ${table}`);
    await db.execute(`DROP TABLE ${table}`);
    await db.execute(`ALTER TABLE ${table}_new RENAME TO ${table}`);
    await db.execute("PRAGMA foreign_keys = ON");
  }

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_mode_b_predictions_lookup ON mode_b_predictions(question_kind, question_id, group_id)"
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_mode_b_reactions_lookup ON mode_b_reactions(question_kind, question_id, group_id)"
  );
}

// Older deployments have a `questions` table with one row per day
// (scheduled_date UNIQUE). Rebuild it to support multiple questions per
// day via the `slot` column, without losing existing rows/ids.
async function migrateQuestionsTable() {
  const info = await db.execute("PRAGMA table_info(questions)");
  const hasSlot = info.rows.some((r) => r.name === "slot");
  if (hasSlot) return;

  // FK enforcement must be off while we swap the table out from under
  // `answers.question_id REFERENCES questions(id)` — otherwise the DROP
  // below is rejected even though the data is copied across untouched.
  await db.execute("PRAGMA foreign_keys = OFF");
  await db.execute(`
    CREATE TABLE questions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a','b','c','d')),
      scheduled_date TEXT NOT NULL,
      slot INTEGER NOT NULL DEFAULT 1,
      UNIQUE(scheduled_date, slot)
    )
  `);
  await db.execute(`
    INSERT INTO questions_new
      (id, question, category, difficulty, option_a, option_b, option_c, option_d, correct_answer, scheduled_date, slot)
    SELECT id, question, category, difficulty, option_a, option_b, option_c, option_d, correct_answer, scheduled_date, 1
    FROM questions
  `);
  await db.execute("DROP TABLE questions");
  await db.execute("ALTER TABLE questions_new RENAME TO questions");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_questions_date ON questions(scheduled_date)");
  await db.execute("PRAGMA foreign_keys = ON");
}

// Older deployments created special_questions before it had
// option_a/option_b (needed for "¿Qué prefieres?"). Nullable columns can
// be added in place with ALTER TABLE, no rebuild required.
async function migrateSpecialQuestionsTable() {
  const info = await db.execute("PRAGMA table_info(special_questions)");
  const hasOptionA = info.rows.some((r) => r.name === "option_a");
  if (hasOptionA) return;

  await db.execute("ALTER TABLE special_questions ADD COLUMN option_a TEXT");
  await db.execute("ALTER TABLE special_questions ADD COLUMN option_b TEXT");
}
