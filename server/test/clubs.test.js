import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTempDatabase, makeGroup } from "./helpers.js";

const cleanup = useTempDatabase();
const { db, initSchema } = await import("../db/client.js");
const ledger = await import("../utils/ledger.js");
const clubs = await import("../utils/clubs.js");
const { streakFromDates } = await import("../utils/streak.js");
const { todayStr, monthOf } = await import("../utils/points.js");
const recovery = await import("../utils/recovery.js");

before(async () => { await initSchema(); });
after(() => cleanup());

async function startedClub(mode, members = ["ana", "beto"]) {
  const { groupId, userIds } = await makeGroup(db, { name: `Club ${mode} ${members.join("")}`, members });
  await db.execute({ sql: "UPDATE groups_t SET club_mode = ?, season_started_at = '2026-01-01' WHERE id = ?", args: [mode, groupId] });
  return { groupId, userIds };
}

test("el día de la app es el de Chile, no el de UTC", () => {
  assert.equal(todayStr(new Date("2026-10-26T02:30:00Z")), "2026-10-25");
  assert.equal(todayStr(new Date("2026-10-26T04:30:00Z")), "2026-10-26");
});

test("Clásico: solo cuentan el partido del día y la copa; lo libre no", () => {
  assert.equal(ledger.pointsFor("clasico", "partido_dia", 80), 80);
  assert.equal(ledger.pointsFor("clasico", "copa", 200), 200);
  assert.equal(ledger.pointsFor("clasico", "versus", 30), 0);
  assert.equal(ledger.pointsFor("clasico", "libre:escudos", 20), 0);
  assert.equal(ledger.pointsFor("clasico", "dt_podio", 60), 0);
});

test("Total: partido del día y copa valen el doble y lo libre suma", () => {
  assert.equal(ledger.pointsFor("total", "partido_dia", 80), 160);
  assert.equal(ledger.pointsFor("total", "copa", 200), 400);
  assert.equal(ledger.pointsFor("total", "versus", 30), 30);
  assert.equal(ledger.pointsFor("total", "dt_podio", 60), 60);
});

test("el partido del día suma al instante en cada club iniciado del usuario", async () => {
  const a = await startedClub("clasico", ["ana1", "beto1"]);
  const b = await startedClub("total", ["carla2", "dani2"]);
  const ana = a.userIds[0];
  await db.execute({ sql: "INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)", args: [b.groupId, ana] });
  const res = await ledger.creditPoints(ana, todayStr(), "partido_dia", 60);
  const byGroup = Object.fromEntries(res.credited.map((c) => [c.groupId, c.points]));
  assert.equal(byGroup[a.groupId], 60);
  assert.equal(byGroup[b.groupId], 120);
  const again = await ledger.creditPoints(ana, todayStr(), "partido_dia", 60);
  assert.equal(again.credited.length, 0, "repetir no suma de nuevo");
});

test("pretemporada: un club sin temporada iniciada no suma y se informa lo que habría ganado", async () => {
  const { groupId, userIds } = await makeGroup(db, { name: "Pre", members: ["pepe", "quique"] });
  const res = await ledger.creditPoints(userIds[0], todayStr(), "partido_dia", 50);
  assert.deepEqual(res.credited, []);
  assert.equal(res.wouldHave, 50, "sin club iniciado se informa el valor Clásico");
  const table = await ledger.clubTable(groupId, "general", todayStr());
  assert.ok(table.every((r) => r.points === 0));
});

test("libre: una vez por juego al día y con tope de 100 por día (Total)", async () => {
  const { groupId, userIds } = await startedClub("total", ["tomi", "uri"]);
  const tomi = userIds[0];
  const date = "2026-03-10";
  assert.equal((await ledger.creditPoints(tomi, date, ledger.freeGameSource("escudos"), 20)).credited[0].points, 20);
  assert.equal((await ledger.creditPoints(tomi, date, ledger.freeGameSource("escudos"), 20)).credited.length, 0, "misma fuente, mismo día");
  for (const g of ["a", "b", "c", "d"]) await ledger.creditPoints(tomi, date, ledger.freeGameSource(g), 20);
  const over = await ledger.creditPoints(tomi, date, "versus", 30);
  assert.equal(over.credited.length, 0, "el tope diario de 100 corta lo que sigue");
  const row = (await ledger.clubTable(groupId, "hoy", date)).find((r) => r.userId === tomi);
  assert.equal(row.points, 100);
  assert.equal((await ledger.creditPoints(tomi, date, "partido_dia", 50)).credited[0].points, 100, "el partido del día no cuenta para el tope");
});

test("entrada tardía: aparece en la tabla desde el mes siguiente y no suma antes", async () => {
  const { groupId, userIds } = await startedClub("clasico", ["vale", "wal"]);
  const wal = userIds[1];
  const club = { season_started_at: "2026-01-01" };
  assert.equal(clubs.debutMonthFor(club, "2026-03-15"), "2026-04");
  assert.equal(clubs.debutMonthFor(club, "2026-12-20"), "2027-01");
  assert.equal(clubs.debutMonthFor(club, "2026-03-01"), null);
  assert.equal(clubs.debutMonthFor({ season_started_at: null }, "2026-03-15"), null);
  await db.execute({ sql: "UPDATE group_members SET debuts_month = '2026-04' WHERE group_id = ? AND user_id = ?", args: [groupId, wal] });
  const res = await ledger.creditPoints(wal, "2026-03-20", "partido_dia", 70);
  assert.equal(res.credited.find((c) => c.groupId === groupId), undefined);
  const march = await ledger.clubTable(groupId, "mes", "2026-03-20");
  assert.ok(!march.some((r) => r.userId === wal), "no figura en la tabla de marzo");
  const april = await ledger.clubTable(groupId, "mes", "2026-04-02");
  assert.ok(april.some((r) => r.userId === wal), "figura desde abril");
});

test("tabla: vistas hoy, mes y general; los empates comparten puesto", async () => {
  const { groupId, userIds } = await startedClub("clasico", ["xavi", "yuri", "zoe"]);
  const [x, y, z] = userIds;
  await ledger.creditPoints(x, "2026-05-01", "partido_dia", 80);
  await ledger.creditPoints(x, "2026-05-02", "partido_dia", 20);
  await ledger.creditPoints(y, "2026-05-02", "partido_dia", 100);
  await ledger.creditPoints(z, "2026-06-01", "partido_dia", 100);
  const hoy = await ledger.clubTable(groupId, "hoy", "2026-05-02");
  assert.deepEqual(hoy.map((r) => [r.userId, r.points]), [[y, 100], [x, 20], [z, 0]]);
  const mes = await ledger.clubTable(groupId, "mes", "2026-05-15");
  assert.deepEqual(mes.map((r) => [r.userId, r.points, r.rank]), [[x, 100, 1], [y, 100, 1], [z, 0, 3]]);
  const general = await ledger.clubTable(groupId, "general", "2026-07-01");
  assert.equal(general.length, 3);
  assert.equal(general[0].points, 100);
});

test("racha: cuenta días seguidos y el protector perdona un día por semana", () => {
  const s = (...d) => new Set(d);
  assert.equal(streakFromDates(s("2026-10-24", "2026-10-25", "2026-10-26"), "2026-10-26").streak, 3);
  assert.equal(streakFromDates(s("2026-10-24", "2026-10-25"), "2026-10-26").streak, 2, "hoy sin jugar no corta");
  assert.equal(streakFromDates(s("2026-10-22", "2026-10-24", "2026-10-25"), "2026-10-26").streak, 3, "el protector cubre un día");
  assert.equal(streakFromDates(s("2026-10-20", "2026-10-22", "2026-10-25"), "2026-10-26").streak, 1, "dos días salteados en la semana cortan");
  assert.equal(streakFromDates(s(), "2026-10-26").streak, 0);
});

test("sobres guardados: máximo 3 sin club y se desbloquean al entrar a un club iniciado", async () => {
  process.env.FUTOTAL2 = "1";
  try {
    const { groupId, userIds } = await makeGroup(db, { name: "Sobres", members: ["nico", "olga"] });
    const nico = userIds[0];
    for (let i = 1; i <= 5; i++) await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, '2026-02-01', ?)", args: [nico, `normal${i}`] });
    await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, '2026-02-01', 'bienvenida')", args: [nico] });
    let st = await clubs.packStatus(nico);
    assert.equal(st.openable.length, 1, "solo el de bienvenida se abre sin club");
    assert.equal(st.locked.length, 3, "máximo 3 guardados");
    const { dropped } = await clubs.unlockPacksFor(nico, false);
    assert.equal(dropped, 2, "lo que superaba el máximo se descarta");
    await db.execute({ sql: "UPDATE groups_t SET season_started_at = '2026-02-01' WHERE id = ?", args: [groupId] });
    st = await clubs.packStatus(nico);
    assert.equal(st.locked.length, 0);
    assert.equal(st.openable.length, 4, "bienvenida + los 3 guardados");
  } finally {
    delete process.env.FUTOTAL2;
  }
});

test("sin la bandera FUTOTAL2 los sobres no se bloquean", async () => {
  const { userIds } = await makeGroup(db, { name: "SinBandera", members: ["pablo", "rita"] });
  await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, '2026-02-01', 'normal1')", args: [userIds[0]] });
  const st = await clubs.packStatus(userIds[0]);
  assert.equal(st.openable.length, 1);
  assert.equal(st.locked.length, 0);
});

test("código de recuperación: formato, cifrado de ida y vuelta y comparación tolerante", () => {
  const code = recovery.newRecoveryCode();
  assert.match(code, /^FUT-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const sealed = recovery.sealCode(code);
  assert.ok(!sealed.includes(code));
  assert.equal(recovery.openCode(sealed), code);
  assert.equal(recovery.openCode("basura"), null);
  assert.ok(recovery.codesMatch(code.toLowerCase().replace(/-/g, " "), code));
  assert.ok(!recovery.codesMatch("FUT-AAAA-AAAA-AAAA", code));
  assert.equal(monthOf("2026-10-26"), "2026-10");
});
