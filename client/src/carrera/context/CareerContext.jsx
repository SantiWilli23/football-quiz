import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { teams, teamById, teamsByLeague } from "../data/teams.js";
import { players as allPlayers, playersByTeam } from "../data/players.js";
import { loadCareer, saveCareer, clearCareer } from "../hooks/useCareerSave.js";
import { simulateUserMatch, simulateQuickMatch, simulateHalf, combineHalves, dayFormFactor } from "../engine/matchEngine.js";
import { ageSquad, releaseExpired, generateYouthProspects, applyPositionTrainings } from "../engine/playerGrowth.js";
import { assignInitialNumbers, nextAvailableNumber } from "../engine/squadNumbers.js";
import { getPressQuestion } from "../engine/pressEngine.js";
import { transferBudgetFor, weeklyWageBill, seasonIncome } from "../engine/financeEngine.js";
import { generateMarketRumors, generateIncomingOffers } from "../engine/transferAI.js";
import { effectiveOvr, TRAINING_WEEKS } from "../engine/positions.js";
import { scoutPlayer, mergeReports, MONTHLY_SCOUT_ID, shouldRunMonthlyScout, pickMonthlyDiscoveries } from "../engine/scouting.js";
import { clubDecision, playerDecision } from "../engine/transferMarket.js";
import { rollMatchInjuries, recoverInjuries, forceInjury } from "../engine/injuryEngine.js";
import { rollEvent } from "../engine/eventEngine.js";

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

const COPA_ROUNDS = ["Dieciseisavos", "Cuartos de final", "Semifinal", "Final"];
const COPA_WEEKS = [6, 14, 22, 30];
const COPA_PRIZES = [0.5, 1, 2, 5];

const RIVALRY_PAIRS = [
  ["mancity", "manutd"],
  ["liverpool", "everton"],
  ["arsenal", "tottenham"],
  ["chelsea", "tottenham"],
  ["realmadrid", "barcelona"],
  ["realmadrid", "atletico"],
  ["atletico", "barcelona"],
  ["athletic", "realsociedad"],
  ["sevilla", "realbetis"],
  ["barcelona", "espanyol"],
];

function isDerby(teamId, opponentId) {
  return RIVALRY_PAIRS.some(([a, b]) => (a === teamId && b === opponentId) || (a === opponentId && b === teamId));
}

function generatePreseason(myTeamId) {
  const others = teams.filter((t) => t.id !== myTeamId).sort(() => Math.random() - 0.5);
  const opponents = others.slice(0, 3).map((t) => ({ id: t.id, name: t.name, tier: t.tier || 2 }));
  return { opponents, matchesPlayed: 0, total: opponents.length, done: opponents.length === 0 };
}

const CONTINENTAL_ROUNDS = ["Fase de grupos", "Cuartos de final", "Semifinal", "Final"];
const CONTINENTAL_WEEKS = [10, 18, 26, 34];
const CONTINENTAL_PRIZES = { champions: [2, 4, 8, 15], europa: [1, 2, 4, 8] };
const CONTINENTAL_LABELS = { champions: "Champions League", europa: "Europa League" };

// Clasificación a copas europeas: 1ra temporada por jerarquía del club, después por posición final.
function determineContinentalCompetition(tier, position) {
  if (position != null) {
    if (position <= 4) return "champions";
    if (position <= 6) return "europa";
    return null;
  }
  if (tier === 1) return "champions";
  if (tier === 2) return Math.random() < 0.4 ? "europa" : null;
  return null;
}

function generateContinental(competition, myTeamId) {
  if (!competition) return null;
  const pool = teams.filter((t) => t.id !== myTeamId && (t.tier === 1 || t.tier === 2));
  const others = [...pool].sort(() => Math.random() - 0.5);
  const opponents = others.slice(0, 4).map((t) => ({ id: t.id, name: t.name, tier: t.tier || 2 }));
  return { competition, opponents, currentRound: 0, eliminated: false, champion: false, results: [] };
}

// Cansancio: los titulares pierden físico, el resto del plantel recupera cada semana.
function applyMatchFatigue(fatigue, squad, playedIds, trainingFocus) {
  const updated = { ...(fatigue || {}) };
  const playedSet = new Set(playedIds);
  const recoveryBonus = trainingFocus === "fitness" ? 5 : 0;
  squad.forEach((p) => {
    const cur = updated[p.id] ?? 100;
    const delta = playedSet.has(p.id) ? -22 : 15 + recoveryBonus;
    updated[p.id] = Math.max(0, Math.min(100, cur + delta));
  });
  return updated;
}

function roundRobinCalendar(leagueTeamIds, myTeamId) {
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
  });
  return { calendar, allRounds };
}

function initialStandings(leagueTeamIds) {
  return leagueTeamIds.map((id) => ({ teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }));
}

function applyResult(standings, teamId, gf, ga) {
  const row = standings.find((s) => s.teamId === teamId);
  if (!row) return;
  row.played += 1; row.gf += gf; row.ga += ga;
  if (gf > ga) { row.won += 1; row.pts += 3; }
  else if (gf === ga) { row.drawn += 1; row.pts += 1; }
  else { row.lost += 1; }
}

function sortStandings(standings) {
  return [...standings].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

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
  starters.forEach((s) => {
    if (s.playerId) return;
    const rest = squad.filter((p) => !used.has(p.id));
    const best = rest.filter((p) => p.position === s.slot).sort((a, b) => b.ovr - a.ovr)[0]
      || rest.sort((a, b) => effectiveOvr(b, s.slot) - effectiveOvr(a, s.slot))[0];
    if (best) { s.playerId = best.id; used.add(best.id); }
  });
  const bench = squad.filter((p) => !used.has(p.id) && (lineup.bench.includes(p.id) || prevIds.includes(p.id)))
    .sort((a, b) => b.ovr - a.ovr).slice(0, 9).map((p) => p.id);
  bench.forEach((id) => used.add(id));
  const reserves = squad.filter((p) => !used.has(p.id)).map((p) => p.id);
  return { starters, bench, reserves };
}

function runMonthlyDiscovery(scoutReports, week) {
  const players = pickMonthlyDiscoveries(allPlayers);
  const updatedReports = { ...scoutReports };
  const entries = [];
  players.forEach((p, i) => {
    const sellerTeam = teamById(p.teamId);
    const report = scoutPlayer(MONTHLY_SCOUT_ID, p, sellerTeam?.league);
    if (!report) return;
    updatedReports[p.id] = mergeReports(scoutReports[p.id], report);
    entries.push({ playerId: p.id, name: p.name, teamId: p.teamId, potentialEstimate: report.potentialEstimate, isGem: i === 0 });
  });
  const gem = entries.find((e) => e.isGem);
  const newsLine = entries.length
    ? `🔭 Informe mensual de Iker Salgado: ${entries.map((e) => e.name).join(", ")}${gem ? ` (la joya: ${gem.name}, ~${gem.potentialEstimate})` : ""}.`
    : null;
  return { scoutReports: updatedReports, entry: { week, entries }, newsLine };
}

function generateCopa(leagueTeams, myTeamId) {
  const others = [...leagueTeams.filter(t => t.id !== myTeamId)].sort(() => Math.random() - 0.5);
  const opponents = others.slice(0, 4).map(t => ({ id: t.id, name: t.name, tier: t.tier || 2 }));
  return { opponents, currentRound: 0, eliminated: false, champion: false, results: [] };
}

function generateReleaseClauses() {
  const clauses = {};
  allPlayers.forEach(p => {
    if (Math.random() < 0.22) {
      clauses[p.id] = Math.round(p.value * (1.6 + Math.random() * 0.5) * 20) / 20;
    }
  });
  return clauses;
}

function applyMatchMorale(morale, squad, lineup, isWin, isLoss) {
  const updated = { ...morale };
  const starterSet = new Set(lineup.starters.map(s => s.playerId).filter(Boolean));
  const benchSet = new Set(lineup.bench);
  squad.forEach(p => {
    const cur = updated[p.id] ?? 70;
    let delta = 0;
    if (starterSet.has(p.id))      delta = isWin ? 5 : isLoss ? -8 : 1;
    else if (benchSet.has(p.id))   delta = isWin ? 2 : isLoss ? -4 : 0;
    else                            delta = isLoss ? -2 : -1;
    updated[p.id] = Math.max(0, Math.min(100, cur + delta));
  });
  return updated;
}

function mergePlayerStats(current, starterIds, matchStats) {
  const updated = { ...current };
  starterIds.forEach(id => {
    if (!updated[id]) updated[id] = { goals: 0, assists: 0, yellowCards: 0, appearances: 0 };
    updated[id] = { ...updated[id], appearances: updated[id].appearances + 1 };
  });
  Object.entries(matchStats || {}).forEach(([id, ms]) => {
    if (!updated[id]) updated[id] = { goals: 0, assists: 0, yellowCards: 0, appearances: 0 };
    updated[id] = {
      ...updated[id],
      goals: updated[id].goals + (ms.goals || 0),
      assists: updated[id].assists + (ms.assists || 0),
      yellowCards: updated[id].yellowCards + (ms.yellowCards || 0),
    };
  });
  return updated;
}

function buildInitialState(teamId) {
  const team = teamById(teamId);
  const squad = assignInitialNumbers(playersByTeam(teamId).map((p) => ({ ...p })));
  const leagueTeamIds = teamsByLeague(team.league).map((t) => t.id);
  const leagueTeams = teamsByLeague(team.league);
  const { calendar } = roundRobinCalendar(leagueTeamIds, teamId);
  const initialDiscovery = runMonthlyDiscovery({}, 0);

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
    news: [initialDiscovery.newsLine, `Bienvenido al banquillo de ${team.name}.`].filter(Boolean),
    history: [],
    lastMatch: null,
    gameOver: false,
    scoutReports: initialDiscovery.scoutReports,
    scoutsAvailable: {},
    acquired: [],
    offerCooldowns: {},
    monthlyReports: [initialDiscovery.entry],
    lastMonthlyScoutWeek: 0,
    watchlist: [],
    sentOffers: [],
    incomingOffers: [],
    // nuevos campos
    injuries: [],
    playerStats: {},
    morale: {},
    managerPrestige: 50,
    trainingFocus: "balanced",
    releaseClauses: generateReleaseClauses(),
    copa: generateCopa(leagueTeams, teamId),
    clubReputation: 50,
    jobOffers: [],
    pendingMatch: null,
    lastMeetingWeek: -1,
    fatigue: {},
    continental: generateContinental(determineContinentalCompetition(team.tier, null), teamId),
    captainId: [...squad].sort((a, b) => b.ovr - a.ovr)[0]?.id || null,
    playerInstructions: {},
    preseason: generatePreseason(teamId),
    scoutCooldowns: {},
  };
}

export function CareerProvider({ children }) {
  const [state, setState] = useState(() => loadCareer());

  useEffect(() => {
    if (state) saveCareer(state);
  }, [state]);

  const team = state ? teamById(state.teamId) : null;
  const leagueTeams = team ? teamsByLeague(team.league) : [];

  function selectTeam(teamId) { setState(buildInitialState(teamId)); }
  function resetCareer() { clearCareer(); setState(null); }

  function setFormation(formation) {
    setState((s) => ({ ...s, formation, lineup: remapLineupToFormation(s.squad, s.lineup, formation) }));
  }
  function setMentality(mentality) { setState((s) => ({ ...s, mentality })); }
  function setSlider(key, value) { setState((s) => ({ ...s, sliders: { ...s.sliders, [key]: value } })); }
  function setLineup(lineup) { setState((s) => ({ ...s, lineup })); }
  function setTrainingFocus(focus) { setState((s) => ({ ...s, trainingFocus: focus })); }

  function applyTacticsPreset(preset) {
    setState((s) => ({
      ...s,
      formation: preset.formation,
      mentality: preset.mentality,
      sliders: { ...s.sliders, ...preset.sliders },
      lineup: remapLineupToFormation(s.squad, s.lineup, preset.formation),
    }));
  }

  function setSlotPosition(slotIndex, x, y, newPos) {
    setState((s) => ({
      ...s,
      lineup: {
        ...s.lineup,
        starters: s.lineup.starters.map((slot, i) =>
          i === slotIndex ? { ...slot, x, y, ...(newPos ? { slot: newPos } : {}) } : slot
        ),
      },
    }));
  }

  function resetLineupPositions() {
    setState((s) => {
      const preset = FORMATIONS[s.formation] || FORMATIONS["4-3-3"];
      return {
        ...s,
        lineup: { ...s.lineup, starters: s.lineup.starters.map((slot, i) => ({ slot: preset[i] || slot.slot, playerId: slot.playerId })) },
      };
    });
  }

  function assignSlot(slotIndex, playerId) {
    setState((s) => {
      const starters = s.lineup.starters.slice();
      const bench = s.lineup.bench.slice();
      const reserves = s.lineup.reserves.slice();
      const occupant = starters[slotIndex]?.playerId ?? null;

      if (playerId == null) {
        starters[slotIndex] = { ...starters[slotIndex], playerId: null };
        if (occupant) reserves.push(occupant);
        return { ...s, lineup: { starters, bench, reserves } };
      }

      const sourceStarterIndex = starters.findIndex((slot, i) => i !== slotIndex && slot.playerId === playerId);
      const benchIndex = bench.indexOf(playerId);
      const reserveIndex = reserves.indexOf(playerId);

      starters[slotIndex] = { ...starters[slotIndex], playerId };

      if (sourceStarterIndex !== -1) {
        starters[sourceStarterIndex] = { ...starters[sourceStarterIndex], playerId: occupant };
      } else if (benchIndex !== -1) {
        if (occupant) bench[benchIndex] = occupant; else bench.splice(benchIndex, 1);
      } else if (reserveIndex !== -1) {
        if (occupant) reserves[reserveIndex] = occupant; else reserves.splice(reserveIndex, 1);
      } else if (occupant) {
        reserves.push(occupant);
      }

      return { ...s, lineup: { starters, bench, reserves } };
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

  const OFFER_COOLDOWN_WEEKS = 4;

  function isOnOfferCooldown(playerId) {
    const until = (state.offerCooldowns || {})[playerId];
    return until != null && state.week < until;
  }

  function weeksUntilCanOffer(playerId) {
    const until = (state.offerCooldowns || {})[playerId];
    return until != null ? Math.max(0, until - state.week) : 0;
  }

  function isTransferWindowOpen() {
    if (!state) return true;
    const w = state.week;
    return (w >= 0 && w <= 7) || (w >= 20 && w <= 24);
  }

  function offerForPlayer(player, offerAmount) {
    const releaseClause = (state.releaseClauses || {})[player.id];
    // Prestige da un pequeño bonus al efectivo (alta reputación = clubs aceptan ligeramente menos)
    const prestigeBonus = ((state.managerPrestige ?? 50) - 50) * 0.005;
    const effectiveOffer = Math.round(offerAmount * (1 + prestigeBonus) * 20) / 20;

    // Cláusula de liberación: si la oferta cubre la cláusula, aceptación automática
    if (releaseClause != null && offerAmount >= releaseClause) {
      setState((s) => ({
        ...s,
        sentOffers: [
          { id: `fee_rc_${player.id}_${s.week}_${Date.now()}`, type: "fee", playerId: player.id, playerName: player.name, teamId: player.teamId, amount: offerAmount, accepted: true, week: s.week, byClause: true },
          ...(s.sentOffers || []),
        ].slice(0, 30),
      }));
      return { accepted: true, player, sellerTeam: teamById(player.teamId), offerAmount, byReleaseClause: true };
    }

    const sellerTeam = teamById(player.teamId);
    const result = clubDecision(player, sellerTeam, effectiveOffer);
    setState((s) => ({
      ...s,
      offerCooldowns: result.accepted ? s.offerCooldowns : { ...(s.offerCooldowns || {}), [player.id]: s.week + OFFER_COOLDOWN_WEEKS },
      sentOffers: [
        { id: `fee_${player.id}_${s.week}_${Date.now()}`, type: "fee", playerId: player.id, playerName: player.name, teamId: player.teamId, amount: offerAmount, accepted: result.accepted, week: s.week },
        ...(s.sentOffers || []),
      ].slice(0, 30),
    }));
    return { ...result, player, sellerTeam, offerAmount };
  }

  function offerContractTo(player, wageOffered, years) {
    const sellerTeam = teamById(player.teamId);
    const result = playerDecision(player, sellerTeam, team, wageOffered, years);
    setState((s) => ({
      ...s,
      offerCooldowns: result.accepted ? s.offerCooldowns : { ...(s.offerCooldowns || {}), [player.id]: s.week + OFFER_COOLDOWN_WEEKS },
      sentOffers: [
        { id: `wage_${player.id}_${s.week}_${Date.now()}`, type: "wage", playerId: player.id, playerName: player.name, teamId: player.teamId, amount: wageOffered, years, accepted: result.accepted, week: s.week },
        ...(s.sentOffers || []),
      ].slice(0, 30),
    }));
    return { ...result, player, wageOffered, years };
  }

  function completeTransfer(player, feeAgreed, wageAgreed, yearsAgreed) {
    if (!isTransferWindowOpen()) return { success: false, reason: "window_closed" };
    if (state.budget < feeAgreed) return { success: false, reason: "insufficient_budget" };
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
        number: nextAvailableNumber(s.squad),
      };
      const squad = [...s.squad, signed];
      const reserves = [...s.lineup.reserves, signed.id];
      return {
        ...s,
        squad,
        lineup: { ...s.lineup, reserves },
        budget: Math.round((s.budget - feeAgreed) * 20) / 20,
        acquired: [...(s.acquired || []), player.id],
        watchlist: (s.watchlist || []).filter((id) => id !== player.id),
        news: [`✍️ Fichaste a ${player.name} por €${feeAgreed}M.`, ...s.news].slice(0, 8),
      };
    });
    return { success: true };
  }

  function toggleWatchlist(playerId) {
    setState((s) => {
      const watchlist = s.watchlist || [];
      return { ...s, watchlist: watchlist.includes(playerId) ? watchlist.filter((id) => id !== playerId) : [...watchlist, playerId] };
    });
  }

  function toggleTransferListed(playerId) {
    setState((s) => ({ ...s, squad: s.squad.map((p) => (p.id === playerId ? { ...p, transferListed: !p.transferListed } : p)) }));
  }

  function toggleLoanListed(playerId) {
    setState((s) => ({ ...s, squad: s.squad.map((p) => (p.id === playerId ? { ...p, loanListed: !p.loanListed } : p)) }));
  }

  function setCaptain(playerId) {
    setState((s) => ({ ...s, captainId: playerId }));
  }

  function setPlayerInstruction(playerId, instruction) {
    setState((s) => ({
      ...s,
      playerInstructions: { ...(s.playerInstructions || {}), [playerId]: instruction === "libre" ? undefined : instruction },
    }));
  }

  function startPositionTraining(playerId, targetPos) {
    setState((s) => ({
      ...s,
      squad: s.squad.map((p) =>
        p.id === playerId && !p.training && p.position !== targetPos
          ? { ...p, training: { targetPos, endWeek: s.week + TRAINING_WEEKS } }
          : p
      ),
    }));
  }

  function acceptJobOffer(offerId) {
    setState((s) => {
      const offer = (s.jobOffers || []).find((o) => o.id === offerId && o.status === "pending");
      if (!offer) return s;
      // Construir nueva carrera en el club destino, manteniendo prestige e historial
      const newState = buildInitialState(offer.fromTeamId);
      return {
        ...newState,
        managerPrestige: s.managerPrestige,
        history: [...s.history, { season: s.season, teamId: s.teamId, note: `Fichado por ${offer.fromTeamName}` }],
        news: [`🤝 Firmaste como técnico de ${offer.fromTeamName}. Nueva etapa.`, ...newState.news].slice(0, 8),
      };
    });
  }

  function declineJobOffer(offerId) {
    setState((s) => ({
      ...s,
      jobOffers: (s.jobOffers || []).map((o) => o.id === offerId ? { ...o, status: "declined" } : o),
      news: [`❌ Rechazaste la oferta de otro club. Seguís en tu proyecto.`, ...s.news].slice(0, 8),
    }));
  }

  function respondToIncomingOffer(offerId, accept) {
    setState((s) => {
      const offer = (s.incomingOffers || []).find((o) => o.id === offerId);
      if (!offer || offer.status !== "pending") return s;
      const incomingOffers = s.incomingOffers.map((o) => (o.id === offerId ? { ...o, status: accept ? "accepted" : "rejected" } : o));
      if (!accept) return { ...s, incomingOffers };

      const squad = s.squad.filter((p) => p.id !== offer.playerId);
      const lineup = {
        starters: s.lineup.starters.map((slot) => (slot.playerId === offer.playerId ? { ...slot, playerId: null } : slot)),
        bench: s.lineup.bench.filter((id) => id !== offer.playerId),
        reserves: s.lineup.reserves.filter((id) => id !== offer.playerId),
      };
      const budget = offer.isLoan ? s.budget : Math.round((s.budget + offer.amount) * 20) / 20;
      const news = [
        offer.isLoan
          ? `🔁 Prestaste a ${offer.playerName} a ${offer.teamName}.`
          : `💰 Vendiste a ${offer.playerName} a ${offer.teamName} por €${offer.amount}M.`,
        ...s.news,
      ].slice(0, 8);
      return { ...s, squad, lineup, budget, incomingOffers, news };
    });
  }

  const SCOUT_COOLDOWN_WEEKS = 3;

  function scoutCooldownKey(scoutId, playerId) {
    return `${scoutId}__${playerId}`;
  }

  function isScoutOnCooldown(scoutId, playerId) {
    const until = (state?.scoutCooldowns || {})[scoutCooldownKey(scoutId, playerId)];
    return until != null && state.week < until;
  }

  function weeksUntilScoutAvailable(scoutId, playerId) {
    const until = (state?.scoutCooldowns || {})[scoutCooldownKey(scoutId, playerId)];
    return until != null ? Math.max(0, until - state.week) : 0;
  }

  function sendScout(scoutId, playerId) {
    const player = allPlayers.find((p) => p.id === playerId) || state.squad.find((p) => p.id === playerId);
    if (!player) return null;
    if (isScoutOnCooldown(scoutId, playerId)) {
      return { error: "cooldown", weeksLeft: weeksUntilScoutAvailable(scoutId, playerId) };
    }
    const targetTeam = teamById(player.teamId);
    const report = scoutPlayer(scoutId, player, targetTeam?.league);
    setState((s) => ({
      ...s,
      scoutReports: { ...s.scoutReports, [playerId]: mergeReports(s.scoutReports[playerId], report) },
      scoutCooldowns: { ...(s.scoutCooldowns || {}), [scoutCooldownKey(scoutId, playerId)]: s.week + SCOUT_COOLDOWN_WEEKS },
      news: [`🔎 ${report.scoutName} entregó su informe sobre ${player.name}.`, ...s.news].slice(0, 8),
    }));
    return report;
  }

  function currentFixture() {
    if (!state) return null;
    return state.calendar.find((c) => !c.played) || null;
  }

  function isRivalMatch(opponentId) {
    if (!state) return false;
    return isDerby(state.teamId, opponentId);
  }

  function copaIsAvailable() {
    if (!state?.copa) return false;
    const { copa } = state;
    if (copa.eliminated || copa.champion) return false;
    return state.week >= COPA_WEEKS[copa.currentRound];
  }

  function playNextMatchFirstHalf() {
    const fixture = currentFixture();
    if (!fixture || !team) return null;
    const rival = teamById(fixture.opponentTeamId);
    const rivalSquad = playersByTeam(rival.id).filter((p) => !(state.acquired || []).includes(p.id));
    const rivalOvr = rivalSquad.length ? rivalSquad.reduce((s, p) => s + p.ovr, 0) / rivalSquad.length : rival.tier === 1 ? 82 : rival.tier === 2 ? 76 : 70;
    const rivalFormScore = 60;
    const myDay = dayFormFactor();
    const rivalDay = dayFormFactor();

    const h1 = simulateHalf({
      myPlayers: state.squad,
      lineup: state.lineup.starters,
      myMentality: state.mentality,
      mySliders: state.sliders,
      myFormScore: 65,
      rivalOvr,
      rivalFormScore,
      isHome: fixture.home,
      morale: state.morale || {},
      fatigue: state.fatigue || {},
      instructions: state.playerInstructions || {},
      trainingFocus: state.trainingFocus || "balanced",
      myDay, rivalDay, half: 1,
    });

    const derby = isDerby(state.teamId, rival.id);

    setState((s) => ({
      ...s,
      pendingMatch: {
        fixtureWeek: fixture.week,
        rivalId: rival.id,
        rivalOvr, rivalFormScore,
        isHome: fixture.home,
        myDay, rivalDay,
        isDerby: derby,
        h1,
        lineupFirst: s.lineup.starters,
      },
    }));

    return { phase: "half1", ...h1, rival, isDerby: derby };
  }

  function playNextMatchSecondHalf(subs = []) {
    const pm = state.pendingMatch;
    if (!pm) return null;
    const rival = teamById(pm.rivalId);

    const lineup2 = pm.lineupFirst.map((slot) => {
      const sub = subs.find((sb) => sb.outId === slot.playerId);
      return sub ? { ...slot, playerId: sub.inId } : slot;
    });

    const h2 = simulateHalf({
      myPlayers: state.squad,
      lineup: lineup2,
      myMentality: state.mentality,
      mySliders: state.sliders,
      myFormScore: 65,
      rivalOvr: pm.rivalOvr,
      rivalFormScore: pm.rivalFormScore,
      isHome: pm.isHome,
      morale: state.morale || {},
      fatigue: state.fatigue || {},
      instructions: state.playerInstructions || {},
      trainingFocus: state.trainingFocus || "balanced",
      myDay: pm.myDay, rivalDay: pm.rivalDay, half: 2,
    });

    const result = combineHalves(pm.h1, h2);

    setState((s) => {
      const standings = [...s.standings.map((r) => ({ ...r }))];
      applyResult(standings, s.teamId, result.myGoals, result.rivalGoals);
      applyResult(standings, rival.id, result.rivalGoals, result.myGoals);
      simulateRestOfWeek(standings, leagueTeams, s.teamId, rival.id);

      const calendar = s.calendar.map((c) => (c.week === pm.fixtureWeek ? { ...c, played: true, result: { myGoals: result.myGoals, rivalGoals: result.rivalGoals } } : c));
      const isWin = result.myGoals > result.rivalGoals;
      const isLoss = result.myGoals < result.rivalGoals;

      let news = [
        isWin ? `Victoria ${result.myGoals}-${result.rivalGoals} vs ${rival.name}.`
          : isLoss ? `Derrota ${result.myGoals}-${result.rivalGoals} vs ${rival.name}.`
          : `Empate ${result.myGoals}-${result.rivalGoals} vs ${rival.name}.`,
        ...generateMarketRumors(teams, allPlayers, 1),
        ...s.news,
      ].slice(0, 8);

      const newWeek = s.week + 1;

      const playerStats = mergePlayerStats(s.playerStats || {}, result.starterIds || [], result.playerMatchStats || {});
      let morale = applyMatchMorale(s.morale || {}, s.squad, { starters: pm.lineupFirst, bench: s.lineup.bench }, isWin, isLoss);
      const fatigue = applyMatchFatigue(s.fatigue || {}, s.squad, result.starterIds || [], s.trainingFocus);

      let managerPrestige = s.managerPrestige ?? 50;
      if (pm.isDerby) {
        // El clásico pega más fuerte en la moral y en la reputación del técnico.
        const derbyMoraleDelta = isWin ? 6 : isLoss ? -6 : 0;
        const updated = { ...morale };
        s.squad.forEach((p) => { updated[p.id] = Math.max(0, Math.min(100, (updated[p.id] ?? 70) + derbyMoraleDelta)); });
        morale = updated;
        managerPrestige = Math.max(0, Math.min(100, managerPrestige + (isWin ? 4 : isLoss ? -3 : 0)));
        news = [isWin ? `🔥 ¡Ganaste el clásico ante ${rival.name}!` : isLoss ? `😔 Perdiste el clásico ante ${rival.name}.` : `🔥 Empate en el clásico ante ${rival.name}.`, ...news].slice(0, 8);
      }

      if (s.captainId && isWin && (result.starterIds || []).includes(s.captainId)) {
        const updated = { ...morale };
        s.squad.forEach((p) => { updated[p.id] = Math.min(100, (updated[p.id] ?? 70) + 2); });
        morale = updated;
      }

      const newInjuries = rollMatchInjuries(pm.lineupFirst, newWeek);
      let injuries = [...newInjuries, ...recoverInjuries(s.injuries || [], newWeek)];
      if (newInjuries.length) {
        const names = newInjuries.map(i => {
          const p = s.squad.find(pl => pl.id === i.playerId);
          return p ? `${p.name} (${i.type}, ${i.weeksOut} sem.)` : "";
        }).filter(Boolean).join(", ");
        if (names) news = [`🏥 Bajas: ${names}`, ...news].slice(0, 8);
      }

      // Evento aleatorio semanal (narrativo, con jugadores reales del plantel)
      const event = rollEvent(s.squad);
      let eventPatches = {};
      if (event) {
        news = [event.text, ...news].slice(0, 8);
        if (event.apply) eventPatches = event.apply(s);
        if (event.moraleBonus) {
          const bonus = event.moraleBonus;
          const updatedMorale = { ...morale };
          s.squad.forEach(p => {
            updatedMorale[p.id] = Math.max(0, Math.min(100, (updatedMorale[p.id] ?? 70) + bonus));
          });
          morale = updatedMorale;
        }
        if (event.targetMoraleId && event.targetMoraleDelta) {
          morale = {
            ...morale,
            [event.targetMoraleId]: Math.max(0, Math.min(100, (morale[event.targetMoraleId] ?? 70) + event.targetMoraleDelta)),
          };
        }
        if (event.forceInjuryId && !recoverInjuries(injuries, newWeek).some(i => i.playerId === event.forceInjuryId)) {
          injuries = [...injuries, forceInjury(event.forceInjuryId, newWeek)];
        }
      }

      const allPlayed = calendar.every((c) => c.played);
      const competitionLabel = pm.isDerby ? "🔥 Clásico · Liga" : "Liga";
      let next = { ...s, ...eventPatches, standings, calendar, managerPrestige, lastMatch: { ...result, rival, isDerby: pm.isDerby, competitionLabel }, news, week: newWeek, playerStats, morale, fatigue, injuries, pendingMatch: null };

      const trainingResult = applyPositionTrainings(next.squad, next.week);
      if (trainingResult.news.length) {
        next = { ...next, squad: trainingResult.squad, news: [...trainingResult.news, ...next.news].slice(0, 8) };
      }

      const newOffers = generateIncomingOffers(next.squad, teams, next.teamId, next.week);
      if (newOffers.length) {
        next = {
          ...next,
          incomingOffers: [...newOffers, ...(next.incomingOffers || [])].slice(0, 20),
          news: [`📨 Llegaron ${newOffers.length} oferta${newOffers.length === 1 ? "" : "s"} por jugadores tuyos.`, ...next.news].slice(0, 8),
        };
      }

      if (shouldRunMonthlyScout(next.week, next.lastMonthlyScoutWeek)) {
        const discovery = runMonthlyDiscovery(next.scoutReports, next.week);
        next = {
          ...next,
          scoutReports: discovery.scoutReports,
          monthlyReports: [discovery.entry, ...(next.monthlyReports || [])].slice(0, 12),
          lastMonthlyScoutWeek: next.week,
          news: discovery.newsLine ? [discovery.newsLine, ...next.news].slice(0, 8) : next.news,
        };
      }

      if (allPlayed) next = finishSeason(next);
      return next;
    });

    return { phase: "final", ...result, rival, isDerby: pm.isDerby, competitionLabel: pm.isDerby ? "🔥 Clásico · Liga" : "Liga" };
  }

  function answerPressConference(effects) {
    setState((s) => {
      const boardConfidence = effects.boardConfidence
        ? Math.max(0, Math.min(100, s.boardConfidence + effects.boardConfidence))
        : s.boardConfidence;
      const managerPrestige = effects.managerPrestige
        ? Math.max(0, Math.min(100, (s.managerPrestige ?? 50) + effects.managerPrestige))
        : s.managerPrestige;
      const clubReputation = effects.clubReputation
        ? Math.max(0, Math.min(100, (s.clubReputation ?? 50) + effects.clubReputation))
        : s.clubReputation;
      let morale = s.morale || {};
      if (effects.moraleAll) {
        const delta = effects.moraleAll;
        const updated = { ...morale };
        s.squad.forEach((p) => { updated[p.id] = Math.max(0, Math.min(100, (updated[p.id] ?? 70) + delta)); });
        morale = updated;
      }
      return { ...s, boardConfidence, managerPrestige, clubReputation, morale };
    });
  }

  function holdSquadMeeting(type) {
    setState((s) => {
      if (s.lastMeetingWeek === s.week) return s;
      const morale = { ...(s.morale || {}) };
      let boardConfidence = s.boardConfidence;
      let newsLine = "";

      if (type === "motivate") {
        s.squad.forEach((p) => { morale[p.id] = Math.min(100, (morale[p.id] ?? 70) + 8); });
        newsLine = "🗣️ Diste una charla motivadora al plantel. La moral general sube.";
      } else if (type === "demand") {
        s.squad.forEach((p) => { morale[p.id] = Math.max(0, (morale[p.id] ?? 70) - 3); });
        boardConfidence = Math.min(100, boardConfidence + 3);
        newsLine = "📢 Exigiste más nivel al plantel. La directiva valora tu carácter, aunque genera algo de tensión.";
      } else if (type === "rest") {
        s.squad.forEach((p) => { morale[p.id] = Math.min(100, (morale[p.id] ?? 70) + 12); });
        newsLine = "🌴 Le diste un día libre al plantel. La moral sube notablemente.";
      } else {
        return s;
      }

      return { ...s, morale, boardConfidence, lastMeetingWeek: s.week, news: [newsLine, ...s.news].slice(0, 8) };
    });
  }

  function playCopaMatch() {
    const copa = state?.copa;
    if (!copa || copa.eliminated || copa.champion) return null;
    const roundIdx = copa.currentRound;
    if (state.week < COPA_WEEKS[roundIdx]) return null;

    const opponent = copa.opponents[roundIdx];
    if (!opponent) return null;

    const rivalTeam = teamById(opponent.id);
    const rivalOvr = rivalTeam?.tier === 1 ? 83 : rivalTeam?.tier === 2 ? 76 : 70;

    const result = simulateUserMatch({
      myPlayers: state.squad,
      myLineup: state.lineup.starters,
      myMentality: state.mentality,
      mySliders: state.sliders,
      myFormScore: 65,
      rivalOvr,
      rivalFormScore: 60,
      isHome: true,
      morale: state.morale || {},
      fatigue: state.fatigue || {},
      instructions: state.playerInstructions || {},
      trainingFocus: state.trainingFocus || "balanced",
    });

    const won = result.myGoals > result.rivalGoals;
    // En Copa el empate se decide por penales (simplificado: usuario gana el 50%)
    const wonAfterPenalties = result.myGoals === result.rivalGoals ? Math.random() < 0.5 : won;

    setState((s) => {
      const newCopa = { ...s.copa };
      newCopa.results = [...newCopa.results, { round: roundIdx, won: wonAfterPenalties, myGoals: result.myGoals, rivalGoals: result.rivalGoals }];

      let news = [...s.news];
      let budget = s.budget;

      // Lesiones Copa
      const newInjuries = rollMatchInjuries(s.lineup.starters, s.week);
      const injuries = [...newInjuries, ...recoverInjuries(s.injuries || [], s.week)];

      const playerStats = mergePlayerStats(s.playerStats || {}, result.starterIds || [], result.playerMatchStats || {});
      const isWin = result.myGoals > result.rivalGoals;
      const isLoss = result.myGoals < result.rivalGoals;
      const morale = applyMatchMorale(s.morale || {}, s.squad, s.lineup, wonAfterPenalties, !wonAfterPenalties);
      const fatigue = applyMatchFatigue(s.fatigue || {}, s.squad, result.starterIds || [], s.trainingFocus);

      if (!wonAfterPenalties) {
        newCopa.eliminated = true;
        news = [`💔 Copa ${COPA_ROUNDS[roundIdx]}: eliminados por ${opponent.name} (${result.myGoals}-${result.rivalGoals}).`, ...news].slice(0, 8);
      } else if (roundIdx === 3) {
        newCopa.champion = true;
        newCopa.currentRound = 4;
        budget = Math.round((budget + COPA_PRIZES[3]) * 20) / 20;
        news = [`🏆 ¡CAMPEÓN DE COPA! Ganaste la final vs ${opponent.name} (${result.myGoals}-${result.rivalGoals}). +€${COPA_PRIZES[3]}M.`, ...news].slice(0, 8);
      } else {
        newCopa.currentRound = roundIdx + 1;
        budget = Math.round((budget + COPA_PRIZES[roundIdx]) * 20) / 20;
        news = [`🏅 Copa ${COPA_ROUNDS[roundIdx]}: avanzás a ${COPA_ROUNDS[roundIdx + 1]} vs ${newCopa.opponents[roundIdx + 1]?.name || "?"} (ganaste ${result.myGoals}-${result.rivalGoals}${result.myGoals === result.rivalGoals ? " en penales" : ""}). +€${COPA_PRIZES[roundIdx]}M.`, ...news].slice(0, 8);
      }

      return { ...s, copa: newCopa, news, budget, injuries, playerStats, morale, fatigue, lastMatch: { ...result, rival: { name: opponent.name }, competitionLabel: `Copa del Rey · ${COPA_ROUNDS[roundIdx]}` } };
    });

    return { ...result, rival: { name: opponent.name }, competitionLabel: `Copa del Rey · ${COPA_ROUNDS[roundIdx]}` };
  }

  function continentalIsAvailable() {
    if (!state?.continental) return false;
    const { continental } = state;
    if (continental.eliminated || continental.champion) return false;
    return state.week >= CONTINENTAL_WEEKS[continental.currentRound];
  }

  function playContinentalMatch() {
    const continental = state?.continental;
    if (!continental || continental.eliminated || continental.champion) return null;
    const roundIdx = continental.currentRound;
    if (state.week < CONTINENTAL_WEEKS[roundIdx]) return null;

    const opponent = continental.opponents[roundIdx];
    if (!opponent) return null;

    const rivalTeam = teamById(opponent.id);
    const rivalOvr = rivalTeam?.tier === 1 ? 86 : rivalTeam?.tier === 2 ? 79 : 72;
    const prizes = CONTINENTAL_PRIZES[continental.competition] || CONTINENTAL_PRIZES.europa;
    const compLabel = CONTINENTAL_LABELS[continental.competition] || "Copa Europea";

    const result = simulateUserMatch({
      myPlayers: state.squad,
      myLineup: state.lineup.starters,
      myMentality: state.mentality,
      mySliders: state.sliders,
      myFormScore: 65,
      rivalOvr,
      rivalFormScore: 63,
      isHome: true,
      morale: state.morale || {},
      fatigue: state.fatigue || {},
      instructions: state.playerInstructions || {},
      trainingFocus: state.trainingFocus || "balanced",
    });

    const won = result.myGoals > result.rivalGoals;
    const wonAfterPenalties = result.myGoals === result.rivalGoals ? Math.random() < 0.5 : won;

    setState((s) => {
      const newContinental = { ...s.continental };
      newContinental.results = [...newContinental.results, { round: roundIdx, won: wonAfterPenalties, myGoals: result.myGoals, rivalGoals: result.rivalGoals }];

      let news = [...s.news];
      let budget = s.budget;
      let managerPrestige = s.managerPrestige ?? 50;
      let clubReputation = s.clubReputation ?? 50;

      const newInjuries = rollMatchInjuries(s.lineup.starters, s.week);
      const injuries = [...newInjuries, ...recoverInjuries(s.injuries || [], s.week)];
      const playerStats = mergePlayerStats(s.playerStats || {}, result.starterIds || [], result.playerMatchStats || {});
      const morale = applyMatchMorale(s.morale || {}, s.squad, s.lineup, wonAfterPenalties, !wonAfterPenalties);
      const fatigue = applyMatchFatigue(s.fatigue || {}, s.squad, result.starterIds || [], s.trainingFocus);

      if (!wonAfterPenalties) {
        newContinental.eliminated = true;
        managerPrestige = Math.max(0, managerPrestige - 2);
        news = [`💔 ${compLabel} ${CONTINENTAL_ROUNDS[roundIdx]}: eliminados por ${opponent.name} (${result.myGoals}-${result.rivalGoals}).`, ...news].slice(0, 8);
      } else if (roundIdx === 3) {
        newContinental.champion = true;
        newContinental.currentRound = 4;
        budget = Math.round((budget + prizes[3]) * 20) / 20;
        managerPrestige = Math.min(100, managerPrestige + 15);
        clubReputation = Math.min(100, clubReputation + 15);
        news = [`🏆🌍 ¡CAMPEÓN DE ${compLabel.toUpperCase()}! Venciste a ${opponent.name} (${result.myGoals}-${result.rivalGoals}). +€${prizes[3]}M.`, ...news].slice(0, 8);
      } else {
        newContinental.currentRound = roundIdx + 1;
        budget = Math.round((budget + prizes[roundIdx]) * 20) / 20;
        managerPrestige = Math.min(100, managerPrestige + 3);
        news = [`🌍 ${compLabel} ${CONTINENTAL_ROUNDS[roundIdx]}: avanzás a ${CONTINENTAL_ROUNDS[roundIdx + 1]} vs ${newContinental.opponents[roundIdx + 1]?.name || "?"} (ganaste ${result.myGoals}-${result.rivalGoals}${result.myGoals === result.rivalGoals ? " en penales" : ""}). +€${prizes[roundIdx]}M.`, ...news].slice(0, 8);
      }

      return {
        ...s, continental: newContinental, news, budget, injuries, playerStats, morale, fatigue, managerPrestige, clubReputation,
        lastMatch: { ...result, rival: { name: opponent.name }, competitionLabel: `${compLabel} · ${CONTINENTAL_ROUNDS[roundIdx]}` },
      };
    });

    return { ...result, rival: { name: opponent.name }, competitionLabel: `${compLabel} · ${CONTINENTAL_ROUNDS[roundIdx]}` };
  }

  function preseasonAvailable() {
    return !!state?.preseason && !state.preseason.done;
  }

  function playPreseasonMatch() {
    const preseason = state?.preseason;
    if (!preseason || preseason.done) return null;
    const opponent = preseason.opponents[preseason.matchesPlayed];
    if (!opponent) return null;

    const rivalTeam = teamById(opponent.id);
    const rivalOvr = rivalTeam?.tier === 1 ? 80 : rivalTeam?.tier === 2 ? 73 : 66;

    const result = simulateUserMatch({
      myPlayers: state.squad,
      myLineup: state.lineup.starters,
      myMentality: state.mentality,
      mySliders: state.sliders,
      myFormScore: 60,
      rivalOvr,
      rivalFormScore: 55,
      isHome: true,
      morale: state.morale || {},
      fatigue: state.fatigue || {},
      instructions: state.playerInstructions || {},
      trainingFocus: state.trainingFocus || "balanced",
    });

    const isWin = result.myGoals > result.rivalGoals;
    const isLoss = result.myGoals < result.rivalGoals;

    setState((s) => {
      const matchesPlayed = s.preseason.matchesPlayed + 1;
      const done = matchesPlayed >= s.preseason.total;
      const morale = applyMatchMorale(s.morale || {}, s.squad, s.lineup, isWin, isLoss);
      const news = [
        isWin ? `Amistoso: victoria ${result.myGoals}-${result.rivalGoals} vs ${opponent.name}.`
          : isLoss ? `Amistoso: derrota ${result.myGoals}-${result.rivalGoals} vs ${opponent.name}.`
          : `Amistoso: empate ${result.myGoals}-${result.rivalGoals} vs ${opponent.name}.`,
        ...s.news,
      ].slice(0, 8);
      return { ...s, preseason: { ...s.preseason, matchesPlayed, done }, morale, news };
    });

    return { ...result, rival: { name: opponent.name }, competitionLabel: "Amistoso de pretemporada" };
  }

  function finishSeason(s) {
    const sorted = sortStandings(s.standings);
    const position = sorted.findIndex((r) => r.teamId === s.teamId) + 1;
    const objectiveMet = evaluateObjective(team.boardObjective, position);
    const confDelta = objectiveMet ? 20 : -25;
    const boardConfidence = Math.max(0, Math.min(100, s.boardConfidence + confDelta));
    const gameOver = boardConfidence <= 0;

    // Prestige update al final de temporada
    let managerPrestige = s.managerPrestige ?? 50;
    if (objectiveMet) managerPrestige = Math.min(100, managerPrestige + 5);
    else managerPrestige = Math.max(0, managerPrestige - 5);
    if (s.copa?.champion) managerPrestige = Math.min(100, managerPrestige + 10);
    else if ((s.copa?.currentRound || 0) >= 2) managerPrestige = Math.min(100, managerPrestige + 3);

    // Club reputation: crece con el tiempo y los resultados, más difícil de perder que boardConfidence
    let clubReputation = s.clubReputation ?? 50;
    if (objectiveMet) clubReputation = Math.min(100, clubReputation + 8);
    else clubReputation = Math.max(0, clubReputation - 6);
    if (s.copa?.champion) clubReputation = Math.min(100, clubReputation + 12);
    // Cada temporada que sigues en el club sube +2 de fidelidad base
    clubReputation = Math.min(100, clubReputation + 2);

    let squad = releaseExpired(ageSquad(s.squad, s.playerStats || {}));
    generateYouthProspects(team, 3).forEach((y) => {
      squad = [...squad, { ...y, number: nextAvailableNumber(squad) }];
    });

    const income = seasonIncome(team, position);
    // Club reputation alta → más presupuesto (hasta +20%)
    const repBonus = clubReputation >= 75 ? 1.2 : clubReputation >= 50 ? 1.0 : 0.85;
    const budget = Math.round((transferBudgetFor(team, position) + Math.round(income.total * 0.3)) * repBonus);

    const leagueTeamIds = leagueTeams.map((t) => t.id);
    const { calendar } = roundRobinCalendar(leagueTeamIds, s.teamId);
    const newCopa = generateCopa(leagueTeams, s.teamId);

    const nextCompetition = determineContinentalCompetition(team.tier, position);
    const newContinental = generateContinental(nextCompetition, s.teamId);
    const continentalNewsLine = nextCompetition
      ? `🌍 Clasificaste a ${CONTINENTAL_LABELS[nextCompetition]} la próxima temporada.`
      : null;

    // Generar ofertas de otros clubes si el prestige es suficiente
    let newJobOffers = (s.jobOffers || []).map((o) => o.status === "pending" ? { ...o, status: "expired" } : o);
    const offerChance = managerPrestige >= 75 ? 0.65 : managerPrestige >= 60 ? 0.40 : managerPrestige >= 50 ? 0.20 : 0;
    if (objectiveMet && Math.random() < offerChance) {
      const allTeamsList = teams.filter((t) => t.id !== s.teamId);
      const candidate = allTeamsList[Math.floor(Math.random() * allTeamsList.length)];
      if (candidate) {
        newJobOffers = [
          {
            id: `job_${candidate.id}_${s.season}`,
            fromTeamId: candidate.id,
            fromTeamName: candidate.name,
            fromLeague: candidate.league,
            season: s.season,
            status: "pending",
          },
          ...newJobOffers,
        ].slice(0, 5);
      }
    }

    const offerNews = newJobOffers.some((o) => o.status === "pending")
      ? [`📩 ${newJobOffers.find(o => o.status === "pending").fromTeamName} te ofrece su banquillo. Revisá tu bandeja.`]
      : [];

    return {
      ...s,
      season: s.season + 1,
      week: 0,
      lastMonthlyScoutWeek: 0,
      squad,
      lineup: defaultLineup(squad, s.formation),
      budget,
      boardConfidence,
      managerPrestige,
      clubReputation,
      jobOffers: newJobOffers,
      calendar,
      standings: initialStandings(leagueTeamIds),
      copa: newCopa,
      continental: newContinental,
      preseason: generatePreseason(s.teamId),
      playerStats: {},
      injuries: [],
      fatigue: {},
      history: [...s.history, { season: s.season, position, points: sorted.find((r) => r.teamId === s.teamId)?.pts || 0, objectiveMet, copaChampion: s.copa?.champion || false, continentalChampion: s.continental?.champion || false }],
      news: [
        ...(continentalNewsLine ? [continentalNewsLine] : []),
        ...offerNews,
        objectiveMet ? `¡Objetivo cumplido! Terminaste ${position}° — la directiva confía en el proyecto.` : `No se cumplió el objetivo (terminaste ${position}°). La directiva está molesta.`,
        `Nueva temporada: llegan 3 promesas de la cantera.`,
        `Copa del Rey: primera ronda disponible en jornada ${COPA_WEEKS[0]}.`,
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
      COPA_ROUNDS,
      COPA_WEEKS,
      CONTINENTAL_ROUNDS,
      CONTINENTAL_WEEKS,
      CONTINENTAL_LABELS,
      selectTeam,
      resetCareer,
      setFormation,
      setMentality,
      setSlider,
      setLineup,
      setTrainingFocus,
      assignSlot,
      setSlotPosition,
      resetLineupPositions,
      moveToBench,
      moveToReserves,
      sendScout,
      isScoutOnCooldown,
      weeksUntilScoutAvailable,
      offerForPlayer,
      offerContractTo,
      completeTransfer,
      isOnOfferCooldown,
      weeksUntilCanOffer,
      isTransferWindowOpen,
      toggleWatchlist,
      toggleTransferListed,
      toggleLoanListed,
      startPositionTraining,
      setCaptain,
      setPlayerInstruction,
      preseasonAvailable,
      playPreseasonMatch,
      respondToIncomingOffer,
      currentFixture,
      isRivalMatch,
      playNextMatchFirstHalf,
      playNextMatchSecondHalf,
      playCopaMatch,
      copaIsAvailable,
      playContinentalMatch,
      continentalIsAvailable,
      applyTacticsPreset,
      acceptJobOffer,
      declineJobOffer,
      holdSquadMeeting,
      answerPressConference,
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
