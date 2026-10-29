import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const meRouter = (await import("../routes/me.js")).default;

before(async () => { await initSchema(); });
after(() => cleanup());

// /me/owner: el selector de versiones (Futotal 1 / Actual / Demo) solo aparece para OWNER_USERNAME.
test("/me/owner dice si el usuario es el dueño, y nadie lo es sin OWNER_USERNAME", async () => {
  const g = await makeGroup(db, { name: "Dueño", members: ["willy", "otra"] });
  const layer = meRouter.stack.find((l) => l.route?.path === "/owner");
  assert.ok(layer, "existe la ruta");
  const call = (userId) => new Promise((resolve) => {
    const res = { status() { return this; }, json(d) { resolve(d); return this; } };
    layer.route.stack[0].handle({ userId }, res);
  });
  delete process.env.OWNER_USERNAME;
  assert.equal((await call(g.userIds[0])).owner, false);
  process.env.OWNER_USERNAME = "Willy";
  try {
    assert.equal((await call(g.userIds[0])).owner, true, "sin distinguir mayúsculas");
    assert.equal((await call(g.userIds[1])).owner, false);
  } finally { delete process.env.OWNER_USERNAME; }
});
