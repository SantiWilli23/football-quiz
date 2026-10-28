import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const { default: router } = await import("../routes/draft.js");
const D = await import("../utils/draft-engine.js");
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

const call = (method, p, { userId, body = {}, params = {}, query = {} } = {}) => new Promise((resolve) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
  handle({ userId, body, params, query, headers: {} }, res);
});

// El mejor fichaje posible: el de mayor valoración que encaje en un puesto libre.
function bestMove(pool, slots) {
  let best = null;
  pool.forEach((pl, pi) => slots.forEach((sl, si) => { if (!sl.filled && D.normalizePositions(pl.p).includes(sl.type) && (!best || pl.r > best.r)) best = { poolIdx: pi, slotIdx: si, r: pl.r }; }));
  return best;
}
function draftAll(seed, mode = "almanaque") {
  let s = D.newRun({ formation: "4-3-3", mode, style: "equilibrado" }, seed);
  for (let g = 0; s.phase === "draft" && g < 100; g++) { const m = bestMove(s.pool, s.slots); s = D.pick(s, m); }
  return s;
}

test("hay 139 planteles con al menos 11 jugadores y las 8 formaciones se pueden armar", () => {
  assert.equal(D.TEAMS.length, 139);
  assert.ok(D.TEAMS.every((t) => t.players.length >= 11));
  assert.equal(Object.keys(D.FORMATIONS).length, 8);
  for (const f of Object.keys(D.FORMATIONS)) {
    const s = draftAll(99, "almanaque");
    assert.equal(s.phase, "result", f);
  }
});

test("la misma semilla y las mismas elecciones dan el mismo draft y la misma Champions", () => {
  const a = D.playCup(draftAll(4242));
  const b = D.playCup(draftAll(4242));
  assert.deepEqual(a.cup, b.cup);
  assert.equal(a.cup.rounds.length, 4);
  assert.equal(a.cup.rounds[0].matches.length, 8);
  assert.equal(a.cup.rounds[3].matches.length, 1);
  // Cada partido tiene ganador y los empates se definen en prórroga o penales.
  for (const r of a.cup.rounds) for (const m of r.matches) {
    assert.ok(["home", "away"].includes(m.winner));
    if (m.scoreHome === m.scoreAway) assert.ok(m.pens, "empate = penales");
  }
});

test("en Clásico las valoraciones están ocultas mientras se arma el equipo", () => {
  const s = D.newRun({ formation: "4-4-2", mode: "clasico", style: "ofensivo" }, 7);
  const v = D.publicView(s);
  assert.ok(v.pool.length >= 8 && v.pool.every((p) => p.r === undefined));
  const alm = D.publicView(D.newRun({ formation: "4-4-2", mode: "almanaque", style: "ofensivo" }, 7));
  assert.ok(alm.pool.every((p) => typeof p.r === "number"));
});

test("los cambios de plantel se limitan por modo", () => {
  let c = D.newRun({ formation: "4-3-3", mode: "clasico", style: "equilibrado" }, 11);
  c = D.reroll(c, "club");
  assert.ok(!c.error);
  assert.match(D.reroll(c, "club").error, /cambios de equipo/);
  assert.match(D.reroll(c, "season").error, /otra temporada/, "Clásico no cambia de temporada");
  let a = D.newRun({ formation: "4-3-3", mode: "almanaque", style: "equilibrado" }, 11);
  a = D.reroll(a, "club"); a = D.reroll(a, "club");
  assert.match(D.reroll(a, "club").error, /cambios de equipo/, "máximo 2 de equipo");
});

test("no se puede fichar fuera de puesto ni en un puesto ocupado", () => {
  let s = D.newRun({ formation: "4-3-3", mode: "almanaque", style: "equilibrado" }, 21);
  const bad = s.pool.findIndex((p) => !D.normalizePositions(p.p).includes("GOL"));
  assert.match(D.pick(s, { poolIdx: bad, slotIdx: 0 }).error, /no juega/);
  const m = bestMove(s.pool, s.slots);
  s = D.pick(s, m);
  assert.match(D.pick(s, { poolIdx: 0, slotIdx: m.slotIdx }).error, /ocupado/);
  assert.match(D.pick(s, { poolIdx: 99, slotIdx: 0 }).error, /inválida/);
});

test("por la API: jugar entero, doble toque rechazado y ganar la copa suma 30 una vez al día", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Draft", members: ["dr1", "dr2"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const u = userIds[0];

  const start = await call("post", "/start", { userId: u, body: { formation: "4-4-2", mode: "almanaque", style: "defensivo" } });
  assert.equal(start.status, 201);
  assert.equal((await call("post", "/start", { userId: u, body: { formation: "9-9-9", mode: "clasico" } })).status, 400);
  let { id, step, draft } = start.body;
  // Jugada repetida con el mismo paso → 409 con el estado actual.
  const m = bestMove(draft.pool, draft.slots);
  const first = await call("post", "/:id/:action", { userId: u, params: { id, action: "pick" }, body: { step, ...m } });
  assert.equal(first.status, 200);
  assert.equal((await call("post", "/:id/:action", { userId: u, params: { id, action: "pick" }, body: { step, ...m } })).status, 409);
  ({ step, draft } = first.body);
  for (let g = 0; draft.phase === "draft" && g < 100; g++) {
    const mv = bestMove(draft.pool, draft.slots);
    const r = await call("post", "/:id/:action", { userId: u, params: { id, action: "pick" }, body: { step, ...mv } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    ({ step, draft } = r.body);
  }
  assert.equal(draft.phase, "result");
  assert.ok(draft.average > 70);
  // Fichajes de la ventana (De almanaque): 3 cambios.
  const t = await call("post", "/:id/:action", { userId: u, params: { id, action: "transfer" }, body: { step, slotIdx: 3 } });
  assert.equal(t.status, 200);
  assert.ok(t.body.draft.transferOptions.length >= 1);
  const ap = await call("post", "/:id/:action", { userId: u, params: { id, action: "apply" }, body: { step: t.body.step, optIdx: 0 } });
  assert.equal(ap.status, 200);
  assert.equal(ap.body.draft.transfersLeft, 2);
  const cup = await call("post", "/:id/:action", { userId: u, params: { id, action: "cup" }, body: { step: ap.body.step } });
  assert.equal(cup.status, 200);
  assert.equal(cup.body.draft.phase, "done");
  assert.equal((await call("post", "/:id/:action", { userId: u, params: { id, action: "cup" }, body: { step: cup.body.step } })).status, 409, "terminada");
  assert.equal((await call("get", "/active", { userId: u })).body.draft, null);

  // Campeón forzado: se busca una semilla que gane la copa y se arma esa partida en la base.
  let seed = 1; let st;
  for (; seed < 400; seed++) { const done = D.playCup(draftAll(seed)); if (done.final.champion) { st = draftAll(seed); break; } }
  assert.ok(st, "alguna semilla sale campeona");
  const ins = async () => Number((await db.execute({ sql: "INSERT INTO draft_runs (user_id, seed, state_json) VALUES (?, ?, ?)", args: [u, seed, JSON.stringify(st)] })).lastInsertRowid);
  const champ = await call("post", "/:id/:action", { userId: u, params: { id: await ins(), action: "cup" }, body: { step: 0 } });
  assert.equal(champ.body.draft.final.champion, true);
  assert.deepEqual(champ.body.draft.final.rewards.club.credited.map((c) => c.points), [30]);
  const again = await call("post", "/:id/:action", { userId: u, params: { id: await ins(), action: "cup" }, body: { step: 0 } });
  assert.equal(again.body.draft.final.rewards.club.credited.length, 0, "una sola vez por día");
  const ledger = (await db.execute({ sql: "SELECT points FROM points_ledger WHERE user_id = ? AND source = 'draft' AND date = ?", args: [u, todayStr()] })).rows;
  assert.equal(ledger.length, 1);
});
