import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const M = await import("../utils/market.js");
const { CARDS } = await import("../routes/cards.js");

before(async () => { await initSchema(); });
after(() => cleanup());

const card = CARDS.find((c) => c.tier === "oro");
const give = (u, n = 2) => db.execute({ sql: "INSERT OR REPLACE INTO user_cards (user_id, player_name, count) VALUES (?, ?, ?)", args: [u, card.name, n] });
const coins = (u, n) => db.execute({ sql: "INSERT OR REPLACE INTO card_wallets (user_id, balance) VALUES (?, ?)", args: [u, n] });
const bal = async (u) => Number((await db.execute({ sql: "SELECT balance FROM card_wallets WHERE user_id = ?", args: [u] })).rows[0]?.balance || 0);
const cnt = async (u) => Number((await db.execute({ sql: "SELECT count FROM user_cards WHERE user_id = ? AND player_name = ?", args: [u, card.name] })).rows[0]?.count || 0);
const later = () => new Date(Date.now() + 25 * 3600 * 1000);

test("mercado: subasta completa, la carta y las monedas cambian de manos con comisión del 5%", async () => {
  const g = await makeGroup(db, { name: "Mercado", members: ["vende", "puja1", "puja2"] });
  const [s, a, b] = g.userIds;
  await give(s, 2); await coins(a, 200); await coins(b, 200);
  assert.equal((await M.publish(s, card.name, 50)).ok, true);
  assert.equal(await cnt(s), 1, "la carta sale del vendedor al publicar");
  const l = (await M.listOpen(a)).listings[0];
  assert.equal(l.minBid, 50);
  assert.equal((await M.bid(s, l.id, 60)).error, "No puedes pujar por tu propia carta");
  assert.match((await M.bid(a, l.id, 10)).error, /mínima es 50/);
  assert.equal((await M.bid(a, l.id, 60)).ok, true);
  assert.equal(await bal(a), 140, "las monedas quedan retenidas");
  assert.match((await M.bid(b, l.id, 61)).error, /mínima es 63/);
  assert.equal((await M.bid(b, l.id, 80)).ok, true);
  assert.equal(await bal(a), 200, "a quien lo superan se le devuelve");
  assert.equal(await bal(b), 120);
  await M.settleExpired(later());
  assert.equal(await cnt(b), 1, "la carta llega a quien más pujó");
  assert.equal(await bal(s), 76, "el vendedor cobra 80 menos 5% de comisión (4)");
  const h = await M.historyOf(card.name);
  assert.equal(h[0].kind, "subasta");
  assert.equal(h[0].price, 80);
});

test("mercado: sin pujas la carta vuelve, solo repetidas, máximo de subastas abiertas y cancelar sin pujas", async () => {
  const g = await makeGroup(db, { name: "Mercado2", members: ["v2", "p2"] });
  const [s, p] = g.userIds;
  await give(s, 1);
  assert.equal((await M.publish(s, card.name, 10)).error, "Solo puedes subastar cartas repetidas");
  await give(s, 5);
  const first = await M.publish(s, card.name, 10);
  assert.equal(first.ok, true);
  assert.equal((await M.cancel(s, first.id)).ok, true);
  assert.equal(await cnt(s), 5);
  for (let i = 0; i < 3; i++) assert.equal((await M.publish(s, card.name, 10)).ok, true);
  assert.match((await M.publish(s, card.name, 10)).error, /3 subastas abiertas/);
  await coins(p, 100);
  const open = (await M.listOpen(p)).listings[0];
  await M.bid(p, open.id, 10);
  assert.match((await M.cancel(s, open.id)).error, /Ya hay pujas/);
  await M.settleExpired(later());
  assert.equal(await cnt(s), 4, "dos sin pujas vuelven (5-3+2=4) y una se vendió");
});

test("mercado: una subasta no se ve ni se puja desde otro club", async () => {
  const g1 = await makeGroup(db, { name: "ClubA", members: ["ca1"] });
  const g2 = await makeGroup(db, { name: "ClubB", members: ["cb1"] });
  await give(g1.userIds[0], 3); await coins(g2.userIds[0], 100);
  const r = await M.publish(g1.userIds[0], card.name, 10);
  assert.equal((await M.listOpen(g2.userIds[0])).listings.length, 0);
  assert.equal((await M.bid(g2.userIds[0], r.id, 20)).error, "Esa subasta es de otro club");
});
