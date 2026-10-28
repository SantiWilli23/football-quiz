import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const { resolveIfComplete } = await import("../routes/duels.js");
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

async function duelBetween(a, b, aHits, bHits) {
  const ids = [1, 2, 3, 4, 5];
  for (const id of ids) await db.execute({ sql: "INSERT OR IGNORE INTO duel_questions (id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, ?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [id, `pregunta ${id}`] });
  const g = (await db.execute({ sql: "SELECT group_id FROM group_members WHERE user_id = ?", args: [a] })).rows[0].group_id;
  const ins = await db.execute({ sql: "INSERT INTO duels (group_id, challenger_id, opponent_id, question_ids, status) VALUES (?, ?, ?, ?, 'esperando')", args: [g, a, b, JSON.stringify(ids)] });
  const id = Number(ins.lastInsertRowid);
  for (const [user, hits] of [[a, aHits], [b, bHits]]) {
    for (let i = 0; i < 5; i++) await db.execute({ sql: "INSERT INTO duel_answers (duel_id, user_id, question_id, answer, is_correct) VALUES (?, ?, ?, 'a', ?)", args: [id, user, ids[i], i < hits ? 1 : 0] });
  }
  return (await db.execute({ sql: "SELECT * FROM duels WHERE id = ?", args: [id] })).rows[0];
}

const credits = async (user) => (await db.execute({ sql: "SELECT source, points FROM points_ledger WHERE user_id = ?", args: [user] })).rows;

test("versus: el ganador de un duelo cerrado por el servidor suma 30 en un club Total, una sola vez", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const g = await makeGroup(db, { name: "Versus", members: ["va", "vb"] });
    await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [g.groupId] });
    const [a, b] = g.userIds;
    const duel = await duelBetween(a, b, 4, 2);
    const done = await resolveIfComplete(duel);
    assert.equal(done.winner_id, a);
    assert.deepEqual((await credits(a)).map((r) => [r.source, Number(r.points)]), [["versus", 30]]);
    assert.deepEqual(await credits(b), [], "el que pierde no suma");
    // volver a resolver el mismo duelo (ya terminado) no suma otra vez
    await resolveIfComplete({ ...duel, status: "terminado" });
    assert.equal((await credits(a)).length, 1);
  } finally { delete process.env.FUTOTAL2; }
});

test("versus: un empate no suma a nadie, y sin la bandera nada cambia", async () => {
  const g = await makeGroup(db, { name: "Versus2", members: ["vc", "vd"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [g.groupId] });
  const [c, d] = g.userIds;
  process.env.FUTOTAL2 = "1";
  try {
    await resolveIfComplete(await duelBetween(c, d, 3, 3));
    assert.deepEqual(await credits(c), []);
    assert.deepEqual(await credits(d), []);
  } finally { delete process.env.FUTOTAL2; }
  await resolveIfComplete(await duelBetween(c, d, 5, 0));
  assert.deepEqual(await credits(c), [], "sin FUTOTAL2 no se acredita");
  assert.equal(todayStr().length, 10);
});
