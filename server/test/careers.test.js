import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const { default: router } = await import("../routes/careers.js");
const E = await import("../utils/career-engine.js");
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

const call = (method, p, { userId, body = {}, query = {}, params = {} } = {}) => new Promise((resolve) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
  handle({ userId, body, query, params, headers: {} }, res);
});
const player = (extra = {}) => ({ surname: "Cabrera", number: 10, foot: "zurdo", nation: "Chile", pos: "FWD", profile: "tecnica", ...extra });

// Juega una carrera entera por la API eligiendo siempre la primera opción.
async function playAll(userId, game, mode) {
  const start = await call("post", "/start", { userId, body: { game, mode, player: player() } });
  assert.equal(start.status, 201, JSON.stringify(start.body));
  let { id, step, career } = start.body;
  for (let i = 0; i < 700 && !career.retired; i++) {
    const choice = career.phase === "summary" ? "continue" : career.phase === "transfer" ? "stay" : career.pending.options[0].key;
    const r = await call("post", "/:id/act", { userId, params: { id }, body: { step, choice } });
    assert.equal(r.status, 200, `${career.phase}: ${JSON.stringify(r.body)}`);
    ({ step, career } = r.body);
  }
  assert.ok(career.retired, "la carrera termina");
  return { id, career };
}

test("las dos versiones se juegan enteras por la API y el servidor calcula el puntaje", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Cotrero", members: ["cot1", "cot2"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const u = userIds[0];
  for (const [game, mode] of [["cotrero", "exp" + "res"], ["cotrero", "intensa"], ["cotrero", "normal"], ["cotrero_medio", "normal"]]) {
    const { career } = await playAll(u, game, mode);
    assert.ok(career.final.score > 0 && career.final.score <= 3000);
    assert.equal(career.final.label, E.labelOf(career.final.score, game));
    assert.ok(career.final.seasons >= 3);
  }
  // Cotrero medio cierra con reputación y figura parecida; el simple no.
  const med = await playAll(u, "cotrero_medio", "normal");
  assert.ok(med.career.final.figure?.name);
  assert.ok(["Ídolo", "Querido", "Profesional", "Polémico", "Villano"].includes(med.career.final.repLabel));
  // Solo suma 20 «carrera» una vez al día, aunque se terminen varias.
  const rows = (await db.execute({ sql: "SELECT points FROM points_ledger WHERE user_id = ? AND source = 'carrera' AND date = ?", args: [u, todayStr()] })).rows;
  assert.deepEqual(rows.map((r) => Number(r.points)), [20]);
  const verified = (await db.execute({ sql: "SELECT game, verified FROM career_scores WHERE user_id = ? ORDER BY game", args: [u] })).rows;
  assert.deepEqual(verified.map((r) => [r.game, Number(r.verified)]), [["cotrero", 1], ["cotrero_medio", 1]]);
});

test("mismo estado y misma elección dan lo mismo (semilla) y el doble toque no avanza", async () => {
  const { userIds } = await makeGroup(db, { name: "Semilla", members: ["sem1", "sem2"] });
  const p = E.validatePlayer("cotrero", player()).player;
  const a = E.act(E.newCareer("cotrero", "normal", p, 12345), { choice: E.newCareer("cotrero", "normal", p, 12345).pending.options[0].key });
  const b = E.act(E.newCareer("cotrero", "normal", p, 12345), { choice: E.newCareer("cotrero", "normal", p, 12345).pending.options[0].key });
  assert.deepEqual(a, b);

  const u = userIds[0];
  const start = await call("post", "/start", { userId: u, body: { game: "cotrero", mode: "normal", player: player() } });
  const { id } = start.body;
  const opt = start.body.career.pending.options[0].key;
  const first = await call("post", "/:id/act", { userId: u, params: { id }, body: { step: 0, choice: opt } });
  assert.equal(first.status, 200);
  assert.equal(first.body.step, 1);
  const again = await call("post", "/:id/act", { userId: u, params: { id }, body: { step: 0, choice: opt } });
  assert.equal(again.status, 200);
  assert.equal(again.body.step, 1, "no avanzó dos veces");
  assert.equal(again.body.repeated, true);
  const stale = await call("post", "/:id/act", { userId: u, params: { id }, body: { step: 0, choice: "otra" } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.step, 1, "responde el estado actual");
  const noOpt = await call("post", "/:id/act", { userId: u, params: { id }, body: { step: 1, choice: "inventada" } });
  assert.equal(noOpt.status, 400);
  // Otro usuario no toca mi carrera.
  assert.equal((await call("post", "/:id/act", { userId: userIds[1], params: { id }, body: { step: 1, choice: "continue" } })).status, 404);
});

test("continuar desde otro aparato, validación del jugador y tope de 10 inicios", async () => {
  const { userIds } = await makeGroup(db, { name: "Inicios", members: ["ini1", "ini2"] });
  const u = userIds[0];
  assert.equal((await call("post", "/start", { userId: u, body: { game: "cotrero", mode: "normal", player: player({ surname: "A" }) } })).status, 400);
  assert.equal((await call("post", "/start", { userId: u, body: { game: "cotrero", mode: "loca", player: player() } })).status, 400);
  assert.equal((await call("post", "/start", { userId: u, body: { game: "cotrero_medio", player: player({ pos: "GK" }) } })).status, 400, "el medio solo es delantero o enganche");
  assert.equal((await call("get", "/active", { userId: u, query: { game: "cotrero" } })).body.career, null);
  const s1 = await call("post", "/start", { userId: u, body: { game: "cotrero", mode: "normal", player: player() } });
  const act = await call("get", "/active", { userId: u, query: { game: "cotrero" } });
  assert.equal(act.body.id, s1.body.id);
  // Empezar otra deja la anterior abandonada.
  const s2 = await call("post", "/start", { userId: u, body: { game: "cotrero", mode: "normal", player: player() } });
  assert.equal((await call("get", "/active", { userId: u, query: { game: "cotrero" } })).body.id, s2.body.id);
  assert.equal((await db.execute({ sql: "SELECT status FROM careers WHERE id = ?", args: [s1.body.id] })).rows[0].status, "abandonada");
  for (let i = 0; i < 8; i++) await call("post", "/start", { userId: u, body: { game: "cotrero", mode: "normal", player: player() } });
  assert.equal((await call("post", "/start", { userId: u, body: { game: "cotrero", mode: "normal", player: player() } })).status, 429);
});

test("un puntaje mandado desde el teléfono queda sin verificar y no pisa uno verificado", async () => {
  const { userIds } = await makeGroup(db, { name: "Verif", members: ["ver1", "ver2"] });
  const u = userIds[0];
  await call("post", "/score", { userId: u, body: { game: "cotrero", score: 2000, label: "Leyenda", name: "Truchado" } });
  let row = (await db.execute({ sql: "SELECT score, verified FROM career_scores WHERE user_id = ? AND game = 'cotrero'", args: [u] })).rows[0];
  assert.deepEqual([Number(row.score), Number(row.verified)], [2000, 0]);
  assert.equal((await db.execute({ sql: "SELECT 1 FROM user_achievements WHERE user_id = ? AND key = 'leyenda_cotrero'", args: [u] })).rows.length, 0, "el puntaje del teléfono no da el logro");

  // Una carrera verificada mejor reemplaza al no verificado… pero nunca al revés.
  await db.execute({ sql: "UPDATE career_scores SET score = 300, verified = 1 WHERE user_id = ? AND game = 'cotrero'", args: [u] });
  await call("post", "/score", { userId: u, body: { game: "cotrero", score: 2900, label: "Leyenda" } });
  row = (await db.execute({ sql: "SELECT score, verified FROM career_scores WHERE user_id = ? AND game = 'cotrero'", args: [u] })).rows[0];
  assert.deepEqual([Number(row.score), Number(row.verified)], [300, 1]);
});
