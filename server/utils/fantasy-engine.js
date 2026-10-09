import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rng, shuffle, dailySeed } from "./futgames.js";
import { simulateMatchScore, clamp } from "./match-engine.js";
import { generateRoundRobin } from "./dt-match.js";
import { rateMatch } from "./match-ratings.js";

// Motor del Fantasy: arma los planteles de los clubes de la liga elegida (actual, o actual con leyendas
// en su mejor momento), reparte planteles iniciales de valor parecido, simula cada jornada de la liga real
// y calcula la calificación de 1 a 10 de cada jugador. Todo es determinístico a partir de una semilla.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POOL = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/fantasy-pool.json"), "utf8"));

export const FORMATIONS = {
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  "5-3-2": { GK: 1, DEF: 5, MID: 3, FWD: 2 },
};
export const POSITIONS = ["GK", "DEF", "MID", "FWD"];
export const slotsOf = (formation) => POSITIONS.flatMap((pos) => Array.from({ length: (FORMATIONS[formation] || FORMATIONS["4-3-3"])[pos] }, () => pos));
export const MENTALITIES = {
  defensiva: { GK: 1.03, DEF: 1.05, MID: 1, FWD: 0.96 },
  equilibrada: { GK: 1, DEF: 1, MID: 1, FWD: 1 },
  ofensiva: { GK: 1, DEF: 0.96, MID: 1.02, FWD: 1.05 },
};
export const LEAGUE_LABEL = { premier: "Premier League", laliga: "LaLiga" };
export const SQUAD_SHAPE = { GK: 2, DEF: 6, MID: 6, FWD: 4 }; // plantel inicial de 18
export const MAX_SQUAD = 28;
export const TOTAL_ROUNDS = 38;
const CLUB_KEEP = { GK: 3, DEF: 8, MID: 8, FWD: 6 }; // plantel de cada club en la liga

export function clubsOf(leagueKey) {
  return Object.values(POOL.clubs).filter((c) => c.league === leagueKey);
}

const strengthOf = (players) => {
  const top = [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 11);
  return top.reduce((s, p) => s + p.ovr, 0) / Math.max(1, top.length);
};

// Jugadores de la liga: cada uno pertenece a un club real. En el modo histórico las leyendas se reparten por
// los clubes (primero los más flojos) y cada club conserva a los mejores de cada puesto entre los actuales y
// las leyendas que le tocaron, así el plantel queda lo más fuerte posible.
export function buildLeaguePlayers(leagueKey, mode, seed) {
  const clubs = clubsOf(leagueKey);
  const byClub = new Map(clubs.map((c) => [c.id, POOL.players.filter((p) => p.club === c.id).map((p) => ({ ...p }))]));
  if (mode === "historica") {
    const rand = rng(seed >>> 0);
    const order = [...clubs].sort((a, b) => strengthOf(byClub.get(a.id)) - strengthOf(byClub.get(b.id))).map((c) => c.id);
    const legends = shuffle(POOL.legends.map((l) => ({ ...l })), rand).sort((a, b) => b.ovr - a.ovr);
    const received = new Map(clubs.map((c) => [c.id, { GK: 0, DEF: 0, MID: 0, FWD: 0 }]));
    const CAP = { GK: 1, DEF: 3, MID: 3, FWD: 3 };
    let dir = 1;
    let idx = 0;
    for (const l of legends) {
      // serpiente sobre los clubes: ida y vuelta, saltando a los que ya tienen su cupo de ese puesto
      let tries = 0;
      while (received.get(order[idx])[l.pos] >= CAP[l.pos] && tries < order.length * 2) {
        idx += dir;
        if (idx >= order.length) { idx = order.length - 1; dir = -1; } else if (idx < 0) { idx = 0; dir = 1; }
        tries += 1;
      }
      if (received.get(order[idx])[l.pos] >= CAP[l.pos]) continue;
      const clubId = order[idx];
      received.get(clubId)[l.pos] += 1;
      byClub.get(clubId).push({ ...l, club: clubId });
      idx += dir;
      if (idx >= order.length) { idx = order.length - 1; dir = -1; } else if (idx < 0) { idx = 0; dir = 1; }
    }
  }
  const out = [];
  for (const [clubId, list] of byClub) {
    for (const pos of POSITIONS) {
      list.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, CLUB_KEEP[pos]).forEach((p) => out.push({ ...p, club: clubId }));
    }
  }
  return out;
}

const sum = (l, f) => l.reduce((s, x) => s + f(x), 0);

// Planteles iniciales de valor parecido: cada participante recibe 2 arqueros, 6 defensas, 6 medios y 4
// delanteros sin repetir jugadores, y el valor total de todos queda dentro de un 4% del objetivo.
export function startingSquads(players, count, seed) {
  const rand = rng((seed ^ 0x9e3779b1) >>> 0);
  const free = players.map((p) => ({ ...p }));
  const values = free.map((p) => p.value).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)] || 10;
  const target = Math.round(18 * median * 1.6);
  const squads = [];
  for (let u = 0; u < count; u++) {
    let best = null;
    for (let attempt = 0; attempt < 700; attempt++) {
      const pick = [];
      const taken = new Set();
      for (const pos of POSITIONS) {
        const pool = free.filter((p) => p.pos === pos && !taken.has(p.id));
        const chosen = shuffle(pool, rand).slice(0, SQUAD_SHAPE[pos]);
        chosen.forEach((p) => taken.add(p.id));
        pick.push(...chosen);
      }
      const err = Math.abs(sum(pick, (p) => p.value) - target) / target;
      if (!best || err < best.err) best = { pick, err };
      if (err < 0.04) break;
    }
    best.pick.forEach((p) => { const i = free.findIndex((x) => x.id === p.id); if (i >= 0) free.splice(i, 1); });
    squads.push(best.pick);
  }
  return { squads, target };
}

// Mejor once posible de una lista de jugadores para una formación: [{ pid/id... }] por puesto, de mayor a menor nivel.
export function autoLineup(players, formation) {
  const slots = slotsOf(formation);
  const used = new Set();
  return slots.map((pos) => {
    const cand = players.filter((p) => p.pos === pos && !used.has(p.id)).sort((a, b) => b.ovr - a.ovr)[0];
    if (cand) used.add(cand.id);
    return cand ? cand.id : null;
  });
}

// Cuántos minutos juega cada uno en un club: el once base juega casi siempre, el resto rota.
function squadForMatch(players, rand) {
  const shape = FORMATIONS["4-3-3"];
  const starters = [];
  for (const pos of POSITIONS) {
    const list = players.filter((p) => p.pos === pos).sort((a, b) => (b.ovr + (b.form - 6.5) * 1.5) - (a.ovr + (a.form - 6.5) * 1.5));
    let need = shape[pos];
    const chosen = [];
    for (const p of list) {
      if (chosen.length >= need) break;
      // 12% de rotación: el titular descansa y entra el siguiente
      if (rand() < 0.12 && list.length > need + chosen.length) continue;
      chosen.push(p);
    }
    starters.push(...chosen.slice(0, need));
  }
  const bench = shuffle(players.filter((p) => !starters.includes(p) && p.pos !== "GK"), rand).slice(0, 3);
  return { starters, bench };
}

// Simula un partido entre dos clubes. Devuelve el marcador y las líneas de cada jugador que jugó.
function playMatch(home, away, homePlayers, awayPlayers, rand) {
  const ovrH = strengthOf(homePlayers);
  const ovrA = strengthOf(awayPlayers);
  const { homeGoals, awayGoals } = simulateMatchScore({ ovrHome: ovrH, ovrAway: ovrA, homeAdvantage: 2.2 });
  const side = (club, players, gf, ga) => {
    const { starters, bench } = squadForMatch(players, rand);
    const lines = [...starters.map((p) => ({ p, starter: true })), ...bench.map((p) => ({ p, starter: false }))];
    const stat = new Map(lines.map(({ p }) => [p.id, { goals: 0, assists: 0 }]));
    const field = lines.filter((l) => l.p.pos !== "GK");
    const weight = (l) => (l.p.pos === "FWD" ? 3.2 : l.p.pos === "MID" ? 1.7 : 0.55) * (l.p.ovr / 80) * (l.starter ? 1 : 0.55);
    const pickWeighted = (list, exclude) => {
      const cand = list.filter((l) => l.p.id !== exclude);
      const total = sum(cand, weight) || 1;
      let r = rand() * total;
      for (const l of cand) { r -= weight(l); if (r <= 0) return l; }
      return cand[0];
    };
    for (let g = 0; g < gf; g++) {
      const scorer = pickWeighted(field);
      if (!scorer) break;
      stat.get(scorer.p.id).goals += 1;
      if (rand() < 0.72) {
        const assister = pickWeighted(field, scorer.p.id);
        if (assister) stat.get(assister.p.id).assists += 1;
      }
    }
    const shotsOnTarget = ga + 2 + Math.floor(rand() * 4);
    return lines.map(({ p, starter }) => {
      const s = stat.get(p.id);
      const group = p.pos;
      const sheet = [
        { name: "totalGoals", value: s.goals }, { name: "goalAssists", value: s.assists },
        { name: "saves", value: group === "GK" ? Math.max(0, shotsOnTarget - ga) : 0 },
        { name: "goalsConceded", value: group === "GK" ? ga : 0 },
        { name: "totalShots", value: group === "FWD" ? Math.floor(rand() * 4) + s.goals : group === "MID" ? Math.floor(rand() * 2) + s.goals : s.goals },
        { name: "shotsOnTarget", value: s.goals + (group === "FWD" ? Math.floor(rand() * 2) : 0) },
        { name: "yellowCards", value: rand() < 0.1 ? 1 : 0 },
        { name: "redCards", value: rand() < 0.008 ? 1 : 0 },
        { name: "foulsCommitted", value: Math.floor(rand() * 3) },
        { name: "foulsSuffered", value: Math.floor(rand() * 3) },
        { name: "offsides", value: group === "FWD" ? Math.floor(rand() * 2) : 0 },
        { name: "ownGoals", value: 0 },
      ];
      let rating = rateMatch({ starter, stats: sheet }, group, gf, ga);
      rating += (p.ovr - 78) * 0.035 + (rand() - 0.5) * 0.9; // los mejores rinden algo más, y siempre hay azar
      rating = Math.round(clamp(rating, 3, 10) * 10) / 10;
      return { id: p.id, club, rating, goals: s.goals, assists: s.assists, starter };
    });
  };
  return { hg: homeGoals, ag: awayGoals, lines: [...side(home, homePlayers, homeGoals, awayGoals), ...side(away, awayPlayers, awayGoals, homeGoals)] };
}

// Fixture de la liga (doble ronda: 38 fechas con 20 clubes), igual cada temporada para la misma semilla.
export function fixturesFor(leagueKey, seed) {
  const ids = shuffle(clubsOf(leagueKey).map((c) => c.id), rng((seed ^ 0x51ed270b) >>> 0));
  return generateRoundRobin(ids).slice(0, TOTAL_ROUNDS);
}

// Simula una fecha de la liga. `playersByClub`: Map club -> [jugadores con id, pos, ovr, form]. Devuelve los
// partidos y las líneas de cada jugador (calificación, goles, asistencias).
export function simulateRound(leagueKey, seed, season, round, playersByClub) {
  const rand = rng(dailySeed(`${seed}|${season}|${round}`, "fantasy-round"));
  const fixtures = fixturesFor(leagueKey, seed)[round - 1] || [];
  const matches = [];
  const lines = [];
  for (const [home, away] of fixtures) {
    const r = playMatch(home, away, playersByClub.get(home) || [], playersByClub.get(away) || [], rand);
    matches.push({ home, away, hg: r.hg, ag: r.ag });
    lines.push(...r.lines);
  }
  return { matches, lines };
}

// Puntos de un participante en una fecha: la calificación de cada jugador de su once que jugó, ajustada por su mentalidad.
export function scoreLineup(lineupIds, playerById, linesById, mentality) {
  const mult = MENTALITIES[mentality] || MENTALITIES.equilibrada;
  let total = 0;
  const detail = [];
  for (const id of lineupIds) {
    if (id == null) continue;
    const p = playerById.get(id);
    const l = linesById.get(id);
    if (!p || !l) { if (p) detail.push({ id, rating: null }); continue; }
    const pts = Math.round(l.rating * (mult[p.pos] || 1) * 10) / 10;
    total += pts;
    detail.push({ id, rating: l.rating, points: pts, goals: l.goals, assists: l.assists });
  }
  return { points: Math.round(total * 10) / 10, detail };
}

// Evolución de un jugador: cada 5 fechas, si su forma es muy buena sube de nivel (y de precio) y si es mala baja.
export function progressPlayer(p, rating) {
  const form = Math.round((p.form * 0.7 + rating * 0.3) * 100) / 100;
  const played = p.played + 1;
  let { ovr, value } = p;
  if (played % 5 === 0) {
    if (form >= 7.3 && ovr < 99) { ovr += 1; value = Math.round(value * 1.07 * 10) / 10; }
    else if (form <= 5.6 && ovr > 55) { ovr -= 1; value = Math.max(1, Math.round(value * 0.93 * 10) / 10); }
  }
  return { form, played, ovr, value };
}

export const minBidFor = (value) => Math.max(1, Math.ceil(value / 2));
export const bankPrice = (value) => Math.round(value * 0.9 * 10) / 10;
