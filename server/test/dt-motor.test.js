import { test } from "node:test";
import assert from "node:assert/strict";

// Motor del Modo DT (cliente, JavaScript puro): agenda unificada y fichajes por rondas.
const S = await import("../../client/src/carrera/engine/schedule.js");
const T = await import("../../client/src/carrera/engine/transferMarket.js");

const base = () => ({
  week: 0,
  preseason: { opponents: [{ id: "a", name: "A" }, { id: "b", name: "B" }], matchesPlayed: 0, total: 2, done: false },
  calendar: Array.from({ length: 38 }, (_, i) => ({ week: i + 1, opponentTeamId: `r${i}`, home: i % 2 === 0, played: false, result: null })),
  copa: { opponents: [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }], currentRound: 0, eliminated: false, results: [] },
  continental: { competition: "champions", opponents: [{ id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" }], currentRound: 0, eliminated: false, results: [] },
});

test("la agenda junta liga, copa, Europa y amistosos en orden de fecha", () => {
  const ev = S.seasonSchedule(base());
  assert.equal(ev[0].comp, "amistoso");
  // Semana 6: Copa el miércoles antes de la liga del sábado; semana 10: Europa el martes.
  const w6 = ev.filter((e) => e.weekIdx === 6).map((e) => e.comp);
  assert.deepEqual(w6, ["copa", "liga"]);
  const w10 = ev.filter((e) => e.weekIdx === 10).map((e) => e.comp);
  assert.deepEqual(w10, ["europa", "liga"]);
  assert.equal(ev.length, 2 + 38 + 4 + 4);
});

test("la copa de la semana bloquea la liga hasta jugarse", () => {
  const s = base();
  s.preseason.done = true;
  s.week = 6;
  s.calendar.slice(0, 6).forEach((c) => { c.played = true; });
  assert.equal(S.nextEvent(s).comp, "copa");
  assert.equal(S.midweekBlocking(s).comp, "copa");
  s.copa.results.push({ round: 0, won: true, myGoals: 2, rivalGoals: 1 });
  s.copa.currentRound = 1;
  assert.equal(S.nextEvent(s).comp, "liga");
  assert.equal(S.midweekBlocking(s), null);
});

test("eliminado de la copa, sus rondas siguientes desaparecen de la agenda", () => {
  const s = base();
  s.copa.results.push({ round: 0, won: false, myGoals: 0, rivalGoals: 1 });
  s.copa.eliminated = true;
  const copa = S.seasonSchedule(s).filter((e) => e.comp === "copa");
  assert.equal(copa.length, 1);
  assert.equal(copa[0].played, true);
});

test("pretemporada saltada: los amistosos que faltaban no salen", () => {
  const s = base();
  s.preseason = { ...s.preseason, matchesPlayed: 1, done: true, results: [{ myGoals: 1, rivalGoals: 0 }] };
  assert.equal(S.seasonSchedule(s).filter((e) => e.comp === "amistoso").length, 1);
});

test("ventanas de fichajes", () => {
  assert.equal(S.windowAt(3).id, "verano");
  assert.equal(S.windowAt(12), null);
  assert.equal(S.windowClosesIn(22), 2);
  assert.equal(S.nextWindow(12).id, "invierno");
});

test("negociación sin azar: cumplir el precio acepta, cerca contraoferta, lejos rechaza", () => {
  assert.equal(T.negotiate(50, 50).verdict, "accept");
  const c = T.negotiate(50, 42, 1);
  assert.equal(c.verdict, "counter");
  assert.ok(c.counter > 42 && c.counter <= 50);
  assert.equal(T.negotiate(50, 30).verdict, "reject");
  assert.equal(T.negotiate(50, 30).angry, true);
  // En la tercera ronda el club cede un 5 %: 47,5 ya alcanza.
  assert.equal(T.negotiate(50, 47.5, 3).verdict, "accept");
  assert.equal(T.negotiate(50, 47.5, 1).verdict, "counter");
  for (let i = 0; i < 50; i++) assert.equal(T.negotiate(50, 44, 2).verdict, "counter"); // siempre igual
});

test("pagar en cuotas cuesta 5 % más y un canterano 20 % más", () => {
  const p = { value: 40, contractYears: 3, ovr: 70, academyProduct: false };
  const seller = { prestige: 5 };
  const ask = T.askingPrice(p, seller);
  assert.equal(T.clubNegotiation(p, seller, ask, 1).verdict, "accept");
  assert.notEqual(T.clubNegotiation(p, seller, ask, 1, { installments: true }).verdict, "accept");
  assert.notEqual(T.clubNegotiation({ ...p, academyProduct: true }, seller, ask, 1).verdict, "accept");
});

test("necesidades del plantel por línea", () => {
  const squad = [
    { position: "GK", ovr: 80 },
    ...Array.from({ length: 7 }, () => ({ position: "CB", ovr: 80 })),
    ...Array.from({ length: 7 }, () => ({ position: "CM", ovr: 80 })),
    { position: "ST", ovr: 70 },
  ];
  const n = Object.fromEntries(T.squadNeeds(squad).map((l) => [l.id, l]));
  assert.equal(n.ARQ.short, 1);
  assert.equal(n.DEF.status, 0);
  assert.equal(n.DEL.status, 2); // faltan 4 delanteros
});

test("pedir más por una oferta recibida: sube si había margen, si no se retira", () => {
  assert.deepEqual(T.raiseIncoming({ amount: 20 }, { value: 30 }), { raised: true, amount: 23 });
  assert.equal(T.raiseIncoming({ amount: 35 }, { value: 30 }).raised, false);
});

test("el jugador no corta en la primera ronda: contesta con lo que pide", () => {
  const p = { wage: 100, ovr: 85, value: 50, contractYears: 3 };
  const big = { prestige: 9 }, small = { prestige: 5 };
  const r = T.playerNegotiation(p, big, small, 115, 4, null, null, 1);
  assert.equal(r.verdict, "counter");
  assert.ok(r.counter > 115);
  assert.equal(T.playerNegotiation(p, big, small, r.counter, 4, null, null, 2).verdict, "accept");
});
