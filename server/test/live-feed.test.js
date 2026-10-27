import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLiveMatch, clearLiveCache, TTL_MS, knownSlug } from "../utils/live-feed.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/live");
const summary = JSON.parse(fs.readFileSync(path.join(dir, "espn-summary-eve-ars.json"), "utf-8"));

const asLive = () => {
  const j = JSON.parse(JSON.stringify(summary));
  j.header.competitions[0].status.type = { name: "STATUS_SECOND_HALF", state: "in" };
  j.header.competitions[0].status.displayClock = "67'";
  return j;
};

beforeEach(() => clearLiveCache());

test("ligas conocidas por clave o por slug de ESPN; las demás no", () => {
  assert.equal(knownSlug("premier"), "eng.1");
  assert.equal(knownSlug("eng.1"), "eng.1");
  assert.equal(knownSlug("../../etc"), null);
});

test("entradas inválidas se rechazan sin llamar al proveedor", async () => {
  let calls = 0;
  const fetchJson = async () => { calls++; return summary; };
  await assert.rejects(() => getLiveMatch("inventada", "123456", { fetchJson }), { status: 400 });
  await assert.rejects(() => getLiveMatch("premier", "abc", { fetchJson }), { status: 400 });
  assert.equal(calls, 0);
});

test("muchos usuarios a la vez = una sola consulta al proveedor", async () => {
  let calls = 0;
  const fetchJson = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return asLive(); };
  const results = await Promise.all(Array.from({ length: 25 }, () => getLiveMatch("premier", "401878768", { fetchJson })));
  assert.equal(calls, 1);
  assert.ok(results.every((r) => r.live && r.minute === 67 && r.stale === false));
});

test("un partido en vivo se renueva a los 15 s; uno terminado dura más", async () => {
  let calls = 0;
  let t = 1_000_000;
  const now = () => t;
  const live = async () => { calls++; return asLive(); };
  await getLiveMatch("premier", "401878768", { fetchJson: live, now });
  t += TTL_MS.live - 1000;
  await getLiveMatch("premier", "401878768", { fetchJson: live, now });
  assert.equal(calls, 1, "dentro de la ventana usa la copia");
  t += 2000;
  await getLiveMatch("premier", "401878768", { fetchJson: live, now });
  assert.equal(calls, 2, "pasada la ventana vuelve a pedir");

  clearLiveCache();
  calls = 0;
  const done = async () => { calls++; return summary; };
  await getLiveMatch("premier", "401878768", { fetchJson: done, now });
  t += 5 * 60_000;
  const again = await getLiveMatch("premier", "401878768", { fetchJson: done, now });
  assert.equal(calls, 1, "uno terminado no se vuelve a pedir en 5 minutos");
  assert.equal(again.finished, true);
});

test("si el proveedor falla se sirve la última copia marcada como vieja, nunca como actual", async () => {
  let t = 5_000_000;
  const now = () => t;
  await getLiveMatch("premier", "401878768", { fetchJson: async () => asLive(), now });
  t += TTL_MS.live + 1000;
  const out = await getLiveMatch("premier", "401878768", { fetchJson: async () => { throw new Error("ESPN 503"); }, now });
  assert.equal(out.stale, true);
  assert.match(out.error, /última actualización/);
  assert.ok(out.ageSeconds >= 15);
  // y si lleva demasiado, ya no hay copia que servir
  t += 10 * 60_000;
  await assert.rejects(() => getLiveMatch("premier", "401878768", { fetchJson: async () => { throw new Error("ESPN 503"); }, now }), /503/);
});
