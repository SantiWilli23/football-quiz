import { test } from "node:test";
import assert from "node:assert/strict";
import { withScorers, simulateMatchEvents } from "../utils/match-engine.js";

const xi = [{ name: "Arquero", pos: "GK" }, { name: "Defensa", pos: "DEF" }, { name: "Medio", pos: "MID" }, { name: "Delantero", pos: "FWD" }];

test("los goles reciben autor del equipo que anotó y el arquero nunca anota", () => {
  const events = Array.from({ length: 400 }, (_, i) => ({ min: 1 + (i % 89), team: i % 2 ? "home" : "away", type: "goal" }));
  const out = withScorers(events, { home: xi, away: [{ name: "Rival", pos: "FWD" }] });
  assert.ok(out.every((e) => e.player), "todos tienen autor");
  assert.ok(out.filter((e) => e.team === "away").every((e) => e.player === "Rival"));
  assert.ok(!out.some((e) => e.player === "Arquero"));
  const by = Object.fromEntries(["Defensa", "Medio", "Delantero"].map((n) => [n, out.filter((e) => e.player === n).length]));
  assert.ok(by.Delantero > by.Medio && by.Medio > by.Defensa, `más delanteros que medios y defensas: ${JSON.stringify(by)}`);
});

test("sin once, el gol queda sin nombre y lo que no es gol no se toca", () => {
  const out = withScorers([{ min: 10, team: "home", type: "goal" }, { min: 45, team: null, type: "half" }, { min: 20, team: "away", type: "goal", player: "Ya tiene" }], { home: [], away: xi });
  assert.equal(out[0].player, undefined);
  assert.deepEqual(out[1], { min: 45, team: null, type: "half" });
  assert.equal(out[2].player, "Ya tiene");
});

test("el motor sigue dando el mismo marcador con o sin autores", () => {
  for (let i = 0; i < 30; i++) {
    const sim = simulateMatchEvents({ ovrHome: 70, ovrAway: 65 });
    const named = withScorers(sim.events, { home: xi, away: xi });
    assert.equal(named.filter((e) => e.type === "goal" && e.team === "home").length, sim.homeGoals);
    assert.equal(named.filter((e) => e.type === "goal" && e.team === "away").length, sim.awayGoals);
    assert.deepEqual(named.map((e) => [e.min, e.type, e.team]), sim.events.map((e) => [e.min, e.type, e.team]));
  }
});
