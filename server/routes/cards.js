import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";
import { simulateMatchEvents } from "../utils/match-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;

const router = Router();
router.use(requireAuth);

// Álbum de cartas: cada jugador de la base única es una carta. La rareza sale de
// qué tan conocido es (la base viene ordenada de más a menos famoso). Se ganan
// sobres de 5 cartas: uno gratis por día, uno por cumplir el reto del día y
// uno por ganarle a alguien con tu equipo (máx. 2 por día). Con las cartas se
// arma un XI (1-4-3-3) que juega partidos automáticos contra la CPU o contra
// el equipo guardado de alguien de tu grupo; la química sale de los clubes y
// nacionalidades que comparten en sus carreras reales.

const TIERS = [
  { key: "estrella", label: "Estrella", base: 88, upTo: 150, weight: 3 },
  { key: "oro", label: "Oro", base: 80, upTo: 500, weight: 12 },
  { key: "plata", label: "Plata", base: 72, upTo: 1200, weight: 30 },
  { key: "bronce", label: "Bronce", base: 64, upTo: Infinity, weight: 55 },
];
const POS = { Portero: "GK", Defensa: "DEF", Mediocampista: "MID", Delantero: "FWD" };
const FORMATION = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

// Clubes grandes: pasar por 2 o más sube la rareza aunque el jugador esté al final de la base
// (las leyendas se cargaron después que las figuras actuales).
const BIG = new Set(["Real Madrid", "Barcelona", "Manchester United", "Manchester City", "Juventus", "AC Milan", "Inter Milan", "Bayern Munich", "Liverpool", "Chelsea", "Arsenal", "Paris Saint-Germain", "Atletico Madrid", "Borussia Dortmund"]);

const CARDS = ALL.map((p, i) => {
  const bigCount = new Set((p.carrera || []).map((c) => c.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "")).filter((c) => BIG.has(c))).size;
  const minTier = bigCount >= 3 ? 1 : bigCount >= 2 ? 2 : TIERS.length - 1;
  const tier = TIERS[Math.min(TIERS.findIndex((t) => i < t.upTo), minTier)];
  let h = 0;
  for (const ch of p.nombre) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  const clubs = new Set((p.carrera || []).map((c) => c.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "")));
  return {
    name: p.nombre,
    tier: tier.key,
    tierLabel: tier.label,
    ovr: tier.base + (h % 9),
    pos: POS[p.posicion] || "MID",
    nationality: p.nacionalidad,
    clubs,
    club: [...clubs].pop(),
  };
});
const BY_NAME = new Map(CARDS.map((c) => [c.name, c]));
const BY_TIER = Object.fromEntries(TIERS.map((t) => [t.key, CARDS.filter((c) => c.tier === t.key)]));
const pub = (c) => ({ name: c.name, tier: c.tier, tierLabel: c.tierLabel, ovr: c.ovr, pos: c.pos, nationality: c.nationality, club: c.club });

function drawCard() {
  let r = Math.random() * TIERS.reduce((s, t) => s + t.weight, 0);
  for (const t of TIERS) {
    r -= t.weight;
    if (r <= 0) {
      const pool = BY_TIER[t.key];
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return CARDS[CARDS.length - 1];
}

// Sobre por reto del día cumplido (el bonus vive en wordle_results con league 'reto').
async function grantRetoPacks(userId) {
  const rows = (await db.execute({
    sql: "SELECT date FROM wordle_results WHERE user_id = ? AND league = 'reto' ORDER BY date DESC LIMIT 30",
    args: [userId],
  })).rows;
  for (const r of rows) {
    await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, 'reto')", args: [userId, r.date] });
  }
}

router.get("/state", async (req, res) => {
  try {
    await grantRetoPacks(req.userId);
    const today = todayStr();
    const packs = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND opened_at IS NULL", args: [req.userId] })).rows[0].n);
    const dailyClaimed = !!(await db.execute({ sql: "SELECT 1 FROM card_packs WHERE user_id = ? AND date = ? AND source = 'diario'", args: [req.userId, today] })).rows[0];
    const owned = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM user_cards WHERE user_id = ?", args: [req.userId] })).rows[0].n);
    res.json({ packs, dailyClaimed, owned, total: CARDS.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/claim-daily", async (req, res) => {
  try {
    const ins = await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, 'diario')", args: [req.userId, todayStr()] });
    res.json({ newly: ins.rowsAffected > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/open", async (req, res) => {
  try {
    const pack = (await db.execute({ sql: "SELECT id FROM card_packs WHERE user_id = ? AND opened_at IS NULL ORDER BY id LIMIT 1", args: [req.userId] })).rows[0];
    if (!pack) return res.status(400).json({ error: "No tenés sobres para abrir" });
    const upd = await db.execute({ sql: "UPDATE card_packs SET opened_at = datetime('now') WHERE id = ? AND opened_at IS NULL", args: [pack.id] });
    if (upd.rowsAffected === 0) return res.status(409).json({ error: "Ese sobre ya se abrió" });
    const cards = [];
    for (let i = 0; i < 5; i++) {
      const c = drawCard();
      const have = (await db.execute({ sql: "SELECT count FROM user_cards WHERE user_id = ? AND player_name = ?", args: [req.userId, c.name] })).rows[0];
      if (have) await db.execute({ sql: "UPDATE user_cards SET count = count + 1 WHERE user_id = ? AND player_name = ?", args: [req.userId, c.name] });
      else await db.execute({ sql: "INSERT INTO user_cards (user_id, player_name, count) VALUES (?, ?, 1)", args: [req.userId, c.name] });
      cards.push({ ...pub(c), isNew: !have });
    }
    res.json({ cards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Vida FUT: un sobre por cada etapa completada (el avance vive en el navegador, así que
// esto confía en el cliente; es un premio chico y una sola vez por etapa).
router.post("/grant-stage", async (req, res) => {
  try {
    const stage = Number(req.body?.stage);
    if (![1, 2, 3].includes(stage)) return res.status(400).json({ error: "Etapa inválida" });
    const ins = await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [req.userId, "vida-fut", `vidafut${stage}`] });
    res.json({ newly: ins.rowsAffected > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Álbum completo: nombre/posición/rareza de las ~2000 cartas, sin las demás
// stats — alcanza para dibujar las siluetas de lo que falta en el álbum, sin
// filtrar nada del resto de la lógica del juego.
router.get("/all", (req, res) => {
  res.json({ cards: CARDS.map(pub) });
});

router.get("/collection", async (req, res) => {
  try {
    const rows = (await db.execute({ sql: "SELECT player_name, count FROM user_cards WHERE user_id = ?", args: [req.userId] })).rows;
    const cards = rows.map((r) => BY_NAME.get(r.player_name) && { ...pub(BY_NAME.get(r.player_name)), count: Number(r.count) }).filter(Boolean)
      .sort((a, b) => b.ovr - a.ovr);
    res.json({ cards, total: CARDS.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ---------- equipo y partidos ----------
async function lineupOf(userId) {
  const row = (await db.execute({ sql: "SELECT players FROM card_lineups WHERE user_id = ?", args: [userId] })).rows[0];
  if (!row) return [];
  try { return JSON.parse(row.players).map((n) => BY_NAME.get(n)).filter(Boolean); } catch { return []; }
}

function strengthOf(cards) {
  const base = cards.reduce((s, c) => s + c.ovr, 0);
  let chem = 0, nat = 0;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if ([...cards[i].clubs].some((c) => cards[j].clubs.has(c))) chem += 1;
      if (cards[i].nationality === cards[j].nationality) nat += 0.5;
    }
  }
  chem = Math.min(chem, 25);
  nat = Math.min(nat, 10);
  return { base, chem, nat, total: base + chem + nat };
}

router.get("/lineup", async (req, res) => {
  const cards = await lineupOf(req.userId);
  res.json({ players: cards.map(pub), formation: FORMATION, strength: cards.length === 11 ? strengthOf(cards) : null });
});

router.put("/lineup", async (req, res) => {
  try {
    const names = Array.isArray(req.body?.players) ? req.body.players : [];
    if (new Set(names).size !== 11) return res.status(400).json({ error: "El equipo necesita 11 jugadores distintos" });
    const owned = new Set((await db.execute({ sql: "SELECT player_name FROM user_cards WHERE user_id = ?", args: [req.userId] })).rows.map((r) => r.player_name));
    const cards = names.map((n) => BY_NAME.get(n));
    if (cards.some((c) => !c) || names.some((n) => !owned.has(n))) return res.status(400).json({ error: "Solo podés usar cartas que tenés" });
    const count = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const c of cards) count[c.pos]++;
    if (Object.keys(FORMATION).some((k) => count[k] !== FORMATION[k])) {
      return res.status(400).json({ error: "La formación es 1 arquero, 4 defensas, 3 mediocampistas y 3 delanteros" });
    }
    await db.execute({
      sql: "INSERT INTO card_lineups (user_id, players, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET players = excluded.players, updated_at = excluded.updated_at",
      args: [req.userId, JSON.stringify(names)],
    });
    res.json({ ok: true, strength: strengthOf(cards) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Rivales posibles: gente de tus grupos que ya guardó un equipo.
router.get("/rivals", async (req, res) => {
  try {
    const rows = (await db.execute({
      sql: `SELECT DISTINCT u.id, u.username FROM group_members me
            JOIN group_members gm ON gm.group_id = me.group_id AND gm.user_id != me.user_id
            JOIN users u ON u.id = gm.user_id
            JOIN card_lineups l ON l.user_id = u.id
            WHERE me.user_id = ?`,
      args: [req.userId],
    })).rows;
    res.json({ rivals: rows.map((r) => ({ id: r.id, username: r.username })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/match", async (req, res) => {
  try {
    const mine = await lineupOf(req.userId);
    if (mine.length !== 11) return res.status(400).json({ error: "Primero armá tu equipo de 11" });
    const vs = req.body?.vs;
    let oppName = "CPU";
    let opp;
    if (vs && vs !== "cpu") {
      const rivalId = Number(vs);
      const ok = (await db.execute({
        sql: `SELECT 1 FROM group_members a JOIN group_members b ON a.group_id = b.group_id WHERE a.user_id = ? AND b.user_id = ? LIMIT 1`,
        args: [req.userId, rivalId],
      })).rows[0];
      if (!ok) return res.status(403).json({ error: "Ese rival no está en tus grupos" });
      opp = await lineupOf(rivalId);
      if (opp.length !== 11) return res.status(400).json({ error: "Ese rival todavía no armó su equipo" });
      oppName = (await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [rivalId] })).rows[0]?.username || "Rival";
    } else {
      // CPU: once cartas al azar de Plata para abajo, con la química de un equipo armado a los apurones.
      const pool = [...BY_TIER.plata, ...BY_TIER.bronce, ...BY_TIER.oro.slice(0, 40)];
      opp = Array.from({ length: 11 }, () => pool[Math.floor(Math.random() * pool.length)]);
    }
    const a = strengthOf(mine), b = strengthOf(opp);
    // total/11 = overall promedio del plantel — misma escala que un OVR
    // individual (DT League usa el mismo rango, ~50-95), así que el motor
    // compartido interpreta la diferencia de la misma manera en los dos juegos.
    const { homeGoals: myGoals, awayGoals: theirGoals, events } = simulateMatchEvents({
      ovrHome: a.total / 11,
      ovrAway: b.total / 11,
      homeAdvantage: 0, // acá no hay "local", los dos equipos son de cartas
    });
    const won = myGoals > theirGoals;
    let pack = false;
    if (won) {
      const today = todayStr();
      const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND date = ? AND source LIKE 'victoria%'", args: [req.userId, today] })).rows[0].n);
      if (n < 2) {
        await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [req.userId, today, `victoria${n + 1}`] });
        pack = true;
      }
    }
    res.json({
      opponent: oppName,
      score: [myGoals, theirGoals],
      result: won ? "win" : myGoals === theirGoals ? "draw" : "loss",
      strength: { mine: Math.round(a.total), theirs: Math.round(b.total), chemistry: Math.round(a.chem + a.nat) },
      events, // línea de tiempo del partido (mismo formato que DT League) para la cancha animada
      pack,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
