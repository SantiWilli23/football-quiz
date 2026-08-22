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
