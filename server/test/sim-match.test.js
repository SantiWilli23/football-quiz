import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateMatchEvents, withScorers } from "../utils/match-engine.js";
import { fromEngine, fromSubasta, scoreOf, validateSimMatch } from "../../client/src/match/simMatch.js";

const xi = [{ name: "GK", pos: "GK" }, { name: "DF", pos: "DEF" }, { name: "MC", pos: "MID" }, { name: "DC", pos: "FWD" }];
const home = { name: "Tu equipo", isMe: true };
const away = { name: "Rival" };

test("fromEngine conserva marcador, minutos y ganador de 50 partidos del motor", () => {
  for (let i = 0; i < 50; i++) {
    const sim = simulateMatchEvents({ ovrHome: 60 + (i % 20), ovrAway: 70 - (i % 15) });
    const events = withScorers(sim.events, { home: xi, away: xi });
    const m = fromEngine({ events, home, away });
    assert.deepEqual(validateSimMatch(m), [], `partido ${i}`);
    assert.equal(m.score.home, sim.homeGoals);
    assert.equal(m.score.away, sim.awayGoals);
    const goalsOf = (list, team) => list.filter((e) => e.type === "goal" && e.team === team).map((e) => e.min);
    assert.deepEqual(goalsOf(m.events, "home"), goalsOf(sim.events, "home"), "mismos minutos de gol local");
    assert.deepEqual(goalsOf(m.events, "away"), goalsOf(sim.events, "away"), "mismos minutos de gol visita");
    assert.equal(m.events[0].type, "kickoff");
    assert.equal(m.events.at(-1).type, "ft");
    assert.equal(m.events.filter((e) => e.type === "ht").length, sim.events.some((e) => e.type === "half") ? 1 : 0);
  }
});

test("el validador detecta un SimMatch roto", () => {
  const ok = fromEngine({ events: [{ min: 10, team: "home", type: "goal" }], home, away });
  assert.deepEqual(validateSimMatch(ok), []);
  assert.match(validateSimMatch({ ...ok, events: ok.events.slice(0, -1) }).join(), /ft/);
  assert.match(validateSimMatch({ ...ok, score: { home: 3, away: 0 } }).join(), /no coincide/);
  assert.match(validateSimMatch({ ...ok, events: [...ok.events].reverse() }).join(), /ordenados|ft/);
  assert.match(validateSimMatch({ ...ok, teams: { home: {}, away: {} } }).join(), /equipos/);
});

test("los goles en contra suman al rival", () => {
  assert.deepEqual(scoreOf([{ type: "own_goal", team: "home" }, { type: "pen_goal", team: "home" }]), { home: 1, away: 1 });
});

test("fromSubasta traduce goles, ocasiones y cortes del partido", () => {
  const m = fromSubasta({ match: { goalsA: 2, goalsB: 1, scorersA: ["Ana", "Bea"], scorersB: ["Cami"], minsA: [12, 70], minsB: [33], chances: [5, 12, 60] }, home: { name: "A" }, away: { name: "B" } });
  assert.deepEqual(validateSimMatch(m), []);
  assert.deepEqual(m.score, { home: 2, away: 1 });
  assert.equal(m.events.filter((e) => e.type === "chance").length, 2, "la ocasión del minuto 12 se pisaba con el gol y se descarta");
  assert.equal(m.events.find((e) => e.min === 33).player, "Cami");
});

test("en vivo el partido no termina hasta que llega el final", () => {
  const live = fromEngine({ events: [{ min: 12, team: "home", type: "goal", text: "Gol" }, { min: 45, team: null, type: "half" }], home, away, partial: true });
  assert.notEqual(live.events.at(-1).type, "ft");
  assert.ok(validateSimMatch(live).join().includes("ft"));
  const done = fromEngine({ events: [{ min: 12, team: "home", type: "goal" }, { min: 45, team: null, type: "half" }], home, away });
  assert.equal(done.events.at(-1).type, "ft");
  assert.deepEqual(validateSimMatch(done), []);
});

test("fromDraft arma prórroga y penales con los remates después del final", async () => {
  const { fromDraft } = await import("../../client/src/match/simMatch.js");
  const m = fromDraft({
    home: { label: "Tu selección", isYou: true }, away: { label: "RIVAL 2010-11", isYou: false },
    events: [{ minute: 20, type: "goal", side: "A", player: "Delantero" }, { minute: 77, type: "goal", side: "B", player: "Rival" }, { minute: 60, type: "sub", side: "A", outName: "X", inName: "Y" },
      { minute: 121, type: "shootout", side: "A", player: "Delantero", scored: true }, { minute: 121, type: "shootout", side: "B", player: "Rival", scored: false }],
    scoreHome: 1, scoreAway: 1, extra: true, pens: true, penHome: 1, penAway: 0, winner: "home",
  });
  assert.deepEqual(validateSimMatch(m), []);
  assert.equal(m.duration, 120);
  assert.deepEqual(m.score, { home: 1, away: 1, pens: { home: 1, away: 0 } });
  const types = m.events.map((e) => e.type);
  assert.deepEqual(types.slice(-3), ["ft", "shootout_kick", "shootout_kick"]);
  assert.ok(m.events.find((e) => e.type === "sub" && e.in === "Y"));
});
