import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeGroup, useTempDatabase } from "./helpers.js";

const cleanup = useTempDatabase();

const season = await import("../utils/dt-season.js");

describe("niveles y tiers", () => {
  it("10 niveles por dentro y 3 tiers (3 / 4 / 3) a la vista", () => {
    assert.equal(season.levelFromRating(88), 1);
    assert.equal(season.levelFromRating(62), 10);
    const tiers = Array.from({ length: 10 }, (_, i) => season.tierFromLevel(i + 1));
    assert.deepEqual(tiers, [1, 1, 1, 2, 2, 2, 2, 3, 3, 3]);
  });

  it("los tiers viejos (1 / 2 / 3) siguen cayendo en su tier con el rating base", () => {
    for (const tier of [1, 2, 3]) {
      assert.equal(season.tierFromRating(season.baseRatingForTier(tier, "club-x")), tier);
    }
  });

  it("el presupuesto baja con el nivel", () => {
    assert.ok(season.initialBudget(1) > season.initialBudget(5));
    assert.ok(season.initialBudget(5) > season.initialBudget(10));
  });

  it("terminar mejor de lo esperado sube el presupuesto y peor lo baja", () => {
    assert.ok(season.budgetAfterSeason(50, 8, 8) > 50);
    assert.ok(season.budgetAfterSeason(50, 2, 15) < 50);
  });
});

describe("puntaje de los humanos", () => {
  it("ganar contra un club mejor vale más que contra uno peor", () => {
    const vsStronger = season.matchPoints(8, 2, "win");
    const vsWeaker = season.matchPoints(2, 8, "win");
    assert.ok(vsStronger > vsWeaker);
  });

  it("un grande que pierde contra un chico resta, un chico que pierde contra un grande no", () => {
    assert.ok(season.matchPoints(2, 8, "loss") < 0);
    assert.equal(season.matchPoints(8, 2, "loss"), 0);
  });

  it("ganar la liga con el Girona vale más que con el Barça (mismo puesto, distinto nivel)", () => {
    const girona = season.positionPoints(7, 1, 20);
    const barca = season.positionPoints(1, 1, 20);
    assert.ok(girona > barca);
  });

  it("la posición recién cuenta con varias jornadas jugadas", () => {
    assert.equal(season.positionPoints(7, 1, 2), 0);
  });

  it("las copas pagan más cuanto más lejos llegás y las europeas pesan más", () => {
    assert.ok(season.cupRoundPoints("copa", 3, "win", 5, 5) > season.cupRoundPoints("copa", 0, "win", 5, 5));
    assert.ok(season.cupRoundPoints("champions", 1, "win", 5, 5) > season.cupRoundPoints("copa", 1, "win", 5, 5));
  });

  it("clasificar a la Champions vale más en la Premier que en la Bundesliga", () => {
    assert.ok(season.qualificationPoints("premier", "champions", 4) > season.qualificationPoints("bundesliga", "champions", 4));
  });
});

describe("llaves de copa", () => {
  it("20 equipos: 12 pasan directo y 8 juegan la primera ronda (los mejores sembrados libres)", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const { pairs, byes } = season.firstRound(ids, (id) => 100 - Number(id.slice(1)));
    assert.equal(byes.length, 12);
    assert.equal(pairs.length, 4);
    assert.ok(byes.includes("t0") && byes.includes("t11"));
    assert.ok(!byes.includes("t12"));
  });

  it("16 equipos: sin libres", () => {
    const ids = Array.from({ length: 16 }, (_, i) => `t${i}`);
    assert.equal(season.firstRound(ids).byes.length, 0);
    assert.equal(season.firstRound(ids).pairs.length, 8);
  });

  it("nombres de rondas", () => {
    assert.equal(season.roundName(20, 4), "Final");
    assert.equal(season.roundName(20, 0), "Ronda de 32");
    assert.equal(season.roundName(32, 3), "Semifinal");
    assert.equal(season.roundName(16, 0), "Octavos de final");
  });
});

describe("mercados", () => {
  it("verano en las primeras 8 jornadas, invierno a mitad de temporada", () => {
    assert.equal(season.windowAt(0), "summer");
    assert.equal(season.windowAt(7), "summer");
    assert.equal(season.windowAt(12), null);
    assert.equal(season.windowAt(21), "winter");
  });
});

describe("temporada online (con base de datos)", async () => {
  const { db, initSchema } = await import("../db/client.js");
  await initSchema();
  const core = await import("../utils/dt-league-core.js");

  async function newLeague(humanTeams) {
    const { groupId, userIds } = await makeGroup(db, { members: humanTeams.map((_, i) => `dt${Math.random().toString(36).slice(2, 6)}${i}`) });
    const res = await db.execute({
      sql: "INSERT INTO dt_leagues (name, league_key, invite_code, created_by, group_id, weeks_per_month) VALUES ('Test', 'premier', ?, ?, ?, 4)",
      args: [`T${Math.random().toString(36).slice(2, 7).toUpperCase()}`, userIds[0], groupId],
    });
    const leagueId = Number(res.lastInsertRowid);
    for (let i = 0; i < userIds.length; i++) {
      await db.execute({ sql: "INSERT INTO dt_league_members (league_id, user_id, team_id) VALUES (?, ?, ?)", args: [leagueId, userIds[i], humanTeams[i]] });
    }
    const league = (await db.execute({ sql: "SELECT * FROM dt_leagues WHERE id = ?", args: [leagueId] })).rows[0];
    const members = async () => (await db.execute({
      sql: `SELECT m.id, m.user_id, m.team_id, m.joined_at, m.ready_month, m.ready_at, m.last_active_at, m.expelled_at, u.username
            FROM dt_league_members m JOIN users u ON u.id = m.user_id WHERE m.league_id = ?`,
      args: [leagueId],
    })).rows;
    const reload = async () => (await db.execute({ sql: "SELECT * FROM dt_leagues WHERE id = ?", args: [leagueId] })).rows[0];
    return { league, members, reload, userIds, leagueId };
  }

  it("arma la liga, las copas nacionales y los torneos europeos", async () => {
    const t = await newLeague(["arsenal", "chelsea"]);
    await core.startSeason(t.league, await t.members());
    const rows = (await db.execute({ sql: "SELECT comp, COUNT(*) AS c FROM dt_league_fixtures WHERE league_id = ? GROUP BY comp", args: [t.leagueId] })).rows;
    const by = Object.fromEntries(rows.map((r) => [r.comp, Number(r.c)]));
    assert.equal(by.liga, 380);
    assert.ok(by.fa_cup > 0, "FA Cup");
    assert.ok(by.league_cup > 0, "Copa de la Liga");
    assert.ok(by.champions > 0, "Champions");
    assert.ok(by.europa > 0, "Europa League");
  });

  it("el mes no pasa hasta que todos los humanos juegan y aprietan Listo", async () => {
    const t = await newLeague(["arsenal", "chelsea"]);
    await core.startSeason(t.league, await t.members());
    let league = await t.reload();
    let members = await t.members();

    // Cada humano juega TODOS sus partidos del mes 1.
    const mine = (await db.execute({
      sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND month = 1 AND played = 0 AND (home_team_id IN ('arsenal','chelsea') OR away_team_id IN ('arsenal','chelsea'))",
      args: [t.leagueId],
    })).rows;
    assert.ok(mine.length > 0);
    for (const fx of mine) await core.recordResult(league, fx, 2, 1, {});
    league = await core.resolveAuto(league, members);
    assert.equal(Number(league.current_month), 1, "sin Listo no pasa");

    // Solo uno aprieta Listo: sigue sin pasar.
    await db.execute({ sql: "UPDATE dt_league_members SET ready_month = 1, ready_at = datetime('now') WHERE league_id = ? AND user_id = ?", args: [t.leagueId, t.userIds[0]] });
    members = await t.members();
    league = await core.resolveAuto(await t.reload(), members);
    assert.equal(Number(league.current_month), 1);

    // El otro también: pasa al mes 2.
    await db.execute({ sql: "UPDATE dt_league_members SET ready_month = 1, ready_at = datetime('now') WHERE league_id = ? AND user_id = ?", args: [t.leagueId, t.userIds[1]] });
    members = await t.members();
    league = await core.resolveAuto(await t.reload(), members);
    assert.equal(Number(league.current_month), 2);
  });

  it("suma puntaje cuando se cierra la jornada completa", async () => {
    const t = await newLeague(["arsenal", "chelsea"]);
    await core.startSeason(t.league, await t.members());
    const league = await t.reload();
    const members = await t.members();
    const fx = (await db.execute({ sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND week = 1 AND comp = 'liga'", args: [t.leagueId] })).rows;
    // Se juegan todos menos uno: todavía no se puntúa la jornada.
    for (const f of fx.slice(1)) await core.recordResult(league, f, 1, 0, {});
    await core.settleWeeks(league, members);
    const none = (await db.execute({ sql: "SELECT COUNT(*) AS c FROM dt_league_weekly_scores WHERE league_id = ?", args: [t.leagueId] })).rows[0].c;
    assert.equal(Number(none), 0);
    await core.recordResult(league, fx[0], 1, 0, {});
    await core.settleWeeks(league, members);
    const scored = (await db.execute({ sql: "SELECT COUNT(*) AS c FROM dt_league_weekly_scores WHERE league_id = ?", args: [t.leagueId] })).rows[0].c;
    assert.ok(Number(scored) > 0, "ahora sí hay puntaje");
  });

  it("multas por día de atraso y expulsión al tercero: el club pasa a la CPU", async () => {
    const t = await newLeague(["arsenal", "chelsea"]);
    await core.startSeason(t.league, await t.members());
    const league = await t.reload();
    // Uno cierra el mes (todo jugado y Listo) y el otro no hace nada hace 4 días.
    const mine = (await db.execute({
      sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND month = 1 AND played = 0 AND (home_team_id = 'arsenal' OR away_team_id = 'arsenal')",
      args: [t.leagueId],
    })).rows;
    for (const fx of mine) {
      if (fx.home_team_id === "chelsea" || fx.away_team_id === "chelsea") continue;
      await core.recordResult(league, fx, 1, 0, {});
    }
    // El cruce entre ambos también hay que jugarlo para que arsenal quede "done".
    const between = (await db.execute({ sql: "SELECT * FROM dt_league_fixtures WHERE league_id = ? AND month = 1 AND played = 0 AND comp = 'liga' AND ((home_team_id='arsenal' AND away_team_id='chelsea') OR (home_team_id='chelsea' AND away_team_id='arsenal'))", args: [t.leagueId] })).rows;
    for (const fx of between) await core.recordResult(league, fx, 1, 1, {});
    const old = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 19).replace("T", " ");
    await db.execute({ sql: "UPDATE dt_league_members SET ready_month = 1, ready_at = ?, last_active_at = ? WHERE league_id = ? AND user_id = ?", args: [old, old, t.leagueId, t.userIds[0]] });
    await db.execute({ sql: "UPDATE dt_league_members SET last_active_at = ? WHERE league_id = ? AND user_id = ?", args: [old, t.leagueId, t.userIds[1]] });
    await db.execute({ sql: "UPDATE dt_leagues SET month_started_at = ? WHERE id = ?", args: [old, t.leagueId] });

    // chelsea todavía tenía partidos del mes pendientes (liga y copas): atrasado 4 días, expulsado.
    const members = await t.members();
    const { expelled } = await core.applyOverdue(await t.reload(), members);
    assert.deepEqual(expelled, [t.userIds[1]]);
    const fines = (await db.execute({ sql: "SELECT COUNT(*) AS c, SUM(amount) AS s FROM dt_league_fines WHERE league_id = ? AND user_id = ?", args: [t.leagueId, t.userIds[1]] })).rows[0];
    assert.equal(Number(fines.c), 3);
    assert.equal(Number(fines.s), 15);
    const after = (await t.members()).find((m) => m.user_id === t.userIds[1]);
    assert.equal(after.team_id, null);
    assert.ok(after.expelled_at);
  });

  it("las ofertas de clubes CPU por jugadores propios llegan en los mercados", async () => {
    const t = await newLeague(["arsenal", "chelsea"]);
    const squad = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `Jugador ${i}`, ovr: 78 + (i % 6), value: 30 + i }));
    for (const uid of t.userIds) {
      await db.execute({ sql: "INSERT INTO dt_league_squads (league_id, user_id, team_id, state, power) VALUES (?, ?, 'arsenal', ?, 80)", args: [t.leagueId, uid, JSON.stringify({ squad })] });
    }
    let total = 0;
    // El mercado corre una vez por ventana: la primera vez sí, la segunda no.
    const first = await core.runCpuMarket(t.league, await t.members(), "summer");
    total += first.offers;
    const second = await core.runCpuMarket(t.league, await t.members(), "summer");
    assert.equal(second.offers, 0);
    assert.ok(first.deals > 0, "los CPU se fichan entre ellos");
  });

  it("al cerrar la temporada queda el historial", async () => {
    const t = await newLeague(["arsenal", "chelsea"]);
    await core.startSeason(t.league, await t.members());
    const league = await t.reload();
    await core.finishSeason(league, await t.members());
    const hist = (await db.execute({ sql: "SELECT * FROM dt_league_history WHERE league_id = ?", args: [t.leagueId] })).rows;
    assert.equal(hist.length, 2);
    assert.equal((await t.reload()).status, "finished");
  });
});

cleanup();
