import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Los pools son datos puros: no hace falta base para revisarlos, y son la
// fuente de la mayoría de los errores de contenido (una correcta que apunta a
// una opción vacía, una pregunta repetida, un pool más corto que el calendario).
const seedSource = await import("node:fs").then((fs) =>
  fs.readFileSync(new URL("../db/seed.js", import.meta.url), "utf8")
);

function poolSize(name) {
  const start = seedSource.indexOf(`const ${name} = [`);
  assert.notEqual(start, -1, `no encontré ${name}`);
  const chunk = seedSource.slice(start, seedSource.indexOf("\n]", start));
  return name.includes("SLOT")
    ? (chunk.match(/question:/g) || []).length
    : (chunk.match(/^ {2}["{]/gm) || []).length;
}

const NUM_DAYS = Number(seedSource.match(/NUM_DAYS = (\d+)/)[1]);

describe("calendario de preguntas", () => {
  it("cada pool cubre el calendario completo sin repetir", () => {
    // Los pools rotan con `día % pool.length`: si el pool es más corto que
    // NUM_DAYS, las preguntas vuelven a salir dentro del mismo ciclo.
    for (const pool of [
      "SLOT1_POOL",
      "SLOT2_POOL",
      "SLOT3_POOL",
      "QUIEN_ES_MAS_POOL",
      "QUE_PREFIERES_POOL",
    ]) {
      const size = poolSize(pool);
      assert.ok(size >= NUM_DAYS, `${pool} tiene ${size} y el calendario es de ${NUM_DAYS} días`);
    }
  });

  it("no hay preguntas de trivia repetidas", () => {
    const preguntas = [...seedSource.matchAll(/question: "([^"]+)"/g)].map((m) => m[1]);
    const repetidas = preguntas.filter((q, i) => preguntas.indexOf(q) !== i);
    assert.deepEqual(repetidas, [], "hay preguntas duplicadas en los pools");
  });

  it("toda respuesta correcta apunta a una opción que existe", () => {
    const bloques = [...seedSource.matchAll(/\{\s*question: "[^"]+",[\s\S]*?correct_answer: "([abcd])",/g)];
    assert.ok(bloques.length > 100, "esperaba encontrar todas las preguntas");
    for (const bloque of bloques) {
      const texto = bloque[0];
      const correcta = bloque[1];
      assert.match(
        texto,
        new RegExp(`option_${correcta}: "[^"]+"`),
        `la correcta (${correcta}) apunta a una opción vacía en: ${texto.slice(0, 80)}`
      );
    }
  });
});
