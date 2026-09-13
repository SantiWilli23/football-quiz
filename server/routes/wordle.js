import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../data/equipo-jugador-players.json");
const RAW = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
const PLAYERS = RAW.jugadores;

const MAX_POINTS = 10;
const MIN_POINTS = 1;

function normalize(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // saca tildes
    .toLowerCase().trim();
}

// Hash determinístico y estable de la fecha (mismo jugador para todo el
// mundo el mismo día, sin tener que guardar nada en la base).
function hashDate(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function secretFor(dateStr) {
  const idx = hashDate(dateStr) % PLAYERS.length;
  return PLAYERS[idx];
}

// El "club actual": el que no tiene fecha de fin, o si ya se retiró de
// todos, el último por orden de inicio.
function currentClubOf(player) {
  const carrera = player.carrera || [];
  const active = carrera.find((c) => c.fin === null);
  if (active) return active.club;
  const last = [...carrera].sort((a, b) => (b.inicio || 0) - (a.inicio || 0))[0];
  return last?.club ?? null;
}

function feedbackFor(guess, secret) {
  const guessClub = currentClubOf(guess);
  const secretClub = currentClubOf(secret);
  const birthDirection =
    guess.nacimiento === secret.nacimiento ? "match" : guess.nacimiento < secret.nacimiento ? "up" : "down";

  return {
    name: guess.nombre,
    nationality: { value: guess.nacionalidad, match: normalize(guess.nacionalidad) === normalize(secret.nacionalidad) },
    position: { value: guess.posicion, match: normalize(guess.posicion) === normalize(secret.posicion) },
    birth_year: { value: guess.nacimiento, direction: birthDirection },
    club: { value: guessClub, match: guessClub != null && normalize(guessClub) === normalize(secretClub) },
  };
}

function pointsForAttempts(attempts) {
  return Math.max(MIN_POINTS, MAX_POINTS - (attempts - 1));
}

const router = Router();
router.use(requireAuth);

// Nombres para el autocompletado — se manda una sola vez, el cliente lo
// cachea (son 750, no vale la pena paginar).
router.get("/players", (req, res) => {
  res.json({ players: PLAYERS.map((p) => p.nombre).sort() });
});

router.get("/today", async (req, res) => {
  const date = todayStr();
  try {
    const guessesResult = await db.execute({
      sql: "SELECT attempt_number, guess_name, is_correct FROM wordle_guesses WHERE user_id = ? AND date = ? ORDER BY attempt_number",
      args: [req.userId, date],
    });
    const resultResult = await db.execute({
      sql: "SELECT attempts, points FROM wordle_results WHERE user_id = ? AND date = ?",
      args: [req.userId, date],
    });
    const secret = secretFor(date);
    const solved = resultResult.rows[0] || null;

    const guesses = guessesResult.rows.map((g) => feedbackFor(PLAYERS.find((p) => p.nombre === g.guess_name) || { nombre: g.guess_name, nacionalidad: "?", posicion: "?", nacimiento: 0, carrera: [] }, secret));

    res.json({
      date,
      attempts: guessesResult.rows.length,
      solved: !!solved,
      points: solved?.points ?? null,
      guesses,
      // Recién se revela el nombre una vez resuelto — antes solo se ve el feedback.
      secret_name: solved ? secret.nombre : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/guess", async (req, res) => {
  const guessName = String(req.body?.name || "").trim();
  if (!guessName) return res.status(400).json({ error: "Falta el nombre" });

  const date = todayStr();
  try {
    const already = await db.execute({
      sql: "SELECT id FROM wordle_results WHERE user_id = ? AND date = ?",
      args: [req.userId, date],
    });
    if (already.rows.length > 0) return res.status(400).json({ error: "Ya adivinaste el de hoy" });

    const guess = PLAYERS.find((p) => normalize(p.nombre) === normalize(guessName));
    if (!guess) return res.status(400).json({ error: "Ese jugador no está en la lista — elegilo del buscador" });

    const countResult = await db.execute({
      sql: "SELECT COUNT(*) AS c FROM wordle_guesses WHERE user_id = ? AND date = ?",
      args: [req.userId, date],
    });
    const attemptNumber = Number(countResult.rows[0].c) + 1;

    const secret = secretFor(date);
    const isCorrect = normalize(guess.nombre) === normalize(secret.nombre);

    await db.execute({
      sql: "INSERT INTO wordle_guesses (user_id, date, attempt_number, guess_name, is_correct) VALUES (?, ?, ?, ?, ?)",
      args: [req.userId, date, attemptNumber, guess.nombre, isCorrect ? 1 : 0],
    });

    let points = null;
    if (isCorrect) {
      points = pointsForAttempts(attemptNumber);
      await db.execute({
        sql: "INSERT INTO wordle_results (user_id, date, attempts, points) VALUES (?, ?, ?, ?)",
        args: [req.userId, date, attemptNumber, points],
      });
    }

    res.status(201).json({
      feedback: feedbackFor(guess, secret),
      attempt: attemptNumber,
      solved: isCorrect,
      points,
      secret_name: isCorrect ? secret.nombre : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
