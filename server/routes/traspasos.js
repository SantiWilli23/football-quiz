import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { normalize } from "../utils/futgames.js";

// Traspasos a ciegas (juego diario, Fútbol 12): se muestra la línea de clubes de
// un jugador, sin nombre, y hay que adivinar quién es en 5 intentos. Arranca con
// los primeros 2 clubes de su carrera; cada fallo (o salto) suma uno más, y en los
// últimos intentos aparecen la posición y la nacionalidad. El jugador sale de la
// fecha (igual para todos) y se queda en el servidor: el cliente solo pide pistas y
// pregunta "¿es este?".
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;

const MAX = 5;
const START_STEPS = 2;
// Los más conocidos de la base (viene ordenada de más a menos famoso) con carrera
// lo bastante larga como para que haya historia que mostrar.
const POOL = PLAYERS.slice(0, 700).filter((p) => (p.carrera || []).length >= 4);

function secretFor(date) {
  let h = 0;
  for (const ch of `${date}|traspasos`) h = (h * 31 + ch.charCodeAt(0)) % 1000000007;
  return POOL[(h * 2654435761 >>> 0) % POOL.length];
}

const clean = (club) => String(club).replace(/\s*\((cedido|cantera)\)\s*$/i, "");
const tagOf = (club) => (/\(cedido\)/i.test(club) ? "cedido" : /\(cantera\)/i.test(club) ? "cantera" : null);

const router = Router();
router.use(requireAuth);

router.get("/puzzle", (req, res) => {
  const date = todayStr();
  const p = secretFor(date);
  const attempts = Math.max(0, Math.min(MAX - 1, Math.floor(Number(req.query.attempts) || 0)));
  const total = p.carrera.length;
  const shown = Math.min(total, START_STEPS + attempts);
  res.json({
    date,
    max: MAX,
    total,
    steps: p.carrera.slice(0, shown).map((c) => ({ club: clean(c.club), tag: tagOf(c.club), from: c.inicio, to: c.fin })),
    hints: {
      position: attempts >= 2 ? p.posicion : null,
      nationality: attempts >= 3 ? p.nacionalidad : null,
      born: attempts >= 4 ? p.nacimiento : null,
    },
    players: PLAYERS.map((x) => x.nombre).sort((a, b) => a.localeCompare(b)),
  });
});

router.post("/guess", (req, res) => {
  const p = secretFor(todayStr());
  res.json({ correct: normalize(req.body?.name) === normalize(p.nombre) });
});

router.get("/reveal", (req, res) => {
  const p = secretFor(todayStr());
  res.json({
    name: p.nombre,
    nationality: p.nacionalidad,
    position: p.posicion,
    career: p.carrera.map((c) => ({ club: clean(c.club), tag: tagOf(c.club), from: c.inicio, to: c.fin })),
  });
});

export default router;
