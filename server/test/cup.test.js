import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const cup = await import("../utils/cup.js");
const ledger = await import("../utils/ledger.js");

before(async () => { await initSchema(); });
after(() => cleanup());

const MONDAY = "2026-03-02"; // lunes
const day = (n) => { const d = new Date(`${MONDAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const LATER = "2026-03-20"; // la semana ya terminó

test("tamaño del cuadro según los miembros", () => {
  assert.equal(cup.bracketSize(12), 8);
  assert.equal(cup.bracketSize(8), 8);
  assert.equal(cup.bracketSize(7), 4);
  assert.equal(cup.bracketSize(4), 4);
  assert.equal(cup.bracketSize(3), 2);
  assert.equal(cup.bracketSize(2), 2);
  assert.equal(cup.bracketSize(1), 0);
});

test("8 jugadores: cuartos el viernes, semis el sábado, final el domingo", () => {
  const entries = Array.from({ length: 8 }, (_, i) => ({ userId: i + 1, qual: 800 - i * 10 }));
  const scores = {
    [day(4)]: { 1: 50, 8: 10, 4: 30, 5: 60, 2: 40, 7: 40, 3: 20 }, // 6 no juega: pierde
    [day(5)]: { 1: 70, 5: 20, 2: 55, 3: 56 },
    [day(6)]: { 1: 80, 3: 90 },
  };
  const c = cup.buildCup(entries, scores, MONDAY, LATER, 10);
  assert.equal(c.size, 8);
  assert.deepEqual(c.rounds.map((r) => r.key), ["cuartos", "semis", "final"]);
  const [q1, q2, q3, q4] = c.rounds[0].matches;
  assert.equal(q1.winner.userId, 1, "1 vs 8");
  assert.equal(q2.winner.userId, 5, "4 vs 5: gana el 5 por puntaje del día");
  assert.equal(q3.winner.userId, 2, "2 vs 7 empatan 40-40: gana quien clasificó mejor");
  assert.equal(q4.winner.userId, 3, "3 vs 6: el 6 no jugó");
  assert.equal(c.rounds[1].matches[0].winner.userId, 1);
  assert.equal(c.rounds[1].matches[1].winner.userId, 3);
  assert.equal(c.champion.userId, 3);
  assert.equal(c.complete, true);
});

test("el partido de un cruce que no jugó nadie lo gana quien clasificó mejor", () => {
  const entries = [{ userId: 1, qual: 100 }, { userId: 2, qual: 90 }];
  const c = cup.buildCup(entries, {}, MONDAY, LATER, 2);
  assert.equal(c.champion.userId, 1);
});

test("un cruce todavía abierto no tiene ganador", () => {
  const entries = [{ userId: 1, qual: 100 }, { userId: 2, qual: 90 }];
  const c = cup.buildCup(entries, { [day(6)]: { 1: 70 } }, MONDAY, day(6), 2);
  assert.equal(c.rounds[0].matches[0].winner, null);
  assert.equal(c.complete, false);
});

test("premios: campeón, finalista, semifinalistas y participantes", () => {
  const entries = Array.from({ length: 8 }, (_, i) => ({ userId: i + 1, qual: 800 - i * 10 }));
  const c = cup.buildCup(entries, { [day(6)]: { 1: 10 } }, MONDAY, LATER, 8);
  const prizes = Object.fromEntries(cup.cupPrizes(c).map((p) => [p.userId, p.base]));
  assert.equal(prizes[c.champion.userId], 200);
  assert.equal(Object.values(prizes).filter((v) => v === 200).length, 1);
  assert.equal(Object.values(prizes).filter((v) => v === 120).length, 1);
  assert.equal(Object.values(prizes).filter((v) => v === 60).length, 2);
  assert.equal(Object.values(prizes).filter((v) => v === 20).length, 4);
});

test("final de 2: los dos son finalistas y uno es campeón", () => {
  const entries = [{ userId: 1, qual: 10 }, { userId: 2, qual: 5 }];
  const c = cup.buildCup(entries, { [day(6)]: { 2: 80, 1: 30 } }, MONDAY, LATER, 3);
  const prizes = Object.fromEntries(cup.cupPrizes(c).map((p) => [p.userId, p.base]));
  assert.deepEqual(prizes, { 1: 120, 2: 200 });
});

async function seasonClub(mode, names) {
  const { groupId, userIds } = await makeGroup(db, { name: `Copa ${mode} ${names.join("")}`, members: names });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = ?, season_started_at = '2026-01-01' WHERE id = ?", args: [mode, groupId] });
  return { groupId, userIds };
}

async function play(userId, date, total) {
  await db.execute({ sql: "INSERT OR REPLACE INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 0, 0, 0, ?)", args: [userId, date, total] });
}

test("la copa se reparte una sola vez y respeta el modo del club", async () => {
  const total = await seasonClub("total", ["c1", "c2", "c3", "c4"]);
  const clasico = await seasonClub("clasico", ["k1", "k2", "k3", "k4"]);
  for (const club of [total, clasico]) {
    const [a, b, c, d] = club.userIds;
    // Lunes a jueves: a > b > c > d
    for (const [u, pts] of [[a, 90], [b, 80], [c, 70], [d, 60]]) await play(u, day(0), pts);
    // Semis el sábado: a(1) vs d(4), b(2) vs c(3). Final el domingo.
    await play(a, day(5), 70); await play(d, day(5), 40);
    await play(b, day(5), 30); await play(c, day(5), 55);
    await play(a, day(6), 60); await play(c, day(6), 90);
  }
  const first = await cup.settleCup(total.groupId, MONDAY);
  assert.equal(first.settled, true);
  assert.equal(first.champion, total.userIds[2], "c3 gana la final");
  const again = await cup.settleCup(total.groupId, MONDAY);
  assert.equal(again.credited, 0, "no se vuelve a repartir");

  const totalTable = await ledger.clubTable(total.groupId, "general", LATER);
  const byUser = Object.fromEntries(totalTable.map((r) => [r.userId, r.points]));
  assert.equal(byUser[total.userIds[2]], 400, "campeón en Total: 200 x 2");
  assert.equal(byUser[total.userIds[0]], 240, "finalista en Total: 120 x 2");
  assert.equal(byUser[total.userIds[1]], 120, "semifinalista: 60 x 2");
  assert.equal(byUser[total.userIds[3]], 120, "semifinalista: 60 x 2");

  await cup.settleCup(clasico.groupId, MONDAY);
  const clasicoTable = await ledger.clubTable(clasico.groupId, "general", LATER);
  assert.equal(clasicoTable.find((r) => r.userId === clasico.userIds[2]).points, 200, "campeón en Clásico: 200");
});

test("una copa que todavía no terminó no se reparte", async () => {
  const { groupId } = await seasonClub("clasico", ["w1", "w2"]);
  const res = await cup.settleCup(groupId, "2099-01-05");
  assert.equal(res.settled, false);
});
