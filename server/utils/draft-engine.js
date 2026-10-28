import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Draft «8a2» (solo) en el servidor. Es el mismo juego del html viejo, con las mismas reglas y la
// misma simulación de partidos, pero el servidor guarda la partida, tira el azar con una semilla y
// decide el resultado: el teléfono solo elige a quién ficha y dónde lo pone.
//
// Flujo: elegir formación, modo (Clásico: valoraciones ocultas y 1 cambio · De almanaque: valoraciones
// visibles y hasta 3 cambios, más 3 fichajes al final) y estilo; 11 rondas de «sale un plantel, ficha
// a uno»; con el once armado se juega la Champions (octavos a final) contra 15 plantel rivales.
const DATA = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/draft-squads.json"), "utf-8"));
export const FORMATIONS = DATA.formations;
export const TEAMS = DATA.teams;
const SEASONS = DATA.seasonCount;
export const ROUND_ORDER = DATA.roundOrder;
export const MODES = { clasico: "Clásico", almanaque: "De almanaque" };
export const STYLES = ["equilibrado", "defensivo", "ofensivo"];
export const CHAMPION_POINTS = 30;
const POOL_SIZE = 11;

const ALIASES = { LI: "LE", MD: "MEI", ME: "MEI", MEC: "MEI", MED: "MEI", MC: "MEI" };
const ATT_MID_RAW = { MD: true, ME: true, MEC: true, MEI: true };
export const normalizePositions = (raw) => raw.split("/").map((p) => { const t = p.trim(); return ALIASES[t] || t; });

// ---------- azar con semilla ----------
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const roll = (st) => { st.n += 1; return mulberry((st.seed * 2654435761 + st.n * 40503) >>> 0)(); };
const rand = (st, list) => list[Math.floor(roll(st) * list.length)];
function shuffle(st, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(roll(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- reglas del draft ----------
function effectiveRating(style, player) {
  if (style === "equilibrado") return player.r;
  const raw = player.p.split("/").map((s) => s.trim());
  const normed = normalizePositions(player.p);
  if (style === "defensivo") return normed.some((p) => ["GOL", "ZAG", "LD", "LE"].includes(p)) ? player.r + 3 : player.r;
  const att = normed.some((p) => ["CA", "PE", "PD"].includes(p)) || raw.some((p) => ATT_MID_RAW[p]);
  return att ? player.r + 3 : player.r;
}

const rerollsTotal = (st) => st.rerollsClub + st.rerollsSeason;
export function canRerollClub(st) { return st.mode === "clasico" ? st.rerollsClub < 1 : st.rerollsClub < 2 && rerollsTotal(st) < 3; }
export function canRerollSeason(st) {
  if (st.mode === "clasico" || !st.team) return false;
  if ((SEASONS[st.team.club] || 0) < 2) return false;
  return st.rerollsSeason < 1 && rerollsTotal(st) < 3;
}

function pickTeam(st, opts = {}) {
  let pool = TEAMS.filter((t) => {
    if (opts.sameClub && t.club !== opts.sameClub) return false;
    if (opts.sameSeason !== undefined && t.season !== opts.sameSeason) return false;
    if (opts.excludeClub && t.club === opts.excludeClub && !opts.sameClub) return false;
    if (opts.excludeSeason !== undefined && t.season === opts.excludeSeason && opts.sameSeason === undefined) return false;
    return true;
  });
  if (!pool.length) pool = TEAMS;
  return rand(st, pool);
}

const emptyTypes = (st) => new Set(st.slots.filter((s) => !s.filled).map((s) => s.type));
const poolFits = (st, pool) => { const e = emptyTypes(st); return pool.some((pl) => normalizePositions(pl.p).some((t) => e.has(t))); };

// ¿El pool que salió es justo el once de mejor promedio posible del plantel?
function isBestXI(team, pool) {
  if (pool.length < 11 || team.players.length < 11) return false;
  const sorted = team.players.slice().sort((a, b) => b.r - a.r);
  const cutoff = sorted[10].r;
  const names = new Set(pool.map((p) => p.n));
  return sorted.every((p) => p.r <= cutoff || names.has(p.n)) && pool.every((p) => p.r >= cutoff);
}

function drawTeam(st, opts = {}, attempt = 0) {
  const o = {};
  if (opts.keepClub && st.team) o.sameClub = st.team.club;
  if (opts.keepSeason && st.team) o.sameSeason = st.team.season;
  if (!opts.keepClub && st.excludeClub) o.excludeClub = st.excludeClub;
  if (!opts.keepSeason && st.excludeSeason !== null) o.excludeSeason = st.excludeSeason;
  const team = pickTeam(st, o);
  const pool = shuffle(st, team.players).slice(0, POOL_SIZE);
  if (!poolFits(st, pool)) {
    // El plantel no trae a nadie para los puestos que quedan: se cambia uno del pool por alguien que sí encaje.
    const empties = emptyTypes(st);
    const fit = team.players.find((p) => !pool.includes(p) && normalizePositions(p.p).some((t) => empties.has(t)));
    if (fit) pool[pool.length - 1] = fit;
    else if (attempt < 40) return drawTeam(st, {}, attempt + 1);
  }
  st.team = { club: team.club, season: team.season, flag: team.flag, revelacion: team.revelacion, note: team.note };
  st.pool = pool;
  st.bestXI = isBestXI(team, pool);
  st.excludeClub = team.club;
  st.excludeSeason = team.season;
  st.round += 1;
  return st;
}

export function newRun({ formation, mode, style }, seed) {
  if (!FORMATIONS[formation]) return { error: "Formación inválida" };
  if (!MODES[mode]) return { error: "Modo inválido" };
  if (!STYLES.includes(style)) return { error: "Estilo inválido" };
  const st = {
    seed: seed >>> 0, n: 0, formation, mode, style, round: 0, phase: "draft",
    slots: FORMATIONS[formation].map((type) => ({ type, filled: null })),
    team: null, pool: [], rerollsClub: 0, rerollsSeason: 0, excludeClub: null, excludeSeason: null, bestXI: false,
    transfersLeft: 0, transferSlot: null, transferOptions: null, cup: null, final: null,
  };
  drawTeam(st);
  return st;
}

// Lo que ve el teléfono. En Clásico las valoraciones están ocultas mientras se arma el equipo.
export function publicView(st) {
  const hide = st.mode === "clasico" && st.phase === "draft";
  const player = (p) => (hide ? { n: p.n, p: p.p } : { n: p.n, p: p.p, r: p.r });
  return {
    phase: st.phase, formation: st.formation, mode: st.mode, style: st.style, round: st.round, total: st.slots.length,
    layout: DATA.layouts[st.formation], posLabel: DATA.posLabel,
    team: st.team && { ...st.team, bestXI: st.bestXI, idols: DATA.idols[st.team.club] || [] },
    pool: st.phase === "draft" ? st.pool.map(player) : [],
    slots: st.slots.map((s) => ({ type: s.type, filled: s.filled && { n: s.filled.n, p: s.filled.p, club: s.filled.club, season: s.filled.season, ...(hide ? {} : { r: s.filled.r, eff: s.filled.eff }) } })),
    rerolls: { club: canRerollClub(st), season: canRerollSeason(st), usedClub: st.rerollsClub, usedSeason: st.rerollsSeason, max: st.mode === "clasico" ? 1 : 3 },
    transfersLeft: st.transfersLeft, transferSlot: st.transferSlot, transferOptions: st.transferOptions && st.transferOptions.map((o) => ({ n: o.n, p: o.p, r: o.r, eff: o.eff, club: o.club, season: o.season })),
    average: st.phase === "draft" ? null : avgOf(st), cup: st.cup && publicCup(st.cup), final: st.final, room: st.room || null,
  };
}
const avgOf = (st) => Math.round((st.slots.reduce((a, s) => a + s.filled.eff, 0) / st.slots.length) * 10) / 10;

export function reroll(st, type) {
  if (st.phase !== "draft") return { error: "Ya no se puede cambiar de plantel" };
  const s = structuredClone(st);
  if (type === "club") { if (!canRerollClub(s)) return { error: "Ya no te quedan cambios de equipo" }; s.rerollsClub += 1; s.round -= 1; drawTeam(s, s.mode === "clasico" ? {} : { keepSeason: true }); }
  else if (type === "season") { if (!canRerollSeason(s)) return { error: "No hay otra temporada para cambiar" }; s.rerollsSeason += 1; s.round -= 1; drawTeam(s, { keepClub: true }); }
  else return { error: "Cambio inválido" };
  return s;
}

export function pick(st, { poolIdx, slotIdx }) {
  if (st.phase !== "draft") return { error: "El equipo ya está completo" };
  const player = st.pool[poolIdx];
  const slot = st.slots[slotIdx];
  if (!player || !slot) return { error: "Elección inválida" };
  if (slot.filled) return { error: "Ese puesto ya está ocupado" };
  if (!normalizePositions(player.p).includes(slot.type)) return { error: "Ese jugador no juega en ese puesto" };
  const s = structuredClone(st);
  s.slots[slotIdx].filled = { n: player.n, p: player.p, r: player.r, eff: effectiveRating(s.style, player), club: s.team.club, season: s.team.season };
  if (s.slots.every((x) => x.filled)) {
    s.phase = "result";
    s.transfersLeft = s.mode === "almanaque" ? 3 : 0;
    s.pool = [];
  } else drawTeam(s, {});
  return s;
}

// Reubicar a un jugador ya fichado en otro puesto libre (o intercambiarlo) si juega ahí.
export function move(st, { from, to }) {
  if (st.phase !== "draft") return { error: "Ya no se puede reubicar" };
  const a = st.slots[from]; const b = st.slots[to];
  if (!a?.filled || !b || from === to) return { error: "Movimiento inválido" };
  if (b.filled) return { error: "Ese puesto está ocupado" };
  if (!normalizePositions(a.filled.p).includes(b.type)) return { error: "Ese jugador no juega en ese puesto" };
  // Debe quedar al menos un puesto libre que el plantel actual pueda cubrir.
  const s = structuredClone(st);
  s.slots[to].filled = s.slots[from].filled; s.slots[from].filled = null;
  if (!poolFits(s, s.pool)) return { error: "Con ese movimiento no podrías fichar a nadie del plantel de esta ronda" };
  return s;
}

export function openTransfer(st, slotIdx) {
  if (st.phase !== "result" || st.transfersLeft <= 0) return { error: "No quedan fichajes" };
  const slot = st.slots[slotIdx];
  if (!slot) return { error: "Puesto inválido" };
  const s = structuredClone(st);
  const inXI = new Set(s.slots.map((x) => `${x.filled.n}|${x.filled.club}|${x.filled.season}`));
  const opts = []; const seen = new Set();
  for (let tries = 0; opts.length < 3 && tries < 600; tries++) {
    const team = rand(s, TEAMS); const pl = rand(s, team.players);
    const key = `${pl.n}|${team.club}|${team.season}`;
    if (inXI.has(key) || seen.has(pl.n) || !normalizePositions(pl.p).includes(slot.type)) continue;
    seen.add(pl.n);
    opts.push({ n: pl.n, p: pl.p, r: pl.r, eff: effectiveRating(s.style, pl), club: team.club, season: team.season });
  }
  if (!opts.length) return { error: "No salió nadie para ese puesto" };
  s.transferSlot = slotIdx; s.transferOptions = opts;
  return s;
}

export function applyTransfer(st, optIdx) {
  const o = st.transferOptions?.[optIdx];
  if (st.phase !== "result" || !o || st.transferSlot === null) return { error: "Fichaje inválido" };
  const s = structuredClone(st);
  s.slots[s.transferSlot].filled = { n: o.n, p: o.p, r: o.r, eff: o.eff, club: o.club, season: o.season };
  s.transfersLeft -= 1; s.transferSlot = null; s.transferOptions = null;
  return s;
}

// ---------- simulación de partidos (misma que el html viejo) ----------
function bestFeasibleXI(players, formation) {
  const slots = FORMATIONS[formation];
  const cand = players.slice().sort((a, b) => b.r - a.r);
  const pos = cand.map((p) => normalizePositions(p.p));
  const matchSlot = new Array(cand.length).fill(-1);
  const tryAssign = (slotIdx, seen) => {
    for (let i = 0; i < cand.length; i++) {
      if (seen[i] || !pos[i].includes(slots[slotIdx])) continue;
      seen[i] = true;
      if (matchSlot[i] === -1 || tryAssign(matchSlot[i], seen)) { matchSlot[i] = slotIdx; return true; }
    }
    return false;
  };
  for (let s = 0; s < slots.length; s++) tryAssign(s, new Array(cand.length).fill(false));
  const starters = new Array(slots.length).fill(null);
  cand.forEach((p, i) => { if (matchSlot[i] !== -1) starters[matchSlot[i]] = p; });
  const used = new Set(starters.filter(Boolean).map((p) => p.n));
  return { starters: starters.filter(Boolean), bench: players.filter((p) => !used.has(p.n)) };
}

function packFromSlots(slots, formation) {
  const starters = slots.map((s) => ({ n: s.filled.n, p: s.filled.p, r: s.filled.eff, club: s.filled.club, season: s.filled.season }));
  const used = new Set(starters.map((p) => `${p.club}|${p.season}|${p.n}`));
  const seen = new Set(); const bench = [];
  for (const p of starters) {
    const cs = `${p.club}|${p.season}`;
    if (seen.has(cs)) continue;
    seen.add(cs);
    const team = TEAMS.find((t) => t.club === p.club && t.season === p.season);
    if (!team) continue;
    for (const tp of team.players) if (!used.has(`${cs}|${tp.n}`)) bench.push({ n: tp.n, p: tp.p, r: tp.r, club: p.club, season: p.season });
  }
  return { isYou: true, club: null, season: null, flag: "⭐", label: "Tu selección", formation, starters, bench };
}

function botPack(st, team) {
  const formation = rand(st, Object.keys(FORMATIONS));
  const xi = bestFeasibleXI(team.players, formation);
  const tag = (p) => ({ n: p.n, p: p.p, r: p.r, club: team.club, season: team.season });
  return { isYou: false, club: team.club, season: team.season, flag: team.flag, label: `${team.club} ${team.season}`, formation, starters: xi.starters.map(tag), bench: xi.bench.map(tag) };
}

function segStrength(starters) {
  const att = []; const def = []; const mid = [];
  for (const p of starters) {
    const n = normalizePositions(p.p);
    if (n.includes("CA") || n.includes("PD") || n.includes("PE")) att.push(p.r);
    if (n.includes("GOL") || n.includes("ZAG") || n.includes("LD") || n.includes("LE")) def.push(p.r);
    if (n.includes("MEI")) mid.push(p.r);
  }
  const avg = (a, f) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : f);
  return { attack: avg(att, 72), defense: avg(def, 72), mid: avg(mid, 72) };
}

function expectedGoals(myAttack, oppDefense, myMid, oppMid) {
  const xg = 1.3 * Math.pow(1.22, (myAttack - oppDefense) / 10) * Math.pow(1.05, (myMid - oppMid) / 10);
  return Math.max(0.2, Math.min(5.5, xg));
}

function pickScorer(st, starters) {
  const weighted = starters.map((p) => {
    const n = normalizePositions(p.p);
    let w = 0.4;
    if (n.includes("CA")) w = 5; else if (n.includes("PD") || n.includes("PE")) w = 3.2; else if (n.includes("MEI")) w = 1.6; else if (n.includes("GOL")) w = 0.05;
    return { p, w: w * Math.max(0.4, p.r / 80) };
  });
  let r = roll(st) * weighted.reduce((a, x) => a + x.w, 0);
  for (const x of weighted) { r -= x.w; if (r <= 0) return x.p; }
  return weighted[weighted.length - 1].p;
}

function pickSubMinutes(st) {
  const mins = [];
  while (mins.length < 4) { const m = 50 + Math.floor(roll(st) * 40); if (!mins.includes(m)) mins.push(m); }
  return mins.sort((a, b) => a - b);
}

function trySubstitute(st, team, minute, events, side) {
  if (!team.bench.length || team.subsUsed >= 4) return false;
  const order = shuffle(st, team.starters.map((_, i) => i));
  for (const outIdx of order) {
    const out = team.starters[outIdx];
    const outTypes = normalizePositions(out.p);
    const bi = team.bench.findIndex((b) => normalizePositions(b.p).some((t) => outTypes.includes(t)));
    if (bi === -1) continue;
    const inn = team.bench.splice(bi, 1)[0];
    team.starters[outIdx] = { n: inn.n, p: inn.p, r: inn.r + 2, club: inn.club, season: inn.season };
    team.subsUsed += 1;
    events.push({ minute, type: "sub", side, outName: out.n, inName: inn.n });
    return true;
  }
  return false;
}

function penalties(st, startersA, startersB, events) {
  const takers = (xi) => { const o = xi.filter((p) => !normalizePositions(p.p).includes("GOL")).sort((a, b) => b.r - a.r); return o.length ? o : xi; };
  const gk = (xi) => xi.find((p) => normalizePositions(p.p).includes("GOL")) || { r: 70 };
  const tA = takers(startersA); const tB = takers(startersB);
  const gkA = gk(startersA); const gkB = gk(startersB);
  const roll1 = (taker, keeper) => roll(st) < Math.max(0.45, Math.min(0.93, 0.76 + ((taker.r - 78) - (keeper.r - 78) * 0.6) / 250));
  let penA = 0; let penB = 0;
  for (let round = 1; round <= 20; round++) {
    const a = tA[(round - 1) % tA.length]; const okA = roll1(a, gkB); if (okA) penA++;
    events.push({ minute: 121, type: "shootout", side: "A", player: a.n, scored: okA });
    const b = tB[(round - 1) % tB.length]; const okB = roll1(b, gkA); if (okB) penB++;
    events.push({ minute: 121, type: "shootout", side: "B", player: b.n, scored: okB });
    if (round >= 5 && penA !== penB) break;
  }
  return { penA, penB, winner: penA > penB ? "A" : penB > penA ? "B" : roll(st) < 0.5 ? "A" : "B" };
}

export function simulateMatch(st, packA, packB) {
  const A = { starters: packA.starters.slice(), bench: packA.bench.slice(), subsUsed: 0 };
  const B = { starters: packB.starters.slice(), bench: packB.bench.slice(), subsUsed: 0 };
  const events = [];
  let scoreA = 0; let scoreB = 0;
  const subA = pickSubMinutes(st); const subB = pickSubMinutes(st);
  const segment = (from, to, fatigue) => {
    const sa = segStrength(A.starters); const sb = segStrength(B.starters);
    const xgA = expectedGoals(sa.attack, sb.defense, sa.mid, sb.mid) * fatigue;
    const xgB = expectedGoals(sb.attack, sa.defense, sb.mid, sa.mid) * fatigue;
    for (let min = from; min <= to; min++) {
      if (roll(st) < xgA / 90) { scoreA++; events.push({ minute: min, type: "goal", side: "A", player: pickScorer(st, A.starters).n }); }
      if (roll(st) < xgB / 90) { scoreB++; events.push({ minute: min, type: "goal", side: "B", player: pickScorer(st, B.starters).n }); }
      if (subA.includes(min)) trySubstitute(st, A, min, events, "A");
      if (subB.includes(min)) trySubstitute(st, B, min, events, "B");
    }
  };
  let cursor = 1;
  for (const m of [...subA, ...subB].sort((a, b) => a - b)) { if (m > cursor) segment(cursor, m - 1, 1); cursor = Math.max(cursor, m); }
  if (cursor <= 90) segment(cursor, 90, 1);
  let extra = false; let pens = false; let penA = null; let penB = null; let winner;
  if (scoreA === scoreB) { extra = true; segment(91, 105, 1.08); segment(106, 120, 1.15); }
  if (scoreA !== scoreB) winner = scoreA > scoreB ? "A" : "B";
  else { pens = true; const p = penalties(st, A.starters, B.starters, events); penA = p.penA; penB = p.penB; winner = p.winner; }
  return { events, scoreA, scoreB, extra, pens, penA, penB, winner };
}

const matchEntry = (st, a, b, r) => ({
  home: { label: a.label, flag: a.flag, isYou: !!a.isYou }, away: { label: b.label, flag: b.flag, isYou: !!b.isYou },
  events: r.events, scoreHome: r.scoreA, scoreAway: r.scoreB, extra: r.extra, pens: r.pens, penHome: r.penA, penAway: r.penB,
  winner: r.winner === "A" ? "home" : "away", isYours: !!(a.isYou || b.isYou),
});

// Juega la Champions entera (16 equipos: tu once y 15 plantel rivales) y deja el resultado en el estado.
export function playCup(st) {
  if (st.phase !== "result") return { error: "Primero arma el equipo" };
  const s = structuredClone(st);
  const you = packFromSlots(s.slots, s.formation);
  const bots = shuffle(s, TEAMS).slice(0, 15).map((t) => botPack(s, t));
  let teams = [you, ...shuffle(s, bots)];
  const rounds = [];
  let eliminated = null;
  for (let ri = 0; teams.length > 1; ri++) {
    const name = ROUND_ORDER[ri];
    const matches = []; const winners = [];
    for (let i = 0; i < teams.length; i += 2) {
      const r = simulateMatch(s, teams[i], teams[i + 1]);
      matches.push(matchEntry(s, teams[i], teams[i + 1], r));
      winners.push(r.winner === "A" ? teams[i] : teams[i + 1]);
    }
    rounds.push({ name, matches });
    if (!eliminated && !winners.includes(you)) eliminated = name;
    teams = winners;
  }
  const champion = teams[0];
  s.cup = { rounds, eliminated, champion: champion.isYou ? "you" : champion.label };
  s.phase = "done";
  s.final = { average: avgOf(s), champion: champion.isYou, eliminated, championName: champion.isYou ? "Tu selección" : champion.label };
  return s;
}

// Contra un amigo: los dos equipos juegan UN partido (con prórroga y penales si hace falta). El azar sale de
// las dos semillas, así que cualquiera de los dos servidores da lo mismo.
export function playVersus(stA, stB, nameA, nameB) {
  const rng = { seed: (stA.seed ^ stB.seed) >>> 0, n: 0 };
  const a = { ...packFromSlots(stA.slots, stA.formation), label: nameA, isYou: false };
  const b = { ...packFromSlots(stB.slots, stB.formation), label: nameB, isYou: false };
  const r = simulateMatch(rng, a, b);
  return { entry: matchEntry(rng, a, b, r), winner: r.winner === "A" ? "A" : "B", avgA: avgOf(stA), avgB: avgOf(stB) };
}
// El mismo partido visto desde el otro lado (la «casa» pasa a ser quien lo mira).
export function flipEntry(e) {
  const swap = (side) => (side === "A" ? "B" : "A");
  return {
    home: e.away, away: e.home, scoreHome: e.scoreAway, scoreAway: e.scoreHome, extra: e.extra, pens: e.pens, penHome: e.penAway, penAway: e.penHome,
    winner: e.winner === "home" ? "away" : "home", isYours: true,
    events: e.events.map((ev) => (ev.side ? { ...ev, side: swap(ev.side) } : ev)),
  };
}

// El partido visto por quien juega de A (o de B): su equipo siempre queda de «casa» y marcado como suyo.
export function viewFor(entry, side) {
  const e = side === "A" ? entry : flipEntry(entry);
  return { ...e, home: { ...e.home, isYou: true }, away: { ...e.away, isYou: false }, isYours: true };
}

// La vista pública del torneo: todo el cuadro ya jugado.
function publicCup(cup) { return cup; }
