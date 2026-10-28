// Formato único de partido simulado de Futotal 2.0 (`SimMatch`) y los adaptadores que traducen la
// salida de cada motor a ese formato. Los motores no cambian: solo cambia cómo se muestran.
//
// SimMatch = {
//   id, source: "sim:cartas" | "sim:copa" | "sim:subasta" | "sim:draft" | "sim:carrera" | "sim:dt",
//   teams: { home: { name, short, colors?: [a, b], crest?, isMe? }, away: {…} },
//   lineups?: { home: { formation?, players: [{ name, pos }] }, away: {…} },
//   events: [{ min, extra?, type, team: "home" | "away" | null, player?, assist?, in?, out?, x?, y?, text? }],
//   score: { home, away, pens?: { home, away } },
//   duration: 90 | 120, playback: { mode: "replay" | "live", speed: 1 | 2 | 4 },
// }
// Tipos de evento: kickoff, goal, own_goal, pen_goal, pen_miss, chance, save, yellow, red, sub,
// injury, ht, ft, shootout_kick.
export const EVENT_TYPES = ["kickoff", "goal", "own_goal", "pen_goal", "pen_miss", "chance", "save", "yellow", "red", "sub", "injury", "ht", "ft", "shootout_kick"];
const GOAL_TYPES = new Set(["goal", "pen_goal"]);

export const short = (name) => String(name || "").replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, "").trim().slice(0, 3).toUpperCase() || "EQ";

// Quién anotó un gol hacia qué marcador: el gol en contra suma al rival.
export function scoreOf(events) {
  const s = { home: 0, away: 0 };
  for (const e of events) {
    if (GOAL_TYPES.has(e.type) && e.team) s[e.team] += 1;
    else if (e.type === "own_goal" && e.team) s[e.team === "home" ? "away" : "home"] += 1;
  }
  return s;
}

// Problemas de un SimMatch (lista vacía si está bien): termina en `ft`, los eventos van ordenados y
// la suma de goles coincide con el marcador.
export function validateSimMatch(m) {
  const out = [];
  if (!m?.teams?.home?.name || !m?.teams?.away?.name) out.push("faltan los equipos");
  const ev = m?.events || [];
  if (!ev.length || ev[ev.length - 1].type !== "ft") out.push("el último evento tiene que ser «ft»");
  for (let i = 1; i < ev.length; i++) if (ev[i].min < ev[i - 1].min) { out.push("los eventos no están ordenados"); break; }
  for (const e of ev) if (!EVENT_TYPES.includes(e.type)) { out.push(`tipo desconocido: ${e.type}`); break; }
  const s = scoreOf(ev);
  if (m?.score && (s.home !== m.score.home || s.away !== m.score.away)) out.push(`el marcador (${m.score.home}-${m.score.away}) no coincide con los goles (${s.home}-${s.away})`);
  return out;
}

// Salida de utils/match-engine.js (Cartas y Copa semanal): { min, team, type: "goal" | "half" | "final" | "wo" | "penalties", text, player? }.
export function fromEngine({ id, source = "sim:cartas", events = [], home, away, lineups = null, speed = 1 }) {
  const out = [{ min: 0, type: "kickoff", team: null }];
  let hasFt = false;
  let pens = null;
  for (const e of [...events].sort((a, b) => a.min - b.min)) {
    if (e.type === "goal") out.push({ min: e.min, type: "goal", team: e.team, player: e.player, text: e.text });
    else if (e.type === "half") out.push({ min: 45, type: "ht", team: null });
    else if (e.type === "final") { out.push({ min: 90, type: "ft", team: null }); hasFt = true; }
    else if (e.type === "penalties") pens = e.team;
    else if (e.type === "wo") out.push({ min: 0, type: "chance", team: null, text: e.text });
  }
  if (!hasFt) out.push({ min: 90, type: "ft", team: null });
  const score = scoreOf(out);
  if (pens) score.pens = { winner: pens };
  return {
    id: id || `${source}:${out.map((e) => `${e.min}${e.type[0]}${e.team?.[0] || ""}`).join("")}:${home.name}:${away.name}`, source,
    teams: { home: { name: home.name, short: short(home.name), isMe: !!home.isMe, colors: home.colors }, away: { name: away.name, short: short(away.name), isMe: !!away.isMe, colors: away.colors } },
    lineups, events: out, score, duration: 90, playback: { mode: "replay", speed },
  };
}

// Salida de la Subasta (`match` de LivePitch): { goalsA, goalsB, scorersA, scorersB, minsA, minsB, chances }.
export function fromSubasta({ id, match, home, away, lineups = null }) {
  const out = [{ min: 0, type: "kickoff", team: null }, { min: 45, type: "ht", team: null }];
  (match.minsA || []).forEach((min, i) => out.push({ min, type: "goal", team: "home", player: match.scorersA?.[i] }));
  (match.minsB || []).forEach((min, i) => out.push({ min, type: "goal", team: "away", player: match.scorersB?.[i] }));
  const busy = new Set(out.map((e) => e.min));
  (match.chances || []).forEach((c, i) => {
    const min = typeof c === "number" ? c : c?.min;
    if (min == null || busy.has(min)) return;
    busy.add(min);
    out.push({ min, type: "chance", team: (typeof c === "object" && c.team) || (i % 2 ? "away" : "home") });
  });
  out.push({ min: 90, type: "ft", team: null });
  out.sort((a, b) => a.min - b.min || (a.type === "ft") - (b.type === "ft"));
  return {
    id: id || `sim:subasta:${out.map((e) => `${e.min}${e.type[0]}${e.team?.[0] || ""}`).join("")}:${home.name}:${away.name}`, source: "sim:subasta",
    teams: { home: { name: home.name, short: short(home.name) }, away: { name: away.name, short: short(away.name) } },
    lineups, events: out, score: scoreOf(out), duration: 90, playback: { mode: "replay", speed: 1 },
  };
}
