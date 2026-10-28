import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const dg = await import("../utils/daily-games.js");
const J = await import("../utils/juegos.js");
const { default: publicRouter } = await import("../routes/public.js");
const { todayStr } = await import("../utils/points.js");

before(async () => { await initSchema(); });
after(() => cleanup());

async function totalClub(names) {
  const g = await makeGroup(db, { name: `J ${names.join("")}`, members: names });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [g.groupId] });
  return g;
}
const play = (user, key, fraction = 0.8, play = {}) => dg.recordDailyResult(user, "2026-04-20", key, fraction, 0, { mode: "fun", ...play });

test("las claves viejas se traducen al juego fusionado", () => {
  assert.equal(J.fusedOf("fichado"), "quien_es");
  assert.equal(J.fusedOf("traspasos"), "quien_es");
  assert.equal(J.fusedOf("torta"), "que_club");
  assert.equal(J.fusedOf("a_quien_me_compro"), "mas_o_menos");
  assert.equal(J.fusedOf("supervivencia"), "trivia");
  assert.equal(J.fusedOf("arbitraje_var"), "var");
  assert.equal(J.fusedOf("tateti"), "bingo");
  assert.equal(J.fusedOf("cualquier_otro"), "cualquier_otro", "lo desconocido queda igual");
});

test("una vez por juego fusionado al día: Fichado y Traspasos comparten el mismo cupo", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const g = await totalClub(["j1", "j2"]);
    const u = g.userIds[0];
    const a = await play(u, "fichado", 1);
    assert.equal(a.club.credited[0].points, 20);
    assert.equal(a.firstToday, true);
    assert.equal(a.fused, "quien_es");
    const b = await play(u, "traspasos", 1);
    assert.equal(b.firstToday, false, "otra variante del mismo juego no vuelve a sumar");
    assert.deepEqual(b.club.credited, []);
    const c = await play(u, "escudos", 0.6); // otro juego fusionado: sí suma (3 aciertos × 4)
    assert.equal(c.club.credited[0].points, 12);
    const rows = (await db.execute({ sql: "SELECT source FROM points_ledger WHERE user_id = ? ORDER BY source", args: [u] })).rows.map((r) => r.source);
    assert.deepEqual(rows, ["libre:que_club", "libre:quien_es"]);
  } finally { delete process.env.FUTOTAL2; }
});

test("en un club Clásico no suma y avisa lo que habría sumado", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const g = await makeGroup(db, { name: "Clasico J", members: ["j3", "j4"] });
    await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-01-01' WHERE id = ?", args: [g.groupId] });
    const r = await play(g.userIds[0], "bingo", 1);
    assert.deepEqual(r.club.credited, []);
    assert.equal(r.club.wouldHave, 20, "en Clásico no suma, pero se informa lo que valdría en Total");
    const sinClub = await makeGroup(db, { name: "Sin club J", members: ["j5", "j6"] });
    const s = await play(sinClub.userIds[0], "bingo", 1);
    assert.equal(s.club.wouldHave, 20, "sin club iniciado se muestra el valor Total posible");
  } finally { delete process.env.FUTOTAL2; }
});

test("una duración imposible (menos de 15 s) no se acredita ni da sobre", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const g = await totalClub(["j7", "j8"]);
    const u = g.userIds[0];
    const r = await play(u, "piramide", 1, { seconds: 6 });
    assert.equal(r.rejected, "duracion");
    assert.equal(r.pack, null);
    assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM points_ledger WHERE user_id = ?", args: [u] })).rows[0].n), 0);
    const ok = await play(u, "piramide", 1, { seconds: 90 });
    assert.equal(ok.club.credited[0].points, 20, "con una duración normal sí suma");
  } finally { delete process.env.FUTOTAL2; }
});

test("Cotrero y el Draft no mandan puntos por esta vía", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const g = await totalClub(["j9", "j10"]);
    for (const key of ["cotrero", "cotrero_medio", "draft_europeo"]) {
      const r = await play(g.userIds[0], key, 1);
      assert.deepEqual(r.club.credited, [], key);
    }
    assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM points_ledger WHERE user_id = ?", args: [g.userIds[0]] })).rows[0].n), 0);
  } finally { delete process.env.FUTOTAL2; }
});

test("la lista de juegos fusionados abiertos se publica sin iniciar sesión", async () => {
  const get = () => new Promise((resolve) => {
    const layer = publicRouter.stack.find((l) => l.route?.path === "/features");
    layer.route.stack[0].handle({}, { json: resolve });
  });
  assert.deepEqual((await get()).juegos, []);
  process.env.FUTOTAL2 = "1";
  process.env.FUTOTAL2_JUEGOS = "bingo, que_club";
  try {
    const f = await get();
    assert.deepEqual(f.juegos, ["bingo", "que_club"]);
  } finally { delete process.env.FUTOTAL2; delete process.env.FUTOTAL2_JUEGOS; }
});
