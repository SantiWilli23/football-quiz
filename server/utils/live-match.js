// Modelo único de partido (Futotal 2.0, sección 14 del traspaso): convierte lo que devuelve
// ESPN (resumen del partido) a una sola forma que usan todas las pantallas: marcador,
// minuto, alineaciones ubicadas en la cancha, eventos, estadísticas y comentarios.
// Es tolerante: ESPN no es una API oficial y cualquier campo puede faltar.

const STATUS = {
  STATUS_SCHEDULED: "NS",
  STATUS_FIRST_HALF: "1H",
  STATUS_HALFTIME: "HT",
  STATUS_SECOND_HALF: "2H",
  STATUS_FULL_TIME: "FT",
  STATUS_FINAL: "FT",
  STATUS_FINAL_AET: "AET",
  STATUS_END_OF_REGULATION: "FT",
  STATUS_FIRST_HALF_EXTRA_TIME: "ET",
  STATUS_SECOND_HALF_EXTRA_TIME: "ET",
  STATUS_HALFTIME_ET: "ET",
  STATUS_END_OF_EXTRATIME: "AET",
  STATUS_SHOOTOUT: "P",
  STATUS_FINAL_PEN: "PEN",
  STATUS_POSTPONED: "PST",
  STATUS_CANCELED: "PST",
  STATUS_SUSPENDED: "SUSP",
  STATUS_ABANDONED: "SUSP",
  STATUS_DELAYED: "SUSP",
};
export const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "P"]);
export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

export function statusOf(type = {}) {
  const known = STATUS[type.name];
  if (known) return known;
  if (type.state === "pre") return "NS";
  if (type.state === "post") return "FT";
  if (type.state === "in") return "1H";
  return "NS";
}

// Línea de la cancha de cada abreviatura de posición de ESPN (G, CD-L, LB, AM-R, F…).
// «depth» ordena los mediocampistas de más atrás a más adelante: LM/RM pueden ser la
// pareja de volantes de un 4-2-3-1 o los carrileros de un 4-4-2, y se resuelve con la formación.
export function classifyPosition(abbr = "") {
  const a = String(abbr).toUpperCase();
  if (a === "G" || a === "GK") return { line: "G", depth: 0 };
  if (/^(CD|CB|SW|LB|RB|LWB|RWB|WB|D)(-|$)/.test(a) || a === "D") return { line: "D", depth: 1 };
  if (/^(CF|F|ST|SS|LF|RF|FW)(-|$)/.test(a) || a === "F") return { line: "F", depth: 5 };
  if (/^AM/.test(a) || /^(LW|RW|W)(-|$)/.test(a)) return { line: "M", depth: 3 };
  if (/^DM/.test(a)) return { line: "M", depth: 1 };
  if (/^(LM|RM)(-|$)/.test(a)) return { line: "M", depth: 2 };
  if (/^(CM|M)(-|$)/.test(a) || a === "M") return { line: "M", depth: 2 };
  if (a === "SUB") return { line: null, depth: 0 };
  return { line: "M", depth: 2 }; // desconocida: se la trata como volante en vez de perderla
}

// Lado en la cancha según la abreviatura: izquierda, centro o derecha (visto desde su arco).
export function sideOf(abbr = "") {
  const a = String(abbr).toUpperCase();
  if (a.endsWith("-L") || /^(LB|LWB|LM|LF|LW)$/.test(a)) return "L";
  if (a.endsWith("-R") || /^(RB|RWB|RM|RF|RW)$/.test(a)) return "R";
  return "C";
}
// Orden de izquierda a derecha dentro de una fila: el lateral/carrilero pegado a la banda va
// más afuera que el central del mismo lado (LB, CD-L, CD, CD-R, RB).
export function lateralRank(abbr = "") {
  const a = String(abbr).toUpperCase();
  if (/^(LB|LWB|LM|LW|LF)$/.test(a)) return 0;
  if (a.endsWith("-L")) return 1;
  if (a.endsWith("-R")) return 3;
  if (/^(RB|RWB|RM|RW|RF)$/.test(a)) return 4;
  return 2;
}

export function parseFormation(formation) {
  const parts = String(formation || "").split("-").map((n) => Number(n));
  return parts.length >= 2 && parts.every((n) => Number.isInteger(n) && n > 0) && parts.reduce((a, b) => a + b, 0) === 10 ? parts : null;
}

// Si la fuente no trae la formación, se infiere contando por línea (4-3-3, 4-4-2…). Cuando
// hay mediocampistas atrasados (volantes) y adelantados (enganches), se parten en dos filas:
// 4-2-3-1 en vez de 4-5-1.
export function inferFormation(starters) {
  const count = { D: 0, F: 0, low: 0, high: 0 };
  for (const p of starters) {
    const { line, depth } = classifyPosition(p.pos);
    if (!line || line === "G") continue;
    if (line === "M") count[depth >= 3 ? "high" : "low"] += 1;
    else count[line] += 1;
  }
  const total = count.D + count.F + count.low + count.high;
  if (total !== 10) return null;
  return count.low && count.high ? `${count.D}-${count.low}-${count.high}-${count.F}` : `${count.D}-${count.low + count.high}-${count.F}`;
}

const asNum = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

// Ubica a los titulares en la cancha. y: 0 = su propio arco, 100 = arco rival; x: 0 a 100 de
// izquierda a derecha. Cada fila de la formación se llena con los jugadores que le tocan.
export function placeStarters(starters, formation) {
  const gk = starters.filter((p) => classifyPosition(p.pos).line === "G");
  const field = starters.filter((p) => classifyPosition(p.pos).line !== "G" && classifyPosition(p.pos).line !== null);
  const rowsSpec = parseFormation(formation) || parseFormation(inferFormation(starters)) || [4, 4, 2];
  const def = field.filter((p) => classifyPosition(p.pos).line === "D");
  const fwd = field.filter((p) => classifyPosition(p.pos).line === "F");
  const mid = field.filter((p) => classifyPosition(p.pos).line === "M").sort((a, b) => classifyPosition(a.pos).depth - classifyPosition(b.pos).depth);

  // Cuántos jugadores van en cada fila: la formación manda; lo que sobra o falta de una
  // línea se corre a la vecina para no perder a nadie.
  const rows = [];
  rowsSpec.forEach((n, i) => {
    const isFirst = i === 0;
    const isLast = i === rowsSpec.length - 1;
    rows.push({ want: n, kind: isFirst ? "D" : isLast ? "F" : "M", players: [] });
  });
  const take = (arr, n) => arr.splice(0, n);
  const pools = { D: [...def], F: [...fwd], M: [...mid] };
  for (const row of rows) row.players = take(pools[row.kind], row.want);
  // sobrantes → a la fila más cercana con lugar libre; faltantes → desde mediocampistas
  const leftovers = [...pools.D, ...pools.M, ...pools.F];
  for (const row of rows) {
    while (row.players.length < row.want && leftovers.length) row.players.push(leftovers.shift());
  }
  const placed = [];
  const lateral = (a, b) => lateralRank(a.pos) - lateralRank(b.pos) || (asNum(a.place) ?? 0) - (asNum(b.place) ?? 0);
  const n = rows.length;
  if (gk[0]) placed.push({ ...gk[0], x: 50, y: 6 });
  rows.forEach((row, ri) => {
    const sorted = [...row.players].sort(lateral);
    const y = 6 + ((ri + 1) / (n + 1)) * 88 + (ri === n - 1 ? 0 : 0);
    sorted.forEach((p, i) => placed.push({ ...p, x: Math.round(((i + 1) / (sorted.length + 1)) * 100), y: Math.round(y) }));
  });
  // si hay más de un arquero titular (dato raro) o alguien que no calzó, no se pierde
  for (const extra of gk.slice(1)) placed.push({ ...extra, x: 50, y: 6 });
  return placed;
}

const roundMinute = (display = "") => {
  const m = String(display).match(/(\d+)'(?:\+(\d+)')?/);
  return m ? { minute: Number(m[1]), stoppage: m[2] ? Number(m[2]) : 0 } : { minute: null, stoppage: 0 };
};

export function eventTypeOf(type = "", text = "") {
  const t = String(type).toLowerCase();
  if (t.startsWith("own-goal") || /own goal/i.test(text) && t.startsWith("goal")) return "own_goal";
  if (t.startsWith("penalty---scored") || t.startsWith("goal---penalty")) return "pen_goal";
  if (t.startsWith("penalty---missed") || t.startsWith("penalty---saved") || t.includes("penalty-miss")) return "pen_miss";
  if (t.startsWith("goal")) return "goal";
  if (t === "yellow-card") return "yellow";
  if (t === "red-card" || t === "yellow-red-card" || t.includes("second-yellow")) return "red";
  if (t === "substitution") return "sub";
  if (t.startsWith("var")) return "var";
  return null; // kickoff, halftime, corners… no son eventos de la línea de tiempo
}

function playerRef(map, athlete) {
  if (!athlete) return null;
  return map.get(String(athlete.id)) || { id: String(athlete.id), name: athlete.displayName || athlete.fullName || null };
}

// Normaliza el resumen de un partido de ESPN. `now` solo se usa para decidir qué tan viejo es el dato.
export function normalizeEspnSummary(json, { leagueKey = null, now = new Date() } = {}) {
  const comp = json?.header?.competitions?.[0] || {};
  const st = comp.status || {};
  const status = statusOf(st.type);
  const competitors = comp.competitors || [];
  const sideOfTeam = new Map(competitors.map((c) => [String(c.team?.id ?? c.id), c.homeAway]));
  const teamInfo = (c) => c && {
    id: String(c.team?.id ?? c.id),
    name: c.team?.displayName || c.team?.name || null,
    short: c.team?.abbreviation || null,
    logo: c.team?.logos?.[0]?.href || c.team?.logo || null,
    colors: { main: c.team?.color ? `#${c.team.color}` : null, alt: c.team?.alternateColor ? `#${c.team.alternateColor}` : null },
  };
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const scoreOf = (c) => (c && c.score !== undefined && c.score !== "" ? Number(c.score) : null);
  const shootout = {
    home: asNum(home?.shootoutScore),
    away: asNum(away?.shootoutScore),
  };

  // Alineaciones
  const lineups = {};
  const people = new Map();
  for (const r of json?.rosters || []) {
    const side = r.homeAway === "away" ? "away" : "home";
    const all = (r.roster || []).map((x) => ({
      id: String(x.athlete?.id ?? ""),
      name: x.athlete?.displayName || x.athlete?.fullName || null,
      short: x.athlete?.shortName || null,
      number: asNum(x.jersey),
      pos: x.position?.abbreviation || null,
      place: asNum(x.formationPlace),
      starter: !!x.starter,
      subbedIn: !!x.subbedIn,
      subbedOut: !!x.subbedOut,
      photo: x.athlete?.headshot?.href || null,
      rating: null,
      captain: false,
    }));
    for (const p of all) people.set(p.id, p);
    const starters = all.filter((p) => p.starter);
    const formation = parseFormation(r.formation) ? r.formation : inferFormation(starters);
    lineups[side] = {
      formation: formation || null,
      formationGiven: !!parseFormation(r.formation),
      probable: !!r.probable,
      coach: r.coach?.displayName || r.coach?.fullName || null,
      starters: placeStarters(starters, formation).map((p) => ({ id: p.id, number: p.number, name: p.name, short: p.short, photo: p.photo, pos: p.pos, line: classifyPosition(p.pos).line, side: sideOf(p.pos), x: p.x, y: p.y, rating: p.rating, captain: p.captain, subbedOut: p.subbedOut })),
      bench: all.filter((p) => !p.starter).map((p) => ({ id: p.id, number: p.number, name: p.name, short: p.short, photo: p.photo, pos: p.pos === "SUB" ? null : p.pos, subbedIn: p.subbedIn })),
    };
  }

  // Eventos de la línea de tiempo (goles, tarjetas, cambios, VAR)
  const events = [];
  for (const e of json?.keyEvents || []) {
    const type = eventTypeOf(e.type?.type, e.text);
    if (!type) continue;
    const { minute, stoppage } = roundMinute(e.clock?.displayValue);
    const team = sideOfTeam.get(String(e.team?.id)) || null;
    const parts = e.participants || [];
    const ev = { id: String(e.id), min: minute, stoppage, display: e.clock?.displayValue || "", type, team, detail: e.text || "" };
    if (type === "sub") {
      ev.in = playerRef(people, parts[0]?.athlete)?.name || null;
      ev.out = playerRef(people, parts[1]?.athlete)?.name || null;
      ev.playerId = parts[0]?.athlete ? String(parts[0].athlete.id) : null;
    } else {
      ev.player = playerRef(people, parts[0]?.athlete)?.name || null;
      ev.playerId = parts[0]?.athlete ? String(parts[0].athlete.id) : null;
      if (type === "goal" || type === "pen_goal") ev.assist = playerRef(people, parts[1]?.athlete)?.name || null;
    }
    events.push(ev);
  }
  events.sort((a, b) => (a.min ?? 0) + a.stoppage / 100 - ((b.min ?? 0) + b.stoppage / 100));

  // Marcas sobre cada jugador (gol, tarjeta, cambio) para dibujarlas en la alineación.
  const marks = new Map();
  const mark = (id, key) => { if (id) { const m = marks.get(id) || {}; m[key] = (m[key] || 0) + 1; marks.set(id, m); } };
  for (const e of events) {
    if (e.type === "goal" || e.type === "pen_goal") mark(e.playerId, "goals");
    if (e.type === "own_goal") mark(e.playerId, "ownGoals");
    if (e.type === "yellow") mark(e.playerId, "yellow");
    if (e.type === "red") mark(e.playerId, "red");
  }
  for (const side of Object.values(lineups)) {
    for (const p of side.starters) p.marks = marks.get(p.id) || {};
    for (const p of side.bench) p.marks = marks.get(p.id) || {};
  }

  // Estadísticas: [local, visita]
  const statOf = (team, name) => {
    const v = team?.statistics?.find((s) => s.name === name)?.displayValue;
    return v === undefined ? null : Number(String(v).replace("%", ""));
  };
  const teamsBox = json?.boxscore?.teams || [];
  const boxFor = (c) => teamsBox.find((t) => String(t.team?.id) === String(c?.team?.id ?? c?.id));
  const stat = (name) => [statOf(boxFor(home), name), statOf(boxFor(away), name)];
  const stats = {
    possession: stat("possessionPct"), shots: stat("totalShots"), onTarget: stat("shotsOnTarget"),
    corners: stat("wonCorners"), fouls: stat("foulsCommitted"), yellow: stat("yellowCards"), red: stat("redCards"),
    offsides: stat("offsides"), saves: stat("saves"),
  };

  const commentary = (json?.commentary || [])
    .filter((c) => c.text)
    .map((c) => ({ min: roundMinute(c.time?.displayValue).minute, display: c.time?.displayValue || "", text: c.text }))
    .slice(-120);

  const { minute, stoppage } = roundMinute(st.displayClock);
  return {
    id: String(json?.header?.id ?? comp.id ?? ""),
    source: "espn",
    league: leagueKey,
    status,
    live: LIVE_STATUSES.has(status),
    finished: FINISHED_STATUSES.has(status),
    detail: st.type?.shortDetail || st.type?.detail || "",
    minute: LIVE_STATUSES.has(status) ? minute : status === "HT" ? 45 : FINISHED_STATUSES.has(status) ? 90 : null,
    stoppage: LIVE_STATUSES.has(status) ? stoppage : 0,
    kickoff: comp.date || null,
    venue: json?.gameInfo?.venue?.fullName || null,
    teams: { home: teamInfo(home), away: teamInfo(away) },
    score: { home: scoreOf(home), away: scoreOf(away), pens: shootout.home !== null || shootout.away !== null ? shootout : null },
    lineups,
    events,
    stats,
    commentary,
    updatedAt: now.toISOString(),
  };
}

// Versión liviana desde el tablero del día (sin alineaciones ni eventos): sirve para listas.
export function normalizeEspnScoreboardEvent(ev, { leagueKey = null } = {}) {
  const comp = ev?.competitions?.[0] || {};
  const status = statusOf(ev?.status?.type || comp.status?.type);
  const side = (h) => comp.competitors?.find((c) => c.homeAway === h);
  const team = (c) => c && { id: String(c.team?.id), name: c.team?.displayName, short: c.team?.abbreviation, logo: c.team?.logo || null };
  return {
    id: String(ev?.id), source: "espn", league: leagueKey, status, live: LIVE_STATUSES.has(status), finished: FINISHED_STATUSES.has(status),
    detail: ev?.status?.type?.shortDetail || "", kickoff: ev?.date || null,
    minute: LIVE_STATUSES.has(status) ? roundMinute(ev?.status?.displayClock).minute : null,
    teams: { home: team(side("home")), away: team(side("away")) },
    score: { home: side("home")?.score !== undefined ? Number(side("home").score) : null, away: side("away")?.score !== undefined ? Number(side("away").score) : null },
  };
}
