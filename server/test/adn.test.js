import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const adn = await import("../utils/adn.js");
const dm = await import("../utils/daily-match.js");
const { default: meRouter } = await import("../routes/me.js");
const { default: dailyRouter } = await import("../routes/daily-match.js");
const { todayStr } = await import("../utils/points.js");

before(async () => {
  await initSchema();
  for (let i = 1; i <= 12; i++) {
    await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [`Pregunta ${i}`] });
    await db.execute({ sql: "INSERT INTO questions (question, category, difficulty, option_a, option_b, option_c, option_d, correct_answer, scheduled_date, slot) VALUES (?, ?, 'media', 'A', 'B', 'C', 'D', 'b', ?, 1)", args: [`Trivia ${i}`, ["Liga Chilena", "Europa", "Historia"][i % 3], `2026-01-${String(i).padStart(2, "0")}`] });
  }
});
after(() => cleanup());

function call(router, method, p, { userId, body = {}, query = {} }) {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body, query, params: {} }, res);
  });
}

async function user(name) {
  const g = await makeGroup(db, { name: `Adn ${name}`, members: [name, `${name}2`] });
  return { groupId: g.groupId, a: g.userIds[0], b: g.userIds[1] };
}

// 15 respuestas de un área: `hits` aciertos, con la rapidez dada.
async function answers(userId, area, hits, speed, date = todayStr(), n = 15, startIdx = 0) {
  for (let i = 0; i < n; i++) {
    await db.execute({
      sql: "INSERT OR REPLACE INTO daily_match_answers (user_id, date, idx, answer, ms, ok, points, area, speed) VALUES (?, ?, ?, 0, 1000, ?, 1, ?, ?)",
      args: [userId, date, startIdx + i, i < hits ? 1 : 0, area, speed],
    });
  }
}

test("todas las preguntas del partido del día traen un área del ADN", async () => {
  const items = await dm.matchFor("2026-02-02");
  assert.ok(items.every((i) => ["chile", "europa", "leyendas", "actualidad", "mercado"].includes(i.area)), JSON.stringify(items.map((i) => i.area)));
  assert.ok(items.filter((i) => i.kind === "mas_menos").every((i) => i.area === "mercado"));
});

test("un área con menos de 15 respuestas dice «faltan datos» en vez de inventar un puntaje", async () => {
  const u = await user("adnA");
  await answers(u.a, "chile", 10, 0.5, todayStr(), 14);
  const r = await adn.computeAdn(u.a, "all");
  assert.equal(r.areas.chile.score, null);
  assert.equal(r.areas.chile.answers, 14);
  assert.equal(r.areas.europa.score, null);
});

test("con pocos jugadores el puntaje es el rendimiento propio (0 a 99)", async () => {
  const u = await user("adnB");
  await answers(u.a, "europa", 15, 0.8);
  await answers(u.b, "europa", 0, 0.2);
  const a = await adn.computeAdn(u.a, "all");
  assert.equal(a.areas.europa.score, 99);
  assert.equal(a.areas.europa.pct, 100);
  const b = await adn.computeAdn(u.b, "all");
  assert.equal(b.areas.europa.score, 0);
});

test("la velocidad sale de la rapidez de todas las respuestas", async () => {
  const u = await user("adnC");
  await answers(u.a, "chile", 10, 1.0, todayStr(), 8, 0);
  await answers(u.a, "mercado", 10, 1.0, todayStr(), 8, 20);
  const r = await adn.computeAdn(u.a, "all");
  assert.equal(r.areas.velocidad.answers, 16);
  assert.equal(r.areas.velocidad.score, 99, "muy rápido: velocidad máxima");
});

test("con 10 jugadores o más se compara por percentil", () => {
  assert.equal(adn.percentile(0.9, [0.1, 0.2, 0.3, 0.4]), 1);
  assert.equal(adn.percentile(0.1, [0.5, 0.6]), 0);
  assert.equal(adn.percentile(0.5, [0.5, 0.5]), 0.5, "empate: la mitad");
  assert.equal(adn.percentile(0.5, []), null);
});

test("mejor y peor área, arquetipo y rangos de la semana y el mes", async () => {
  const u = await user("adnD");
  await answers(u.a, "leyendas", 15, 0.4, todayStr(), 15, 0);
  await answers(u.a, "chile", 3, 0.4, todayStr(), 15, 20);
  await answers(u.a, "mercado", 8, 0.4, todayStr(), 15, 40);
  const r = await adn.analysis(u.a, "month", { groupId: u.groupId });
  assert.equal(r.best, "leyendas");
  assert.equal(r.worst, "chile");
  assert.equal(r.suggestion.area, "chile");
  assert.ok(r.suggestion.text.length > 10 && r.suggestion.game);
  assert.equal(r.archetype, "Nostálgico");
  assert.equal(r.specialty, "leyendas");
  assert.ok(r.club && "leyendas" in r.club);
  const w = await adn.analysis(u.a, "week");
  assert.equal(w.specialty, null, "la especialidad es mensual");
  assert.ok(adn.rangeFor("week", "2026-10-28").from <= "2026-10-28");
  assert.equal(adn.rangeFor("month", "2026-10-28").from, "2026-10-01");
  assert.deepEqual(adn.previousRange("month", "2026-10-28"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(adn.previousRange("week", "2026-10-28"), { from: "2026-10-19", to: "2026-10-25" });
});

test("cuánto subiste o bajaste respecto del período anterior", async () => {
  const u = await user("adnE");
  await answers(u.a, "europa", 5, 0.5, "2026-09-10", 15, 0);
  await answers(u.a, "europa", 12, 0.5, "2026-10-10", 15, 0);
  const r = await adn.analysis(u.a, "month", { today: "2026-10-20" });
  assert.equal(r.areas.europa.score, Math.round((12 / 15) * 99));
  assert.equal(r.previous.europa.score, Math.round((5 / 15) * 99));
  assert.equal(r.deltas.europa, Math.round((12 / 15) * 99) - Math.round((5 / 15) * 99));
});

test("carta Futotal: promedio de los últimos 30 partidos y categoría", async () => {
  assert.equal(adn.tierOfMedia(59), "bronce");
  assert.equal(adn.tierOfMedia(60), "plata");
  assert.equal(adn.tierOfMedia(74), "plata");
  assert.equal(adn.tierOfMedia(75), "oro");
  assert.equal(adn.tierOfMedia(84), "oro");
  assert.equal(adn.tierOfMedia(85), "especial");
  const u = await user("adnF");
  assert.equal((await adn.futotalCard(u.a)).media, null);
  // 35 partidos: los 5 más viejos (media 0) no cuentan
  for (let i = 1; i <= 35; i++) {
    const date = new Date(Date.UTC(2026, 0, i)).toISOString().slice(0, 10);
    await db.execute({ sql: "INSERT INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 0, 0, 0, ?)", args: [u.a, date, i <= 5 ? 0 : 80] });
  }
  const c = await adn.futotalCard(u.a);
  assert.equal(c.played, 30);
  assert.equal(c.media, 80);
  assert.equal(c.tier, "oro");
  const api = (await call(meRouter, "get", "/card", { userId: u.a })).body;
  assert.equal(api.media, 80);
  assert.equal(api.username, "adnF");
});

test("entrenamiento: 6 preguntas del área elegida, con respuestas para corregir en el teléfono", async () => {
  for (const area of ["mercado", "velocidad", "chile", "leyendas"]) {
    const r = (await call(meRouter, "get", "/train", { userId: 1, query: { area } })).body;
    assert.equal(r.items.length, 6, area);
    assert.ok(r.items.every((i) => i.options?.length >= 2 && Number.isInteger(i.answer)), area);
  }
  assert.equal((await call(meRouter, "get", "/train", { userId: 1, query: { area: "inventada" } })).status, 400);
});

test("el partido del día guarda el área y la rapidez de cada respuesta", async () => {
  const u = await user("adnG");
  const items = await dm.matchFor(todayStr());
  const out = await call(dailyRouter, "post", "/answer", { userId: u.a, body: { idx: 0, answer: items[0].answer, ms: 3000 } });
  assert.equal(out.status, 200);
  const row = (await db.execute({ sql: "SELECT area, speed FROM daily_match_answers WHERE user_id = ? AND idx = 0 AND date = ?", args: [u.a, todayStr()] })).rows[0];
  assert.equal(row.area, items[0].area);
  assert.ok(row.speed > 0 && row.speed < 1);
});
