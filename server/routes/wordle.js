import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { LEAGUES, leagueForClub } from "../data/league-clubs.js";

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

function leagueOf(player) {
  return leagueForClub(currentClubOf(player)) || "";
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
function similarity(guess, secret) {
  if (guess.nombre === secret.nombre) return 100;
  const guessClub = currentClubOf(guess);
  const sameTeam = guessClub != null && normalize(guessClub) === normalize(currentClubOf(secret));
  const samePosition = normalize(guess.posicion) === normalize(secret.posicion);
  const sameNationality = normalize(guess.nacionalidad) === normalize(secret.nacionalidad);
  const gl = leagueOf(guess);
  const sameLeague = gl !== "" && gl === leagueOf(secret);
  const ageCloseness = clamp(1 - Math.abs((guess.nacimiento || 0) - (secret.nacimiento || 0)) / 15, 0, 1);

  if (sameTeam || (sameNationality && samePosition)) {
    let t = 0.5;
    if (sameTeam && sameNationality) t += 0.22;
    if (sameLeague) t += 0.1;
    t += ageCloseness * 0.16;
    return Math.round(lerp(80, 98, clamp(t, 0, 1)));
  }
  const minor = [sameLeague, samePosition, sameNationality].filter(Boolean).length;
  if (minor >= 2) {
    let t = 0.28;
    if (minor >= 3) t += 0.22;
    t += ageCloseness * 0.25;
    return Math.round(lerp(40, 65, clamp(t, 0, 1)));
  }
  if (minor === 1) {
    let t = 0.15 + ageCloseness * 0.3;
    if (samePosition) t += 0.2;
    return Math.round(lerp(15, 30, clamp(t, 0, 1)));
  }
  return Math.round(lerp(0, 15, clamp(ageCloseness * 0.55, 0, 1)));
}

function leagueLabel(key) {
  return LEAGUES.find((l) => l.key === key)?.label || null;
}

function feedbackFor(guess, secret) {
  const guessClub = currentClubOf(guess);
  const secretClub = currentClubOf(secret);
  const birthDirection =
    guess.nacimiento === secret.nacimiento ? "match" : guess.nacimiento < secret.nacimiento ? "up" : "down";
  const gl = leagueOf(guess);

  return {
    name: guess.nombre,
    similarity: similarity(guess, secret),
    nationality: { value: guess.nacionalidad, match: normalize(guess.nacionalidad) === normalize(secret.nacionalidad) },
    position: { value: guess.posicion, match: normalize(guess.posicion) === normalize(secret.posicion) },
    birth_year: { value: guess.nacimiento, direction: birthDirection },
    club: { value: guessClub, match: guessClub != null && normalize(guessClub) === normalize(secretClub) },
    league: { value: leagueLabel(gl) || "Otra", match: gl !== "" && gl === leagueOf(secret) },
  };
}

function hintText(secret, kind) {
  switch (kind) {
    case "position": return `Posición: ${secret.posicion}`;
    case "league": return `Liga: ${leagueLabel(leagueOf(secret)) || "otra liga"}`;
    case "nationality": return `Nacionalidad: ${secret.nacionalidad}`;
    case "age": return `Nació en ${secret.nacimiento}`;
    default: return `Club actual: ${currentClubOf(secret) || "sin club"}`;
  }
}

// Puntos de la partida (los que van al ranking semanal del grupo). Ganada:
// 40-100 según eficiencia, multiplicado por dificultad. Perdida: consuelo
// según lo cerca que llegaste.
function finalPoints({ won, guessesUsed, hintsUsed, difficulty, bestSimilarity }) {
  const mult = (DIFFICULTIES[difficulty] || DIFFICULTIES.normal).multiplier;
  if (won) {
    const cost = guessesUsed + hintsUsed * HINT_COST;
    const efficiency = clamp(1 - (cost - 1) / (MAX_ATTEMPTS - 1), 0, 1);
    return Math.round((40 + efficiency * 60) * mult);
  }
  return Math.round(bestSimilarity * 0.15 * mult);
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
  const guesses = guessNames.map((n) => feedbackFor(byName(n), secret));
  const hints = HINT_ORDER.slice(0, game.hints_used).map((k) => hintText(secret, k));
  const ended = game.status !== "playing";
  return {
    id: game.id,
    mode: game.mode,
    league: game.league,
    difficulty: game.difficulty,
    maxAttempts: game.max_attempts,
    hintsUsed: game.hints_used,
    hints,
    attemptsUsed: guesses.length + game.hints_used * HINT_COST,
    status: game.status,
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
          league: leagueLabel(leagueOf(secret)),
        }
      : null,
  };
}

async function closeGame(loaded, won) {
  const { game, guessNames } = loaded;
  const points = finalPoints({
    won,
    guessesUsed: guessNames.length,
    hintsUsed: game.hints_used,
    difficulty: game.difficulty,
    bestSimilarity: won ? 0 : bestSimilarityOf(guessNames, byName(game.secret_name)),
  });
  await db.execute({ sql: "UPDATE fichado_games SET status = ?, points = ? WHERE id = ?", args: [won ? "won" : "lost", points, game.id] });
  // La diaria ganada sigue sumando al ranking global de puntos (10 menos un
  // punto por cada intento extra, mínimo 1), como el viejo Fulbodle.
  if (won && game.mode === "daily") {
    await db.execute({
      sql: "INSERT OR IGNORE INTO wordle_results (user_id, date, league, attempts, points) VALUES (?, ?, ?, ?, ?)",
      args: [game.user_id, game.date, game.league, guessNames.length, Math.max(1, 10 - (guessNames.length - 1))],
    });
  }
}

// Cierra la partida si ya ganó o se quedó sin intentos, y devuelve el estado fresco.
async function settle(gameId, userId) {
  const loaded = await loadGame(gameId, userId);
  const { game, guessNames } = loaded;
  const won = guessNames.includes(game.secret_name);
  const used = guessNames.length + game.hints_used * HINT_COST;
  if (won || used >= game.max_attempts) {
    await closeGame(loaded, won);
    return loadGame(gameId, userId);
  }
  return loaded;
}

const router = Router();
router.use(requireAuth);

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
router.get("/game", async (req, res) => {
  const mode = req.query.mode === "random" ? "random" : "daily";
  const league = leagueKeyFrom(req.query.league);
  try {
    if (mode === "daily") {
      const date = todayStr();
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
    res.status(201).json({ game: serialize(await settle(game.id, req.userId)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/hint", async (req, res) => {
  const gameId = Number(req.body?.gameId);
  if (!Number.isInteger(gameId)) return res.status(400).json({ error: "Falta la partida" });
  try {
    const loaded = await loadGame(gameId, req.userId);
    if (!loaded) return res.status(404).json({ error: "Partida no encontrada" });
    const { game, guessNames } = loaded;
    if (game.status !== "playing") return res.status(400).json({ error: "Esta partida ya terminó" });
    if (game.hints_used >= HINT_ORDER.length) return res.status(400).json({ error: "Ya usaste todas las pistas" });
    if (guessNames.length + (game.hints_used + 1) * HINT_COST > game.max_attempts) {
      return res.status(400).json({ error: "No te alcanzan los intentos para otra pista" });
    }
    await db.execute({ sql: "UPDATE fichado_games SET hints_used = hints_used + 1 WHERE id = ?", args: [game.id] });
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

export default router;
