import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
const { db, initSchema } = await import("../db/client.js");
const cards = await import("../routes/cards.js");
const { adminRouter } = await import("../routes/admin.js");
const { todayStr, addDays } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

function call(router, method, p, { userId = 1, body = {}, query = {}, params = {} } = {}) {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body, query, params }, res);
  });
}

test("el panel crea un desafío con filtro, y reemplaza a la temática automática mientras dure", async () => {
  const today = todayStr();
  const auto = cards.themePeriod(today).theme;

  const prev = await call(adminRouter, "get", "/sbc/preview", { query: { filterType: "nacionalidad", filterValue: "Argentina" } });
  assert.equal(prev.status, 200);
  assert.equal(prev.body.feasible, true);

  // Un filtro sin cartas suficientes se rechaza explicando qué falta.
  const bad = await call(adminRouter, "post", "/sbc", { body: { label: "Imposible", filterType: "club", filterValue: "Club Que No Existe", start: today, end: addDays(today, 5) } });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /no alcanzan las cartas/);
  assert.equal((await call(adminRouter, "post", "/sbc", { body: { label: "", filterType: "retirados", start: today, end: addDays(today, 5) } })).status, 400);
  assert.equal((await call(adminRouter, "post", "/sbc", { body: { label: "Fechas", filterType: "retirados", start: today, end: addDays(today, -1) } })).status, 400);

  const ok = await call(adminRouter, "post", "/sbc", { body: { label: "Los albicelestes", filterType: "nacionalidad", filterValue: "Argentina", start: today, end: addDays(today, 6), bonusCoins: 80 } });
  assert.equal(ok.status, 201);
  assert.equal(cards.themePeriod(today).theme.label, "Los albicelestes");
  assert.equal(cards.themePeriod(today).end, addDays(today, 6));

  // No se pueden superponer dos desafíos.
  const clash = await call(adminRouter, "post", "/sbc", { body: { label: "Otro", filterType: "retirados", start: addDays(today, 3), end: addDays(today, 9) } });
  assert.equal(clash.status, 409);

  // Los jugadores lo ven y el premio extra en monedas se entrega al completarlo.
  const { userIds } = await makeGroup(db, { name: "SBC propio", members: ["gaucho", "otro"] });
  const u = userIds[0];
  const state = await call(cards.default, "get", "/sbc-tema", { userId: u });
  assert.equal(state.body.theme.label, "Los albicelestes");
  const pool = cards.themePeriod(today).theme.pool;
  const picked = [];
  for (const [pos, n] of Object.entries({ GK: 1, DEF: 4, MID: 3, FWD: 3 })) {
    for (const c of pool.filter((x) => x.pos === pos).slice(0, n)) {
      await db.execute({ sql: "INSERT INTO user_cards (user_id, player_name, count) VALUES (?, ?, 2)", args: [u, c.name] });
      picked.push(c.name);
    }
  }
  const sub = await call(cards.default, "post", "/sbc-tema/submit", { userId: u, body: { formation: "4-3-3", players: picked } });
  assert.equal(sub.status, 200);
  assert.equal(sub.body.reward.coins, 80);
  assert.equal(Number((await db.execute({ sql: "SELECT balance FROM card_wallets WHERE user_id = ?", args: [u] })).rows[0].balance), 80);

  // Al borrarlo vuelve la temática automática.
  const list = await call(adminRouter, "get", "/sbc");
  await call(adminRouter, "delete", "/sbc/:id", { params: { id: list.body.sbcs[0].id } });
  assert.equal(cards.themePeriod(today).theme.key, auto.key);
});
