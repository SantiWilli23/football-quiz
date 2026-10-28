import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const daily = await import("../utils/daily-games.js");
const clubs = await import("../utils/clubs.js");
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

const date = todayStr();
const sources = async (userId) => (await db.execute({ sql: "SELECT source, points FROM points_ledger WHERE user_id = ? AND date = ?", args: [userId, date] })).rows.map((r) => `${r.source}:${r.points}`);

test("las variantes de un juego fusionado comparten un solo cupo de puntos por día", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Fusión Total", members: ["f1", "f2"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const u = userIds[0];

  const a = await daily.recordDailyResult(u, date, "fichado", 1, 20, { mode: "fun" });
  assert.equal(a.club.credited[0].points, 20);
  // Otra variante del mismo juego fusionado el mismo día: práctica, no vuelve a sumar.
  const b = await daily.recordDailyResult(u, date, "traspasos", 1, 5, { mode: "fun" });
  assert.equal(b.club.credited.length, 0);
  assert.equal(b.club.reason, "ya");
  // Otro juego fusionado sí suma, hasta el tope.
  const c = await daily.recordDailyResult(u, date, "escudos", 0.6, 3, { mode: "fun" });
  assert.equal(c.club.credited[0].points, 12);
  assert.deepEqual((await sources(u)).sort(), ["libre:que_club:12", "libre:quien_es:20"]);
});

test("en Clásico y sin club se explica por qué no suma", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Fusión Clásico", members: ["g1", "g2"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'clasico', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const classic = await daily.recordDailyResult(userIds[0], date, "piramide", 1, 10, { mode: "fun" });
  assert.equal(classic.club.reason, "clasico");
  assert.equal(classic.club.wouldHave, 20);

  const lone = (await db.execute({ sql: "INSERT INTO users (username, email, password_hash, avatar) VALUES ('solo', 'solo@x.cl', 'x', 'S')" })).lastInsertRowid;
  const out = await daily.recordDailyResult(Number(lone), date, "bingo", 1, 9, { mode: "fun" });
  assert.equal(out.club.reason, "sin_club");
  assert.equal(out.club.wouldHave, 20);
});

test("los juegos abiertos salen de FUTOTAL2_JUEGOS y sin la variable están todos", () => {
  delete process.env.FUTOTAL2_JUEGOS;
  assert.deepEqual(clubs.enabledGames(), clubs.MERGED_GAMES);
  process.env.FUTOTAL2_JUEGOS = "bingo, var,inventado";
  assert.deepEqual(clubs.enabledGames(), ["var", "bingo"]);
  delete process.env.FUTOTAL2_JUEGOS;
});
