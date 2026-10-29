import { test } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase } from "./helpers.js";

const cleanup = useTempDatabase();
const { dailyGameKeyFor, DAILY_GAMES } = await import("../utils/daily-games.js");
test.after(() => cleanup());

const plus = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

test("desde el 30/10/2026 Traspasos no sale en el juego diario y los demás rotan todos", () => {
  const seen = new Set();
  for (let i = 0; i < 120; i++) {
    const k = dailyGameKeyFor(plus("2026-10-30", i));
    assert.notEqual(k, "traspasos", plus("2026-10-30", i));
    seen.add(k);
  }
  assert.equal(seen.size, DAILY_GAMES.length - 1);
});

test("las fechas anteriores conservan su juego del día", () => {
  // Antes del corte la rotación incluía Traspasos: en un ciclo completo aparece.
  const before = new Set();
  for (let i = 0; i < DAILY_GAMES.length; i++) before.add(dailyGameKeyFor(plus("2026-10-12", i)));
  assert.ok(before.has("traspasos"));
});
