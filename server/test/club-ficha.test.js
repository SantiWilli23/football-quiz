import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const { default: clubsRouter, longestRun } = await import("../routes/clubs.js");
const { matchFor } = await import("../utils/daily-match.js");
const { todayStr } = await import("../utils/points.js");

before(async () => {
  await initSchema();
  for (let i = 1; i <= 12; i++) {
    await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', ?, 'dificil')", args: [`P${i}`, "abcd"[i % 4]] });
  }
});
after(() => cleanup());

function call(method, p, { userId, params = {} }) {
  const layer = clubsRouter.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body: {}, query: {}, params, headers: {} }, res);
  });
}

async function playedToday(userId, total, okAll = true) {
  const date = todayStr();
  const items = await matchFor(date);
  for (let idx = 0; idx < items.length; idx++) {
    await db.execute({ sql: "INSERT OR IGNORE INTO daily_match_answers (user_id, date, idx, answer, ms, ok, points) VALUES (?, ?, ?, 0, 2000, ?, 1)", args: [userId, date, idx, okAll ? 1 : 0] });
  }
  await db.execute({ sql: "INSERT OR REPLACE INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 30, 30, 20, ?)", args: [userId, date, total] });
}

test("la ficha de un miembro muestra sus datos y el cara a cara exige que los dos hayan jugado", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Club Ficha", members: ["ana", "beto", "caro"] });
  await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const [ana, beto, caro] = userIds;

  await playedToday(beto, 78);
  let f = await call("get", "/:id/members/:uid", { userId: ana, params: { id: groupId, uid: beto } });
  assert.equal(f.status, 200);
  assert.equal(f.body.user.username, "beto");
  assert.deepEqual(f.body.today, { played: true, total: 78 });
  assert.equal(f.body.canCompare, false, "ana todavía no jugó");

  let h = await call("get", "/:id/head-to-head/:uid", { userId: ana, params: { id: groupId, uid: beto } });
  assert.equal(h.status, 409);

  await playedToday(ana, 64);
  f = await call("get", "/:id/members/:uid", { userId: ana, params: { id: groupId, uid: beto } });
  assert.equal(f.body.canCompare, true);
  h = await call("get", "/:id/head-to-head/:uid", { userId: ana, params: { id: groupId, uid: beto } });
  assert.equal(h.status, 200);
  assert.deepEqual(h.body.totals, { me: 64, them: 78 });
  assert.equal(h.body.rows.length, 17);
  assert.ok(h.body.rows.every((r) => r.me && r.them));

  // Alguien que no es del club no puede espiar ni la ficha ni el cara a cara.
  const out = await makeGroup(db, { name: "Otro club", members: ["intruso"] });
  assert.equal((await call("get", "/:id/members/:uid", { userId: out.userIds[0], params: { id: groupId, uid: beto } })).status, 404);
  assert.equal((await call("get", "/:id/head-to-head/:uid", { userId: out.userIds[0], params: { id: groupId, uid: beto } })).status, 404);
  // Y no se puede abrir el cara a cara con uno mismo.
  assert.equal((await call("get", "/:id/head-to-head/:uid", { userId: ana, params: { id: groupId, uid: ana } })).status, 404);
  void caro;
});

test("las insignias del club salen de lo que pasó de verdad", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Club Insignias", members: ["x1", "x2"] });
  const get = async () => (await call("get", "/:id/badges", { userId: userIds[0], params: { id: groupId } })).body.badges;
  const earned = (b) => b.filter((x) => x.earned).map((x) => x.key);

  assert.deepEqual(earned(await get()), []);
  await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  assert.deepEqual(earned(await get()), ["temporada"]);
  await db.execute({ sql: "INSERT INTO points_ledger (user_id, group_id, date, month, source, points) VALUES (?, ?, '2026-02-08', '2026-02', 'copa', 200)", args: [userIds[0], groupId] });
  assert.ok(earned(await get()).includes("copa"));
  await db.execute({ sql: "INSERT INTO month_closes (group_id, month, podium_json) VALUES (?, '2026-01', '[]')", args: [groupId] });
  assert.ok(earned(await get()).includes("mes"));
});

test("la racha más larga cuenta días corridos", () => {
  assert.equal(longestRun([]), 0);
  assert.equal(longestRun(["2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05", "2026-01-06"]), 3);
  assert.equal(longestRun(["2026-01-31", "2026-02-01"]), 2);
});
