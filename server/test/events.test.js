import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const ev = await import("../utils/events.js");
const dm = await import("../utils/daily-match.js");
const { default: eventsRouter } = await import("../routes/events.js");
const { default: dailyRouter } = await import("../routes/daily-match.js");
const { todayStr, addDays } = await import("../utils/points.js");
const lm = await import("../utils/live-match.js");

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/live");
const summary = JSON.parse(fs.readFileSync(path.join(dir, "espn-summary-eve-ars.json"), "utf-8"));

before(async () => {
  await initSchema();
  for (let i = 1; i <= 12; i++) {
    await db.execute({ sql: "INSERT INTO duel_questions (question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, 'A', 'B', 'C', 'D', 'a', 'dificil')", args: [`Pregunta ${i}`] });
  }
});
after(() => cleanup());

function call(router, method, p, { userId, body = {}, query = {}, params = {} }) {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; } };
    handle({ userId, body, query, params }, res);
  });
}
const E = (m, p, o) => call(eventsRouter, m, p, o);
const D = (m, p, o) => call(dailyRouter, m, p, o);

// Tablero de ESPN mínimo con un clásico y un partido cualquiera.
const board = (home, away, extra = {}) => ({
  events: [
    { id: "9001", name: `${away} at ${home}`, date: "2026-03-14T20:00Z", competitions: [{ competitors: [{ homeAway: "home", team: { id: "1", displayName: home } }, { homeAway: "away", team: { id: "2", displayName: away } }], notes: extra.notes || [] }], season: extra.season },
    { id: "9002", name: "Otro", date: "2026-03-14T18:00Z", competitions: [{ competitors: [{ homeAway: "home", team: { id: "3", displayName: "Getafe" } }, { homeAway: "away", team: { id: "4", displayName: "Sevilla" } }] }] },
  ],
});

test("detecta el Clásico (en cualquier orden local/visita) y lo guarda una sola vez", async () => {
  const sb = async (slug) => (slug === "esp.1" ? board("Barcelona", "Real Madrid") : { events: [] });
  const found = await ev.detectEvents("2026-03-14", { scoreboard: sb });
  assert.equal(found.kit_key, "clasico");
  assert.equal(found.event_id, "9001");
  assert.equal(found.home_name, "Barcelona");
  const again = await ev.detectEvents("2026-03-14", { scoreboard: sb });
  assert.equal(again.event_id, "9001");
  assert.equal(Number((await db.execute("SELECT COUNT(*) AS n FROM events WHERE date = '2026-03-14'")).rows[0].n), 1);
});

test("un partido común no es un evento", async () => {
  const sb = async () => ({ events: [board("Getafe", "Sevilla").events[1]] });
  assert.equal(await ev.detectEvents("2026-04-04", { scoreboard: sb }), null);
});

test("el Superclásico chileno y la final de Champions se reconocen; las semis no", () => {
  const sc = board("Colo Colo", "Universidad de Chile").events[0];
  assert.equal(ev.matchKit(sc, "chi.1").kit.key, "superclasico");
  assert.equal(ev.matchKit(sc, "esp.1"), null, "otra liga no cuenta");
  const final = board("Paris Saint-Germain", "Inter Milan", { notes: [{ headline: "Final" }] }).events[0];
  assert.equal(ev.matchKit(final, "uefa.champions").kit.key, "final_champions");
  const semi = board("Paris Saint-Germain", "Inter Milan", { notes: [{ headline: "Semifinal" }] }).events[0];
  assert.equal(ev.matchKit(semi, "uefa.champions"), null);
});

test("máximo 2 eventos por semana", async () => {
  const mon = "2026-05-04"; // lunes
  const mk = (date) => async (slug) => (slug === "esp.1" ? { events: [{ ...board("Barcelona", "Real Madrid").events[0], date: `${date}T20:00Z` }] } : { events: [] });
  assert.ok(await ev.detectEvents(addDays(mon, 0), { scoreboard: mk(mon) }));
  assert.ok(await ev.detectEvents(addDays(mon, 2), { scoreboard: mk(addDays(mon, 2)) }));
  assert.equal(await ev.detectEvents(addDays(mon, 4), { scoreboard: mk(addDays(mon, 4)) }), null, "el tercero de la semana no entra");
  assert.ok(await ev.detectEvents(addDays(mon, 7), { scoreboard: mk(addDays(mon, 7)) }), "la semana siguiente sí");
});

test("el tercer tiempo de un día de evento es el juego especial y la vista pública no trae respuestas", async () => {
  const date = "2026-06-06";
  await db.execute({ sql: "INSERT INTO events (date, kit_key, league, event_id, home_name, home_id, away_name, away_id, kickoff) VALUES (?, 'clasico', 'esp.1', '9100', 'Barcelona', '83', 'Real Madrid', '86', '2026-06-06T20:00Z')", args: [date] });
  const items = await dm.matchFor(date);
  const third = items.filter((i) => i.part === 3);
  assert.equal(third.length, 3);
  assert.ok(third.every((i) => i.kind === "especial" && i.options.length >= 3 && i.answer >= 0 && i.answer < i.options.length));
  assert.equal(items.filter((i) => i.part === 1).length, 6);
  const pub = dm.publicView(items).filter((i) => i.part === 3);
  assert.ok(pub.every((i) => !("answer" in i) && i.title));
  // el especial de un clásico mezcla «Messi o Cristiano» con «¿en qué club jugó?»
  const texts = third.map((i) => i.question);
  assert.ok(texts.some((t) => /club|jugó/i.test(t)));
});

test("las preguntas de club son correctas según las carreras de la base", () => {
  const rand = (() => { let a = 1; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  const qs = ev.clubQuestions({ name: "Real Madrid", career: "Real Madrid" }, { name: "Barcelona", career: "Barcelona" }, rand, 6);
  assert.equal(qs.length, 6);
  const players = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/equipo-jugador-players.json"), "utf-8")).jugadores;
  for (const q of qs) {
    const name = q.q.replace("¿En qué club jugó ", "").replace("?", "");
    const clubs = new Set(players.find((p) => p.nombre === name).carrera.map((c) => c.club));
    const inA = clubs.has("Real Madrid");
    const inB = clubs.has("Barcelona");
    assert.equal(q.answer, inA && inB ? 2 : inA ? 0 : 1, name);
  }
  assert.ok(new Set(qs.map((q) => q.answer)).size >= 2, "no siempre la misma respuesta");
});

async function eventDay(date, kit = "clasico", kickoff = "2999-01-01T20:00Z") {
  await db.execute({ sql: "INSERT OR REPLACE INTO events (date, kit_key, league, event_id, home_name, home_id, away_name, away_id, kickoff) VALUES (?, ?, 'esp.1', '401878768', 'Barcelona', '83', 'Real Madrid', '86', ?)", args: [date, kit, kickoff] });
}
async function newUser(name) {
  const g = await makeGroup(db, { name: `Ev ${name}`, members: [name, `${name}2`] });
  return { groupId: g.groupId, a: g.userIds[0], b: g.userIds[1] };
}

test("pronóstico: antes del partido, uno por persona, y el sobre llega cuando se resuelve", async () => {
  const date = "2026-07-04";
  await eventDay(date);
  const u = await newUser("pred");
  assert.equal((await E("post", "/pred", { userId: u.a, body: { date, pick: "nadie" } })).status, 400);
  assert.equal((await E("post", "/pred", { userId: u.a, body: { date, pick: "home" } })).status, 200);
  await E("post", "/pred", { userId: u.a, body: { date, pick: "away" } }); // cambia de idea
  await E("post", "/pred", { userId: u.b, body: { date, pick: "draw" } });
  assert.equal((await db.execute({ sql: "SELECT pick FROM event_preds WHERE user_id = ? AND date = ?", args: [u.a, date] })).rows[0].pick, "away");

  // ya empezó: no se acepta
  await db.execute({ sql: "UPDATE events SET kickoff = '2000-01-01T00:00Z' WHERE date = ?", args: [date] });
  assert.equal((await E("post", "/pred", { userId: u.a, body: { date, pick: "home" } })).status, 409);

  // el resultado real: 2-0 local → gana "home"; ninguno de los dos acertó
  await ev.resolveEvent(date, { getMatch: async () => ({ finished: true, score: { home: 2, away: 0, pens: null } }) });
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE source = ?", args: [`evento-pred-${date}`] })).rows[0].n), 0);

  const date2 = "2026-07-11";
  await eventDay(date2, "clasico", "2000-01-01T00:00Z");
  await db.execute({ sql: "INSERT INTO event_preds (user_id, date, pick) VALUES (?, ?, 'draw')", args: [u.b, date2] });
  await ev.resolveEvent(date2, { getMatch: async () => ({ finished: true, score: { home: 1, away: 1, pens: null } }) });
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND source = ?", args: [u.b, `evento-pred-${date2}`] })).rows[0].n), 1);
  // resolver otra vez no entrega otro
  await db.execute({ sql: "UPDATE events SET resolved_at = NULL WHERE date = ?", args: [date2] });
  await ev.resolveEvent(date2, { getMatch: async () => ({ finished: true, score: { home: 1, away: 1, pens: null } }) });
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND source = ?", args: [u.b, `evento-pred-${date2}`] })).rows[0].n), 1);
});

test("hinchadas: gana la que sumó más puntos en el partido del día, y no se cambia después de jugar", async () => {
  const date = "2026-08-01";
  await eventDay(date);
  const g = await makeGroup(db, { name: "Hinchadas", members: ["h1", "h2", "h3"] });
  const [h1, h2, h3] = g.userIds;
  for (const [u, side] of [[h1, "home"], [h2, "away"], [h3, "away"]]) await E("post", "/side", { userId: u, body: { date, side } });
  for (const [u, pts] of [[h1, 90], [h2, 30], [h3, 40]]) await db.execute({ sql: "INSERT INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 0, 0, 0, ?)", args: [u, date, pts] });
  assert.equal((await E("post", "/side", { userId: h1, body: { date, side: "away" } })).status, 409, "ya jugó");
  const fans = (await E("get", "/fans", { userId: h1, query: { groupId: g.groupId, date } })).body;
  assert.deepEqual(fans.home, { fans: 1, points: 90 });
  assert.deepEqual(fans.away, { fans: 2, points: 70 });
  assert.equal(fans.winner, "home", "gana la hinchada con más puntos, no la más numerosa");
  const out = await newUser("fuera");
  assert.equal((await E("get", "/fans", { userId: out.a, query: { groupId: g.groupId, date } })).status, 403);
  const hist = (await E("get", "/history", { userId: h1, query: { groupId: g.groupId } })).body.history;
  assert.ok(hist.some((h) => h.event.date === date && h.winner === "home"));
});

test("el día después: pregunta sobre el resultado real; acertar da insignia y se responde una vez", async () => {
  const yesterday = addDays(todayStr(), -1);
  await eventDay(yesterday, "clasico", "2000-01-01T00:00Z");
  await db.execute({ sql: "UPDATE events SET real_result = ?, resolved_at = datetime('now') WHERE date = ?", args: [JSON.stringify({ home: 3, away: 1, pens: null }), yesterday] });
  const u = await newUser("diaX");
  const q = (await E("get", "/day-after", { userId: u.a })).body;
  assert.equal(q.available, true);
  assert.equal(q.options.length, 4);
  assert.ok(q.options.includes("3-1"));
  assert.equal(new Set(q.options).size, 4);
  const right = q.options.indexOf("3-1");
  assert.equal((await E("post", "/day-after", { userId: u.a, body: { choice: (right + 1) % 4 } })).body.ok, false);
  assert.equal((await E("post", "/day-after", { userId: u.a, body: { choice: right } })).status, 409, "una sola respuesta");
  const u2 = await newUser("diaY");
  const ok = await E("post", "/day-after", { userId: u2.a, body: { choice: right } });
  assert.equal(ok.body.ok, true);
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM event_badges WHERE user_id = ? AND kind = 'dia_despues'", args: [u2.a] })).rows[0].n), 1);
});

test("Adivina la alineación: se revela cuando sale la real, y 8 aciertos dan un sobre", async () => {
  const date = "2026-09-05";
  await eventDay(date);
  const real = lm.normalizeEspnSummary(summary);
  const realNames = real.lineups.home.starters.map((p) => p.name);
  const squad = [...realNames, ...real.lineups.home.bench.map((p) => p.name)];
  ev.setSquadProvider(async () => squad);
  let lineupsOut = false;
  ev.setLiveProvider(async () => ({ ...real, lineups: lineupsOut ? real.lineups : {} }));
  const u = await newUser("alinX");

  const wrongPlayer = await E("post", "/lineup-guess", { userId: u.a, body: { date, team: "home", players: [...realNames.slice(0, 10), "Fulano Inexistente"] } });
  assert.equal(wrongPlayer.status, 400);
  const guess = [...realNames.slice(0, 9), ...real.lineups.home.bench.slice(0, 2).map((p) => p.name)]; // 9 aciertos, 2 errores
  assert.equal((await E("post", "/lineup-guess", { userId: u.a, body: { date, team: "home", players: guess } })).status, 200);

  let r = (await E("get", "/lineup", { userId: u.a, query: { date, team: "home" } })).body;
  assert.equal(r.reveal, null, "todavía no salió la alineación real");
  assert.ok(r.candidates.home.length >= 11);

  lineupsOut = true;
  r = (await E("get", "/lineup", { userId: u.a, query: { date, team: "home" } })).body;
  assert.equal(r.guess.hits, 9);
  assert.equal(r.reveal.marks.filter((m) => m.hit).length, 9);
  assert.equal(r.reveal.pack, true);
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND source LIKE ?", args: [u.a, "bueno-evento-alineacion-%"] })).rows[0].n), 1);
  // revelada: ya no se puede cambiar ni vuelve a dar sobre
  assert.equal((await E("post", "/lineup-guess", { userId: u.a, body: { date, team: "home", players: realNames } })).status, 409);
  await E("get", "/lineup", { userId: u.a, query: { date, team: "home" } });
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND source LIKE ?", args: [u.a, "bueno-evento-alineacion-%"] })).rows[0].n), 1);

  // con pocos aciertos no hay sobre
  const u2 = await newUser("alinY");
  const bad = [...realNames.slice(0, 5), ...real.lineups.home.bench.slice(0, 6).map((p) => p.name)];
  await E("post", "/lineup-guess", { userId: u2.a, body: { date, team: "home", players: bad } });
  const r2 = (await E("get", "/lineup", { userId: u2.a, query: { date, team: "home" } })).body;
  assert.equal(r2.reveal.pack, false);
});

test("Figura del partido: 5 destacados salen del partido real, un voto por persona y club", async () => {
  const date = "2026-10-03";
  await eventDay(date);
  const real = lm.normalizeEspnSummary(summary);
  ev.setLiveProvider(async () => real);
  const g = await makeGroup(db, { name: "Figura", members: ["f1", "f2"] });
  const [f1, f2] = g.userIds;
  const r = (await E("get", "/figure", { userId: f1, query: { groupId: g.groupId, date } })).body;
  assert.equal(r.candidates.length, 5);
  assert.ok(r.candidates.some((c) => c.player === "Ezri Konsa"), "el goleador está entre los destacados");
  const pick = r.candidates[0].player;
  assert.equal((await E("post", "/figure", { userId: f1, body: { groupId: g.groupId, date, player: "Alguien Que No Está" } })).status, 400);
  assert.equal((await E("post", "/figure", { userId: f1, body: { groupId: g.groupId, date, player: pick } })).status, 201);
  assert.equal((await E("post", "/figure", { userId: f1, body: { groupId: g.groupId, date, player: pick } })).status, 409);
  await E("post", "/figure", { userId: f2, body: { groupId: g.groupId, date, player: pick } });
  const after = (await E("get", "/figure", { userId: f1, query: { groupId: g.groupId, date } })).body;
  assert.equal(after.candidates.find((c) => c.player === pick).votes, 2);
  assert.equal(after.mine, pick);
});

test("partido temático: al terminar el partido del día se gana la insignia y el sobre del evento", async () => {
  const date = todayStr();
  await eventDay(date, "superclasico");
  await db.execute({ sql: "DELETE FROM daily_matches WHERE date = ?", args: [date] });
  const u = await newUser("premio");
  const items = await dm.matchFor(date);
  assert.ok(items.some((i) => i.kind === "especial"));
  for (let i = 0; i < items.length; i++) await D("post", "/answer", { userId: u.a, body: { idx: i, answer: items[i].answer, ms: 1000 } });
  const fin = (await D("post", "/finish", { userId: u.a })).body;
  assert.equal(fin.event.badge, "Superclásico");
  assert.equal(fin.event.pack, true);
  const pack = (await db.execute({ sql: "SELECT source, theme FROM card_packs WHERE user_id = ? AND source = ?", args: [u.a, `bueno-evento-${date}`] })).rows[0];
  assert.ok(pack, "sobre del evento");
  assert.equal(pack.theme, "la_roja");
});

test("La Roja: cualquier partido de Chile en un torneo de selecciones es un evento, y no cambia el partido del día", async () => {
  const mk = (home, away) => ({ id: "9500", name: `${away} at ${home}`, date: "2026-06-20T20:00Z", competitions: [{ competitors: [{ homeAway: "home", team: { id: "1", displayName: home } }, { homeAway: "away", team: { id: "2", displayName: away } }] }] });
  assert.equal(ev.matchKit(mk("Chile", "Argentina"), "conmebol.america").kit.key, "seleccion_chile");
  assert.equal(ev.matchKit(mk("Brasil", "Chile"), "fifa.world").kit.key, "seleccion_chile");
  assert.equal(ev.matchKit(mk("Brasil", "Argentina"), "fifa.world"), null);
  assert.equal(ev.matchKit(mk("Chile", "Argentina"), "esp.1"), null, "otra competencia no cuenta");
  await db.execute({ sql: "INSERT INTO events (date, kit_key, league, event_id, home_name, away_name) VALUES ('2026-06-20', 'seleccion_chile', 'conmebol.america', '9500', 'Chile', 'Argentina')" });
  const items = await dm.matchFor("2026-06-20");
  assert.ok(items.every((i) => i.kind !== "especial"), "sin juego especial el tercer tiempo sigue siendo de penales");
  assert.equal(items.filter((i) => i.part === 3).length, 3);
});
