import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const dg = await import("../utils/daily-games.js");
const ledger = await import("../utils/ledger.js");
const dm = await import("../utils/daily-match.js");
const { default: dailyRouter } = await import("../routes/daily-match.js");
const { todayStr } = await import("../utils/points.js");

before(async () => {
  await initSchema();
  for (let i = 1; i <= 12; i++) await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [`Pregunta ${i}`] });
});
after(() => cleanup());

function call(p, userId, body = {}) {
  const layer = dailyRouter.stack.find((l) => l.route && l.route.path === p && l.route.methods.post);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body, query: {}, params: {} }, res);
  });
}

test("F1: con FUTOTAL2 el diario rotativo viejo no le quita los puntos al Partido del día", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const g = await makeGroup(db, { name: "F1", members: ["f1a", "f1b"] });
    await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [g.groupId] });
    const user = g.userIds[0];
    const today = todayStr();
    const rotativo = dg.dailyGameKeyFor(today);

    // 1) se juega el juego que hoy sería el «diario rotativo»
    const old = await dg.recordDailyResult(user, today, rotativo, 1, 10);
    assert.equal(old.practice, true, "pasa por la rama libre");
    assert.equal(old.points, 0);
    assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM daily_game_results WHERE user_id = ?", args: [user] })).rows[0].n), 0, "no escribe daily_game_results");
    assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND source LIKE '%juego-%'", args: [user] })).rows[0].n), 0, "no da el sobre del diario");
    const libre = (await db.execute({ sql: "SELECT source, points FROM points_ledger WHERE user_id = ? AND group_id = ?", args: [user, g.groupId] })).rows;
    assert.deepEqual(libre.map((r) => r.source), [ledger.freeGameSource(rotativo)], "queda como libre:<juego>");
    assert.ok(!libre.some((r) => r.source === "partido_dia"));

    // 2) se juega el Partido del día completo
    const items = await dm.matchFor(today);
    for (let i = 0; i < items.length; i++) await call("/answer", user, { idx: i, answer: items[i].answer, ms: 900 });
    const fin = (await call("/finish", user)).body;
    assert.ok(fin.total >= 90);
    assert.equal(fin.club.credited[0].points, fin.total * 2, "acredita completo y ×2 en un club Total");

    const rows = Object.fromEntries((await db.execute({ sql: "SELECT source, points FROM points_ledger WHERE user_id = ? AND group_id = ?", args: [user, g.groupId] })).rows.map((r) => [r.source, Number(r.points)]));
    assert.equal(rows.partido_dia, fin.total * 2);
    assert.equal(rows[ledger.freeGameSource(rotativo)], 20, "el diario viejo suma como libre (4 por acierto, máximo 20)");
  } finally { delete process.env.FUTOTAL2; }
});

test("sin la bandera el diario rotativo sigue como siempre", async () => {
  const g = await makeGroup(db, { name: "F1sin", members: ["f1c", "f1d"] });
  const today = todayStr();
  const r = await dg.recordDailyResult(g.userIds[0], today, dg.dailyGameKeyFor(today), 0.5, 5);
  assert.equal(r.practice, undefined);
  assert.ok(r.points > 0, "suma puntos del diario como antes");
});
