import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const P = await import("../utils/progreso.js");

before(async () => { await initSchema(); });
after(() => cleanup());

test("progresión: la curva de niveles es creciente y el rango sube con el nivel", () => {
  assert.equal(P.levelOf(0), 1);
  assert.equal(P.levelOf(59), 1);
  assert.equal(P.levelOf(60), 2);
  assert.equal(P.levelOf(180), 3);
  assert.equal(P.levelOf(10 ** 9), P.MAX_LEVEL);
  assert.equal(P.rankOf(1), "Aficionado");
  assert.equal(P.rankOf(10), "Capitán");
  assert.equal(P.rankOf(40), "Inmortal");
});

test("progresión: la experiencia sale de partidos y logros; las celebraciones se desbloquean por nivel", async () => {
  const g = await makeGroup(db, { name: "Prog", members: ["pro1"] });
  const u = g.userIds[0];
  let p = await P.progreso(u);
  assert.equal(p.level, 1);
  assert.equal(p.celebration, "clasica");
  assert.equal((await P.chooseCelebration(u, "fuegos")).error, "Se desbloquea en el nivel 3");
  assert.equal((await P.chooseCelebration(u, "nada")).error, "Esa celebración no existe");
  // 10 partidos de 20 puntos = 10*10 + 200 = 300 xp → nivel 3
  for (let i = 1; i <= 10; i++) await db.execute({ sql: "INSERT INTO daily_match_results (user_id, date, p1, p2, p3, total) VALUES (?, ?, 5, 10, 5, 20)", args: [u, `2026-03-${String(i).padStart(2, "0")}`] });
  p = await P.progreso(u);
  assert.equal(p.xp, 300);
  assert.equal(p.level, 3);
  assert.equal(p.matches, 10);
  assert.ok(p.celebrations.find((c) => c.id === "fuegos").unlocked);
  assert.ok(!p.celebrations.find((c) => c.id === "confeti").unlocked);
  assert.deepEqual(await P.chooseCelebration(u, "fuegos"), { ok: true, celebration: "fuegos" });
  assert.equal((await P.progreso(u)).celebration, "fuegos");
});
