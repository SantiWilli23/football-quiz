import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { teams, teamById, teamsByLeague } from "../data/teams.js";
import { players as allPlayers, playersByTeam } from "../data/players.js";
import { loadCareer, saveCareer, clearCareer } from "../hooks/useCareerSave.js";
import { simulateUserMatch, simulateQuickMatch } from "../engine/matchEngine.js";
import { ageSquad, releaseExpired, generateYouthProspects } from "../engine/playerGrowth.js";
import { transferBudgetFor, weeklyWageBill, seasonIncome } from "../engine/financeEngine.js";
import { generateMarketRumors } from "../engine/transferAI.js";
import { effectiveOvr } from "../engine/positions.js";
import { scoutPlayer, mergeReports } from "../engine/scouting.js";
import { clubDecision, playerDecision } from "../engine/transferMarket.js";

const CareerContext = createContext(null);

const DEFAULT_SLIDERS = { pressing: 50, defLine: 50, tempo: 50, width: 50, offDepth: 50, duels: 50, buildUp: 50, transition: 50 };
const FORMATIONS = {
  "4-3-3": ["GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CM", "RW", "ST", "LW"],
  "4-2-3-1": ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "CAM", "RW", "ST", "LW"],
  "4-4-2": ["GK", "RB", "CB", "CB", "LB", "RW", "CM", "CM", "LW", "ST", "ST"],
  "4-4-2 Diamante": ["GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CM", "CAM", "ST", "ST"],
  "4-1-4-1": ["GK", "RB", "CB", "CB", "LB", "CDM", "RW", "CM", "CM", "LW", "ST"],
  "4-5-1": ["GK", "RB", "CB", "CB", "LB", "RW", "CM", "CM", "CM", "LW", "ST"],
  "4-3-2-1": ["GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CM", "CAM", "CAM", "ST"],
  "4-2-2-2": ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "CAM", "CAM", "ST", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "RB", "CDM", "CM", "CM", "LB", "ST", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "RB", "CM", "CM", "LB", "RW", "ST", "LW"],
  "3-4-2-1": ["GK", "CB", "CB", "CB", "RB", "CM", "CM", "LB", "CAM", "CAM", "ST"],
  "5-3-2": ["GK", "RB", "CB", "CB", "CB", "LB", "CM", "CM", "CM", "ST", "ST"],
  "5-4-1": ["GK", "RB", "CB", "CB", "CB", "LB", "RW", "CM", "CM", "LW", "ST"],
  "5-2-3": ["GK", "RB", "CB", "CB", "CB", "LB", "CM", "CM", "RW", "ST", "LW"],
};

function roundRobinCalendar(leagueTeamIds, myTeamId) {
  // Genera las 38 jornadas (ida y vuelta) del calendario de liga.
  const ids = leagueTeamIds.slice();
  if (ids.length % 2 !== 0) ids.push(null);
  const n = ids.length;
  const half = n / 2;
  const rounds = [];
  let arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== null && b !== null) round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }
  const second = rounds.map((round) => round.map(([a, b]) => [b, a]));
  const allRounds = [...rounds, ...second];

  const calendar = [];
  allRounds.forEach((round, week) => {
    const my = round.find(([a, b]) => a === myTeamId || b === myTeamId);
    if (my) {
      const [a, b] = my;
      const opponent = a === myTeamId ? b : a;
      calendar.push({ week: week + 1, opponentTeamId: opponent, home: a === myTeamId, played: false, result: null });
    }
    // resto de la jornada (partidos sin el usuario) se guarda para simulación estadística
  });
  return { calendar, allRounds };
}

function initialStandings(leagueTeamIds) {
  return leagueTeamIds.map((id) => ({ teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }));
}

function applyResult(standings, teamId, gf, ga) {
  const row = standings.find((s) => s.teamId === teamId);
  if (!row) return;
  row.played += 1;
  row.gf += gf;
  row.ga += ga;
  if (gf > ga) { row.won += 1; row.pts += 3; }
  else if (gf === ga) { row.drawn += 1; row.pts += 1; }
  else { row.lost += 1; }
}

function sortStandings(standings) {
  return [...standings].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

// El lineup titular ahora es un arreglo de slots en el orden exacto de la
// formación ({ slot: "ST", playerId }), no una lista suelta de ids: así
// sabemos en qué posición juega cada uno y se puede penalizar si no es la suya.
function defaultLineup(squad, formation) {
  const slots = FORMATIONS[formation] || FORMATIONS["4-3-3"];
  const used = new Set();
  const starters = slots.map((pos) => {
    const candidate =
      squad.filter((p) => !used.has(p.id) && p.position === pos).sort((a, b) => b.ovr - a.ovr)[0] ||
      squad.filter((p) => !used.has(p.id)).sort((a, b) => effectiveOvr(b, pos) - effectiveOvr(a, pos))[0];
    if (candidate) used.add(candidate.id);
    return { slot: pos, playerId: candidate ? candidate.id : null };
  });
  const bench = squad.filter((p) => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 9).map((p) => p.id);
  bench.forEach((id) => used.add(id));
  const reserves = squad.filter((p) => !used.has(p.id)).map((p) => p.id);
  return { starters, bench, reserves };
}

// Al cambiar de formación tratamos de mantener a los jugadores en su misma
// posición natural si el nuevo esquema la tiene, y sólo recurrimos a la
// banca/reservas para los slots que quedaron sin dueño.
function remapLineupToFormation(squad, lineup, formation) {
  const slots = FORMATIONS[formation] || FORMATIONS["4-3-3"];
  const prevIds = lineup.starters.map((s) => s.playerId).filter(Boolean);
  const pool = squad.filter((p) => prevIds.includes(p.id));
  const used = new Set();
  const starters = slots.map((pos) => {
    const exact = pool.find((p) => !used.has(p.id) && p.position === pos);
    const candidate = exact || pool.find((p) => !used.has(p.id));
    if (candidate) used.add(candidate.id);
    return { slot: pos, playerId: candidate ? candidate.id : null };
  });
  const leftover = squad.filter((p) => !used.has(p.id) && (lineup.bench.includes(p.id) || lineup.reserves.includes(p.id) || prevIds.includes(p.id)));
  // Slots vacíos: se completan con el mejor disponible del resto del plantel.
  starters.forEach((s) => {
    if (s.playerId) return;
    const rest = squad.filter((p) => !used.has(p.id));
    const best = rest.filter((p) => p.position === s.slot).sort((a, b) => b.ovr - a.ovr)[0]
      || rest.sort((a, b) => effectiveOvr(b, s.slot) - effectiveOvr(a, s.slot))[0];
    if (best) { s.playerId = best.id; used.add(best.id); }
  });
  const bench = squad.filter((p) => !used.has(p.id) && (lineup.bench.includes(p.id) || leftover.includes(p)))
    .sort((a, b) => b.ovr - a.ovr).slice(0, 9).map((p) => p.id);
  bench.forEach((id) => used.add(id));
  const reserves = squad.filter((p) => !used.has(p.id)).map((p) => p.id);
  return { starters, bench, reserves };
}

function buildInitialState(teamId) {
  const team = teamById(teamId);
  const squad = playersByTeam(teamId).map((p) => ({ ...p }));
  const leagueTeamIds = teamsByLeague(team.league).map((t) => t.id);
  const { calendar } = roundRobinCalendar(leagueTeamIds, teamId);
  return {
    version: 1,
    teamId,
    season: 1,
    week: 0,
    squad,
    lineup: defaultLineup(squad, "4-3-3"),
    formation: "4-3-3",
    mentality: 3,
    sliders: { ...DEFAULT_SLIDERS },
    budget: transferBudgetFor(team, null),
    money: 0,
    boardConfidence: 60,
    calendar,
    standings: initialStandings(leagueTeamIds),
    news: [`Bienvenido al banquillo de ${team.name}.`],
    history: [],
    lastMatch: null,
    gameOver: false,
    scoutReports: {},
    scoutsAvailable: {},
    acquired: [],
  };
}

export function CareerProvider({ children }) {
  const [state, setState] = useState(() => loadCareer());

  useEffect(() => {
    if (state) saveCareer(state);
  }, [state]);

  const team = state ? teamById(state.teamId) : null;
  const leagueTeams = team ? teamsByLeague(team.league) : [];

  function selectTeam(teamId) {
    setState(buildInitialState(teamId));
  }

  function resetCareer() {
    clearCareer();
    setState(null);
  }

  function setFormation(formation) {
    setState((s) => ({ ...s, formation, lineup: remapLineupToFormation(s.squad, s.lineup, formation) }));
  }
  function setMentality(mentality) {
    setState((s) => ({ ...s, mentality }));
  }
  function setSlider(key, value) {
    setState((s) => ({ ...s, sliders: { ...s.sliders, [key]: value } }));
  }
  function setLineup(lineup) {
    setState((s) => ({ ...s, lineup }));
  }

  // Guarda una posición libre (x/y en % de la cancha) para un slot puntual,
  // así el usuario puede arrastrar a un jugador fuera de su ubicación
  // "de manual" y armar una formación a medida a partir de una preestablecida.
  function setSlotPosition(slotIndex, x, y) {
    setState((s) => ({
      ...s,
      lineup: {
        ...s.lineup,
        starters: s.lineup.starters.map((slot, i) => (i === slotIndex ? { ...slot, x, y } : slot)),
      },
    }));
  }

  // Vuelve a la disposición automática de la formación elegida, tirando
  // cualquier posición libre que se haya movido a mano.
  function resetLineupPositions() {
    setState((s) => ({
      ...s,
      lineup: { ...s.lineup, starters: s.lineup.starters.map((slot) => ({ slot: slot.slot, playerId: slot.playerId })) },
    }));
  }

  // Asigna/retira un jugador de un slot puntual de la formación (usado por
  // el editor de cancha). Si ese jugador ya estaba en otro slot, banca o
  // reservas, lo saca de ahí primero.
  function assignSlot(slotIndex, playerId) {
    setState((s) => {
      const starters = s.lineup.starters.map((slot, i) => {
        if (i === slotIndex) return { ...slot, playerId };
        if (playerId && slot.playerId === playerId) return { ...slot, playerId: null };
        return slot;
      });
      const bench = s.lineup.bench.filter((id) => id !== playerId);
      const reserves = s.lineup.reserves.filter((id) => id !== playerId);
      // El que salió del slot (si había alguien) vuelve a reservas.
      const displaced = s.lineup.starters[slotIndex]?.playerId;
      const reserves2 = displaced && displaced !== playerId && !bench.includes(displaced) ? [...reserves, displaced] : reserves;
      return { ...s, lineup: { starters, bench, reserves: reserves2 } };
    });
  }

  function moveToBench(playerId) {
    setState((s) => {
      if (s.lineup.bench.includes(playerId) || s.lineup.bench.length >= 9) return s;
      const starters = s.lineup.starters.map((slot) => (slot.playerId === playerId ? { ...slot, playerId: null } : slot));
      const reserves = s.lineup.reserves.filter((id) => id !== playerId);
      return { ...s, lineup: { starters, bench: [...s.lineup.bench, playerId], reserves } };
    });
  }

  function moveToReserves(playerId) {
    setState((s) => {
      const starters = s.lineup.starters.map((slot) => (slot.playerId === playerId ? { ...slot, playerId: null } : slot));
      const bench = s.lineup.bench.filter((id) => id !== playerId);
      const reserves = s.lineup.reserves.includes(playerId) ? s.lineup.reserves : [...s.lineup.reserves, playerId];
      return { ...s, lineup: { starters, bench, reserves } };
    });
  }

  // Fichajes: primero se le oferta al club por el pase; si acepta, recién
  // ahí se le ofrece contrato al jugador. Ninguna de las dos ofertas mueve
  // plata todavía — sólo completeTransfer() lo hace, al final.
  function offerForPlayer(player, offerAmount) {
    const sellerTeam = teamById(player.teamId);
    return { ...clubDecision(player, sellerTeam, offerAmount), player, sellerTeam, offerAmount };
  }

  function offerContractTo(player, wageOffered, years) {
    const sellerTeam = teamById(player.teamId);
    return { ...playerDecision(player, sellerTeam, team, wageOffered, years), player, wageOffered, years };
  }

  function completeTransfer(player, feeAgreed, wageAgreed, yearsAgreed) {
    setState((s) => {
      if (s.budget < feeAgreed) return s;
      const signed = {
        ...player,
        teamId: s.teamId,
        wage: wageAgreed,
        contractYears: yearsAgreed,
        isYouth: false,
        transferListed: false,
        loanListed: false,
        releaseClause: null,
      };
      const squad = [...s.squad, signed];
      const reserves = [...s.lineup.reserves, signed.id];
      return {
        ...s,
        squad,
        lineup: { ...s.lineup, reserves },
        budget: Math.round((s.budget - feeAgreed) * 20) / 20,
        acquired: [...(s.acquired || []), player.id],
        news: [`✍️ Fichaste a ${player.name} por €${feeAgreed}M.`, ...s.news].slice(0, 8),
      };
    });
  }

  // Manda a uno de los 6 reclutadores a ver a un jugador (propio o de
  // cualquier otro club). El reporte da un RANGO de OVR y potencial, no el
  // número exacto — varios reportes del mismo jugador angostan el rango.
  function sendScout(scoutId, playerId) {
    const player = allPlayers.find((p) => p.id === playerId) || state.squad.find((p) => p.id === playerId);
    if (!player) return null;
    const targetTeam = teamById(player.teamId);
    const report = scoutPlayer(scoutId, player, targetTeam?.league);
    setState((s) => ({
      ...s,
      scoutReports: { ...s.scoutReports, [playerId]: mergeReports(s.scoutReports[playerId], report) },
      news: [`🔎 ${report.scoutName} entregó su informe sobre ${player.name}.`, ...s.news].slice(0, 8),
    }));
    return report;
  }

  function currentFixture() {
    if (!state) return null;
    return state.calendar.find((c) => !c.played) || null;
  }

  function playNextMatch() {
    const fixture = currentFixture();
    if (!fixture || !team) return null;
    const rival = teamById(fixture.opponentTeamId);
    const rivalSquad = playersByTeam(rival.id).filter((p) => !(state.acquired || []).includes(p.id));
    const rivalOvr = rivalSquad.length ? rivalSquad.reduce((s, p) => s + p.ovr, 0) / rivalSquad.length : rival.tier === 1 ? 82 : rival.tier === 2 ? 76 : 70;

    const result = simulateUserMatch({
      myPlayers: state.squad,
      myLineup: state.lineup.starters,
      myMentality: state.mentality,
      mySliders: state.sliders,
      myFormScore: 65,
      rivalOvr,
      rivalFormScore: 60,
      isHome: fixture.home,
    });

    setState((s) => {
      const standings = [...s.standings.map((r) => ({ ...r }))];
      applyResult(standings, s.teamId, result.myGoals, result.rivalGoals);
      applyResult(standings, rival.id, result.rivalGoals, result.myGoals);

      // Simula el resto de la jornada estadísticamente.
      leagueTeams.forEach((t) => {
        if (t.id === s.teamId || t.id === rival.id) return;
      });
      simulateRestOfWeek(standings, leagueTeams, s.teamId, rival.id);

      const calendar = s.calendar.map((c) => (c.week === fixture.week ? { ...c, played: true, result: { myGoals: result.myGoals, rivalGoals: result.rivalGoals } } : c));
      const news = [
        result.myGoals > result.rivalGoals
          ? `Victoria ${result.myGoals}-${result.rivalGoals} vs ${rival.name}.`
          : result.myGoals < result.rivalGoals
          ? `Derrota ${result.myGoals}-${result.rivalGoals} vs ${rival.name}.`
          : `Empate ${result.myGoals}-${result.rivalGoals} vs ${rival.name}.`,
        ...generateMarketRumors(teams, allPlayers, 1),
        ...s.news,
      ].slice(0, 8);

      const allPlayed = calendar.every((c) => c.played);
      let next = { ...s, standings, calendar, lastMatch: { ...result, rival }, news, week: s.week + 1 };
      if (allPlayed) next = finishSeason(next);
      return next;
    });
    return result;
  }

  function finishSeason(s) {
    const sorted = sortStandings(s.standings);
    const position = sorted.findIndex((r) => r.teamId === s.teamId) + 1;
    const objectiveMet = evaluateObjective(team.boardObjective, position);
    const confDelta = objectiveMet ? 20 : -25;
    const boardConfidence = Math.max(0, Math.min(100, s.boardConfidence + confDelta));
    const gameOver = boardConfidence <= 0;

    let squad = releaseExpired(ageSquad(s.squad));
    squad = squad.concat(generateYouthProspects(team, 3));

    const income = seasonIncome(team, position);
    const budget = transferBudgetFor(team, position) + Math.round(income.total * 0.3);

    const leagueTeamIds = leagueTeams.map((t) => t.id);
    const { calendar } = roundRobinCalendar(leagueTeamIds, s.teamId);

    return {
      ...s,
      season: s.season + 1,
      week: 0,
      squad,
      lineup: defaultLineup(squad, s.formation),
      budget,
      boardConfidence,
      calendar,
      standings: initialStandings(leagueTeamIds),
      history: [...s.history, { season: s.season, position, points: sorted.find((r) => r.teamId === s.teamId)?.pts || 0, objectiveMet }],
      news: [
        objectiveMet ? `¡Objetivo cumplido! Terminaste ${position}° — la directiva confía en el proyecto.` : `No se cumplió el objetivo (terminaste ${position}°). La directiva está molesta.`,
        `Nueva temporada: llegan ${3} promesas de la cantera.`,
        ...s.news,
      ].slice(0, 8),
      gameOver,
    };
  }

  const value = useMemo(
    () => ({
      state,
      team,
      leagueTeams,
      formations: Object.keys(FORMATIONS),
      formationSlots: FORMATIONS,
      allTeams: teams,
      selectTeam,
      resetCareer,
      setFormation,
      setMentality,
      setSlider,
      setLineup,
      assignSlot,
      setSlotPosition,
      resetLineupPositions,
      moveToBench,
      moveToReserves,
      sendScout,
      offerForPlayer,
      offerContractTo,
      completeTransfer,
      currentFixture,
      playNextMatch,
      standingsSorted: state ? sortStandings(state.standings) : [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  return <CareerContext.Provider value={value}>{children}</CareerContext.Provider>;
}

function evaluateObjective(objective, position) {
  const thresholds = { ganar_liga: 1, top3: 3, top4: 4, top6: 6, top8: 8, top10: 10, top12: 12, salvarse: 17 };
  return position <= (thresholds[objective] || 17);
}

function simulateRestOfWeek(standings, leagueTeams, myId, rivalId) {
  // Empareja al resto de equipos de la liga (sin el usuario ni su rival) de a pares y simula el resultado.
  const others = leagueTeams.filter((t) => t.id !== myId && t.id !== rivalId);
  for (let i = 0; i < others.length - 1; i += 2) {
    const a = others[i], b = others[i + 1];
    if (!a || !b) continue;
    const { golesA, golesB } = simulateQuickMatch(tierToOvr(a.tier), tierToOvr(b.tier));
    applyResult(standings, a.id, golesA, golesB);
    applyResult(standings, b.id, golesB, golesA);
  }
}

function tierToOvr(tier) {
  return tier === 1 ? 84 : tier === 2 ? 77 : 70;
}

export function useCareer() {
  const ctx = useContext(CareerContext);
  if (!ctx) throw new Error("useCareer debe usarse dentro de CareerProvider");
  return ctx;
}
