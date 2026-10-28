import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
process.env.FUTOTAL2 = "1";
process.env.JWT_SECRET = "test-secret";
const { db, initSchema } = await import("../db/client.js");
const ach = await import("../utils/achievements.js");
const { computeAchievements, default: statsRouter } = await import("../routes/stats.js");
const { default: authRouter } = await import("../routes/auth.js");
const { default: dailyRouter } = await import("../routes/daily-match.js");
const { todayStr, addDays } = await import("../utils/points.js");
const { matchFor } = await import("../utils/daily-match.js");

before(async () => {
  await initSchema();
  for (let i = 1; i <= 12; i++) await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [`Q${i}`] });
});
after(() => cleanup());

const call = (router, method, p, { userId, body = {}, query = {} } = {}) => new Promise((resolve) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
  handle({ userId, body, query, params: {}, headers: {} }, res);
});

test("el catálogo nuevo tiene 22 logros sin repetir", () => {
  assert.equal(ach.CATALOG.length, 22);
  assert.equal(new Set(ach.CATALOG.map((a) => a.id)).size, 22);
});

test("congelar conserva los logros del catálogo anterior una sola vez y no pierde marcos", async () => {
  const { userIds } = await makeGroup(db, { name: "Congelados", members: ["vieja", "nuevo"] });
  const u = userIds[0];
  // «Vieja» ya tenía 10 logros del catálogo anterior (los falsea el cómputo).
  const legacyIds = ["francotirador", "dia-perfecto", "en-llamas", "votante", "adivino", "constante", "pregunton", "erudito", "maratonista", "duelista"];
  const fake = async () => ({ achievements: legacyIds.map((id) => ({ id, unlocked: true })) });

  assert.equal(await ach.ensureFrozen(u, fake), 10);
  assert.equal(await ach.ensureFrozen(u, fake), 0, "una sola vez por usuario");
  assert.equal(await ach.unlockedCount(u), 10);
  // «en-llamas», «maratonista» y «duelista» siguen vivos: quedan con su clave nueva, sin duplicarse.
  assert.ok(await ach.has(u, "en_llamas") && await ach.has(u, "maratonista") && await ach.has(u, "duelista"));
  assert.ok(await ach.has(u, "legacy:francotirador"));

  // Si el usuario gana después un logro que ya tenía, no suma dos veces.
  assert.equal(await ach.grant(u, "duelista"), false);

  // Con 10 logros alcanza el marco Oro (requiere 10); con trofeo de copa, además, el marco Copa.
  const base = { bg: "#22c55e", skin: "#f8dcc4", hairColor: "#0f0f0f", hair: "corto", face: "sonrisa", accessory: "ninguno", jersey: "lisa", jerseyColor: "#ffffff" };
  const set = (frame) => call(authRouter, "put", "/avatar", { userId: u, body: { config: { ...base, frame } } });
  const gold = await set("oro");
  assert.equal(gold.status, 200, JSON.stringify(gold.body));
  assert.equal((await set("fuego")).status, 403, "fuego pide 14");
  assert.equal((await set("copa")).status, 403, "sin trofeo no hay marco Copa");
  await ach.grant(u, "copa_ganada");
  assert.equal((await set("copa")).status, 200);

  // Quien nunca tuvo logros no los hereda.
  const none = await ach.ensureFrozen(userIds[1], fake.bind(null));
  assert.equal(none, 10, "el cómputo falso da lo mismo para todos; lo importante es que cada uno se congela por su cuenta");
});

test("la Vitrina lista el catálogo nuevo y, aparte, los clásicos ganados", async () => {
  const { userIds } = await makeGroup(db, { name: "Vitrina", members: ["vit", "otro2"] });
  const u = userIds[0];
  await ach.ensureFrozen(u, async () => ({ achievements: [{ id: "francotirador", unlocked: true }, { id: "bibliotecario", unlocked: false }] }));
  await ach.grant(u, "primer_partido");
  const out = await call(statsRouter, "get", "/achievements", { userId: u });
  const list = out.body.achievements;
  assert.equal(out.body.total, 22);
  assert.equal(out.body.unlocked_count, 2);
  assert.ok(list.find((a) => a.id === "primer_partido").unlocked);
  const classic = list.filter((a) => a.legacy);
  assert.deepEqual(classic.map((a) => a.title), ["Francotirador"]);
});

test("cerrar el partido del día da primer partido, perfecto y fantasma", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Partido logros", members: ["jug", "rival"] });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = 'total', season_started_at = '2026-01-01' WHERE id = ?", args: [groupId] });
  const [a, b] = userIds;
  for (const u of userIds) await db.execute({ sql: "INSERT OR REPLACE INTO user_main_club (user_id, group_id) VALUES (?, ?)", args: [u, groupId] });
  const date = todayStr();
  const items = await matchFor(date);
  // El rival ya jugó y sacó poco; el jugador acierta todo.
  await db.execute({ sql: "INSERT INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 5, 5, 5, 15)", args: [b, date] });
  await db.execute({ sql: "INSERT INTO points_ledger (user_id, group_id, date, month, source, points) VALUES (?, ?, ?, ?, 'partido_dia', 30)", args: [b, groupId, date, date.slice(0, 7)] });
  for (let idx = 0; idx < items.length; idx++) {
    await db.execute({ sql: "INSERT INTO daily_match_answers (user_id, date, idx, answer, ms, ok, points) VALUES (?, ?, ?, ?, 2000, 1, 5)", args: [a, date, idx, items[idx].answer] });
  }
  const fin = await call(dailyRouter, "post", "/finish", { userId: a });
  assert.equal(fin.status, 200);
  for (const k of ["primer_partido", "partido_perfecto"]) assert.ok(await ach.has(a, k), k);
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM ghost_wins WHERE user_id = ?", args: [a] })).rows[0].n), 1);
  assert.ok(!(await ach.has(a, "imparable")));
  void addDays;
});
