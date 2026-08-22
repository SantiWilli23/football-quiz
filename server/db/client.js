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

// Instalaciones anteriores tienen `users` sin la columna del avatar dibujado.
// Es una columna nueva y nullable, así que entra con un ALTER TABLE simple.
async function migrateAvatarConfig() {
  const info = await db.execute("PRAGMA table_info(users)");
  if (info.rows.some((r) => r.name === "avatar_config")) return;
  await db.execute("ALTER TABLE users ADD COLUMN avatar_config TEXT");
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
