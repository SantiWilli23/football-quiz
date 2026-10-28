import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const { payPodium } = await import("../utils/dt-league-core.js");
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

const got = async (uid) => (await db.execute({ sql: "SELECT points FROM points_ledger WHERE user_id = ? AND source LIKE 'dt_podio:%' ORDER BY points DESC", args: [uid] })).rows.map((r) => Number(r.points));

test("el podio de la jornada paga 60 / 40 / 20 al club Total, con empates y sin pagar de más", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Liga DT", members: ["p1", "p2", "p3", "p4"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const [a, b, c, d] = userIds;
  const league = { id: 7, group_id: groupId, season: 1 };

  const paid = await payPodium(league, 3, new Map([[a, 30], [b, 22], [c, 22], [d, 5]]));
  assert.deepEqual(paid.map((p) => [p.userId, p.place, p.points]), [[a, 1, 60], [b, 2, 40], [c, 2, 40]], "empate comparte segundo y no hay tercero");
  assert.deepEqual(await got(d), []);

  // Pagar dos veces la misma jornada no duplica.
  await payPodium(league, 3, new Map([[a, 30], [b, 22]]));
  assert.deepEqual(await got(a), [60]);

  // Otra jornada el mismo día paga aparte (fuente propia).
  await payPodium(league, 4, new Map([[a, 10], [d, 9]]));
  assert.deepEqual(await got(a), [60, 60]);
  assert.deepEqual(await got(d), [40]);

  // Con un solo jugador con puntos no hay podio.
  assert.deepEqual(await payPodium(league, 5, new Map([[a, 12]])), []);
});

test("en un club Clásico el podio no suma", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Liga Clásica", members: ["q1", "q2"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'clasico', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const paid = await payPodium({ id: 9, group_id: groupId, season: 1 }, 1, new Map([[userIds[0], 20], [userIds[1], 10]]), todayStr());
  assert.deepEqual(paid, []);
});
