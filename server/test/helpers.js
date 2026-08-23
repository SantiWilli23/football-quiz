import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Cada archivo de test corre en su propio proceso, así que alcanza con apuntar
// DATABASE_URL a un archivo temporal ANTES de importar nada que toque la base:
// el cliente se construye una sola vez al importarse el módulo.
export function useTempDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fq-test-"));
  const file = path.join(dir, "test.db");
  process.env.DATABASE_URL = `file:${file.replace(/\\/g, "/")}`;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

  // En Windows el archivo sigue tomado por SQLite cuando termina el test, y el
  // borrado falla con EPERM. No es un fallo de la prueba: la carpeta es
  // temporal y el sistema la limpia igual, así que no se deja explotar.
  return () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // sin nada que hacer
    }
  };
}

export function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Alta mínima de un grupo con sus miembros, para no repetir el mismo bloque de
// inserts en cada test.
export async function makeGroup(db, { name = "Grupo", members = ["ana", "beto"] } = {}) {
  const userIds = [];
  for (const username of members) {
    const result = await db.execute({
      sql: "INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, 'x', ?)",
      args: [username, `${username}@test.local`, username.charAt(0).toUpperCase()],
    });
    userIds.push(Number(result.lastInsertRowid));
  }

  const group = await db.execute({
    sql: "INSERT INTO groups_t (name, invite_code, created_by) VALUES (?, ?, ?)",
    args: [name, `FUTBOL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, userIds[0]],
  });
  const groupId = Number(group.lastInsertRowid);

  for (const userId of userIds) {
    await db.execute({
      sql: "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
      args: [groupId, userId],
    });
  }

  return { groupId, userIds };
}

export async function makeSpecialQuestion(db, { type, date, prompt = "¿?", a = null, b = null }) {
  const result = await db.execute({
    sql: `INSERT INTO special_questions (type, prompt, option_a, option_b, scheduled_date)
          VALUES (?, ?, ?, ?, ?)`,
    args: [type, prompt, a, b, date],
  });
  return Number(result.lastInsertRowid);
}

export async function answerSpecial(db, { questionId, groupId, userId, value }) {
  await db.execute({
    sql: `INSERT INTO special_answers (special_question_id, group_id, user_id, answer_value)
          VALUES (?, ?, ?, ?)`,
    args: [questionId, groupId, userId, String(value)],
  });
}

export async function predict(db, { kind, questionId, groupId, userId, value }) {
  await db.execute({
    sql: `INSERT INTO mode_b_predictions (question_kind, question_id, group_id, user_id, predicted_value)
          VALUES (?, ?, ?, ?, ?)`,
    args: [kind, questionId, groupId, userId, String(value)],
  });
}
