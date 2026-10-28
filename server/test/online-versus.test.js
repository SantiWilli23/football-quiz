import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
process.env.JWT_SECRET = "test-secret";
const { db, initSchema } = await import("../db/client.js");
const { attachWsRelay, sharedRoomWithOther } = await import("../ws-relay.js");
const { default: router } = await import("../routes/online-games.js");
const { todayStr } = await import("../utils/points.js");

let server; let port; let wss;
before(async () => {
  await initSchema();
  server = http.createServer();
  wss = attachWsRelay(server);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => { wss.clients.forEach((c) => c.terminate()); wss.close(); server.close(); cleanup(); });

const call = (userId, body) => new Promise((resolve) => {
  const layer = router.stack.find((l) => l.route && l.route.path === "/win");
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
  handle({ userId, body, query: {}, params: {}, headers: {} }, res);
});
const open = (msg) => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  ws.on("open", () => ws.send(JSON.stringify(msg)));
  ws.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "created" || m.type === "joined") resolve({ ws, m }); if (m.type === "error") reject(new Error(m.message)); });
});

test("ganar online solo suma versus si el relay vio a otra persona con sesión en la sala", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Online", members: ["on1", "on2", "on3"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const [a, b, c] = userIds;
  const tok = (id) => jwt.sign({ userId: id }, "test-secret");
  const versus = async (u) => (await db.execute({ sql: "SELECT points FROM points_ledger WHERE user_id = ? AND source = 'versus' AND date = ?", args: [u, todayStr()] })).rows.map((r) => Number(r.points));

  // Sin sala: reportar una victoria no da versus (sí los puntos online de siempre).
  const lone = await call(c, { gameKey: "mentiroso", groupId, opponents: 1, room: "fantasma" });
  assert.equal(lone.status, 201);
  assert.equal(lone.body.club, null);
  assert.deepEqual(await versus(c), []);

  // Sala con dos personas con sesión: el ganador suma 30.
  const host = await open({ type: "create", game: "mentiroso", token: tok(a) });
  const guest = await open({ type: "join", game: "mentiroso", room: host.m.room, token: tok(b) });
  assert.deepEqual(sharedRoomWithOther(a, "mentiroso").others, 1);
  const win = await call(a, { gameKey: "mentiroso", groupId, opponents: 1, room: "m-1" });
  assert.deepEqual(win.body.club.credited.map((x) => x.points), [30]);
  // Otro juego distinto no hereda la sala.
  assert.equal(sharedRoomWithOther(a, "survival"), null);
  // Una segunda victoria el mismo día no vuelve a sumar.
  const again = await call(a, { gameKey: "mentiroso", groupId, opponents: 1, room: "m-2" });
  assert.equal(again.body.club.credited.length, 0);
  assert.deepEqual(await versus(a), [30]);
  host.ws.close(); guest.ws.close();

  // Una sala donde el otro no tenía sesión (sin token) no cuenta.
  const h2 = await open({ type: "create", game: "survival", token: tok(c) });
  const g2 = await open({ type: "join", game: "survival", room: h2.m.room });
  assert.equal(sharedRoomWithOther(c, "survival"), null);
  h2.ws.close(); g2.ws.close();
});
