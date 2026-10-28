import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const { CARDS } = await import("../routes/cards.js");
const { default: torneo } = await import("../routes/torneo.js");
const { adminRouter } = await import("../routes/admin.js");
const T = await import("../utils/tournament.js");
const { todayStr, addDays } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

const call = (router, method, p, { userId = 1, body = {}, params = {} } = {}) => new Promise((resolve) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
  handle({ userId, body, params, query: {}, headers: {} }, res);
});

test("solo entran selecciones con al menos 5 cartas", () => {
  const ok = T.eligibleNations(CARDS);
  assert.ok(ok.length >= 4, "hay selecciones suficientes para jugar");
  assert.ok(ok.every((n) => n.cards >= T.MIN_NATION_CARDS));
  assert.ok(ok.some((n) => n.name === "Chile"), "Chile está");
});

test("el dueño crea un torneo, se valida y el álbum da los premios una sola vez", async () => {
  const today = todayStr();
  const avail = T.eligibleNations(CARDS).map((n) => n.name);
  const nations = ["Chile", ...avail.filter((n) => n !== "Chile").slice(0, 3)];

  assert.equal((await call(adminRouter, "post", "/tournaments", { body: { name: "", starts: today, ends: addDays(today, 20), nations } })).status, 400);
  assert.equal((await call(adminRouter, "post", "/tournaments", { body: { name: "X", starts: today, ends: addDays(today, 20), nations: ["Chile", "Narnia"] } })).status, 400);
  const ok = await call(adminRouter, "post", "/tournaments", { body: { name: "Copa de prueba", starts: today, ends: addDays(today, 29), nations } });
  assert.equal(ok.status, 201);
  assert.equal((await call(adminRouter, "post", "/tournaments", { body: { name: "Otro", starts: addDays(today, 5), ends: addDays(today, 40), nations } })).status, 409, "no se superponen");

  const { userIds } = await makeGroup(db, { name: "Álbum", members: ["albumero", "otro3"] });
  const u = userIds[0];
  let cur = (await call(torneo, "get", "/current", { userId: u })).body;
  assert.equal(cur.tournament.name, "Copa de prueba");
  assert.equal(cur.tournament.day, 1);
  assert.equal(cur.tournament.total, 30);
  assert.equal(cur.tournament.phase, "Fase de grupos");
  assert.equal(cur.nations.length, 4);
  assert.ok(cur.nations.every((n) => n.target === Math.min(11, T.nationCounts(CARDS).get(n.name)) && n.owned === 0));

  const give = async (nation) => {
    for (const c of CARDS.filter((x) => !x.special && ["GK", "DEF", "MID", "FWD"].includes(x.pos) && x.nationality === nation).slice(0, 11)) {
      await db.execute({ sql: "INSERT OR IGNORE INTO user_cards (user_id, player_name, count) VALUES (?, ?, 1)", args: [u, c.name] });
    }
  };
  await give(nations[1]);
  let got = (await call(torneo, "post", "/claim", { userId: u })).body.got;
  assert.deepEqual(got.map((g) => g.key), ["una"], "1 selección completa = sobre normal");
  assert.deepEqual((await call(torneo, "post", "/claim", { userId: u })).body.got, [], "no se cobra dos veces");

  await give("Chile");
  got = (await call(torneo, "post", "/claim", { userId: u })).body.got;
  assert.deepEqual(got.map((g) => g.key), ["chile"]);
  await give(nations[2]); await give(nations[3]);
  got = (await call(torneo, "post", "/claim", { userId: u })).body.got;
  assert.deepEqual(got.map((g) => g.key).sort(), ["cuatro", "todas"]);

  // Vender cartas después no hace que se cobre otra vez.
  await db.execute({ sql: "DELETE FROM user_cards WHERE user_id = ?", args: [u] });
  assert.deepEqual((await call(torneo, "post", "/claim", { userId: u })).body.got, []);
  const packs = (await db.execute({ sql: "SELECT source FROM card_packs WHERE user_id = ?", args: [u] })).rows.map((r) => r.source).sort();
  assert.equal(packs.length, 3, "normal, bueno y top");
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM event_badges WHERE user_id = ? AND kind = 'torneo'", args: [u] })).rows[0].n), 1);

  // Fuera de las fechas no hay banner ni álbum.
  await db.execute("UPDATE tournaments SET starts = '2020-01-01', ends = '2020-02-01'");
  assert.equal((await call(torneo, "get", "/current", { userId: u })).body.tournament, null);
});
