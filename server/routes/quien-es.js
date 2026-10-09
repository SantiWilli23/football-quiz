import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { todayStr } from "../utils/points.js";
import { dailySeed, wonChampions, BALON_DE_ORO } from "../utils/futgames.js";
import { leagueForClub } from "../data/league-clubs.js";

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
  const daily = req.query.mode === "daily";
  const difficulty = daily || req.query.difficulty === "facil" ? "facil" : "dificil";
  // La base viene de más a menos conocido: fácil = los primeros 400 con carrera larga.
  const pool = difficulty === "facil" ? CANDIDATES.slice(0, 400) : CANDIDATES;
  // El diario sale de la fecha: el mismo jugador para todos. Los demás modos, al azar.
  const p = daily ? pool[dailySeed(todayStr(), "quien-es") % pool.length] : pool[Math.floor(Math.random() * pool.length)];
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

// ---------- ¿Quién es? en vivo, versión Preguntas ----------
// Cada uno elige un jugador de la misma dificultad y se van haciendo preguntas de sí o no. Las
// responde el servidor con el jugador secreto de quien las recibe (viaja en un token firmado),
// así nadie puede mentir. La dificultad sale de qué tan conocido es el jugador (la base viene
// de más a menos conocido): fácil = los 200 primeros, medio = hasta el 700, difícil = el resto.
const TIERS = { facil: [0, 200], medio: [200, 700], dificil: [700, Infinity] };
const TIER_LABEL = { facil: "Fácil (los más conocidos)", medio: "Medio", dificil: "Difícil (los menos conocidos)" };
const tierOf = (name) => {
  const i = ALL.findIndex((p) => p.nombre === name);
  return Object.entries(TIERS).find(([, [a, b]]) => i >= a && i < b)?.[0] || "dificil";
};
const POSITIONS = ["Portero", "Defensa", "Mediocampista", "Delantero"];
const BIG_LEAGUES = [["premier", "Premier League"], ["laliga", "La Liga"], ["seriea", "Serie A"], ["bundesliga", "Bundesliga"]];
const baseClub = (c) => String(c || "").replace(SUFFIX, "");
const openClub = (p) => (p.carrera || []).find((c) => c.fin === null || c.fin === undefined)?.club || null;

const COUNTRIES = [...new Set(ALL.map((p) => p.nacionalidad))].sort((a, b) => a.localeCompare(b));
const CLUB_COUNT = new Map();
ALL.forEach((p) => new Set((p.carrera || []).map((c) => baseClub(c.club))).forEach((c) => CLUB_COUNT.set(c, (CLUB_COUNT.get(c) || 0) + 1)));
const CLUBS = [...CLUB_COUNT.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 220).sort((a, b) => a.localeCompare(b));

// Responde una pregunta sobre el jugador p. type: position | nation | league | club | born | flag.
function answerAbout(p, q) {
  const v = String(q?.value ?? "");
  switch (q?.type) {
    case "position": return norm(p.posicion) === norm(v);
    case "nation": return norm(p.nacionalidad) === norm(v);
    case "league": {
      const club = openClub(p);
      if (v === "otra") return !!club && !BIG_LEAGUES.some(([k]) => leagueForClub(baseClub(club)) === k);
      return !!club && leagueForClub(baseClub(club)) === v;
    }
    case "club": return (p.carrera || []).some((c) => norm(baseClub(c.club)) === norm(v));
    case "born": return Number(p.nacimiento) >= Number(v);
    case "flag":
      if (v === "retired") return !openClub(p);
      if (v === "champions") return wonChampions(p);
      if (v === "balon") return BALON_DE_ORO.includes(p.nombre);
      return false;
    default: return null;
  }
}

router.get("/preguntas/meta", (req, res) => {
  res.json({
    tiers: Object.keys(TIERS).map((id) => ({ id, label: TIER_LABEL[id] })),
    positions: POSITIONS,
    leagues: [...BIG_LEAGUES.map(([id, label]) => ({ id, label })), { id: "otra", label: "Otra liga" }],
    countries: COUNTRIES,
    clubs: CLUBS,
    names: ALL.map((p) => p.nombre).sort((a, b) => a.localeCompare(b)),
  });
});

// Valida el jugador que eligió alguien para la dificultad de la sala y le devuelve el token del secreto.
router.post("/preguntas/secret", (req, res) => {
  const name = String(req.body?.name || "");
  const difficulty = TIERS[req.body?.difficulty] ? req.body.difficulty : "medio";
  const p = ALL.find((x) => x.nombre === name);
  if (!p) return res.status(400).json({ ok: false, error: "Ese jugador no está en la base: elegilo de la lista." });
  const tier = tierOf(p.nombre);
  if (tier !== difficulty) {
    return res.json({ ok: false, error: `${p.nombre} es de dificultad ${tier === "facil" ? "fácil" : tier === "medio" ? "media" : "difícil"} y la sala es ${difficulty === "facil" ? "fácil" : difficulty === "medio" ? "media" : "difícil"}. Cambialo por otro.` });
  }
  const token = jwt.sign({ n: p.nombre, u: req.userId, k: "pq" }, process.env.JWT_SECRET, { expiresIn: "3h" });
  res.json({ ok: true, token });
});

router.post("/preguntas/answer", (req, res) => {
  const p = open(req.body?.token);
  if (!p) return res.status(400).json({ error: "Partida inválida o vencida" });
  const answer = answerAbout(p, req.body?.q);
  if (answer === null) return res.status(400).json({ error: "Pregunta desconocida" });
  res.json({ answer });
});

router.post("/preguntas/check", guessLimiter, (req, res) => {
  const p = open(req.body?.token);
  if (!p) return res.status(400).json({ error: "Partida inválida o vencida" });
  const correct = norm(req.body?.name) === norm(p.nombre);
  res.json({ correct, ...(correct ? { name: p.nombre } : {}) });
});

router.post("/reveal", (req, res) => {
  const p = open(req.body?.token);
  if (!p) return res.status(400).json({ error: "Partida inválida o vencida" });
  res.json({ name: p.nombre });
});

export default router;
