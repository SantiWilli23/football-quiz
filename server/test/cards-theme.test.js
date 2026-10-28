import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const cards = await import("../routes/cards.js");
const { default: router } = cards;
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

function call(method, path, { userId, body = {}, query = {}, params = {} }) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body, query, params }, res);
  });
}

async function newUser(name) {
  const { userIds } = await makeGroup(db, { name: `Cartas ${name}`, members: [name, `${name}x`] });
  return userIds[0];
}

const FORMATION_433 = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

test("el período temático dura 14 días, rota y siempre tiene un tema armable", () => {
  const a = cards.themePeriod("2026-10-26");
  const b = cards.themePeriod("2026-11-08");
  const c = cards.themePeriod("2026-11-09");
  assert.equal(a.start, b.start, "los 14 días son el mismo período");
  assert.notEqual(a.start, c.start);
  assert.equal(a.end, "2026-11-08");
  assert.ok(a.theme && c.theme);
  const by = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const card of a.theme.pool) by[card.pos] += 1;
  assert.ok(by.GK >= 2 && by.DEF >= 5 && by.MID >= 5 && by.FWD >= 4, "al menos 2 arqueros y suficientes por línea");
});

async function giveRepeats(userId, theme, counts = { GK: 1, DEF: 4, MID: 3, FWD: 3 }) {
  const picked = [];
  for (const pos of Object.keys(counts)) {
    const pool = theme.pool.filter((c) => c.pos === pos).slice(0, counts[pos]);
    for (const card of pool) {
      await db.execute({ sql: "INSERT OR REPLACE INTO user_cards (user_id, player_name, count) VALUES (?, ?, 2)", args: [userId, card.name] });
      picked.push(card.name);
    }
  }
  return picked;
}

test("SBC temático: con 11 repetidas de la temática se entrega y siempre queda una copia", async () => {
  const user = await newUser("tema1");
  const { theme, start } = cards.themePeriod(todayStr());
  const names = await giveRepeats(user, theme);
  assert.equal(names.length, 11);

  const state = (await call("get", "/sbc-tema", { userId: user })).body;
  assert.equal(state.theme.key, theme.key);
  assert.equal(state.done, false);
  assert.equal(state.owned, 11, "contador 11/11 con la mejor formación");
  assert.equal(state.best.total, 0);

  const ok = await call("post", "/sbc-tema/submit", { userId: user, body: { formation: "4-3-3", players: names } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const left = (await db.execute({ sql: "SELECT player_name, count FROM user_cards WHERE user_id = ?", args: [user] })).rows;
  assert.ok(left.every((r) => Number(r.count) === 1), "queda 1 copia de cada carta");
  const pack = (await db.execute({ sql: "SELECT source, theme, date FROM card_packs WHERE user_id = ?", args: [user] })).rows[0];
  assert.equal(pack.theme, theme.key);
  assert.equal(pack.date, start);
  assert.match(pack.source, /^bueno-sbctema-/);

  // una sola vez por período
  const again = await call("post", "/sbc-tema/submit", { userId: user, body: { formation: "4-3-3", players: names } });
  assert.equal(again.status, 409);
});

test("SBC temático: rechaza cartas sin repetir, de otra temática o que no calzan con la formación", async () => {
  const user = await newUser("tema2");
  const { theme } = cards.themePeriod(todayStr());
  const names = await giveRepeats(user, theme);

  // una sola copia de una de las cartas
  await db.execute({ sql: "UPDATE user_cards SET count = 1 WHERE user_id = ? AND player_name = ?", args: [user, names[0]] });
  let r = await call("post", "/sbc-tema/submit", { userId: user, body: { formation: "4-3-3", players: names } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /repetidas/);
  await db.execute({ sql: "UPDATE user_cards SET count = 2 WHERE user_id = ? AND player_name = ?", args: [user, names[0]] });

  // la formación no calza (4-3-3 cartas en 4-4-2)
  r = await call("post", "/sbc-tema/submit", { userId: user, body: { formation: "4-4-2", players: names } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /formación/);

  // una carta de otra temática
  const other = cards.themePeriod(todayStr()).theme.key === "portugal" ? "Lionel Messi" : "Cristiano Ronaldo";
  await db.execute({ sql: "INSERT OR REPLACE INTO user_cards (user_id, player_name, count) VALUES (?, ?, 2)", args: [user, other] });
  r = await call("post", "/sbc-tema/submit", { userId: user, body: { formation: "4-3-3", players: [...names.slice(0, 10), other] } });
  assert.equal(r.status, 400);

  r = await call("post", "/sbc-tema/submit", { userId: user, body: { formation: "9-9-9", players: names } });
  assert.equal(r.status, 400);
  r = await call("post", "/sbc-tema/submit", { userId: user, body: { formation: "4-3-3", players: names.slice(0, 10) } });
  assert.equal(r.status, 400);
});

test("el contador dice qué línea te falta", async () => {
  const user = await newUser("tema3");
  const { theme } = cards.themePeriod(todayStr());
  await giveRepeats(user, theme, { GK: 0, DEF: 4, MID: 3, FWD: 3 });
  const state = (await call("get", "/sbc-tema", { userId: user })).body;
  assert.equal(state.owned, 10);
  assert.deepEqual(state.best.missing, { GK: 1 });
});

test("tienda temática: cuesta 100 monedas y el sobre trae solo cartas de la temática", async () => {
  const user = await newUser("tema4");
  const { theme } = cards.themePeriod(todayStr());
  assert.equal((await call("post", "/sbc-tema/shop", { userId: user })).status, 400, "sin monedas no se compra");
  await db.execute({ sql: "INSERT INTO card_wallets (user_id, balance, updated_at) VALUES (?, 150, datetime('now'))", args: [user] });
  const buy = await call("post", "/sbc-tema/shop", { userId: user });
  assert.equal(buy.status, 200);
  assert.equal(buy.body.balance, 50);

  const opened = await call("post", "/open", { userId: user });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.equal(opened.body.cards.length, 5);
  const inTheme = new Set(theme.pool.map((c) => c.name));
  assert.ok(opened.body.cards.every((c) => inTheme.has(c.name)), "las 5 son de la temática");
  assert.ok(opened.body.cards.some((c) => c.tier === "estrella" || c.tier === "oro" || c.tier === "plata" || c.tier === "bronce"));
});

test("con FUTOTAL2 cada sobre normal trae una carta de la temática", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const user = await newUser("tema5");
    const { theme } = cards.themePeriod(todayStr());
    const inTheme = new Set(theme.pool.map((c) => c.name));
    // varios sobres para no depender del azar de la última carta
    for (let i = 1; i <= 6; i++) await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [user, `2026-01-0${i}`, `normal${i}`] });
    const { userIds } = await makeGroup(db, { name: "ClubSbc", members: ["u5a", "u5b"] });
    await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-01-01' WHERE id = (SELECT group_id FROM group_members WHERE user_id = ? LIMIT 1)", args: [userIds[0]] });
    await db.execute({ sql: "INSERT INTO group_members (group_id, user_id) SELECT group_id, ? FROM group_members WHERE user_id = ? LIMIT 1", args: [user, userIds[0]] });
    for (let i = 0; i < 6; i++) {
      const r = await call("post", "/open", { userId: user });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.ok(r.body.cards.some((c) => inTheme.has(c.name)), `el sobre ${i + 1} trae una carta de la temática`);
    }
  } finally {
    process.env.FUTOTAL2 = "0";
  }
});

test("carta del día: se gana acertando el primer ¿Quién es? y aparece en el álbum", async () => {
  const dm = await import("../utils/daily-match.js");
  const { default: dailyRouter } = await import("../routes/daily-match.js");
  const callDaily = (method, path, userId, body = {}) => {
    const layer = dailyRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
    const handle = layer.route.stack[layer.route.stack.length - 1].handle;
    return new Promise((resolve) => {
      const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
      handle({ userId, body, query: {}, params: {} }, res);
    });
  };
  for (let i = 1; i <= 12; i++) {
    await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [`Pregunta ${i}`] });
  }
  const winner = await newUser("album1");
  const loser = await newUser("album2");
  const items = await dm.matchFor(todayStr());
  const play = async (userId, firstOk) => {
    for (let i = 0; i < items.length; i++) {
      const right = items[i].answer;
      const answer = i === 0 && !firstOk ? (right + 1) % items[i].options.length : right;
      await callDaily("post", "/answer", userId, { idx: i, answer, ms: 1000 });
    }
    return (await callDaily("post", "/finish", userId)).body;
  };
  const w = await play(winner, true);
  const l = await play(loser, false);
  assert.equal(w.dailyCard, items[0].options[items[0].answer]);
  assert.equal(l.dailyCard, null);

  const album = (await call("get", "/album", { userId: winner, query: {} })).body;
  const today = album.days.find((d) => d.date === todayStr());
  assert.equal(today.player, w.dailyCard);
  assert.equal(album.collected, 1);
  const empty = (await call("get", "/album", { userId: loser, query: {} })).body;
  assert.equal(empty.days.find((d) => d.date === todayStr()).player, null, "fallaste: la casilla queda vacía");
  // la edición del día no se vende (no está en user_cards)
  const owned = (await db.execute({ sql: "SELECT 1 FROM user_cards WHERE user_id = ? AND player_name = ?", args: [winner, w.dailyCard] })).rows[0];
  assert.equal(owned, undefined);
});

async function twoFriends(a, b) {
  const { groupId, userIds } = await makeGroup(db, { name: `Trade ${a}${b}`, members: [a, b] });
  return { groupId, a: userIds[0], b: userIds[1] };
}
const give = (userId, name, count) => db.execute({ sql: "INSERT OR REPLACE INTO user_cards (user_id, player_name, count) VALUES (?, ?, ?)", args: [userId, name, count] });
const copies = async (userId, name) => Number((await db.execute({ sql: "SELECT count FROM user_cards WHERE user_id = ? AND player_name = ?", args: [userId, name] })).rows[0]?.count || 0);

test("intercambio: repetida por repetida, misma categoría, solo entre amigos del club y una vez por día", async () => {
  const { a, b } = await twoFriends("tradeA", "tradeB");
  const stranger = await newUser("tradeZ");
  const bronze = (await call("get", "/all", { userId: a })).body?.cards;
  void bronze;
  const { theme } = cards.themePeriod(todayStr());
  const tierCards = (tier) => theme.pool.filter((c) => c.tier === tier);
  const tier = ["bronce", "plata", "oro"].find((t) => tierCards(t).length >= 3);
  const [c1, c2, c3] = tierCards(tier);
  const other = ["estrella", "oro", "plata", "bronce"].find((t) => t !== tier && tierCards(t).length);
  await give(a, c1.name, 2);
  await give(b, c2.name, 2);
  await give(a, c3.name, 1);

  let r = await call("post", "/trades", { userId: a, body: { toUserId: stranger, give: c1.name, want: c2.name } });
  assert.equal(r.status, 400, "no es del club");
  r = await call("post", "/trades", { userId: a, body: { toUserId: b, give: c3.name, want: c2.name } });
  assert.equal(r.status, 400, "no tienes repetida esa carta");
  r = await call("post", "/trades", { userId: a, body: { toUserId: b, give: c1.name, want: tierCards(other)[0].name } });
  assert.equal(r.status, 400, "otra categoría");

  r = await call("post", "/trades", { userId: a, body: { toUserId: b, give: c1.name, want: c2.name } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.id;
  const pend = (await call("get", "/trades", { userId: b })).body;
  assert.equal(pend.trades[0].status, "pending");
  assert.equal((await call("post", "/trades/:id/accept", { userId: a, params: { id } })).status, 404, "solo el destinatario acepta");

  const ok = await call("post", "/trades/:id/accept", { userId: b, params: { id } });
  assert.equal(ok.status, 200);
  assert.equal(await copies(a, c1.name), 1);
  assert.equal(await copies(b, c1.name), 1);
  assert.equal(await copies(b, c2.name), 1);
  assert.equal(await copies(a, c2.name), 1);
  assert.equal((await call("get", "/trades", { userId: a })).body.usedToday, true);
  r = await call("post", "/trades", { userId: a, body: { toUserId: b, give: c1.name, want: c2.name } });
  assert.equal(r.status, 409, "uno por día");
});
