import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const cards = await import("../routes/cards.js");
const { default: router } = cards;
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

function call(method, path, { userId, body = {} }) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body, query: {}, params: {} }, res);
  });
}

test("la oferta del día es la misma para todos, cambia con la fecha y rebaja 30%", () => {
  const a = cards.dailyDeal("2026-10-26");
  assert.deepEqual(a, cards.dailyDeal("2026-10-26"));
  assert.notEqual(a.quality, "normal");
  assert.ok(a.price < a.normalPrice && a.price >= a.normalPrice * 0.6);
  const seen = new Set(Array.from({ length: 14 }, (_, i) => cards.dailyDeal(`2026-11-${String(i + 1).padStart(2, "0")}`).quality));
  assert.ok(seen.size > 1, "rota entre sobres");
});

test("la oferta se compra una vez al día y a precio rebajado", async () => {
  const { userIds } = await makeGroup(db, { name: "Tienda", members: ["tendero", "cliente"] });
  const u = userIds[0];
  const deal = cards.dailyDeal(todayStr());
  await db.execute({ sql: "INSERT INTO card_wallets (user_id, balance) VALUES (?, 1000)", args: [u] });

  const shop = await call("get", "/shop", { userId: u });
  assert.equal(shop.body.deal.quality, deal.quality);
  assert.equal(shop.body.deal.taken, false);

  assert.equal((await call("post", "/shop/buy", { userId: u, body: { quality: "normal", deal: true } })).status, 400, "no es la oferta de hoy");
  const buy = await call("post", "/shop/buy", { userId: u, body: { quality: deal.quality, deal: true } });
  assert.equal(buy.status, 200);
  assert.equal(buy.body.balance, 1000 - deal.price);
  assert.equal((await call("post", "/shop/buy", { userId: u, body: { quality: deal.quality, deal: true } })).status, 409, "una por día");
  assert.equal((await call("get", "/shop", { userId: u })).body.deal.taken, true);
  // La compra normal del mismo sobre sigue disponible a precio completo.
  const full = await call("post", "/shop/buy", { userId: u, body: { quality: deal.quality } });
  assert.equal(full.body.balance, 1000 - deal.price - deal.normalPrice);
});

test("vender una repetida que sirve para el desafío pide confirmar", async () => {
  const { userIds } = await makeGroup(db, { name: "Vendedor", members: ["vende", "otro"] });
  const u = userIds[0];
  const { theme } = cards.themePeriod(todayStr());
  const useful = theme.pool[0];
  await db.execute({ sql: "INSERT INTO user_cards (user_id, player_name, count) VALUES (?, ?, 2)", args: [u, useful.name] });

  const first = await call("post", "/sell", { userId: u, body: { name: useful.name, count: 1 } });
  assert.equal(first.status, 409);
  assert.equal(first.body.needsConfirm, true);
  assert.equal(Number((await db.execute({ sql: "SELECT count FROM user_cards WHERE user_id = ? AND player_name = ?", args: [u, useful.name] })).rows[0].count), 2, "no se vendió");

  const ok = await call("post", "/sell", { userId: u, body: { name: useful.name, count: 1, confirmTheme: true } });
  assert.equal(ok.status, 200);
});
