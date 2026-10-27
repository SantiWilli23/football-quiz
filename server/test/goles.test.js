import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const jobs = await import("../utils/jobs.js");
const dm = await import("../utils/daily-match.js");

before(async () => {
  await initSchema();
  for (let i = 1; i <= 12; i++) await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [`Pregunta ${i}`] });
});
after(() => cleanup());

const model = (home, away, live = true, events = []) => ({ live, finished: !live, score: { home, away }, teams: { home: { name: "Colo-Colo" }, away: { name: "U. de Chile" } }, events });

test("aviso de gol: solo cuando sube el marcador, a quienes siguen el partido y con tope de 3 por día", async () => {
  const g = await makeGroup(db, { name: "Goles", members: ["g1", "g2", "g3"] });
  const [fan, other, nobody] = g.userIds;
  const today = "2026-11-02";
  await db.execute({ sql: "INSERT INTO events (date, kit_key, league, event_id, home_name, home_id, away_name, away_id) VALUES (?, 'superclasico', 'chi.1', '777', 'Colo-Colo', '1', 'U. de Chile', '2')", args: [today] });
  await db.execute({ sql: "INSERT INTO event_preds (user_id, date, pick) VALUES (?, ?, 'home')", args: [fan, today] });
  await db.execute({ sql: "INSERT INTO event_sides (user_id, date, side) VALUES (?, ?, 'away')", args: [other, today] });
  const sent = [];
  const send = async (userId, payload) => { sent.push({ userId, payload }); return 1; };
  let current = model(0, 0);
  const getMatch = async () => current;

  assert.deepEqual(await jobs.notifyGoals({ today, send, getMatch }), { goals: 0, sent: 0 }, "la primera lectura no avisa");
  assert.deepEqual(await jobs.notifyGoals({ today, send, getMatch }), { goals: 0, sent: 0 }, "sin cambios no avisa");

  current = model(1, 0, true, [{ type: "goal", player: "Esteban Paredes" }]);
  const r = await jobs.notifyGoals({ today, send, getMatch });
  assert.equal(r.goals, 1);
  assert.deepEqual(sent.map((s) => s.userId).sort(), [fan, other].sort(), "avisa a quien pronosticó y a quien eligió hinchada, no al resto");
  assert.ok(!sent.some((s) => s.userId === nobody));
  assert.match(sent[0].payload.body, /¡Gol de Colo-Colo! Esteban Paredes Colo-Colo 1-0 U\. de Chile/);
  assert.match(sent[0].payload.url, /^\/vivo\/chi\.1\/777$/);

  // un VAR que baja el marcador no es un gol
  current = model(0, 0);
  assert.equal((await jobs.notifyGoals({ today, send, getMatch })).goals, 0);
  // el final del partido no avisa
  current = model(0, 1, false);
  assert.equal((await jobs.notifyGoals({ today, send, getMatch })).goals, 0);

  // tope de 3 por día
  await db.execute({ sql: "UPDATE push_day SET n = 3 WHERE user_id = ?", args: [fan] });
  sent.length = 0;
  await db.execute({ sql: "UPDATE events SET last_score = '1-0' WHERE date = ?", args: [today] });
  current = model(2, 0);
  await jobs.notifyGoals({ today, send, getMatch });
  assert.ok(!sent.some((s) => s.userId === fan), "ya recibió 3 avisos hoy");
});

test("si la fuente falla, el error queda registrado y no rompe la tarea", async () => {
  const today = "2026-11-03";
  await db.execute({ sql: "INSERT INTO events (date, kit_key, league, event_id, home_name, away_name) VALUES (?, 'clasico', 'esp.1', '888', 'Barcelona', 'Real Madrid')", args: [today] });
  const r = await jobs.notifyGoals({ today, send: async () => 0, getMatch: async () => { throw new Error("ESPN 503"); } });
  assert.deepEqual(r, { goals: 0, sent: 0 });
  assert.ok(Number((await db.execute("SELECT COUNT(*) AS n FROM app_errors WHERE source = 'live'")).rows[0].n) >= 1);
});

test("calibración: una pregunta que casi todos aciertan o casi nadie acierta sale de la tanda", async () => {
  await db.execute({ sql: "INSERT INTO question_stats (question_key, kind, shown, correct, total_ms) VALUES ('d:1', 'penal', 40, 39, 1), ('d:2', 'penal', 40, 2, 1), ('d:3', 'penal', 40, 20, 1), ('d:4', 'penal', 10, 10, 1)" });
  const seen = new Set();
  for (let k = 0; k < 40; k++) {
    const rand = (() => { let a = k + 1; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    for (const it of await dm.penalItems(rand, 12)) seen.add(it.key);
  }
  assert.ok(!seen.has("d:1"), "95%+ de acierto: demasiado fácil");
  assert.ok(!seen.has("d:2"), "10% o menos: demasiado difícil");
  assert.ok(seen.has("d:3"), "50%: queda");
  assert.ok(seen.has("d:4"), "con menos de 20 respuestas no se juzga");
});
