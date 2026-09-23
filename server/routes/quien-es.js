import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;

const router = Router();
router.use(requireAuth);

// Evita que alguien prueba a las patadas cientos de nombres por minuto.
const guessLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: "Muchos intentos seguidos, esperá un momento." });

// "¿Quién es?": se muestra la carrera del jugador club por club (con años) y
// hay que adivinarlo antes de la última pista. Sin estado en la base: el
// secreto viaja en un token firmado (solo el servidor puede leerlo) y cada
// pista se pide de a una, así que la respuesta nunca llega entera al cliente.

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const SUFFIX = /\s*\((cedido|cantera)\)\s*$/i;

// Jugadores con carrera suficiente para armar pistas (3+ clubes distintos).
const CANDIDATES = ALL.filter((p) => new Set((p.carrera || []).map((c) => c.club.replace(SUFFIX, ""))).size >= 3);

function cluesFor(p) {
  const stints = [...p.carrera].sort((a, b) => (a.inicio || 0) - (b.inicio || 0));
  const clubs = stints.map((c) => {
    const base = c.club.replace(SUFFIX, "");
    const tag = /\(cedido\)/i.test(c.club) ? " (cedido)" : /\(cantera\)/i.test(c.club) ? " (cantera)" : "";
    const years = c.inicio ? ` · ${c.inicio}${c.fin === null ? "–hoy" : c.fin && c.fin !== c.inicio ? `–${c.fin}` : ""}` : "";
    return `${base}${tag}${years}`;
  });
  return [
    ...clubs.map((text, i) => ({ kind: "club", text, label: `Club ${i + 1}` })),
    { kind: "extra", label: "Posición", text: p.posicion },
    { kind: "extra", label: "Nacionalidad", text: p.nacionalidad },
    { kind: "extra", label: "Nació en", text: String(p.nacimiento) },
    { kind: "extra", label: "Empieza con", text: `${p.nombre[0].toUpperCase()}…` },
  ];
}

function open(token) {
  try {
    const { n } = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    return ALL.find((p) => p.nombre === n) || null;
  } catch {
    return null;
  }
}

router.get("/new", (req, res) => {
  const difficulty = req.query.difficulty === "facil" ? "facil" : "dificil";
  // La base viene de más a menos conocido: fácil = los primeros 400 con carrera larga.
  const pool = difficulty === "facil" ? CANDIDATES.slice(0, 400) : CANDIDATES;
  const p = pool[Math.floor(Math.random() * pool.length)];
  const clues = cluesFor(p);
  const token = jwt.sign({ n: p.nombre, u: req.userId }, process.env.JWT_SECRET, { expiresIn: "3h" });
  res.json({ token, total: clues.length, first: clues[0] });
});

router.get("/clue", (req, res) => {
  const p = open(req.query.token);
  if (!p) return res.status(400).json({ error: "Partida inválida o vencida" });
  const i = Number(req.query.i);
  const clues = cluesFor(p);
  if (!Number.isInteger(i) || i < 0 || i >= clues.length) return res.status(400).json({ error: "Pista inexistente" });
  res.json({ clue: clues[i] });
});

router.post("/guess", guessLimiter, (req, res) => {
  const p = open(req.body?.token);
  if (!p) return res.status(400).json({ error: "Partida inválida o vencida" });
  const shown = Math.max(1, Number(req.body?.cluesShown) || 1);
  const correct = norm(req.body?.name) === norm(p.nombre);
  if (!correct) return res.json({ correct: false });
  res.json({ correct: true, name: p.nombre, points: Math.max(10, 100 - 10 * (shown - 1)) });
});

router.post("/reveal", (req, res) => {
  const p = open(req.body?.token);
  if (!p) return res.status(400).json({ error: "Partida inválida o vencida" });
  res.json({ name: p.nombre });
});

export default router;
