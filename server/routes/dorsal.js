import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";
import { normalize } from "../utils/futgames.js";

// Dorsal histórico (online, "quién dice más"): se da un club y un número y cada
// jugador tiene 60 segundos para nombrar a los que usaron esa camiseta. Los
// dorsales son los más conocidos (ver data/dorsales.json). Las respuestas se
// quedan en el servidor: el cliente solo pregunta si un nombre vale.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/dorsales.json"), "utf-8")).prompts;
// Nombres de toda la base de jugadores: sirven para sugerir mientras se escribe.
const ALL_NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores
  .map((p) => p.nombre)
  .sort((a, b) => a.localeCompare(b));
// Los más fáciles: dorsales con al menos 5 nombres posibles, así hay más para decir.
const EASY_PROMPTS = PROMPTS.filter((p) => p.players.length >= 5);

// Un nombre vale si coincide con el nombre completo o con el apellido (o el primer
// nombre) siempre que no sea ambiguo dentro de esa lista. Sin tildes ni mayúsculas.
function keysFor(prompt) {
  const entries = prompt.players.map((name) => {
    const tokens = normalize(name).split(" ").filter(Boolean);
    return { name, full: tokens.join(" "), first: tokens[0], last: tokens[tokens.length - 1], single: tokens.length === 1 };
  });
  const count = (k, f) => entries.filter((e) => e[f] === k).length;
  return entries.map((e) => ({
    name: e.name,
    keys: new Set([e.full, e.last, e.first].filter((k) => k && (k === e.full || (count(k, "last") + count(k, "first") === 1)))),
  }));
}
const KEYS = new Map(PROMPTS.map((p) => [p.id, keysFor(p)]));

const router = Router();
router.use(requireAuth);

router.get("/names", (req, res) => {
  res.json({ names: ALL_NAMES });
});

// Pista de mitad de ronda: las iniciales de quienes usaron el dorsal (sin dar el nombre).
router.get("/hints", (req, res) => {
  const p = PROMPTS.find((x) => x.id === String(req.query.promptId || ""));
  if (!p) return res.status(404).json({ error: "Dorsal desconocido" });
  const initials = p.players.map((n) => n.split(" ").filter(Boolean).map((w) => w[0].toUpperCase() + ".").join(" "));
  res.json({ initials });
});

router.get("/prompts", (req, res) => {
  res.json({ prompts: (EASY_PROMPTS.length ? EASY_PROMPTS : PROMPTS).map((p) => ({ id: p.id, club: p.club, number: p.number, total: p.players.length })) });
});

router.post("/check", (req, res) => {
  const list = KEYS.get(String(req.body?.promptId || ""));
  if (!list) return res.status(404).json({ error: "Dorsal desconocido" });
  const typed = normalize(req.body?.name || "").split(" ").filter(Boolean).join(" ");
  const hit = typed ? list.find((e) => e.keys.has(typed)) : null;
  res.json({ valid: !!hit, name: hit ? hit.name : null });
});

router.get("/answers", (req, res) => {
  const p = PROMPTS.find((x) => x.id === String(req.query.promptId || ""));
  if (!p) return res.status(404).json({ error: "Dorsal desconocido" });
  res.json({ players: p.players });
});

export default router;
