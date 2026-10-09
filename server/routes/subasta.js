import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware/auth.js";
import { draftPool } from "./cards.js";
import { simulateMatchScore, clamp } from "../utils/match-engine.js";

// Subasta: cada jugador tiene 1000 M y arma su once pujando por jugadores que salen
// en silueta negra. Este router solo entrega los jugadores de cada lote y simula la
// copa al final; la subasta en sí corre en el navegador del anfitrión (ver
// client/src/pages/Subasta.jsx) usando el relay de salas.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUTOUTS_FILE = path.join(__dirname, "../data/player-cutouts.json");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "../data", f), "utf8"));
// Valores de mercado reales (Transfermarkt, ver data/valores-mercado-tm.json) y la base de jugadores,
// para saber quién no tiene club (retirado o libre) y mostrarlo como "Sin club".
const VALORES_TM = readJson("valores-mercado-tm.json");
const NO_CLUB = new Set(readJson("equipo-jugador-players.json").jugadores
  .filter((p) => !(p.carrera || []).some((c) => c.fin === null || c.fin === undefined))
  .map((p) => p.nombre));

const router = Router();
router.use(requireAuth);

function loadCutouts() {
  try { return JSON.parse(fs.readFileSync(CUTOUTS_FILE, "utf8")); } catch { return {}; }
}

// Valor de mercado orientativo (en millones) según el nivel: lo usan los bots y la puja mínima.
export function valueOf(ovr) {
  if (ovr >= 92) return 150;
  if (ovr >= 90) return 120;
  if (ovr >= 88) return 90;
  if (ovr >= 86) return 70;
  if (ovr >= 84) return 55;
  if (ovr >= 82) return 42;
  if (ovr >= 80) return 32;
  if (ovr >= 78) return 24;
  if (ovr >= 76) return 18;
  return 10;
}
// Valor del jugador: el de Transfermarkt si lo tenemos, si no el orientativo por nivel.
const valueFor = (name, ovr) => VALORES_TM[name] ?? valueOf(ovr);
// La puja mínima es la mitad de su valor (de a 5 M, nunca menos de 5).
const minBidOf = (value) => Math.max(5, Math.round((value * 0.5) / 5) * 5);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Jugadores para los lotes: ?gk=&def=&mid=&fwd= cuántos de cada puesto (con foto sin fondo).
router.get("/pool", (req, res) => {
  const cut = loadCutouts();
  const have = draftPool().filter((p) => cut[p.name]);
  const want = { GK: Number(req.query.gk) || 0, DEF: Number(req.query.def) || 0, MID: Number(req.query.mid) || 0, FWD: Number(req.query.fwd) || 0 };
  const lots = [];
  for (const pos of Object.keys(want)) {
    const list = shuffle(have.filter((p) => p.pos === pos)).slice(0, Math.min(want[pos], 120));
    for (const p of list) {
      const value = valueFor(p.name, p.ovr);
      lots.push({ name: p.name, pos: p.pos, ovr: p.ovr, club: NO_CLUB.has(p.name) ? "Sin club" : p.club, nationality: p.nationality, photo: cut[p.name], minBid: minBidOf(value), value });
    }
  }
  res.json({ lots, available: have.length });
});

// Copa: `teams` = [{ id, name, xi: [{ name, pos, ovr }] }]; 2, 4 u 8 equipos. Devuelve las rondas con goles y goleadores.
router.post("/cup", (req, res) => {
  const teams = (Array.isArray(req.body?.teams) ? req.body.teams : []).slice(0, 8).map((t) => {
    const xi = (Array.isArray(t.xi) ? t.xi : []).slice(0, 11).map((p) => ({ name: String(p.name || "Suplente"), pos: String(p.pos || "MID"), ovr: clamp(Number(p.ovr) || 60, 40, 99) }));
    const avg = xi.length ? xi.reduce((s, p) => s + p.ovr, 0) / xi.length : 60;
    return { id: String(t.id), name: String(t.name || "Equipo").slice(0, 30), xi, avg: Math.round(avg * 10) / 10 };
  });
  if (![2, 4, 8].includes(teams.length)) return res.status(400).json({ error: "La copa es de 2, 4 u 8 equipos" });

  const scorersFor = (team, goals) => {
    const pool = team.xi.filter((p) => p.pos !== "GK");
    const weights = pool.map((p) => (p.pos === "FWD" ? 3 : p.pos === "MID" ? 1.6 : 0.5) * (p.ovr / 80));
    const total = weights.reduce((s, w) => s + w, 0) || 1;
    return Array.from({ length: goals }, () => {
      let r = Math.random() * total;
      for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i].name; }
      return pool[0]?.name || "—";
    });
  };

  function play(a, b) {
    const { homeGoals, awayGoals } = simulateMatchScore({ ovrHome: a.avg, ovrAway: b.avg, homeAdvantage: 0 });
    let winner = homeGoals > awayGoals ? a : awayGoals > homeGoals ? b : null;
    let penalties = null;
    if (!winner) {
      const pa = clamp(0.5 + (a.avg - b.avg) / 60, 0.3, 0.7);
      winner = Math.random() < pa ? a : b;
      penalties = winner === a ? "a" : "b";
    }
    // Minutos de cada gol y ocasiones sin gol: sirven para reproducir el partido minuto a minuto en la cancha.
    const minutes = (n) => Array.from({ length: n }, () => 2 + Math.floor(Math.random() * 87)).sort((x, y) => x - y);
    const chances = Array.from({ length: 4 + Math.floor(Math.random() * 6) }, () => ({ min: 3 + Math.floor(Math.random() * 85), team: Math.random() < 0.5 ? a.id : b.id }));
    return { a: a.id, b: b.id, goalsA: homeGoals, goalsB: awayGoals, scorersA: scorersFor(a, homeGoals), scorersB: scorersFor(b, awayGoals), minsA: minutes(homeGoals), minsB: minutes(awayGoals), chances, penalties, winner: winner.id };
  }

  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  let alive = shuffle(teams);
  const rounds = [];
  const names = { 8: "Cuartos de final", 4: "Semifinales", 2: "Final" };
  while (alive.length > 1) {
    const matches = [];
    for (let i = 0; i < alive.length; i += 2) matches.push(play(alive[i], alive[i + 1]));
    rounds.push({ name: names[alive.length] || "Ronda", matches });
    alive = matches.map((m) => byId[m.winner]);
  }
  res.json({ rounds, champion: alive[0].id, strengths: Object.fromEntries(teams.map((t) => [t.id, t.avg])) });
});

export default router;
