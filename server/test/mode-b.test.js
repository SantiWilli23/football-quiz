import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, dayOffset, makeGroup, makeSpecialQuestion, answerSpecial, predict } from "./helpers.js";

const cleanup = useTempDatabase();

const { db, initSchema } = await import("../db/client.js");
const { MODE_B_POINTS, settleGroup, tallyFor, winnersOf } = await import("../utils/mode-b.js");

before(async () => {
  await initSchema();
});

after(() => cleanup());

describe("winnersOf", () => {
  it("devuelve la opción más votada", () => {
    assert.deepEqual(winnersOf(new Map([["a", 3], ["b", 1]])), ["a"]);
  });

  it("con empate deja ganar a todas las empatadas, para que nadie pierda la predicción por un desempate arbitrario", () => {
    const winners = winnersOf(new Map([["a", 2], ["b", 2], ["c", 1]]));
    assert.deepEqual(winners.sort(), ["a", "b"]);
  });

  it("sin votos no hay ganador", () => {
    assert.deepEqual(winnersOf(new Map()), []);
  });
});

describe("liquidación de un día de Modo B", () => {
  it("paga participación y predicción acertada", async () => {
    const date = dayOffset(-3);
    const { groupId, userIds } = await makeGroup(db, { members: ["ana1", "beto1"] });
    const [ana, beto] = userIds;

    const qid = await makeSpecialQuestion(db, { type: "quien_es_mas", date, prompt: "¿Quién?" });
    // Los dos votan a beto: beto gana claro.
    await answerSpecial(db, { questionId: qid, groupId, userId: ana, value: beto });
    await answerSpecial(db, { questionId: qid, groupId, userId: beto, value: beto });
    // Ana predice bien, beto predice mal.
    await predict(db, { kind: "quien_es_mas", questionId: qid, groupId, userId: ana, value: beto });
    await predict(db, { kind: "quien_es_mas", questionId: qid, groupId, userId: beto, value: ana });

    await settleGroup(groupId);

    const scores = await db.execute({
      sql: "SELECT user_id, points, answered_count, correct_predictions FROM mode_b_scores WHERE group_id = ?",
      args: [groupId],
    });
    const byUser = new Map(scores.rows.map((r) => [r.user_id, r]));

    assert.equal(
      Number(byUser.get(ana).points),
      MODE_B_POINTS.answer + MODE_B_POINTS.prediction,
      "ana respondió y acertó la predicción"
    );
    assert.equal(Number(byUser.get(beto).points), MODE_B_POINTS.answer, "beto respondió pero falló");
    assert.equal(Number(byUser.get(ana).correct_predictions), 1);
    assert.equal(Number(byUser.get(beto).correct_predictions), 0);
  });

  it("en un empate cobran los dos, porque las dos opciones ganan", async () => {
    const date = dayOffset(-4);
    const { groupId, userIds } = await makeGroup(db, { members: ["ana2", "beto2"] });
    const [ana, beto] = userIds;

    const qid = await makeSpecialQuestion(db, {
      type: "que_prefieres", date, prompt: "¿Qué preferís?", a: "Una", b: "Otra",
    });
    await answerSpecial(db, { questionId: qid, groupId, userId: ana, value: "a" });
    await answerSpecial(db, { questionId: qid, groupId, userId: beto, value: "b" });
    await predict(db, { kind: "que_prefieres", questionId: qid, groupId, userId: ana, value: "a" });
    await predict(db, { kind: "que_prefieres", questionId: qid, groupId, userId: beto, value: "b" });

    await settleGroup(groupId);

    const scores = await db.execute({
      sql: "SELECT user_id, correct_predictions FROM mode_b_scores WHERE group_id = ?",
      args: [groupId],
    });
    assert.equal(scores.rows.length, 2);
    for (const row of scores.rows) {
      assert.equal(Number(row.correct_predictions), 1, "con 1-1 las dos opciones son ganadoras");
    }
  });

  it("liquidar dos veces no duplica los puntos", async () => {
    const date = dayOffset(-5);
    const { groupId, userIds } = await makeGroup(db, { members: ["ana3", "beto3"] });

    const qid = await makeSpecialQuestion(db, { type: "quien_es_mas", date, prompt: "¿Quién?" });
    await answerSpecial(db, { questionId: qid, groupId, userId: userIds[0], value: userIds[1] });

    await settleGroup(groupId);
    await settleGroup(groupId);

    const scores = await db.execute({
      sql: "SELECT COUNT(*) AS filas, COALESCE(SUM(points), 0) AS total FROM mode_b_scores WHERE group_id = ?",
      args: [groupId],
    });
    assert.equal(Number(scores.rows[0].filas), 2, "una fila por miembro, no dos");
    assert.equal(Number(scores.rows[0].total), MODE_B_POINTS.answer);
  });

  it("no liquida el día de hoy, que todavía puede recibir votos", async () => {
    const today = dayOffset(0);
    const { groupId, userIds } = await makeGroup(db, { members: ["ana4", "beto4"] });

    const qid = await makeSpecialQuestion(db, { type: "quien_es_mas", date: today, prompt: "¿Quién?" });
    await answerSpecial(db, { questionId: qid, groupId, userId: userIds[0], value: userIds[1] });

    await settleGroup(groupId);

    const scores = await db.execute({
      sql: "SELECT COUNT(*) AS filas FROM mode_b_scores WHERE group_id = ? AND scheduled_date = ?",
      args: [groupId, today],
    });
    assert.equal(Number(scores.rows[0].filas), 0);
  });

  it("quien no respondió queda con cero, no fuera del ranking", async () => {
    const date = dayOffset(-6);
    const { groupId, userIds } = await makeGroup(db, { members: ["ana5", "beto5", "caro5"] });

    const qid = await makeSpecialQuestion(db, { type: "quien_es_mas", date, prompt: "¿Quién?" });
    await answerSpecial(db, { questionId: qid, groupId, userId: userIds[0], value: userIds[1] });

    await settleGroup(groupId);

    const scores = await db.execute({
      sql: "SELECT user_id, points FROM mode_b_scores WHERE group_id = ? AND scheduled_date = ?",
      args: [groupId, date],
    });
    assert.equal(scores.rows.length, 3, "los tres miembros quedan registrados");
    const sinJugar = scores.rows.filter((r) => Number(r.points) === 0);
    assert.equal(sinJugar.length, 2);
  });
});

describe("tallyFor", () => {
  it("cuenta los votos por opción dentro del grupo", async () => {
    const date = dayOffset(-7);
    const { groupId, userIds } = await makeGroup(db, { members: ["ana6", "beto6", "caro6"] });

    const qid = await makeSpecialQuestion(db, {
      type: "que_prefieres", date, prompt: "¿Qué?", a: "Una", b: "Otra",
    });
    await answerSpecial(db, { questionId: qid, groupId, userId: userIds[0], value: "a" });
    await answerSpecial(db, { questionId: qid, groupId, userId: userIds[1], value: "a" });
    await answerSpecial(db, { questionId: qid, groupId, userId: userIds[2], value: "b" });

    const tally = await tallyFor("que_prefieres", qid, groupId);
    assert.equal(tally.get("a"), 2);
    assert.equal(tally.get("b"), 1);
    assert.deepEqual(winnersOf(tally), ["a"]);
  });
});
