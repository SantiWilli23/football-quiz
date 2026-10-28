import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const daily = await import("../utils/daily-games.js");
const ledger = await import("../utils/ledger.js");
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

test("con el rediseño, el diario rotativo viejo nunca ocupa la fuente partido_dia", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Club F1", members: ["ana", "beto"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const userId = userIds[0];
  const date = todayStr();
  const todays = daily.dailyGameKeyFor(date);

  // Primero se juega el juego que antes era «el diario de hoy»…
  const out = await daily.recordDailyResult(userId, date, todays, 1, 20, { mode: "daily" });
  assert.equal(out.practice, true, "se trata como práctica libre");
  assert.equal(out.points, 0);

  let rows = (await db.execute({ sql: "SELECT source FROM points_ledger WHERE user_id = ? AND date = ?", args: [userId, date] })).rows.map((r) => r.source);
  assert.ok(!rows.includes("partido_dia"), "no escribe partido_dia");
  assert.equal((await db.execute({ sql: "SELECT COUNT(*) AS n FROM daily_game_results WHERE user_id = ?", args: [userId] })).rows[0].n, 0);

  // …y después el Partido del día de verdad suma completo (×2 en Total).
  const club = await ledger.creditPoints(userId, date, "partido_dia", 100);
  assert.equal(club.credited[0].points, 200);
  rows = (await db.execute({ sql: "SELECT source FROM points_ledger WHERE user_id = ? AND date = ?", args: [userId, date] })).rows.map((r) => r.source);
  assert.ok(rows.includes("partido_dia"));
});
