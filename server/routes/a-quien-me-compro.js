import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { dailySeed, rng, shuffle } from "../utils/futgames.js";
import { VALORES_MERCADO } from "../data/valores-mercado.js";

// ¿A quién me compro? (Fútbol 12 y juego diario): salen dos jugadores, se ve el valor
// de mercado del de la izquierda y hay que adivinar si el de la derecha vale más o menos
// (fácil) o más, igual o menos (difícil). Las 10 rondas salen de una semilla: la fecha en
// el juego diario (igual para todos, siempre difícil) o un texto al azar en las partidas
// libres. El valor del jugador de la derecha se queda en el servidor hasta que se responde.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;

// Valores del Modo DT (fórmula por nivel, edad y potencial) para los jugadores que no están
// en la lista curada a mano: ampliaron el pool de ~250 a más de 600 jugadores.
const VALORES_DT = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/valores-mercado-dt.json"), "utf-8"));
// Valores de mercado de Transfermarkt (top 250 general, por posición y mayores de 30, leídos de sus
// rankings públicos y cruzados por nombre con la base): son los que mandan. Después la lista curada
// a mano y, por último, la fórmula del Modo DT.
const VALORES_TM = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/valores-mercado-tm.json"), "utf-8"));
const valueOf = (name) => VALORES_TM[name] ?? VALORES_MERCADO[name] ?? VALORES_DT[name];

const ROUNDS = 10;
const POOL = BASE
  .filter((p) => valueOf(p.nombre) != null && (p.carrera || []).some((c) => c.fin === null || c.fin === undefined))
  .map((p) => {
    const current = (p.carrera || []).find((c) => c.fin === null || c.fin === undefined);
    return {
      name: p.nombre,
      position: p.posicion,
      club: (current?.club || "").replace(/\s*\((cedido|cantera)\)\s*$/i, ""),
      value: valueOf(p.nombre),
    };
  });

const seedOf = (v) => String(v || "").replace(/[^a-z0-9-]/gi, "").slice(0, 24);

// Fácil: el valor del rival es claramente distinto (nunca igual). Difícil: valores
// parecidos y, a veces, exactamente iguales.
function roundsFor(seed, difficulty) {
  const rand = rng(dailySeed(seed, `compro-${difficulty}`));
  const order = shuffle(POOL, rand);
  const used = new Set();
  const rounds = [];
  for (const left of order) {
    if (rounds.length >= ROUNDS) break;
    if (used.has(left.name)) continue;
    const wantEqual = difficulty === "dificil" && rand() < 0.2;
    const candidates = order.filter((r) => {
      if (r.name === left.name || used.has(r.name)) return false;
      const ratio = Math.max(r.value, left.value) / Math.min(r.value, left.value);
      if (difficulty === "facil") return ratio >= 1.5 && ratio <= 8;
      return wantEqual ? r.value === left.value : r.value !== left.value && ratio <= 1.7;
    });
    const right = candidates[Math.floor(rand() * candidates.length)];
    if (!right) continue;
    used.add(left.name);
    used.add(right.name);
    rounds.push({ left, right });
  }
  return rounds;
}

function resolve(req) {
  const daily = req.query.mode === "daily" || req.body?.mode === "daily";
  const src = req.method === "GET" ? req.query : req.body || {};
  const difficulty = daily || src.difficulty === "dificil" ? "dificil" : "facil";
  const seed = daily ? todayStr() : seedOf(src.seed) || "libre";
  return { daily, difficulty, seed, rounds: roundsFor(seed, difficulty) };
}

const router = Router();
router.use(requireAuth);

router.get("/game", (req, res) => {
  const { daily, difficulty, seed, rounds } = resolve(req);
  res.json({
    daily, difficulty, seed, total: rounds.length,
    rounds: rounds.map(({ left, right }, i) => ({
      i,
      left,
      right: { name: right.name, position: right.position, club: right.club },
    })),
  });
});

router.post("/answer", (req, res) => {
  const { rounds } = resolve(req);
  const round = rounds[Math.floor(Number(req.body?.i))];
  if (!round) return res.status(400).json({ error: "Ronda desconocida" });
  const guess = String(req.body?.guess || "");
  const truth = round.right.value > round.left.value ? "mayor" : round.right.value < round.left.value ? "menor" : "igual";
  res.json({ correct: guess === truth, truth, rightValue: round.right.value, leftValue: round.left.value });
});

export default router;
