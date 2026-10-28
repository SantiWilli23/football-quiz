import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const { resolveIfComplete } = await import("../routes/duels.js");
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

async function playDuel(groupId, challenger, opponent, ca, oa) {
  const qs = [];
  for (let i = 0; i < 2; i++) {
    qs.push(Number((await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [`P${Math.random()}`] })).lastInsertRowid));
  }
  const id = Number((await db.execute({ sql: "INSERT INTO duels (group_id, challenger_id, opponent_id, question_ids) VALUES (?, ?, ?, ?)", args: [groupId, challenger, opponent, JSON.stringify(qs)] })).lastInsertRowid);
  for (const [uid, right] of [[challenger, ca], [opponent, oa]]) {
    for (let i = 0; i < qs.length; i++) {
      await db.execute({ sql: "INSERT INTO duel_answers (duel_id, user_id, question_id, answer, is_correct) VALUES (?, ?, ?, 'a', ?)", args: [id, uid, qs[i], i < right ? 1 : 0] });
    }
  }
  const duel = (await db.execute({ sql: "SELECT * FROM duels WHERE id = ?", args: [id] })).rows[0];
  return resolveIfComplete(duel);
}
const versus = async (uid) => (await db.execute({ sql: "SELECT points FROM points_ledger WHERE user_id = ? AND date = ? AND source = 'versus'", args: [uid, todayStr()] })).rows.map((r) => Number(r.points));

test("ganar un duelo suma 30 al club Total del ganador, una vez al día y nada si empatan", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Duelistas", members: ["d1", "d2"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const [a, b] = userIds;

  await playDuel(groupId, a, b, 1, 1);
  assert.deepEqual(await versus(a), [], "el empate no suma");

  const r = await playDuel(groupId, a, b, 2, 0);
  assert.equal(r.winner_id, a);
  assert.deepEqual(await versus(a), [30]);
  assert.deepEqual(await versus(b), []);

  await playDuel(groupId, a, b, 2, 0);
  assert.deepEqual(await versus(a), [30], "solo una vez por día");
});
