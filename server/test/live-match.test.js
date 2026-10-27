import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as lm from "../utils/live-match.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/live");
const summary = JSON.parse(fs.readFileSync(path.join(dir, "espn-summary-eve-ars.json"), "utf-8"));
const scoreboard = JSON.parse(fs.readFileSync(path.join(dir, "espn-scoreboard-eng1.json"), "utf-8"));

test("partido real de ESPN (Arsenal 2-0 Everton): marcador, estado y equipos", () => {
  const m = lm.normalizeEspnSummary(summary, { leagueKey: "eng.1" });
  assert.equal(m.status, "FT");
  assert.equal(m.finished, true);
  assert.equal(m.live, false);
  assert.deepEqual([m.score.home, m.score.away], [2, 0]);
  assert.equal(m.teams.home.name, "Arsenal");
  assert.equal(m.teams.away.name, "Everton");
  assert.match(m.teams.home.logo, /^https:\/\//);
  assert.equal(m.venue, "Emirates Stadium");
});

test("la alineación sale completa y ubicada: 11 titulares en las filas de la formación", () => {
  const m = lm.normalizeEspnSummary(summary);
  const home = m.lineups.home;
  assert.equal(home.formation, "4-2-3-1");
  assert.equal(home.starters.length, 11);
  const rows = {};
  for (const p of home.starters) (rows[p.y] ||= []).push(p);
  const sizes = Object.keys(rows).map(Number).sort((a, b) => a - b).map((y) => rows[y].length);
  assert.deepEqual(sizes, [1, 4, 2, 3, 1], "arquero, 4 defensas, 2 volantes, 3 enganches, 1 delantero");
  // de izquierda a derecha: LB, CD-L, CD-R, RB
  const defs = rows[Object.keys(rows).map(Number).sort((a, b) => a - b)[1]].sort((a, b) => a.x - b.x).map((p) => p.pos);
  assert.deepEqual(defs, ["LB", "CD-L", "CD-R", "RB"]);
  for (const p of home.starters) {
    assert.ok(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100, `${p.name} dentro de la cancha`);
    assert.ok(p.name && p.number != null);
  }
  assert.equal(home.bench.length, 9);
});

test("los eventos traen minuto, autor, asistencia y cambios, y se ordenan por minuto", () => {
  const m = lm.normalizeEspnSummary(summary);
  const goals = m.events.filter((e) => e.type === "goal");
  assert.equal(goals.length, 2);
  assert.equal(goals[0].min, 7);
  assert.equal(goals[0].player, "Ezri Konsa");
  assert.equal(goals[0].assist, "Viktor Gyökeres");
  assert.equal(goals[0].team, "home");
  const subs = m.events.filter((e) => e.type === "sub");
  assert.ok(subs.length >= 6);
  assert.ok(subs.every((s) => s.in && s.out), "cada cambio dice quién entra y quién sale");
  assert.equal(m.events.filter((e) => e.type === "yellow").length, 4);
  assert.deepEqual(m.events.map((e) => e.min), [...m.events.map((e) => e.min)].sort((a, b) => a - b));
  // kickoff, corners y demás no son eventos de la línea de tiempo
  assert.ok(m.events.every((e) => ["goal", "own_goal", "pen_goal", "pen_miss", "yellow", "red", "sub", "var"].includes(e.type)));
});

test("las marcas sobre cada jugador reflejan sus goles y tarjetas", () => {
  const m = lm.normalizeEspnSummary(summary);
  const konsa = m.lineups.home.starters.find((p) => p.name === "Ezri Konsa");
  assert.equal(konsa.marks.goals, 1);
  const lewis = m.lineups.home.starters.find((p) => p.name === "Myles Lewis-Skelly");
  assert.equal(lewis.marks.yellow, 1);
});

test("estadísticas y comentarios", () => {
  const m = lm.normalizeEspnSummary(summary);
  assert.deepEqual(m.stats.possession, [58, 42]);
  assert.deepEqual(m.stats.shots, [20, 8]);
  assert.deepEqual(m.stats.corners, [12, 3]);
  assert.ok(m.commentary.length > 50);
  assert.ok(m.commentary.every((c) => c.text));
});

test("tolera datos faltantes: sin formación, sin eventos, sin estadísticas y sin comentarios", () => {
  const broken = JSON.parse(JSON.stringify(summary));
  for (const r of broken.rosters) delete r.formation;
  delete broken.keyEvents;
  delete broken.boxscore;
  delete broken.commentary;
  const m = lm.normalizeEspnSummary(broken);
  assert.equal(m.lineups.home.formation, "4-2-3-1", "la formación se infiere contando por línea");
  assert.equal(m.lineups.home.formationGiven, false);
  assert.equal(m.lineups.home.starters.length, 11);
  assert.deepEqual(m.events, []);
  assert.deepEqual(m.stats.possession, [null, null]);
  assert.deepEqual(m.commentary, []);
});

test("tolera un resumen vacío sin romper", () => {
  const m = lm.normalizeEspnSummary({});
  assert.equal(m.status, "NS");
  assert.equal(m.teams.home, undefined);
  assert.deepEqual(m.events, []);
  assert.deepEqual(m.lineups, {});
});

test("posiciones de ESPN: línea y lado", () => {
  assert.equal(lm.classifyPosition("G").line, "G");
  for (const p of ["LB", "RB", "CD-L", "CD-R", "CD", "LWB", "SW"]) assert.equal(lm.classifyPosition(p).line, "D", p);
  for (const p of ["F", "CF", "LF", "RF", "ST"]) assert.equal(lm.classifyPosition(p).line, "F", p);
  for (const p of ["AM", "AM-L", "AM-R", "DM", "CM", "LM", "RM", "CM-L"]) assert.equal(lm.classifyPosition(p).line, "M", p);
  assert.equal(lm.classifyPosition("COSA-RARA").line, "M", "una abreviatura desconocida no se pierde");
  assert.equal(lm.sideOf("CD-L"), "L");
  assert.equal(lm.sideOf("RB"), "R");
  assert.equal(lm.sideOf("AM"), "C");
});

test("inferir la formación contando por línea", () => {
  const mk = (...p) => p.map((pos) => ({ pos }));
  assert.equal(lm.inferFormation(mk("G", "LB", "CD-L", "CD-R", "RB", "CM", "CM", "CM", "LF", "CF", "RF")), "4-3-3");
  assert.equal(lm.inferFormation(mk("G", "LB", "CD", "RB", "LM", "CM", "CM", "RM", "F", "F", "F")), "3-4-3".replace("3-4-3", "3-4-3"));
  assert.equal(lm.inferFormation(mk("G", "LB")), null, "con datos incompletos no inventa");
  assert.deepEqual(lm.parseFormation("4-4-2"), [4, 4, 2]);
  assert.equal(lm.parseFormation("hola"), null);
  assert.equal(lm.parseFormation("4-4-3"), null, "no suma 10");
});

test("estados de ESPN", () => {
  assert.equal(lm.statusOf({ name: "STATUS_FIRST_HALF" }), "1H");
  assert.equal(lm.statusOf({ name: "STATUS_HALFTIME" }), "HT");
  assert.equal(lm.statusOf({ name: "STATUS_SECOND_HALF" }), "2H");
  assert.equal(lm.statusOf({ name: "STATUS_FINAL_PEN" }), "PEN");
  assert.equal(lm.statusOf({ name: "STATUS_POSTPONED" }), "PST");
  assert.equal(lm.statusOf({ name: "STATUS_QUE_NO_CONOZCO", state: "in" }), "1H");
  assert.equal(lm.statusOf({}), "NS");
});

test("tipos de evento: goles de penal, en contra, tarjetas y cambios", () => {
  assert.equal(lm.eventTypeOf("goal---header"), "goal");
  assert.equal(lm.eventTypeOf("penalty---scored"), "pen_goal");
  assert.equal(lm.eventTypeOf("penalty---saved"), "pen_miss");
  assert.equal(lm.eventTypeOf("own-goal"), "own_goal");
  assert.equal(lm.eventTypeOf("yellow-card"), "yellow");
  assert.equal(lm.eventTypeOf("red-card"), "red");
  assert.equal(lm.eventTypeOf("substitution"), "sub");
  assert.equal(lm.eventTypeOf("kickoff"), null);
});

test("partido en vivo desde el resumen: minuto y estado", () => {
  const live = JSON.parse(JSON.stringify(summary));
  const st = live.header.competitions[0].status;
  st.type = { name: "STATUS_SECOND_HALF", state: "in", completed: false, shortDetail: "67'" };
  st.displayClock = "67'";
  const m = lm.normalizeEspnSummary(live);
  assert.equal(m.status, "2H");
  assert.equal(m.live, true);
  assert.equal(m.minute, 67);
});

test("tablero del día: versión liviana de cada partido", () => {
  const list = scoreboard.events.map((e) => lm.normalizeEspnScoreboardEvent(e, { leagueKey: "eng.1" }));
  assert.equal(list.length, scoreboard.events.length);
  const ars = list.find((x) => x.teams.home.short === "ARS");
  assert.equal(ars.status, "FT");
  assert.deepEqual([ars.score.home, ars.score.away], [2, 0]);
});
