import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { dailyGameKeyFor, recordDailyResult } from "../utils/daily-games.js";
import { challengeFor } from "./daily-challenge.js";
import { LEAGUES, leagueForClub, wideLeagueLabelForClub } from "../data/league-clubs.js";
import { styleOf, styleLabel } from "../data/player-style.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../data/equipo-jugador-players.json");
const RAW = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
const ALL_PLAYERS = RAW.jugadores;

const LEAGUE_KEYS = new Set(LEAGUES.map((l) => l.key));

// El "club actual": el que no tiene fecha de fin, o si ya se retiró de
// todos, el último por orden de inicio. Se usa tanto para el feedback como
// para filtrar los jugadores de cada liga.
function currentClubOf(player) {
  const carrera = player.carrera || [];
  const active = carrera.find((c) => c.fin === null);
  if (active) return active.club;
  const last = [...carrera].sort((a, b) => (b.inicio || 0) - (a.inicio || 0))[0];
  return last?.club ?? null;
}

// Un pool de jugadores por liga — se calcula una sola vez al arrancar, no
// en cada request. "global" son todos; el resto, solo los del club actual
// en esa liga (ver server/data/league-clubs.js para el mapeo de nombres).
const PLAYERS_BY_LEAGUE = { global: ALL_PLAYERS };
for (const { key } of LEAGUES) {
  PLAYERS_BY_LEAGUE[key] = ALL_PLAYERS.filter((p) => leagueForClub(currentClubOf(p)) === key);
}

function leagueKeyFrom(raw) {
  const key = String(raw || "global");
  return LEAGUE_KEYS.has(key) ? key : "global";
}

function playersFor(leagueKey) {
  return PLAYERS_BY_LEAGUE[leagueKey] || PLAYERS_BY_LEAGUE.global;
}

function normalize(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // saca tildes
    .toLowerCase().trim();
}

// Hash determinístico y estable de la fecha (mismo jugador para todo el
// mundo el mismo día, sin tener que guardar nada en la base). Se combina
// con la liga para que cada una tenga su propio secreto.
function hashKey(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const MAX_ATTEMPTS = 8;
const HINT_COST = 3;
const HINT_ORDER = ["position", "league", "nationality", "age", "club"];
const DIFFICULTIES = {
  facil: { label: "Fácil", multiplier: 1, poolMax: 150, poolFraction: 0.3 },
  normal: { label: "Normal", multiplier: 1.3, poolMax: 350, poolFraction: 0.6 },
  dificil: { label: "Difícil", multiplier: 1.6, poolMax: null, poolFraction: 1 },
};

// La base viene ordenada de más a menos conocido, así que el "pool" de
// secretos de cada dificultad es un prefijo de la lista: fácil = solo cracks.
function secretPool(leagueKey, difficulty) {
  const players = playersFor(leagueKey);
  const d = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  if (d.poolMax == null) return players;
  const size = Math.max(Math.min(players.length, 12), Math.min(d.poolMax, Math.ceil(players.length * d.poolFraction)));
  return players.slice(0, Math.min(size, players.length));
}

function dailySecret(dateStr, leagueKey) {
  const players = secretPool(leagueKey, "normal");
  return players[hashKey(`${dateStr}|${leagueKey}`) % players.length];
}

function randomSecret(leagueKey, difficulty) {
  const pool = secretPool(leagueKey, difficulty);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Liga "ancha" para pista y parecido — no es la misma que filtra los pools
// jugables (esa sigue siendo solo las 4 de LEAGUES): esta también reconoce
// una docena de ligas más (Ligue 1, Süper Lig, Brasileirão...) para no
// mostrar "Otra" ni perder el punto de "misma liga" cuando dos jugadores
// están en una de esas ligas no jugables.
function leagueOf(player) {
  return wideLeagueLabelForClub(currentClubOf(player)) || "";
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(lo, hi, t) {
  return lo + (hi - lo) * t;
}

// Número de parecido 0-100 contra el secreto (100 solo si es el mismo).
// Mismos tramos que tenía Fichado: nada en común 0-15, un atributo 15-30,
// dos atributos 40-65, compañeros de equipo o compatriotas de misma posición 80-98.
// "sameStyle" (tipo de juego real, ver player-style.js) es la excepción: no
// cuenta como "campo mostrado" porque solo hay dato para jugadores
// conocidos, pero cuando existe pesa fuerte — es justamente lo que separa a
// Rodri (más parecido a Busquets) de Pedri, aunque los tres compartan
// nacionalidad y posición genérica.
function similarity(guess, secret) {
  if (guess.nombre === secret.nombre) return 100;
  const guessClub = currentClubOf(guess);
  const sameTeam = guessClub != null && normalize(guessClub) === normalize(currentClubOf(secret));
  const samePosition = normalize(guess.posicion) === normalize(secret.posicion);
  const sameNationality = normalize(guess.nacionalidad) === normalize(secret.nacionalidad);
  const gl = leagueOf(guess);
  const sameLeague = gl !== "" && gl === leagueOf(secret);
  const guessStyle = styleOf(guess);
  const sameStyle = guessStyle != null && guessStyle === styleOf(secret);
  const ageCloseness = clamp(1 - Math.abs((guess.nacimiento || 0) - (secret.nacimiento || 0)) / 15, 0, 1);

  if (sameTeam || (sameNationality && samePosition)) {
    let t = 0.5;
    if (sameTeam && sameNationality) t += 0.22;
    if (sameLeague) t += 0.1;
    if (sameStyle) t += 0.12;
    t += ageCloseness * 0.16;
    return Math.round(lerp(80, 98, clamp(t, 0, 1)));
  }
  const minor = [sameLeague, samePosition, sameNationality, sameStyle].filter(Boolean).length;
  if (minor >= 2) {
    let t = 0.28;
    if (minor >= 3) t += 0.22;
    t += ageCloseness * 0.25;
    return Math.round(lerp(40, 65, clamp(t, 0, 1)));
  }
  if (minor === 1) {
    let t = 0.15 + ageCloseness * 0.3;
    if (samePosition || sameStyle) t += 0.2;
    return Math.round(lerp(15, 30, clamp(t, 0, 1)));
  }
  return Math.round(lerp(0, 15, clamp(ageCloseness * 0.55, 0, 1)));
}

// El campo "style" solo se manda en modo fácil: ahí el pool de secretos son
// puros cracks conocidos (ver secretPool), así que el dato curado casi
// siempre existe. En normal/difícil el secreto puede ser cualquiera de la
// base y casi nunca va a tener un tipo de juego cargado — mostrar "sin
// dato" en la mayoría de los intentos sería más confuso que útil.
function feedbackFor(guess, secret, difficulty) {
  const guessClub = currentClubOf(guess);
  const secretClub = currentClubOf(secret);
  const birthDirection =
    guess.nacimiento === secret.nacimiento ? "match" : guess.nacimiento < secret.nacimiento ? "up" : "down";
  const gl = leagueOf(guess);

  const feedback = {
    name: guess.nombre,
    similarity: similarity(guess, secret),
    nationality: { value: guess.nacionalidad, match: normalize(guess.nacionalidad) === normalize(secret.nacionalidad) },
    position: { value: guess.posicion, match: normalize(guess.posicion) === normalize(secret.posicion) },
    birth_year: { value: guess.nacimiento, direction: birthDirection },
    club: { value: guessClub, match: guessClub != null && normalize(guessClub) === normalize(secretClub) },
    league: { value: gl || "Otra", match: gl !== "" && gl === leagueOf(secret) },
  };

  if (difficulty === "facil") {
    const guessStyle = styleOf(guess);
    const secretStyle = styleOf(secret);
    if (secretStyle) {
      feedback.style = { value: styleLabel(guessStyle) || "Sin dato", match: guessStyle != null && guessStyle === secretStyle };
    }
  }

  return feedback;
}

function hintText(secret, kind) {
  switch (kind) {
    case "position": return `Posición: ${secret.posicion}`;
    case "league": return `Liga: ${leagueOf(secret) || "otra liga"}`;
    case "nationality": return `Nacionalidad: ${secret.nacionalidad}`;
    case "age": return `Nació en ${secret.nacimiento}`;
    default: return `Club actual: ${currentClubOf(secret) || "sin club"}`;
  }
}

// Puntos de la partida — el mismo número que ve el jugador en pantalla es el
// que suma al ranking del grupo (antes eran dos escalas distintas: acá se
// unificaron). Ganada: 8-18 según eficiencia, multiplicado por dificultad
// (igual franja de "sesión" que los duelos). Perdida: consuelo chico según
// lo cerca que llegaste.
// Bonus opcional del modo "contra reloj": el cliente avisa que jugó con reloj y el
// tiempo lo mide el SERVIDOR (created_at de la partida), no el cliente.
function speedBonus(game, timed) {
  if (!timed) return 0;
  const started = Date.parse(String(game.created_at).replace(" ", "T") + "Z");
  if (!Number.isFinite(started)) return 0;
  const secs = (Date.now() - started) / 1000;
  return secs <= 60 ? 4 : secs <= 120 ? 2 : secs <= 180 ? 1 : 0;
}

// Mejor puntaje posible de la diaria (normal): ganar al primer intento,
// round(18 × 1.3) = 23, más 4 de bonus por rapidez.
const FICHADO_DAILY_BEST = 27;

function finalPoints({ won, guessesUsed, hintsUsed, difficulty, bestSimilarity }) {
  const mult = (DIFFICULTIES[difficulty] || DIFFICULTIES.normal).multiplier;
  if (won) {
    const cost = guessesUsed + hintsUsed * HINT_COST;
    const efficiency = clamp(1 - (cost - 1) / (MAX_ATTEMPTS - 1), 0, 1);
    return Math.round((8 + efficiency * 10) * mult);
  }
  return Math.round(bestSimilarity * 0.03 * mult);
}

function byName(name) {
  return ALL_PLAYERS.find((p) => p.nombre === name);
}

function findPlayer(leagueKey, name) {
  const wanted = normalize(name);
  return playersFor(leagueKey).find((p) => normalize(p.nombre) === wanted);
}

async function loadGame(gameId, userId) {
  const g = (await db.execute({ sql: "SELECT * FROM fichado_games WHERE id = ? AND user_id = ?", args: [gameId, userId] })).rows[0];
  if (!g) return null;
  const rows = (await db.execute({ sql: "SELECT guess_name FROM fichado_guesses WHERE game_id = ? ORDER BY attempt_number", args: [g.id] })).rows;
  return { game: g, guessNames: rows.map((r) => r.guess_name) };
}

function bestSimilarityOf(guessNames, secret) {
  return guessNames.reduce((m, n) => Math.max(m, similarity(byName(n), secret)), 0);
}

function serialize({ game, guessNames }) {
  const secret = byName(game.secret_name);
  const guesses = guessNames.map((n) => feedbackFor(byName(n), secret, game.difficulty));
  const hints = HINT_ORDER.slice(0, game.hints_used + (game.bonus_hints || 0)).map((k) => hintText(secret, k));
  const ended = game.status !== "playing";
  return {
    id: game.id,
    mode: game.mode,
    league: game.league,
    difficulty: game.difficulty,
    maxAttempts: game.max_attempts,
    hintsUsed: game.hints_used,
    bonusHintsUsed: game.bonus_hints || 0,
    hints,
    attemptsUsed: guesses.length + game.hints_used * HINT_COST,
    status: game.status,
    startedAt: game.created_at,
    points: game.points,
    guesses: guesses.reverse(), // el más reciente arriba
    // El secreto solo se revela al terminar — ganando O perdiendo.
    secret: ended
      ? {
          name: secret.nombre,
          club: currentClubOf(secret),
          nationality: secret.nacionalidad,
          position: secret.posicion,
          birth_year: secret.nacimiento,
          league: leagueOf(secret) || null,
          // El tipo de juego pesa en el puntaje en TODAS las dificultades,
          // pero solo se muestra como dato en fácil — en normal/difícil/la
          // diaria queda invisible: afecta el número de parecido pero nunca
          // aparece como pista ni al revelar el secreto.
          style: game.difficulty === "facil" ? styleLabel(styleOf(secret)) : null,
        }
      : null,
  };
}

// Racha de días consecutivos ganando la diaria de Fichado (mirando hacia
// atrás desde la fecha de esta partida) — se recalcula sola, sin guardar
// nada aparte de la propia tabla de partidas.
async function dailyWinStreakEndingOn(userId, dateStr) {
  const rows = (await db.execute({
    sql: "SELECT date FROM fichado_games WHERE user_id = ? AND mode = 'daily' AND status = 'won' ORDER BY date DESC LIMIT 60",
    args: [userId],
  })).rows.map((r) => r.date);
  const set = new Set(rows);
  let streak = 0;
  let d = dateStr;
  while (set.has(d)) {
    streak++;
    const [y, m, day] = d.split("-").map(Number);
    d = new Date(Date.UTC(y, m - 1, day - 1)).toISOString().slice(0, 10);
  }
  return streak;
}

const WILDCARD_STEP = 5;

// Cada WILDCARD_STEP días seguidos ganando la diaria, se suma un comodín (una
// pista gratis que no cuenta como intento). Idempotente: solo otorga una vez
// por hito de racha alcanzado.
async function maybeAwardWildcard(userId, streak) {
  if (streak < WILDCARD_STEP || streak % WILDCARD_STEP !== 0) return;
  const row = (await db.execute({ sql: "SELECT last_award_streak FROM fichado_wildcards WHERE user_id = ?", args: [userId] })).rows[0];
  if (row && row.last_award_streak >= streak) return;
  await db.execute({
    sql: `INSERT INTO fichado_wildcards (user_id, streak, last_award_streak, available) VALUES (?, ?, ?, 1)
          ON CONFLICT(user_id) DO UPDATE SET streak = excluded.streak, last_award_streak = excluded.streak, available = available + 1`,
    args: [userId, streak, streak],
  });
}

async function closeGame(loaded, won, opts = {}) {
  const { game, guessNames } = loaded;
  const points = finalPoints({
    won,
    guessesUsed: guessNames.length,
    hintsUsed: game.hints_used,
    difficulty: game.difficulty,
    bestSimilarity: won ? 0 : bestSimilarityOf(guessNames, byName(game.secret_name)),
  });
  const total = points + (won ? speedBonus(game, opts.timed) : 0);
  await db.execute({ sql: "UPDATE fichado_games SET status = ?, points = ? WHERE id = ?", args: [won ? "won" : "lost", total, game.id] });
  // La diaria ganada suma al ranking global el MISMO puntaje que ve el
  // jugador en pantalla (antes era un número aparte, más chico y sin
  // relación con la dificultad ni la velocidad — quedaba inconsistente).
  if (game.mode === "daily") {
    // Fichado es un juego diario: la diaria (dificultad normal) paga el mismo
    // tope que los demás diarios, en proporción al puntaje de la partida.
    // wordle_results queda con 0 puntos (solo marca que se ganó ese día) para
    // no contar dos veces.
    // Como juego diario: un solo jugador, si lo adivinás sumás y si no, no.
    await recordDailyResult(game.user_id, game.date, "fichado", won ? total / FICHADO_DAILY_BEST : 0, total);
  }
  if (won && game.mode === "daily") {
    await db.execute({
      sql: "INSERT OR IGNORE INTO wordle_results (user_id, date, league, attempts, points) VALUES (?, ?, ?, ?, 0)",
      args: [game.user_id, game.date, game.league, guessNames.length],
    });
    const streak = await dailyWinStreakEndingOn(game.user_id, game.date);
    await maybeAwardWildcard(game.user_id, streak);
  }
}

// Cierra la partida si ya ganó o se quedó sin intentos, y devuelve el estado fresco.
async function settle(gameId, userId, opts = {}) {
  const loaded = await loadGame(gameId, userId);
  const { game, guessNames } = loaded;
  const won = guessNames.includes(game.secret_name);
  const used = guessNames.length + game.hints_used * HINT_COST;
  if (won || used >= game.max_attempts) {
    await closeGame(loaded, won, opts);
    return loadGame(gameId, userId);
  }
  return loaded;
}

const router = Router();
router.use(requireAuth);

router.get("/wildcards", async (req, res) => {
  const row = (await db.execute({ sql: "SELECT streak, available FROM fichado_wildcards WHERE user_id = ?", args: [req.userId] })).rows[0];
  res.json({ streak: row?.streak || 0, available: row?.available || 0, step: WILDCARD_STEP });
});

router.get("/leagues", (req, res) => {
  res.json({
    leagues: LEAGUES.map((l) => ({ ...l, playerCount: playersFor(l.key).length })),
    difficulties: Object.entries(DIFFICULTIES).map(([id, d]) => ({ id, label: d.label, multiplier: d.multiplier })),
    maxAttempts: MAX_ATTEMPTS,
    hintCost: HINT_COST,
  });
});

// Nombres para el autocompletado — según la liga elegida (en "global" son todos).
router.get("/players", (req, res) => {
  const league = leagueKeyFrom(req.query.league);
  res.json({ players: playersFor(league).map((p) => p.nombre).sort() });
});

const DAILY_SQL = "SELECT id FROM fichado_games WHERE user_id = ? AND mode = 'daily' AND date = ? AND league = ?";

// Partida actual de un modo: la diaria (se crea sola la primera vez que se
// pide) o la aleatoria en curso (null si no hay ninguna empezada).
// Filtros del reto del día: "adiviná con solo jugadores jóvenes (o leyendas,
// porteros, de una liga...)". Se arma el pool con los más conocidos de cada filtro.
const RETO_FILTERS = {
  young: (p) => (p.nacimiento || 0) >= 2003,
  legends: (p) => (p.carrera || []).length > 0 && p.carrera[p.carrera.length - 1].fin !== null,
  keepers: (p) => p.posicion === "Portero",
  premier: (p) => leagueForClub((p.carrera || []).at(-1)?.club)?.key === "premier" || leagueForClub((p.carrera || []).at(-1)?.club) === "premier",
  laliga: (p) => leagueForClub((p.carrera || []).at(-1)?.club) === "laliga",
  seriea: (p) => leagueForClub((p.carrera || []).at(-1)?.club) === "seriea",
};

function retoSecret(dateStr, constraint) {
  const filter = RETO_FILTERS[constraint] || (() => true);
  const pool = playersFor("global").filter(filter).slice(0, 150);
  const list = pool.length ? pool : playersFor("global").slice(0, 150);
  return list[hashKey(`${dateStr}|reto|${constraint}`) % list.length];
}

router.get("/game", async (req, res) => {
  const mode = ["random", "reto"].includes(req.query.mode) ? req.query.mode : "daily";
  const league = mode === "random" ? leagueKeyFrom(req.query.league) : "global";
  try {
    if (mode === "reto") {
      // Reto del día de Fichado: una sola partida por día, con el secreto restringido.
      const date = todayStr();
      const challenge = challengeFor(date);
      if (!challenge.fichado) return res.json({ game: null, notFichado: true });
      let row = (await db.execute({ sql: "SELECT id FROM fichado_games WHERE user_id = ? AND mode = 'reto' AND date = ?", args: [req.userId, date] })).rows[0];
      if (!row) {
        const secret = retoSecret(date, challenge.fichado);
        await db.execute({
          sql: "INSERT INTO fichado_games (user_id, mode, league, difficulty, date, secret_name, max_attempts) VALUES (?, 'reto', 'global', 'normal', ?, ?, ?)",
          args: [req.userId, date, secret.nombre, MAX_ATTEMPTS],
        });
        row = (await db.execute({ sql: "SELECT id FROM fichado_games WHERE user_id = ? AND mode = 'reto' AND date = ?", args: [req.userId, date] })).rows[0];
      }
      return res.json({ game: serialize(await loadGame(row.id, req.userId)), challenge: { key: challenge.key, label: challenge.label } });
    }
    if (mode === "daily") {
      const date = todayStr();
      // Solo es el "juego diario" los días que le toca a Fichado.
      if (dailyGameKeyFor(date) !== "fichado") return res.json({ game: null, notToday: true });
      let row = (await db.execute({ sql: DAILY_SQL, args: [req.userId, date, league] })).rows[0];
      if (!row) {
        const secret = dailySecret(date, league);
        await db.execute({
          sql: "INSERT OR IGNORE INTO fichado_games (user_id, mode, league, difficulty, date, secret_name, max_attempts) VALUES (?, 'daily', ?, 'normal', ?, ?, ?)",
          args: [req.userId, league, date, secret.nombre, MAX_ATTEMPTS],
        });
        row = (await db.execute({ sql: DAILY_SQL, args: [req.userId, date, league] })).rows[0];
      }
      return res.json({ game: serialize(await loadGame(row.id, req.userId)) });
    }
    const row = (await db.execute({
      sql: "SELECT id FROM fichado_games WHERE user_id = ? AND mode = 'random' AND league = ? AND status = 'playing' ORDER BY id DESC LIMIT 1",
      args: [req.userId, league],
    })).rows[0];
    res.json({ game: row ? serialize(await loadGame(row.id, req.userId)) : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/new", async (req, res) => {
  const league = leagueKeyFrom(req.body?.league);
  const difficulty = DIFFICULTIES[req.body?.difficulty] ? req.body.difficulty : "normal";
  try {
    // Una sola aleatoria en curso por liga — la anterior, si quedó sin terminar, se pierde.
    await db.execute({
      sql: "UPDATE fichado_games SET status = 'lost' WHERE user_id = ? AND mode = 'random' AND league = ? AND status = 'playing'",
      args: [req.userId, league],
    });
    const secret = randomSecret(league, difficulty);
    const r = await db.execute({
      sql: "INSERT INTO fichado_games (user_id, mode, league, difficulty, date, secret_name, max_attempts) VALUES (?, 'random', ?, ?, ?, ?, ?)",
      args: [req.userId, league, difficulty, todayStr(), secret.nombre, MAX_ATTEMPTS],
    });
    res.status(201).json({ game: serialize(await loadGame(Number(r.lastInsertRowid), req.userId)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/guess", async (req, res) => {
  const gameId = Number(req.body?.gameId);
  const guessName = String(req.body?.name || "").trim();
  if (!Number.isInteger(gameId) || !guessName) return res.status(400).json({ error: "Falta el nombre" });
  try {
    const loaded = await loadGame(gameId, req.userId);
    if (!loaded) return res.status(404).json({ error: "Partida no encontrada" });
    const { game, guessNames } = loaded;
    if (game.status !== "playing") return res.status(400).json({ error: "Esta partida ya terminó" });

    const guess = findPlayer(game.league, guessName);
    if (!guess) return res.status(400).json({ error: "Ese jugador no está en la lista — elegilo del buscador" });
    if (guessNames.includes(guess.nombre)) return res.status(400).json({ error: `Ya probaste a ${guess.nombre}` });

    await db.execute({
      sql: "INSERT INTO fichado_guesses (game_id, attempt_number, guess_name) VALUES (?, ?, ?)",
      args: [game.id, guessNames.length + 1, guess.nombre],
    });
    res.status(201).json({ game: serialize(await settle(game.id, req.userId, { timed: !!req.body?.timed })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/hint", async (req, res) => {
  const gameId = Number(req.body?.gameId);
  const wantFree = !!req.body?.free;
  if (!Number.isInteger(gameId)) return res.status(400).json({ error: "Falta la partida" });
  try {
    const loaded = await loadGame(gameId, req.userId);
    if (!loaded) return res.status(404).json({ error: "Partida no encontrada" });
    const { game, guessNames } = loaded;
    if (game.status !== "playing") return res.status(400).json({ error: "Esta partida ya terminó" });
    const revealed = game.hints_used + (game.bonus_hints || 0);
    if (revealed >= HINT_ORDER.length) return res.status(400).json({ error: "Ya usaste todas las pistas" });

    if (wantFree) {
      const row = (await db.execute({ sql: "SELECT available FROM fichado_wildcards WHERE user_id = ?", args: [req.userId] })).rows[0];
      if (!row || row.available <= 0) return res.status(400).json({ error: "No tenés comodines disponibles" });
      await db.execute({ sql: "UPDATE fichado_wildcards SET available = available - 1 WHERE user_id = ?", args: [req.userId] });
      await db.execute({ sql: "UPDATE fichado_games SET bonus_hints = bonus_hints + 1 WHERE id = ?", args: [game.id] });
    } else {
      if (guessNames.length + (game.hints_used + 1) * HINT_COST > game.max_attempts) {
        return res.status(400).json({ error: "No te alcanzan los intentos para otra pista" });
      }
      await db.execute({ sql: "UPDATE fichado_games SET hints_used = hints_used + 1 WHERE id = ?", args: [game.id] });
    }
    res.json({ game: serialize(await settle(game.id, req.userId)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Rendirse: termina la partida como perdida y revela quién era.
router.post("/giveup", async (req, res) => {
  const gameId = Number(req.body?.gameId);
  try {
    const loaded = await loadGame(gameId, req.userId);
    if (!loaded) return res.status(404).json({ error: "Partida no encontrada" });
    if (loaded.game.status === "playing") await closeGame(loaded, false);
    res.json({ game: serialize(await loadGame(gameId, req.userId)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Historial y estadísticas del usuario: cuántas ganó/perdió, en cuántos
// intentos en promedio y la distribución de intentos de las últimas
// ganadas — para el panel de "Historial" de Fichado.
router.get("/stats", async (req, res) => {
  try {
    const games = (await db.execute({
      sql: `SELECT g.id, g.status, g.points, g.mode,
                   (SELECT COUNT(*) FROM fichado_guesses WHERE game_id = g.id) AS attempts
            FROM fichado_games g WHERE g.user_id = ? AND g.status != 'playing'
            ORDER BY g.id DESC LIMIT 200`,
      args: [req.userId],
    })).rows;
    const won = games.filter((g) => g.status === "won");
    const winRate = games.length ? Math.round((won.length / games.length) * 100) : 0;
    const avgAttempts = won.length ? Math.round((won.reduce((s, g) => s + g.attempts, 0) / won.length) * 10) / 10 : 0;
    const distribution = Array.from({ length: MAX_ATTEMPTS }, (_, i) => won.filter((g) => g.attempts === i + 1).length);
    res.json({ played: games.length, won: won.length, winRate, avgAttempts, distribution });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
