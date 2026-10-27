import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const dm = await import("../utils/daily-match.js");
const ledger = await import("../utils/ledger.js");
const { default: router } = await import("../routes/daily-match.js");
const { todayStr } = await import("../utils/points.js");

before(async () => {
  await initSchema();
  // Banco mínimo de preguntas para la tanda de penales (el seed completo es lento).
  for (let i = 1; i <= 12; i++) {
    await db.execute({
      sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', ?, 'dificil')",
      args: [`Pregunta ${i}`, "abcd"[i % 4]],
    });
  }
});
after(() => cleanup());

function handler(method, path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function call(method, path, { userId, body = {}, query = {}, params = {} }) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { resolve({ status: this.statusCode, body: d }); return this; },
    };
    handler(method, path)({ userId, body, query, params }, res);
  });
}

test("el partido es el mismo para todos el mismo día y distinto de un día a otro", async () => {
  const a = await dm.matchFor("2026-04-01");
  const b = await dm.matchFor("2026-04-01");
  const c = await dm.matchFor("2026-04-02");
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((i) => i.key), c.map((i) => i.key));
  assert.equal(a.length, 6 + 8 + 3);
  assert.deepEqual([1, 2, 3].map((p) => a.filter((i) => i.part === p).length), [6, 8, 3]);
});

test("cada pregunta tiene su respuesta correcta entre las opciones y nada raro en las opciones", async () => {
  const items = await dm.matchFor("2026-04-03");
  for (const it of items) {
    assert.ok(it.answer >= 0 && it.answer < it.options.length, `respuesta válida en ${it.key}`);
    assert.equal(new Set(it.options).size, it.options.length, `opciones sin repetir en ${it.key}`);
  }
  for (const it of items.filter((i) => i.kind === "mas_menos")) {
    assert.notEqual(it.left.value, it.rightValue, "nunca valen igual");
    assert.equal(it.answer, it.rightValue > it.left.value ? 0 : 1);
  }
});

test("la vista pública no trae respuestas ni el valor oculto", async () => {
  const view = dm.publicView(await dm.matchFor("2026-04-04"));
  for (const it of view) {
    assert.equal("answer" in it, false);
    assert.equal("rightValue" in it, false);
  }
  assert.equal(view[0].idx, 0);
});

test("puntaje: 100 si aciertas todo al instante, 80% por acertar y 20% por rapidez", async () => {
  const items = await dm.matchFor("2026-04-05");
  const perfect = items.map((it) => ({ part: it.part, points: dm.itemPoints(it, true, 0) }));
  assert.equal(dm.partTotals(perfect).total, 100);
  const slow = items.map((it) => ({ part: it.part, points: dm.itemPoints(it, true, it.limitMs) }));
  assert.equal(dm.partTotals(slow).total, 80, "acertar todo sin velocidad = 80");
  assert.equal(dm.itemPoints(items[0], false, 0), 0);
  assert.deepEqual(dm.partTotals(perfect).parts, [33, 33, 34]);
});

test("el tiempo no se puede achicar mintiendo: manda lo que vio el servidor", () => {
  assert.equal(dm.trustedMs(100, 9000, 12000), 6000, "cliente dice 0,1 s pero pasaron 9 s");
  assert.equal(dm.trustedMs(5000, 5500, 12000), 5000, "una diferencia chica es latencia");
  assert.equal(dm.trustedMs(99999, 0, 12000), 12000, "no pasa del límite");
});

test("sobre según el marcador", () => {
  assert.equal(dm.packQualityForTotal(95), "top");
  assert.equal(dm.packQualityForTotal(60), "bueno");
  assert.equal(dm.packQualityForTotal(10), "normal");
  assert.equal(dm.packQualityForTotal(0), null);
});

test("flujo completo: responder en orden, cerrar una sola vez y sumar al club", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Partido", members: ["luli", "mati"] });
  await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const [luli, mati] = userIds;
  const today = (await call("get", "/today", { userId: luli })).body;
  assert.equal(today.items.length, 17);
  assert.equal(today.result, null);
  const full = await dm.matchFor(todayStr());

  // fuera de orden se rechaza
  const skip = await call("post", "/answer", { userId: luli, body: { idx: 3, answer: 0, ms: 1000 } });
  assert.equal(skip.status, 409);

  // cerrar antes de terminar se rechaza
  assert.equal((await call("post", "/finish", { userId: luli })).status, 409);

  for (let i = 0; i < full.length; i++) {
    const r = await call("post", "/answer", { userId: luli, body: { idx: i, answer: full[i].answer, ms: 1500 } });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.correct, full[i].answer);
  }
  // una pregunta ya respondida no se vuelve a responder
  assert.equal((await call("post", "/answer", { userId: luli, body: { idx: 0, answer: 0, ms: 1 } })).status, 409);

  const fin = await call("post", "/finish", { userId: luli });
  assert.equal(fin.status, 200);
  assert.ok(fin.body.total >= 80 && fin.body.total <= 100, `marcador ${fin.body.total}`);
  assert.equal(fin.body.already, false);
  assert.equal(fin.body.pack, "top");
  assert.equal(fin.body.club.credited[0].points, fin.body.total);

  // cerrar de nuevo no suma otra vez
  const again = await call("post", "/finish", { userId: luli });
  assert.equal(again.body.already, true);
  assert.equal(again.body.total, fin.body.total);

  const table = await ledger.clubTable(groupId, "hoy", todayStr());
  assert.equal(table.find((r) => r.userId === luli).points, fin.body.total);
  assert.equal(table.find((r) => r.userId === mati).points, 0);

  // no se puede responder después de cerrar
  assert.equal((await call("post", "/answer", { userId: luli, body: { idx: 0, answer: 0, ms: 1 } })).status, 409);
  // retomar: /today devuelve el resultado y las respuestas
  const back = (await call("get", "/today", { userId: luli })).body;
  assert.equal(back.result.total, fin.body.total);
  assert.equal(back.answered.length, full.length);
});

test("responder mal o dejar pasar el tiempo da 0 en esa pregunta", async () => {
  const { userIds } = await makeGroup(db, { name: "Errores", members: ["nora", "omar"] });
  const [nora] = userIds;
  const full = await dm.matchFor(todayStr());
  const wrong = (full[0].answer + 1) % full[0].options.length;
  const r0 = await call("post", "/answer", { userId: nora, body: { idx: 0, answer: wrong, ms: 500 } });
  assert.equal(r0.body.ok, false);
  assert.equal(r0.body.points, 0);
  const r1 = await call("post", "/answer", { userId: nora, body: { idx: 1, answer: null, ms: 0 } });
  assert.equal(r1.body.ok, false);
  assert.equal(r1.body.ms, full[1].limitMs, "sin respuesta cuenta el tiempo completo");
});

test("así respondió el club solo se ve después de jugar y el fantasma solo tras responder esa pregunta", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Fantasma", members: ["pia", "quito"] });
  await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const [pia, quito] = userIds;
  const full = await dm.matchFor(todayStr());
  // quito juega primero y gana puntos en el mes (para ser el rival de pia)
  for (let i = 0; i < full.length; i++) await call("post", "/answer", { userId: quito, body: { idx: i, answer: full[i].answer, ms: 800 } });
  await call("post", "/finish", { userId: quito });

  assert.equal((await call("get", "/club-stats", { userId: pia, query: { groupId } })).status, 409, "antes de jugar no se ve");
  assert.equal((await call("get", "/ghost", { userId: pia, query: { groupId, idx: 0 } })).body.ghost, null, "sin responder no hay fantasma");

  await call("post", "/answer", { userId: pia, body: { idx: 0, answer: full[0].answer, ms: 900 } });
  const ghost = (await call("get", "/ghost", { userId: pia, query: { groupId, idx: 0 } })).body.ghost;
  assert.equal(ghost.username, "quito");
  assert.equal(ghost.ok, true);
  assert.equal((await call("get", "/ghost", { userId: pia, query: { groupId, idx: 1 } })).body.ghost, null, "la siguiente aún no");
  const rival = (await call("get", "/rival", { userId: pia, query: { groupId } })).body.rival;
  assert.equal(rival.username, "quito");

  for (let i = 1; i < full.length; i++) await call("post", "/answer", { userId: pia, body: { idx: i, answer: full[i].answer, ms: 900 } });
  await call("post", "/finish", { userId: pia });
  const stats = (await call("get", "/club-stats", { userId: pia, query: { groupId } })).body;
  assert.equal(stats.questions.length, full.length);
  assert.ok(stats.questions.every((q) => q.pct === 100 && q.players === 2));
  // alguien de afuera no ve nada
  const outsider = (await makeGroup(db, { name: "Otro", members: ["rudy", "sol"] })).userIds[0];
  assert.equal((await call("get", "/club-stats", { userId: outsider, query: { groupId } })).status, 403);
});

test("archivo: solo fechas pasadas con partido, y trae las respuestas para practicar", async () => {
  const yesterday = (() => { const d = new Date(`${todayStr()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  await dm.matchFor(yesterday);
  const list = (await call("get", "/archive", { userId: 1 })).body.days;
  assert.ok(list.some((d) => d.date === yesterday));
  const past = await call("get", "/archive/:date", { userId: 1, params: { date: yesterday } });
  assert.equal(past.status, 200);
  assert.equal(past.body.practice, true);
  assert.ok("answer" in past.body.items[0]);
  assert.equal((await call("get", "/archive/:date", { userId: 1, params: { date: todayStr() } })).status, 400, "hoy no es archivo");
  assert.equal((await call("get", "/archive/:date", { userId: 1, params: { date: "2020-01-01" } })).status, 400);
});

test("sin señal: se envían las respuestas al volver, con piso de tiempo y una sola vez", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Offline", members: ["sara", "tito"] });
  await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const sara = userIds[0];
  const full = await dm.matchFor(todayStr());

  // incompleta se rechaza
  const partial = await call("post", "/sync", { userId: sara, body: { date: todayStr(), answers: [{ answer: 0, ms: 100 }] } });
  assert.equal(partial.status, 400);
  // una fecha vencida se rechaza
  assert.equal((await call("post", "/sync", { userId: sara, body: { date: "2020-01-01", answers: [] } })).status, 400);

  const answers = full.map((it) => ({ answer: it.answer, ms: 1 })); // todo bien y "instantáneo"
  const r = await call("post", "/sync", { userId: sara, body: { date: todayStr(), answers } });
  assert.equal(r.status, 200);
  assert.equal(r.body.synced, true);
  // con el piso de 30% del tiempo no se llega a 100: 80 + 20 × 0,7 = 94
  assert.ok(r.body.total >= 92 && r.body.total <= 96, `marcador ${r.body.total}`);
  assert.equal(r.body.club.credited[0].points, r.body.total);

  // reenviar no suma de nuevo
  const again = await call("post", "/sync", { userId: sara, body: { date: todayStr(), answers } });
  assert.equal(again.body.already, true);
  const row = (await ledger.clubTable(groupId, "hoy", todayStr())).find((x) => x.userId === sara);
  assert.equal(row.points, r.body.total);
});
