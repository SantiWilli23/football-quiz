import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { flagOf } from "../data/country-flags.js";
import { PYRAMID_PUZZLES } from "../data/pyramid-puzzles.js";
import {
  buildIndex, cellsForPlayer, dailySeed, generateGrid, GRID_MODES, normalize, pickSquadClub,
  pyramidOrder, rankRanges, scorePyramid, squadOf, squadRevealOrders, tierOfRank, validFor,
} from "../utils/futgames.js";

// Tres juegos diarios: Tateti (club/selección x club), Pirámide (ordenar 10
// jugadores por una estadística) y Torta de plantel (adivinar el club por las
// nacionalidades). El reto sale de la fecha, igual para todos; las respuestas
// se quedan en el server y el cliente solo pregunta "¿encaja?", "¿cuántas
// bien?" o "¿es este?". El estado de la partida vive en el cliente.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;
const INDEX = buildIndex(PLAYERS);

const router = Router();
router.use(requireAuth);

const withFlag = (c) => ({ ...c, flag: c.type === "pais" ? flagOf(c.name) : null });

// ---------- Tateti ----------

const GRID_POOLS = {
  facil: {
    clubs: ["Real Madrid", "Barcelona", "Manchester United", "Manchester City", "Chelsea", "Arsenal", "Liverpool", "Juventus", "AC Milan", "Inter Milan", "Bayern Munich", "Paris Saint-Germain", "Atletico Madrid", "Tottenham Hotspur", "Borussia Dortmund"],
    countries: ["España", "Francia", "Argentina", "Brasil", "Alemania", "Italia", "Inglaterra", "Portugal", "Países Bajos"],
  },
  medio: {
    clubs: ["Roma", "Marseille", "Newcastle United", "Aston Villa", "Benfica", "Fiorentina", "Ajax", "Monaco", "West Ham United", "Sevilla", "Lyon", "Valencia", "Everton", "Villarreal", "Napoli", "Lille", "Lazio", "Porto", "Bayer Leverkusen", "Sporting CP", "Galatasaray", "Fenerbahce", "Atalanta", "Real Sociedad", "Real Betis", "Leicester City", "Southampton", "Crystal Palace", "Udinese", "Celtic"],
    countries: ["Uruguay", "Bélgica", "Croacia", "Colombia", "Chile", "Dinamarca", "Senegal", "Costa de Marfil", "Nigeria", "Marruecos", "Suecia", "Polonia", "Serbia", "Suiza", "Escocia", "Estados Unidos", "Japón"],
  },
};

const gridCache = new Map();
function gridFor(mode, date) {
  const key = `${mode}|${date}`;
  if (!gridCache.has(key)) {
    if (gridCache.size > 20) gridCache.clear();
    gridCache.set(key, generateGrid({ index: INDEX, pools: GRID_POOLS, mode, date }));
  }
  return gridCache.get(key);
}
const gridMode = (m) => (m === "medio" ? "medio" : "facil");

router.get("/grid", (req, res) => {
  const mode = gridMode(req.query.mode);
  const date = todayStr();
  const g = gridFor(mode, date);
  res.json({
    date, mode,
    maxErrors: GRID_MODES[mode].maxErrors,
    rows: g.rows.map(withFlag),
    cols: g.cols.map(withFlag),
    players: PLAYERS.map((p) => p.nombre).sort((a, b) => a.localeCompare(b)),
  });
});

router.post("/grid/place", (req, res) => {
  const mode = gridMode(req.body?.mode);
  const name = String(req.body?.name || "");
  const filled = (Array.isArray(req.body?.filled) ? req.body.filled : []).map(Number).filter((n) => n >= 0 && n < 9);
  const player = PLAYERS.find((p) => p.nombre === name);
  if (!player) return res.status(400).json({ error: "Jugador desconocido" });
  const g = gridFor(mode, todayStr());
  res.json({ cells: cellsForPlayer(INDEX, g, name, filled) });
});

// Al terminar: hasta 5 respuestas posibles por casilla.
router.get("/grid/reveal", (req, res) => {
  const mode = gridMode(req.query.mode);
  const g = gridFor(mode, todayStr());
  const answers = [];
  for (const r of g.rows) for (const c of g.cols) answers.push(validFor(INDEX, r, c).sort().slice(0, 5));
  res.json({ answers });
});

// ---------- Pirámide ----------

function pyramidFor(date) {
  const p = PYRAMID_PUZZLES[dailySeed(date, "pyramid") % PYRAMID_PUZZLES.length];
  // Ids opacos por fecha: los de los datos delatan el orden (…-0 es el 1º).
  const entries = p.entries.map((e) => ({ ...e, id: dailySeed(date, e.id).toString(36) }));
  return { ...p, entries };
}

router.get("/pyramid", (req, res) => {
  const mode = req.query.mode === "facil" ? "facil" : "normal";
  const date = todayStr();
  const p = pyramidFor(date);
  const ranges = rankRanges(p.entries);
  const byId = Object.fromEntries(p.entries.map((e) => [e.id, e]));
  res.json({
    date, mode, category: p.category, unit: p.unit,
    players: pyramidOrder(p.entries, date).map((id) => ({
      id,
      name: byId[id].name,
      detail: byId[id].detail,
      // Fácil: la fila de la pirámide a la que pertenece (no la casilla).
      tier: mode === "facil" ? tierOfRank(ranges[id].first) : null,
    })),
  });
});

const placementFrom = (body) => (Array.isArray(body?.placement) ? body.placement.slice(0, 10) : []).map((x) => (x == null ? null : String(x)));

router.post("/pyramid/help", (req, res) => {
  const p = pyramidFor(todayStr());
  res.json({ correct: scorePyramid(p.entries, placementFrom(req.body)).correct });
});

router.post("/pyramid/submit", (req, res) => {
  const p = pyramidFor(todayStr());
  const placement = placementFrom(req.body);
  const { correct, slots } = scorePyramid(p.entries, placement);
  const byId = Object.fromEntries(p.entries.map((e) => [e.id, e]));
  res.json({
    correct,
    slots: slots.map((s) => ({ ...s, value: byId[s.id]?.value ?? null })),
  });
});

// ---------- Torta de plantel ----------

// Clubes con suficientes jugadores en la base y variedad de países.
const SQUAD_CANDIDATES = [...new Set(PLAYERS.flatMap((p) => (p.carrera || []).map((c) => c.club)))]
  .filter((club) => {
    const s = squadOf(PLAYERS, club);
    const total = s.reduce((n, c) => n + c.count, 0);
    return total >= 20 && s.length >= 6;
  })
  .sort();
const ALL_CLUBS = [...new Set(PLAYERS.flatMap((p) => (p.carrera || []).map((c) => c.club)))].sort((a, b) => a.localeCompare(b));

function squadFor(date) {
  const club = pickSquadClub(SQUAD_CANDIDATES, date);
  const countries = squadOf(PLAYERS, club);
  return { club, countries, reveal: squadRevealOrders(countries, date) };
}

router.get("/squad", (req, res) => {
  const date = todayStr();
  const s = squadFor(date);
  res.json({
    date,
    total: s.countries.reduce((n, c) => n + c.count, 0),
    countries: s.countries.map((c) => ({ country: c.country, flag: flagOf(c.country), count: c.count })),
    reveal: s.reveal,
    clubs: ALL_CLUBS,
  });
});

router.post("/squad/guess", (req, res) => {
  const s = squadFor(todayStr());
  res.json({ correct: normalize(req.body?.club) === normalize(s.club) });
});

router.get("/squad/reveal", (req, res) => {
  const s = squadFor(todayStr());
  res.json({ club: s.club, countries: s.countries.map((c) => ({ country: c.country, players: c.players })) });
});

export default router;
