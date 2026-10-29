import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const { default: router } = await import("../routes/dt-league.js");

before(async () => { await initSchema(); });
after(() => cleanup());

const call = (method, p, { userId, body = {}, params = {} } = {}) => new Promise((resolve) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
  handle({ userId, body, query: {}, params, headers: {} }, res);
});

async function setup(week = 2) {
  const { groupId, userIds: [a, b] } = await makeGroup(db, { name: `Liga ${week}`, members: [`ma${week}`, `mb${week}`] });
  const code = `MKT${week}`;
  const lg = await db.execute({ sql: "INSERT INTO dt_leagues (name, league_key, invite_code, created_by, group_id, status, current_week, total_weeks) VALUES ('L', 'premier', ?, ?, ?, 'in_progress', ?, 38)", args: [code, a, groupId, week] });
  const leagueId = Number(lg.lastInsertRowid);
  for (const [uid, team] of [[a, "mancity"], [b, "liverpool"]]) {
    await db.execute({ sql: "INSERT INTO dt_league_members (league_id, user_id, team_id) VALUES (?, ?, ?)", args: [leagueId, uid, team] });
    const state = { teamId: team, budget: 50, squad: [{ id: `${team}-9`, name: `Goleador ${team}`, position: "ST", age: 25, ovr: 82, value: 30, wage: 100 }] };
    await db.execute({ sql: "INSERT INTO dt_league_squads (league_id, user_id, team_id, state, power) VALUES (?, ?, ?, ?, 80)", args: [leagueId, uid, team, JSON.stringify(state)] });
  }
  return { code, a, b };
}

test("oferta, contraoferta y trato cerrado entre dos managers", async () => {
  const { code, a, b } = await setup(2);
  const sq = await call("get", "/:code/managers-squads", { userId: a, params: { code } });
  assert.equal(sq.body.managers[0].players[0].id, "liverpool-9");

  const off = await call("post", "/:code/player-offers", { userId: a, params: { code }, body: { sellerId: b, playerId: "liverpool-9", amount: 20 } });
  assert.equal(off.status, 201, JSON.stringify(off.body));
  // No hay dos ofertas abiertas por el mismo jugador.
  assert.equal((await call("post", "/:code/player-offers", { userId: a, params: { code }, body: { sellerId: b, playerId: "liverpool-9", amount: 25 } })).status, 409);
  // El comprador no puede aceptar su propia oferta.
  assert.equal((await call("post", "/:code/player-offers/:id/respond", { userId: a, params: { code, id: off.body.id }, body: { action: "accept" } })).status, 400);

  const counter = await call("post", "/:code/player-offers/:id/respond", { userId: b, params: { code, id: off.body.id }, body: { action: "counter", amount: 28 } });
  assert.equal(counter.body.countered, true);
  const acc = await call("post", "/:code/player-offers/:id/respond", { userId: a, params: { code, id: off.body.id }, body: { action: "accept" } });
  assert.equal(acc.body.accepted, true);
  assert.equal(acc.body.amount, 28);

  const movesA = (await call("get", "/:code/player-moves", { userId: a, params: { code } })).body.moves;
  assert.equal(movesA[0].kind, "in");
  assert.equal(movesA[0].player.name, "Goleador liverpool");
  const movesB = (await call("get", "/:code/player-moves", { userId: b, params: { code } })).body.moves;
  assert.deepEqual([movesB[0].kind, movesB[0].amount], ["out", 28]);
  await call("post", "/:code/player-moves/:offerId/ack", { userId: a, params: { code, offerId: movesA[0].offerId } });
  assert.equal((await call("get", "/:code/player-moves", { userId: a, params: { code } })).body.moves.length, 0);
  assert.equal((await call("get", "/:code/player-moves", { userId: b, params: { code } })).body.moves.length, 1, "el vendedor todavía no lo aplicó");
});

test("con el mercado cerrado no se puede ofertar, y sin plata tampoco", async () => {
  const closed = await setup(12);
  assert.equal((await call("post", "/:code/player-offers", { userId: closed.a, params: { code: closed.code }, body: { sellerId: closed.b, playerId: "liverpool-9", amount: 10 } })).status, 400);
  const open = await setup(3);
  const r = await call("post", "/:code/player-offers", { userId: open.a, params: { code: open.code }, body: { sellerId: open.b, playerId: "liverpool-9", amount: 80 } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /No te alcanza/);
});
