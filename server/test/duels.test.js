import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase } from "./helpers.js";

const cleanup = useTempDatabase();

const { DUEL_DIFFICULTIES, DEFAULT_DIFFICULTY, duelPointsFor } = await import("../routes/duels.js");

describe("puntos de duelo por dificultad", () => {
  it("paga más cuanto más difícil es el nivel", () => {
    assert.ok(
      duelPointsFor("dificil", "win") < duelPointsFor("ultra", "win"),
      "ultra tiene que pagar más que difícil"
    );
    assert.ok(
      duelPointsFor("ultra", "win") < duelPointsFor("demonio", "win"),
      "demonio tiene que pagar más que ultra"
    );
  });

  it("el empate siempre paga menos que la victoria", () => {
    for (const nivel of Object.keys(DUEL_DIFFICULTIES)) {
      assert.ok(duelPointsFor(nivel, "draw") < duelPointsFor(nivel, "win"), `falla en ${nivel}`);
    }
  });

  it("perder no suma", () => {
    for (const nivel of Object.keys(DUEL_DIFFICULTIES)) {
      assert.equal(duelPointsFor(nivel, "loss"), 0);
    }
  });

  it("un nivel desconocido cae al por defecto en vez de romper", () => {
    // Los duelos creados antes de que existieran los niveles pueden llegar con
    // la columna vacía; no tienen que reventar el ranking.
    assert.equal(duelPointsFor(null, "win"), duelPointsFor(DEFAULT_DIFFICULTY, "win"));
    assert.equal(duelPointsFor("inventado", "draw"), duelPointsFor(DEFAULT_DIFFICULTY, "draw"));
  });

  it("todos los niveles declaran etiqueta y puntajes", () => {
    for (const [key, tier] of Object.entries(DUEL_DIFFICULTIES)) {
      assert.ok(tier.label, `${key} sin etiqueta`);
      assert.ok(Number.isInteger(tier.win) && tier.win > 0, `${key} sin puntos de victoria`);
      assert.ok(Number.isInteger(tier.draw) && tier.draw > 0, `${key} sin puntos de empate`);
    }
  });
});

describe("pool de preguntas de duelo", async () => {
  const { DUEL_POOL } = await import("../db/duel-pool.js");

  it("tiene al menos cinco preguntas por nivel, que es lo que consume un duelo", () => {
    for (const nivel of Object.keys(DUEL_DIFFICULTIES)) {
      const cuantas = DUEL_POOL.filter((q) => q.difficulty === nivel).length;
      assert.ok(cuantas >= 5, `${nivel} sólo tiene ${cuantas} preguntas`);
    }
  });

  it("no repite preguntas", () => {
    const textos = DUEL_POOL.map((q) => q.question);
    assert.equal(new Set(textos).size, textos.length);
  });

  it("cada pregunta tiene nivel válido y una respuesta correcta que existe", () => {
    for (const q of DUEL_POOL) {
      assert.ok(DUEL_DIFFICULTIES[q.difficulty], `nivel inválido en: ${q.question}`);
      assert.ok(["a", "b", "c", "d"].includes(q.correct_answer), `respuesta inválida en: ${q.question}`);
      assert.ok(q[`option_${q.correct_answer}`], `la correcta apunta a una opción vacía en: ${q.question}`);
    }
  });
});

process.on("exit", cleanup);
