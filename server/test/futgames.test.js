import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildIndex, cellsForPlayer, dailySeed, generateGrid, normalize, rankRanges, revealSets,
  scorePyramid, squadOf, squadRevealOrders, tierOfRank,
} from "../utils/futgames.js";
import { PYRAMID_PUZZLES } from "../data/pyramid-puzzles.js";

const P = (nombre, nacionalidad, ...clubs) => ({ nombre, nacionalidad, carrera: clubs.map((club) => ({ club })) });

const PLAYERS = [
  P("Carlos Tevez", "Argentina", "Boca", "Corinthians", "West Ham", "Man Utd", "Man City", "Juventus"),
  P("Sergio Agüero", "Argentina", "Independiente", "Atletico", "Man City", "Barcelona"),
  P("Paul Pogba", "Francia", "Man Utd", "Juventus"),
  P("Patrice Evra", "Francia", "Monaco", "Man Utd", "Juventus"),
  P("Wayne Rooney", "Inglaterra", "Everton", "Man Utd"),
  P("Kyle Walker", "Inglaterra", "Tottenham", "Man City"),
];

const GRID = {
  rows: [{ type: "pais", name: "Argentina" }, { type: "club", name: "Man Utd" }, { type: "pais", name: "Francia" }],
  cols: [{ type: "club", name: "Juventus" }, { type: "club", name: "Man City" }, { type: "club", name: "Tottenham" }],
};

test("dailySeed es determinista y cambia con la fecha", () => {
  assert.equal(dailySeed("2026-10-07"), dailySeed("2026-10-07"));
  assert.notEqual(dailySeed("2026-10-07"), dailySeed("2026-10-08"));
});

test("normalize ignora tildes y mayúsculas", () => {
  assert.equal(normalize("  Agüero ÁLVAREZ "), "aguero alvarez");
});

test("Tateti: celdas válidas para un jugador (fila Y columna)", () => {
  const index = buildIndex(PLAYERS);
  // Tevez: Argentina x Juventus (0), Argentina x Man City (1), Man Utd x Juventus (3), Man Utd x Man City (4)
  assert.deepEqual(cellsForPlayer(index, GRID, "Carlos Tevez"), [0, 1, 3, 4]);
  // Rooney no encaja en ninguna (no jugó en Juventus, City ni Tottenham)
  assert.deepEqual(cellsForPlayer(index, GRID, "Wayne Rooney"), []);
});

test("Tateti: auto-colocación (1 celda) vs elección múltiple (2+)", () => {
  const index = buildIndex(PLAYERS);
  // Pogba: Man Utd x Juventus y Francia x Juventus -> elige entre 2
  assert.deepEqual(cellsForPlayer(index, GRID, "Paul Pogba"), [3, 6]);
  // Con la 3 ya ocupada, queda una sola: se coloca sola
  assert.deepEqual(cellsForPlayer(index, GRID, "Paul Pogba", [3]), [6]);
  // Con las dos ocupadas: no hay lugar
  assert.deepEqual(cellsForPlayer(index, GRID, "Paul Pogba", [3, 6]), []);
});

test("Tateti: el generador respeta mínimos/máximos por casilla", () => {
  const players = [];
  const clubs = ["A", "B", "C", "D", "E", "F"];
  // Muchos jugadores que pasaron por todos los clubes -> muchas respuestas por casilla
  for (let i = 0; i < 8; i++) players.push(P(`J${i}`, i % 2 ? "X" : "Y", ...clubs));
  const index = buildIndex(players);
  const pools = { facil: { clubs, countries: ["X", "Y"] }, medio: { clubs, countries: ["X", "Y"] } };
  const g = generateGrid({ index, pools, mode: "facil", date: "2026-10-07" });
  assert.equal(g.rows.length, 3);
  assert.equal(g.cols.length, 3);
  assert.ok(g.counts.every((n) => n >= 4), "fácil: cada casilla con al menos 4 jugadores");
  // Medio exige 1-3 por casilla: con 4+ en todas, no hay tablero posible
  assert.throws(() => generateGrid({ index, pools, mode: "medio", date: "2026-10-07", maxTries: 50 }));
});

test("Pirámide: tiers por casilla", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 10].map(tierOfRank), [1, 2, 2, 3, 3, 3, 4, 4]);
});

test("Pirámide: conteo de aciertos, con empates en cualquier orden", () => {
  const entries = [
    { id: "a", value: 10 }, { id: "b", value: 8 }, { id: "c", value: 8 }, { id: "d", value: 5 },
    { id: "e", value: 4 }, { id: "f", value: 3 }, { id: "g", value: 2 }, { id: "h", value: 1 },
    { id: "i", value: 0 }, { id: "j", value: -1 },
  ];
  assert.deepEqual(rankRanges(entries).b, { first: 2, last: 3 });
  const perfect = ["a", "c", "b", "d", "e", "f", "g", "h", "i", "j"]; // b y c empatados, invertidos
  assert.equal(scorePyramid(entries, perfect).correct, 10);
  const swapped = ["d", "b", "c", "a", "e", "f", "g", "h", "i", "j"];
  assert.equal(scorePyramid(entries, swapped).correct, 8);
  const partial = ["a", null, null, null, null, null, null, null, null, null];
  assert.equal(scorePyramid(entries, partial).correct, 1);
});

test("Pirámide: los puzzles de datos tienen 10 jugadores distintos", () => {
  for (const p of PYRAMID_PUZZLES) {
    assert.equal(p.entries.length, 10, p.key);
    assert.equal(new Set(p.entries.map((e) => e.name)).size, 10, p.key);
    assert.ok(p.entries.every((e) => Number.isFinite(e.value)), p.key);
  }
});

test("Torta: se revelan porciones enteras hasta 30% / 60% / 100%", () => {
  const countries = [{ count: 5 }, { count: 3 }, { count: 1 }, { count: 1 }]; // total 10
  const sets = revealSets(countries, [0, 1, 2, 3]);
  assert.deepEqual(sets[0], [0]); // 50% >= 30%
  assert.deepEqual(sets[1], [0, 1]); // 80% >= 60%
  assert.deepEqual(sets[2], [0, 1, 2, 3]);
  // En orden aleatorio arrancando por las chicas, hacen falta más porciones
  const rnd = revealSets(countries, [3, 2, 1, 0]);
  assert.deepEqual(rnd[0], [1, 2, 3]); // 1+1+3 = 50%
  assert.deepEqual(rnd[2], [0, 1, 2, 3]);
});

test("Torta: plantel por nacionalidad ordenado y órdenes de revelado", () => {
  const s = squadOf(PLAYERS, "Man Utd");
  assert.deepEqual(s.map((c) => [c.country, c.count]), [["Francia", 2], ["Argentina", 1], ["Inglaterra", 1]]);
  const orders = squadRevealOrders(s, "2026-10-07");
  assert.equal(orders.clockwise.length, 3);
  assert.deepEqual(orders.clockwise[2], [0, 1, 2]);
  assert.deepEqual(orders.random[2], [0, 1, 2]);
});

test("Tateti: la categoría 'champions' sale de la etapa en un club campeón", async () => {
  const { wonChampions } = await import("../utils/futgames.js");
  assert.equal(wonChampions({ carrera: [{ club: "Barcelona", inicio: 2004, fin: 2021 }] }), true); // 2006, 2009, 2011, 2015
  assert.equal(wonChampions({ carrera: [{ club: "Barcelona", inicio: 2016, fin: 2018 }] }), false);
  assert.equal(wonChampions({ carrera: [{ club: "Everton", inicio: 2000, fin: 2010 }] }), false);
});
