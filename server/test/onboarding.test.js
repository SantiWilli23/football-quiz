import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const { default: publicRouter } = await import("../routes/public.js");
const { default: meRouter } = await import("../routes/me.js");
const { default: cardsRouter } = await import("../routes/cards.js");
const { default: groupsRouter } = await import("../routes/groups.js");
const clubs = await import("../utils/clubs.js");

before(async () => {
  await initSchema();
  for (let i = 1; i <= 12; i++) {
    await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [`Pregunta ${i}`] });
  }
});
after(() => cleanup());

function call(router, method, p, { userId, body = {}, query = {}, params = {} }) {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body, query, params, headers: {} }, res);
  });
}

test("la bandera del rediseño se puede preguntar sin iniciar sesión", async () => {
  assert.equal((await call(publicRouter, "get", "/features", {})).body.futotal2, false);
  process.env.FUTOTAL2 = "1";
  try { assert.equal((await call(publicRouter, "get", "/features", {})).body.futotal2, true); } finally { process.env.FUTOTAL2 = "0"; }
});

test("partido de práctica de la portada: 6 preguntas con respuesta, iguales para todos", async () => {
  const a = (await call(publicRouter, "get", "/practice", {})).body;
  const b = (await call(publicRouter, "get", "/practice", {})).body;
  assert.equal(a.items.length, 6);
  assert.deepEqual(a.items.map((i) => i.kind), ["quien", "quien", "mas_menos", "mas_menos", "penal", "penal"]);
  assert.deepEqual(a.items.map((i) => i.key), b.items.map((i) => i.key));
  assert.ok(a.items.every((i) => Number.isInteger(i.answer) && i.options.length >= 2 && i.limitMs > 0));
});

async function newUser(name) {
  const g = await makeGroup(db, { name: `Onb ${name}`, members: [name, `${name}2`] });
  return { groupId: g.groupId, a: g.userIds[0], b: g.userIds[1] };
}

test("sobre de bienvenida: uno por cuenta, se abre sin club y trae una carta del club favorito", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const u = await newUser("bienv");
    assert.equal((await call(meRouter, "post", "/welcome", { userId: u.a, body: {} })).status, 400);
    const first = await call(meRouter, "post", "/welcome", { userId: u.a, body: { club: "Real Madrid" } });
    assert.equal(first.body.granted, true);
    const again = await call(meRouter, "post", "/welcome", { userId: u.a, body: { club: "Barcelona" } });
    assert.equal(again.body.granted, false, "uno por cuenta");

    // sin ningún club iniciado, el de bienvenida igual se abre
    const st = await clubs.packStatus(u.a);
    assert.equal(st.openable.length, 1);

    const opened = await call(cardsRouter, "post", "/open", { userId: u.a });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.cards.length, 5);
    const names = opened.body.cards.map((c) => c.name);
    const { default: _unused } = await import("../routes/cards.js");
    void _unused;
    const state = (await call(cardsRouter, "get", "/collection", { userId: u.a })).body.cards;
    assert.ok(state.length > 0);
    // la primera carta es de un jugador que pasó por el Real Madrid
    const players = (await import("node:fs")).default.readFileSync(new URL("../data/equipo-jugador-players.json", import.meta.url), "utf-8");
    const base = JSON.parse(players).jugadores;
    const first5 = base.find((p) => p.nombre === names[0].split(" · ")[0]);
    assert.ok(first5 && first5.carrera.some((c) => c.club === "Real Madrid"), `${names[0]} debería haber jugado en el Real Madrid`);
  } finally {
    process.env.FUTOTAL2 = "0";
  }
});

test("invitación con desafío: «Juan te desafía» solo si es del club y jugó", async () => {
  const g = await makeGroup(db, { name: "Reto", members: ["retador", "amigo"] });
  const code = (await db.execute({ sql: "SELECT invite_code FROM groups_t WHERE id = ?", args: [g.groupId] })).rows[0].invite_code;
  await db.execute({ sql: "INSERT INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, '2026-01-02', 0, 0, 0, 55)", args: [g.userIds[0]] });
  await db.execute({ sql: "INSERT INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, '2026-01-03', 0, 0, 0, 78)", args: [g.userIds[0]] });
  const withChallenge = (await call(groupsRouter, "get", "/invite/:code/preview", { params: { code }, query: { de: "retador" } })).body;
  assert.deepEqual(withChallenge.challenge, { from: "retador", score: 78, date: "2026-01-03" }, "el último marcador");
  const none = (await call(groupsRouter, "get", "/invite/:code/preview", { params: { code }, query: {} })).body;
  assert.equal(none.challenge, null);
  const notPlayed = (await call(groupsRouter, "get", "/invite/:code/preview", { params: { code }, query: { de: "amigo" } })).body;
  assert.equal(notPlayed.challenge, null, "quien nunca jugó no desafía");
  const stranger = (await call(groupsRouter, "get", "/invite/:code/preview", { params: { code }, query: { de: "nadie" } })).body;
  assert.equal(stranger.challenge, null);
});
