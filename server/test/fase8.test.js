import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const ledger = await import("../utils/ledger.js");
const month = await import("../utils/month.js");
const friendly = await import("../utils/friendly.js");
const jobs = await import("../utils/jobs.js");
const { bus } = await import("../utils/bus.js");
const { default: clubsRouter } = await import("../routes/clubs.js");
const { default: careersRouter } = await import("../routes/careers.js");
const { adminRouter, metrics } = await import("../routes/admin.js");
const { addDays } = await import("../utils/points.js");
const cardsRouter = (await import("../routes/cards.js")).default;

before(async () => { await initSchema(); });
after(() => cleanup());

function call(router, method, p, { userId, body = {}, query = {}, params = {} }) {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body, query, params, headers: {} }, res);
  });
}

async function started(mode, names, createdBy = 0) {
  const g = await makeGroup(db, { name: `F8 ${names.join("")}`, members: names });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = ?, season_started_at = '2026-01-01', created_by = ? WHERE id = ?", args: [mode, g.userIds[createdBy], g.groupId] });
  return g;
}

test("cierre de mes: el podio recibe trofeo y solo el club principal da Sobre Élite; es idempotente", async () => {
  const g = await started("clasico", ["m1", "m2", "m3", "m4"]);
  const [a, b, c, d] = g.userIds;
  for (const [u, pts] of [[a, 90], [b, 70], [c, 50], [d, 10]]) await ledger.creditPoints(u, "2026-03-05", "partido_dia", pts);
  await db.execute({ sql: "INSERT INTO user_main_club (user_id, group_id) VALUES (?, ?)", args: [a, g.groupId] }); // solo a tiene este club como principal
  const r = await month.closeMonth(g.groupId, "2026-03");
  assert.equal(r.closed, true);
  assert.deepEqual(r.podium.map((p) => [p.place, p.elite]), [[1, true], [2, false], [3, false]]);
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM club_trophies WHERE group_id = ?", args: [g.groupId] })).rows[0].n), 3);
  const pack = (await db.execute({ sql: "SELECT theme, date FROM card_packs WHERE user_id = ? AND source = 'top-elite-2026-03'", args: [a] })).rows[0];
  assert.equal(pack.theme, "elite");
  assert.equal((await month.closeMonth(g.groupId, "2026-03")).closed, false, "no se cierra dos veces");
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE source = 'top-elite-2026-03'", args: [] })).rows[0].n) >= 1, true);
});

test("el Sobre Élite trae una carta de 90 o más asegurada", async () => {
  const g = await started("clasico", ["e1", "e2"]);
  await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source, theme) VALUES (?, '2026-04-01', 'top-elite-2026-04', 'elite')", args: [g.userIds[0]] });
  const opened = await call(cardsRouter, "post", "/open", { userId: g.userIds[0] });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.equal(opened.body.cards.length, 5);
  assert.ok(opened.body.cards.some((c) => c.ovr >= 90), `ninguna carta de 90+: ${opened.body.cards.map((c) => c.ovr)}`);
});

test("fin de mes sin podio y ceremonias pendientes", async () => {
  const g = await started("clasico", ["c1x", "c2x"]);
  const r = await month.closeMonth(g.groupId, "2026-05"); // nadie sumó
  assert.equal(r.closed, true);
  assert.deepEqual(r.podium, []);
  const pend = await month.pendingCeremonies(g.userIds[0]);
  assert.ok(pend.some((p) => p.month === "2026-05" && p.place === null));
  await month.markSeen(g.userIds[0], g.groupId, "2026-05");
  assert.ok(!(await month.pendingCeremonies(g.userIds[0])).some((p) => p.month === "2026-05"));
  assert.equal(month.prevMonthOf("2026-01-15"), "2025-12");
});

test("closeDueMonths cierra todos los meses vencidos de los clubes iniciados", async () => {
  const g = await makeGroup(db, { name: "Vencidos", members: ["v1", "v2"] });
  await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-06-10' WHERE id = ?", args: [g.groupId] });
  const done = await month.closeDueMonths("2026-09-02");
  const mine = done.filter((d) => d.month && d.club === "Vencidos");
  assert.deepEqual(mine.map((d) => d.month), ["2026-06", "2026-07", "2026-08"]);
  assert.equal((await month.closeDueMonths("2026-09-02")).filter((d) => d.club === "Vencidos").length, 0);
});

test("amistoso: desafío, aceptación, media por días con mínimo de gente y ganador con insignia", async () => {
  const A = await started("clasico", ["fa1", "fa2", "fa3"], 0);
  const B = await started("clasico", ["fb1", "fb2", "fb3"], 0);
  const codeB = (await db.execute({ sql: "SELECT invite_code FROM groups_t WHERE id = ?", args: [B.groupId] })).rows[0].invite_code;
  assert.equal((await friendly.challenge(A.groupId, codeB, B.userIds[1], "2026-02-04")).status, 403, "solo el dueño desafía");
  assert.equal((await friendly.challenge(A.groupId, "FUTBOL-NOPE", A.userIds[0], "2026-02-04")).status, 404);
  const ch = await friendly.challenge(A.groupId, codeB, A.userIds[0], "2026-02-04"); // miércoles
  assert.equal(ch.ok, true);
  assert.equal(ch.week, "2026-02-09", "arranca el lunes siguiente");
  assert.equal((await friendly.challenge(A.groupId, codeB, A.userIds[0], "2026-02-04")).status, 409, "no se repite");
  assert.equal((await friendly.accept(ch.id, A.userIds[0], "2026-02-05")).status, 404, "acepta el otro dueño");
  assert.equal((await friendly.accept(ch.id, B.userIds[0], "2026-02-05")).week, "2026-02-09");

  const play = (u, date, t) => db.execute({ sql: "INSERT OR REPLACE INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 0, 0, 0, ?)", args: [u, date, t] });
  const week = "2026-02-09";
  // A: lunes 3 jugaron (80, 70, 60 → 70). Martes solo 2 (no cuenta con mínimo 3... pero los clubes son chicos → mínimo 2)
  for (const [u, t] of [[A.userIds[0], 80], [A.userIds[1], 70], [A.userIds[2], 60]]) await play(u, week, t);
  for (const [u, t] of [[B.userIds[0], 50], [B.userIds[1], 60], [B.userIds[2], 40]]) await play(u, week, t);
  await play(A.userIds[0], addDays(week, 1), 100); await play(A.userIds[1], addDays(week, 1), 90); // 95
  await play(B.userIds[0], addDays(week, 1), 10); // 1 solo: no cuenta
  const s = await friendly.scoreFriendly((await db.execute({ sql: "SELECT * FROM club_friendlies WHERE id = ?", args: [ch.id] })).rows[0]);
  assert.equal(s.minPerDay, 3 - 1, "clubes chicos: mínimo 2");
  assert.equal(s.a.avg, 82.5, "(70 + 95) / 2");
  assert.equal(s.b.avg, 50, "solo cuenta el lunes");
  assert.equal(s.winner, A.groupId);

  assert.equal((await friendly.closeDueFriendlies("2026-02-12")).length, 0, "la semana no terminó");
  const closed = await friendly.closeDueFriendlies("2026-02-17");
  assert.equal(closed.find((c) => c.id === ch.id).winner, A.groupId);
  const badges = (await db.execute({ sql: "SELECT user_id FROM event_badges WHERE kit_key = 'amistoso' AND kind = ?", args: [`amistoso-${ch.id}`] })).rows.map((r) => r.user_id);
  assert.deepEqual(badges.sort(), [...A.userIds].sort(), "todo el club ganador recibe la insignia");
  assert.equal((await friendly.closeDueFriendlies("2026-02-17")).length, 0, "idempotente");
  const list = await friendly.friendliesOf(A.groupId, "2026-02-17");
  assert.equal(list[0].status, "closed");
  assert.equal(list[0].winner, A.groupId);
});

test("leyendas del club: la mejor carrera de cada persona, tope de puntaje y etiquetas cerradas", async () => {
  const g = await started("clasico", ["l1", "l2", "l3"]);
  const [a, b] = g.userIds;
  assert.equal((await call(careersRouter, "post", "/score", { userId: a, body: { game: "otro", score: 100 } })).status, 400);
  await call(careersRouter, "post", "/score", { userId: a, body: { game: "cotrero_medio", score: 900, label: "Crack", position: "Delantero", name: "El Pibe" } });
  await call(careersRouter, "post", "/score", { userId: a, body: { game: "cotrero_medio", score: 400, label: "Jugador correcto" } }); // peor: no pisa
  await call(careersRouter, "post", "/score", { userId: b, body: { game: "cotrero_medio", score: 99999, label: "Inventada", name: "<b>Trampa</b>" } });
  const legends = (await call(clubsRouter, "get", "/:id/legends", { userId: a, params: { id: String(g.groupId) } })).body.legends;
  assert.equal(legends[0].username, "l2", "el puntaje se topea en 3000 y gana el más alto");
  assert.equal(legends[0].score, 3000);
  assert.equal(legends[0].label, null, "etiqueta fuera de la lista: se descarta");
  assert.ok(!legends[0].name.includes("<"));
  assert.equal(legends[1].score, 900, "la peor carrera no pisó a la mejor");
  assert.equal(legends[1].name, "El Pibe");
});

test("tabla en vivo: sumar puntos avisa al club por el bus", async () => {
  const g = await started("clasico", ["b1", "b2"]);
  const seen = [];
  const on = (e) => seen.push(e);
  bus.on("points", on);
  try {
    await ledger.creditPoints(g.userIds[0], "2026-03-01", "partido_dia", 82);
    await ledger.creditPointsToGroup(g.userIds[1], g.groupId, "2026-03-01", "copa", 20);
  } finally { bus.off("points", on); }
  assert.deepEqual(seen.map((e) => [e.groupId, e.points, e.source]), [[g.groupId, 82, "partido_dia"], [g.groupId, 20, "copa"]]);
});

test("avisos «a tu hora»: solo a quien tiene un hábito, con motivo concreto y máximo 3 por día", async () => {
  const g = await started("clasico", ["p1", "p2"]);
  const [me, other] = g.userIds;
  const today = "2026-03-10";
  const at = (h) => new Date(Date.UTC(2026, 2, 1, h + 3, 0, 0)).getTime(); // Chile = UTC-3 en marzo
  for (let i = 0; i < 5; i++) await db.execute({ sql: "INSERT INTO daily_match_runs (user_id, date, started_at, last_at) VALUES (?, ?, ?, ?)", args: [me, `2026-03-0${i + 1}`, at(20), at(20)] });
  await db.execute({ sql: "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, 'https://x.test/a', 'k', 'a')", args: [me] });
  await db.execute({ sql: "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, 'https://x.test/b', 'k', 'a')", args: [other] }); // sin hábito
  assert.equal(await jobs.usualHour(me), 20);
  assert.equal(await jobs.usualHour(other), null);

  await db.execute({ sql: "INSERT INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 0, 0, 0, 77)", args: [other, today] });
  await ledger.creditPoints(other, today, "partido_dia", 77);
  const sent = [];
  const send = async (userId, payload) => { sent.push({ userId, payload }); return 1; };
  const wrongHour = await jobs.sendSmartReminders({ today, now: new Date(Date.UTC(2026, 2, 10, 15, 0)), send });
  assert.equal(wrongHour.sent, 0, "a las 12 no es su hora");
  const right = await jobs.sendSmartReminders({ today, now: new Date(Date.UTC(2026, 2, 10, 23, 5)), send });
  assert.equal(right.sent, 1);
  assert.equal(sent[0].userId, me);
  assert.match(sent[0].payload.body, /p2 ya sacó 77/, "el motivo es concreto: alguien ya jugó");
  // tope diario
  await db.execute({ sql: "UPDATE push_day SET n = 3 WHERE user_id = ? AND date = ?", args: [me, today] });
  assert.equal((await jobs.sendSmartReminders({ today, now: new Date(Date.UTC(2026, 2, 10, 23, 5)), send })).sent, 0);
  // quien ya jugó hoy no recibe aviso
  await db.execute({ sql: "INSERT INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 0, 0, 0, 50)", args: [me, today] });
  await db.execute({ sql: "UPDATE push_day SET n = 0 WHERE user_id = ?", args: [me] });
  assert.equal((await jobs.sendSmartReminders({ today, now: new Date(Date.UTC(2026, 2, 10, 23, 5)), send })).sent, 0);
});

test("las tareas se registran y un fallo no frena a las demás", async () => {
  const out = await jobs.runJobs({ today: "2026-03-20", send: async () => 0, now: new Date(Date.UTC(2026, 2, 20, 12, 0)) });
  for (const k of ["eventos", "copas", "meses", "amistosos", "avisos", "alertas"]) assert.ok(k in out, k);
  assert.equal(out.eventos.skipped, true, "sin la bandera no se buscan eventos");
  assert.ok(Number((await db.execute("SELECT COUNT(*) AS n FROM job_runs")).rows[0].n) >= 1);
  await jobs.logError("live", new Error("ESPN 503"));
  await jobs.logError("live", new Error("ESPN 503"));
  const row = (await db.execute("SELECT count FROM app_errors WHERE source = 'live' AND message = 'ESPN 503'")).rows[0];
  assert.equal(Number(row.count), 2, "el mismo error se agrupa");
});

test("panel del dueño: apagado sin OWNER_USERNAME y solo para el dueño; métricas básicas", async () => {
  const g = await makeGroup(db, { name: "Panel", members: ["dueño1", "otro1"] });
  const gate = adminRouter.stack.find((l) => !l.route && l.handle.length === 3 && l.name !== "bound dispatch" && l.handle.toString().includes("OWNER_USERNAME"));
  const run = (userId) => new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    gate.handle({ userId }, res, () => resolve({ status: 200, next: true }));
  });
  delete process.env.OWNER_USERNAME;
  assert.equal((await run(g.userIds[0])).status, 503);
  process.env.OWNER_USERNAME = "dueño1";
  try {
    assert.equal((await run(g.userIds[1])).status, 403);
    assert.equal((await run(g.userIds[0])).next, true);
  } finally { delete process.env.OWNER_USERNAME; }
  const m = await metrics("2026-03-20");
  assert.ok(m.users >= 2);
  assert.ok("d1" in m && "d7" in m && "pctPlayedToday" in m && "pctInStartedClub" in m);
});
