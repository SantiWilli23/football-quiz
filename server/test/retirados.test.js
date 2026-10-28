import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { useTempDatabase } from "./helpers.js";

const cleanup = useTempDatabase();
const here = path.dirname(fileURLToPath(import.meta.url));
const children = [];
after(() => { for (const c of children) c.kill(); cleanup(); });

// Levanta el servidor de verdad (index.js) en un puerto libre y espera a que responda.
async function boot(port, flag) {
  const env = { ...process.env, PORT: String(port), JWT_SECRET: "test-secret", PUSH_CRON_SECRET: "", ...(flag ? { FUTOTAL2: "1" } : { FUTOTAL2: "0" }) };
  const child = spawn(process.execPath, ["index.js"], { cwd: path.join(here, ".."), env, stdio: "ignore" });
  children.push(child);
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return; } catch { /* todavía no */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("el servidor no arrancó");
}
const post = (port, p) => fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });

test("con el rediseño las funciones retiradas responden 410 a toda escritura y las borradas ya no existen", async () => {
  await boot(4391, true);
  for (const p of ["/api/questions/answer", "/api/bonus/answer", "/api/mode-b/answer", "/api/polls", "/api/duel-tournaments", "/api/daily-challenge"]) {
    assert.equal((await post(4391, p)).status, 410, p);
  }
  // Las lecturas no se cortan (pasan a la autenticación normal).
  assert.equal((await fetch("http://127.0.0.1:4391/api/questions/today")).status, 401);
  for (const p of ["/api/quiniela", "/api/fantasy", "/api/fantasyfiction", "/api/transfers", "/api/season-pass", "/api/season-predictions", "/api/group-league"]) {
    assert.equal((await post(4391, p)).status, 404, `${p} ya no existe`);
  }
  // Y lo nuevo sigue vivo: sin sesión pide autenticación, no 404.
  assert.equal((await post(4391, "/api/draft/start")).status, 401);
});

test("sin el rediseño nada se retira: las escrituras viejas siguen pidiendo sesión", async () => {
  await boot(4392, false);
  assert.equal((await post(4392, "/api/questions/answer")).status, 401);
});
