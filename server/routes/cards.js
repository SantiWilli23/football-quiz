import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr } from "../utils/points.js";
import { simulateMatchEvents } from "../utils/match-engine.js";
import { rankingBetween } from "./stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;
const ESPECIALES_RAW = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/cartas-especiales.json"), "utf-8")).cartas_especiales;

// Los 8 jugadores que las cartas especiales necesitan y todavía no estaban en
// la base principal (ver server/data/cartas-especiales.json). Se agregan acá,
// aparte, para no tocar el archivo grande de 2003 jugadores a mano.
const EXTRA_PLAYERS = [
  { nombre: "Bojan Krkić", nacionalidad: "España", posicion: "Delantero", nacimiento: 1990, carrera: [{ club: "Barcelona", inicio: 2007, fin: 2011 }, { club: "AC Milan", inicio: 2011, fin: 2012 }, { club: "Stoke City", inicio: 2014, fin: 2021 }] },
  { nombre: "Everton Cebolinha", nacionalidad: "Brasil", posicion: "Delantero", nacimiento: 1996, carrera: [{ club: "Grêmio", inicio: 2013, fin: 2018 }, { club: "Benfica", inicio: 2018, fin: 2023 }, { club: "Flamengo", inicio: 2023, fin: null }] },
  { nombre: "Fabrício Bruno", nacionalidad: "Brasil", posicion: "Defensa", nacimiento: 1996, carrera: [{ club: "Cruzeiro", inicio: 2018, fin: 2021 }, { club: "Flamengo", inicio: 2022, fin: null }] },
  { nombre: "Gerson", nacionalidad: "Brasil", posicion: "Mediocampista", nacimiento: 1997, carrera: [{ club: "Fluminense", inicio: 2015, fin: 2016 }, { club: "Roma", inicio: 2016, fin: 2017 }, { club: "Olympique Marseille", inicio: 2019, fin: 2021 }, { club: "Flamengo", inicio: 2021, fin: null }] },
  { nombre: "Léo Ortiz", nacionalidad: "Brasil", posicion: "Defensa", nacimiento: 1996, carrera: [{ club: "Athletico Paranaense", inicio: 2018, fin: 2020 }, { club: "Flamengo", inicio: 2021, fin: null }] },
  { nombre: "Léo Pereira", nacionalidad: "Brasil", posicion: "Defensa", nacimiento: 1996, carrera: [{ club: "Athletico Paranaense", inicio: 2018, fin: 2020 }, { club: "Flamengo", inicio: 2021, fin: null }] },
  { nombre: "Wesley (Flamengo)", nacionalidad: "Brasil", posicion: "Defensa", nacimiento: 2001, carrera: [{ club: "Flamengo", inicio: 2021, fin: null }] },
  { nombre: "Xabi Espart", nacionalidad: "España", posicion: "Mediocampista", nacimiento: 2005, carrera: [{ club: "Barcelona", inicio: 2023, fin: null }] },
];

const router = Router();
router.use(requireAuth);

// Cartas es un módulo opt-in por grupo (server/routes/groups.js tiene el
// toggle): solo existe para quien pertenece a un grupo donde un admin lo
// activó. Sin eso, TODA la sección de Cartas devuelve 404 — no aparece
// "deshabilitada", directamente no existe, tal como se decidió.
async function hasCardsAccess(userId) {
  const row = (await db.execute({
    sql: `SELECT 1 FROM group_members gm JOIN groups_t g ON g.id = gm.group_id
          WHERE gm.user_id = ? AND g.cards_enabled = 1 LIMIT 1`,
    args: [userId],
  })).rows[0];
  return !!row;
}

router.use(async (req, res, next) => {
  try {
    if (!(await hasCardsAccess(req.userId))) return res.status(404).json({ error: "Cartas no está activado en ninguno de tus grupos" });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Álbum de cartas: cada jugador de la base única es una carta. La rareza sale de
// qué tan conocido es (la base viene ordenada de más a menos famoso). Se ganan
// sobres de 5 cartas: uno gratis por día, uno por cumplir el reto del día y
// uno por ganarle a alguien con tu equipo (máx. 2 por día). Con las cartas se
// arma un XI (1-4-3-3) que juega partidos automáticos contra la CPU o contra
// el equipo guardado de alguien de tu grupo; la química sale de los clubes y
// nacionalidades que comparten en sus carreras reales.
//
// Moneda propia (server: card_wallets): nace de vender cartas o de un SBC
// completado, y se gasta en la tienda de sobres o en un duelo con apuesta.
// Nunca se compra con dinero real.
const SELL_VALUE = { estrella: 120, oro: 40, plata: 15, bronce: 5 };

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

// Media real para jugadores EN ACTIVIDAD (no retirados): en vez del cálculo
// por fama/hash, estos usan su rating real de verdad. Solo aplica si el
// jugador está activo (su último club en carrera no tiene fecha de fin) —
// un retirado sigue usando el cálculo de siempre, tenga o no entrada acá.
const REAL_OVR = {
  "Lionel Messi": 86,
  "Cristiano Ronaldo": 82,
};

function isActive(p) {
  const career = p.carrera || [];
  return career.length > 0 && career[career.length - 1].fin === null;
}

// EXTRA_PLAYERS también consigue su carta base normal, no solo la especial
// — van al final de la lista (índice más alto = tier más bajo por defecto,
// coherente con que no son "famosos" en la base principal).
const ALL_WITH_EXTRAS = [...ALL, ...EXTRA_PLAYERS];

const BASE_CARDS = ALL_WITH_EXTRAS.map((p, i) => {
  const bigCount = new Set((p.carrera || []).map((c) => c.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "")).filter((c) => BIG.has(c))).size;
  const minTier = bigCount >= 3 ? 1 : bigCount >= 2 ? 2 : TIERS.length - 1;
  const tier = TIERS[Math.min(TIERS.findIndex((t) => i < t.upTo), minTier)];
  let h = 0;
  for (const ch of p.nombre) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  const clubs = new Set((p.carrera || []).map((c) => c.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "")));
  const realOvr = isActive(p) ? REAL_OVR[p.nombre] : undefined;
  return {
    name: p.nombre,
    realName: p.nombre,
    special: null,
    tier: tier.key,
    tierLabel: tier.label,
    ovr: realOvr ?? (tier.base + (h % 9)),
    pos: POS[p.posicion] || "MID",
    nationality: p.nacionalidad,
    clubs,
    club: [...clubs].pop(),
  };
});

// Cartas especiales (ver server/data/cartas-especiales.json): cada jugador
// puede tener como mucho 2 (además de su carta base) — si aparece en más de
// 2 categorías, se quedan las 2 primeras y el resto no se agrega. La media
// va de 0 a 100, y solo UNA carta en todo el juego puede llegar a 100 (la
// primera que aparezca con ese valor; cualquier otra se topea en 99).
const REAL_PLAYER_BY_NAME = new Map([...ALL, ...EXTRA_PLAYERS].map((p) => [p.nombre, p]));

function tierForOvr(ovr) {
  if (ovr >= 88) return TIERS[0]; // estrella
  if (ovr >= 78) return TIERS[1]; // oro
  if (ovr >= 65) return TIERS[2]; // plata
  return TIERS[3]; // bronce
}

const SPECIAL_CARDS = [];
{
  const perPlayer = new Map();
  let hundredTaken = false;
  for (const [category, entries] of Object.entries(ESPECIALES_RAW)) {
    for (const e of entries) {
      const count = perPlayer.get(e.jugador) || 0;
      if (count >= 2) continue; // máximo 2 especiales por jugador — se descarta el resto
      const base = REAL_PLAYER_BY_NAME.get(e.jugador);
      if (!base) continue; // no debería pasar: los 8 que faltaban están en EXTRA_PLAYERS

      let ovr = Math.max(0, Math.min(100, e.media));
      if (ovr >= 100) {
        if (hundredTaken) ovr = 99;
        else hundredTaken = true;
      }

      const clubs = new Set((base.carrera || []).map((c) => c.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "")));
      const tier = tierForOvr(ovr);
      SPECIAL_CARDS.push({
        name: `${e.jugador} · ${category}`,
        realName: e.jugador,
        special: category,
        note: e.nota || null,
        tier: tier.key,
        tierLabel: tier.label,
        ovr,
        pos: POS[base.posicion] || "MID",
        nationality: base.nacionalidad,
        clubs,
        club: [...clubs].pop(),
      });
      perPlayer.set(e.jugador, count + 1);
    }
  }
}

const CARDS = [...BASE_CARDS, ...SPECIAL_CARDS];
const BY_NAME = new Map(CARDS.map((c) => [c.name, c]));
// Los sobres normales/buenos solo salen de la base — las especiales son más
// raras y salen aparte (ver drawCard) para que sigan siendo especiales.
const BY_TIER = Object.fromEntries(TIERS.map((t) => [t.key, BASE_CARDS.filter((c) => c.tier === t.key)]));
const pub = (c) => ({ name: c.name, realName: c.realName, special: c.special, note: c.note || null, tier: c.tier, tierLabel: c.tierLabel, ovr: c.ovr, pos: c.pos, nationality: c.nationality, club: c.club });

// Calidad de sobre: "weights" alternativos a los de TIERS, para que un sobre
// ganado por buen rendimiento (o comprado más caro en la tienda) tenga mejor
// probabilidad de tocar algo bueno, sin dejar de ser el mismo sistema de
// sobres de 5 cartas de siempre.
const PACK_QUALITY = {
  normal: { estrella: 3, oro: 12, plata: 30, bronce: 55 }, // = los weights de TIERS
  bueno: { estrella: 8, oro: 25, plata: 35, bronce: 32 },
  top: { estrella: 20, oro: 35, plata: 30, bronce: 15 },
};

// Solo un sobre "top" puede llegar a tocar una carta especial, y con poca
// chance (6%) — si no, sigue el sorteo normal por tier de siempre.
const SPECIAL_CHANCE_TOP = 0.06;

function drawCard(quality = "normal") {
  if (quality === "top" && SPECIAL_CARDS.length > 0 && Math.random() < SPECIAL_CHANCE_TOP) {
    return SPECIAL_CARDS[Math.floor(Math.random() * SPECIAL_CARDS.length)];
  }
  const weights = PACK_QUALITY[quality] || PACK_QUALITY.normal;
  let r = Math.random() * TIERS.reduce((s, t) => s + (weights[t.key] ?? t.weight), 0);
  for (const t of TIERS) {
    r -= weights[t.key] ?? t.weight;
    if (r <= 0) {
      const pool = BY_TIER[t.key];
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return CARDS[CARDS.length - 1];
}

// La calidad de un sobre queda codificada en su `source`: los que arrancan
// con "top-" (victoria perfecta, campeón del ranking semanal, tienda-top)
// usan la mejor probabilidad; "bueno-" es la franja intermedia; el resto
// (diario, reto, vidafutN) sigue siendo el sobre normal de siempre.
function qualityOf(source) {
  if (source.startsWith("top-")) return "top";
  if (source.startsWith("bueno-")) return "bueno";
  return "normal";
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

function mondayOf(dateStr) {
  const day = (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(dateStr, -day);
}

// Sobre "top" para quien salió 1° en el ranking semanal de un grupo con
// Cartas activado — se otorga perezosamente (al visitar Cartas) por cada
// semana YA TERMINADA que todavía no se premió. El date=lunes de esa semana
// hace que sea idempotente vía el UNIQUE(user_id, date, source) de siempre.
async function grantWeeklyRankingPack(userId) {
  const today = todayStr();
  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, -7);
  const lastSunday = addDays(lastMonday, 6);

  const groups = (await db.execute({
    sql: `SELECT gm.group_id FROM group_members gm JOIN groups_t g ON g.id = gm.group_id
          WHERE gm.user_id = ? AND g.cards_enabled = 1`,
    args: [userId],
  })).rows;

  for (const { group_id: groupId } of groups) {
    const ranking = await rankingBetween(groupId, lastMonday, lastSunday);
    const top = ranking[0];
    if (top && top.id === userId && top.points > 0) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)",
        args: [userId, lastMonday, `top-ranking${groupId}`],
      });
    }
  }
}

router.get("/state", async (req, res) => {
  try {
    await grantRetoPacks(req.userId);
    await grantWeeklyRankingPack(req.userId);
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
    const pack = (await db.execute({ sql: "SELECT id, source FROM card_packs WHERE user_id = ? AND opened_at IS NULL ORDER BY id LIMIT 1", args: [req.userId] })).rows[0];
    if (!pack) return res.status(400).json({ error: "No tenés sobres para abrir" });
    const upd = await db.execute({ sql: "UPDATE card_packs SET opened_at = datetime('now') WHERE id = ? AND opened_at IS NULL", args: [pack.id] });
    if (upd.rowsAffected === 0) return res.status(409).json({ error: "Ese sobre ya se abrió" });
    const quality = qualityOf(pack.source);
    const cards = [];
    for (let i = 0; i < 5; i++) {
      const c = drawCard(quality);
      const have = (await db.execute({ sql: "SELECT count FROM user_cards WHERE user_id = ? AND player_name = ?", args: [req.userId, c.name] })).rows[0];
      if (have) await db.execute({ sql: "UPDATE user_cards SET count = count + 1 WHERE user_id = ? AND player_name = ?", args: [req.userId, c.name] });
      else await db.execute({ sql: "INSERT INTO user_cards (user_id, player_name, count) VALUES (?, ?, 1)", args: [req.userId, c.name] });
      cards.push({ ...pub(c), isNew: !have });
    }
    res.json({ cards, quality });
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

router.get("/wallet", async (req, res) => {
  try {
    const row = (await db.execute({ sql: "SELECT balance FROM card_wallets WHERE user_id = ?", args: [req.userId] })).rows[0];
    res.json({ balance: row ? Number(row.balance) : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

async function creditWallet(userId, amount) {
  await db.execute({
    sql: `INSERT INTO card_wallets (user_id, balance, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = excluded.updated_at`,
    args: [userId, amount],
  });
}

// Vender cartas de a una o varias del mismo jugador. No se puede vender la
// última copia de una carta que esté puesta en el equipo (para no romper el
// once guardado sin darte cuenta).
router.post("/sell", async (req, res) => {
  try {
    const name = String(req.body?.name || "");
    const count = Math.max(1, Number(req.body?.count) || 1);
    const card = BY_NAME.get(name);
    if (!card) return res.status(400).json({ error: "Esa carta no existe" });

    const owned = (await db.execute({ sql: "SELECT count FROM user_cards WHERE user_id = ? AND player_name = ?", args: [req.userId, name] })).rows[0];
    const have = owned ? Number(owned.count) : 0;
    if (have < count) return res.status(400).json({ error: "No tenés esa cantidad de esa carta" });

    const lineup = await lineupOf(req.userId);
    const inLineup = lineup.some((c) => c.name === name);
    if (inLineup && have - count < 1) return res.status(400).json({ error: "No podés vender la última copia de una carta que está en tu equipo" });

    const value = (SELL_VALUE[card.tier] || 0) * count;
    if (have === count) await db.execute({ sql: "DELETE FROM user_cards WHERE user_id = ? AND player_name = ?", args: [req.userId, name] });
    else await db.execute({ sql: "UPDATE user_cards SET count = count - ? WHERE user_id = ? AND player_name = ?", args: [count, req.userId, name] });
    await creditWallet(req.userId, value);

    const wallet = (await db.execute({ sql: "SELECT balance FROM card_wallets WHERE user_id = ?", args: [req.userId] })).rows[0];
    res.json({ ok: true, earned: value, balance: Number(wallet.balance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Tienda de sobres: se paga con la moneda de vender cartas / SBCs, nunca con
// dinero real. Un sobre "top" pensado para ser caro a propósito (no es la
// forma normal de progresar, es un lujo ocasional).
const SHOP_PRICE = { normal: 30, bueno: 90, top: 220 };

router.get("/shop", (req, res) => {
  res.json({ prices: SHOP_PRICE });
});

router.post("/shop/buy", async (req, res) => {
  try {
    const quality = String(req.body?.quality || "");
    const price = SHOP_PRICE[quality];
    if (!price) return res.status(400).json({ error: "Calidad de sobre inválida" });

    const wallet = (await db.execute({ sql: "SELECT balance FROM card_wallets WHERE user_id = ?", args: [req.userId] })).rows[0];
    const balance = wallet ? Number(wallet.balance) : 0;
    if (balance < price) return res.status(400).json({ error: "No te alcanzan las monedas" });

    const today = todayStr();
    // "normal" no lleva prefijo (qualityOf lo trata como normal por default);
    // "bueno"/"top" sí, para que qualityOf() les dé las mejores probabilidades.
    const prefix = quality === "normal" ? "tienda" : `${quality}-tienda`;
    const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND date = ? AND source LIKE ?", args: [req.userId, today, `${prefix}%`] })).rows[0].n);
    await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [req.userId, today, `${prefix}${n + 1}`] });
    await creditWallet(req.userId, -price);

    res.json({ ok: true, balance: balance - price });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// SBC (Squad Building Challenges): armás un equipo de 11 que cumpla un
// requisito puntual, lo "entregás" (se pierden esas cartas, como en el FIFA
// real) y a cambio te dan un sobre. Le da un destino a las cartas de bajo
// tier que si no solo servirían para vender.
const SBC_DEFS = [
  {
    id: "bronce11",
    label: "11 de Bronce",
    desc: "Un equipo completo (11 cartas) todas de tier Bronce.",
    check: (cards) => cards.every((c) => c.tier === "bronce"),
    reward: { packQuality: "bueno" },
  },
  {
    id: "multinacional",
    label: "Multinacional",
    desc: "11 cartas con 6 o más nacionalidades distintas entre ellas.",
    check: (cards) => new Set(cards.map((c) => c.nationality)).size >= 6,
    reward: { packQuality: "normal", coins: 20 },
  },
  {
    id: "plata-peso",
    label: "Plata de peso",
    desc: "11 cartas de Plata o Bronce (nada de Oro/Estrella) sumando 750+ de rating total.",
    check: (cards) => cards.every((c) => c.tier === "plata" || c.tier === "bronce") && cards.reduce((s, c) => s + c.ovr, 0) >= 750,
    reward: { packQuality: "top" },
  },
];

router.get("/sbc", (req, res) => {
  res.json({ sbcs: SBC_DEFS.map(({ id, label, desc, reward }) => ({ id, label, desc, reward })) });
});

router.post("/sbc/:id/submit", async (req, res) => {
  try {
    const def = SBC_DEFS.find((s) => s.id === req.params.id);
    if (!def) return res.status(404).json({ error: "SBC no encontrado" });

    const names = Array.isArray(req.body?.players) ? [...new Set(req.body.players)] : [];
    if (names.length !== 11) return res.status(400).json({ error: "El SBC necesita 11 cartas distintas" });

    const owned = new Map((await db.execute({ sql: "SELECT player_name, count FROM user_cards WHERE user_id = ?", args: [req.userId] })).rows.map((r) => [r.player_name, Number(r.count)]));
    const cards = names.map((n) => BY_NAME.get(n));
    if (cards.some((c) => !c) || names.some((n) => !owned.get(n))) return res.status(400).json({ error: "Solo podés usar cartas que tenés" });

    const lineup = await lineupOf(req.userId);
    const inLineupAndLastCopy = names.some((n) => lineup.some((c) => c.name === n) && owned.get(n) === 1);
    if (inLineupAndLastCopy) return res.status(400).json({ error: "No podés entregar la última copia de una carta que está en tu equipo" });

    if (!def.check(cards)) return res.status(400).json({ error: "Ese equipo no cumple el requisito del SBC" });

    // Se consumen las 11 cartas (una copia de cada una).
    for (const n of names) {
      const c = owned.get(n);
      if (c === 1) await db.execute({ sql: "DELETE FROM user_cards WHERE user_id = ? AND player_name = ?", args: [req.userId, n] });
      else await db.execute({ sql: "UPDATE user_cards SET count = count - 1 WHERE user_id = ? AND player_name = ?", args: [req.userId, n] });
    }

    const today = todayStr();
    const prefix = def.reward.packQuality === "normal" ? `sbc-${def.id}` : `${def.reward.packQuality}-sbc-${def.id}`;
    const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND date = ? AND source LIKE ?", args: [req.userId, today, `${prefix}%`] })).rows[0].n);
    await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [req.userId, today, `${prefix}${n + 1}`] });
    if (def.reward.coins) await creditWallet(req.userId, def.reward.coins);

    res.json({ ok: true, reward: def.reward });
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
    if (new Set(cards.map((c) => c.realName)).size !== 11) {
      return res.status(400).json({ error: "No podés poner dos cartas de la misma persona (base + especial) en el mismo equipo" });
    }
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
      // El sobre por victoria mejora con lo contundente que fue: por 2+ de
      // diferencia da un sobre "top", por la mínima uno "bueno".
      const margin = myGoals - theirGoals;
      const prefix = margin >= 2 ? "top-victoria" : "bueno-victoria";
      const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND date = ? AND source LIKE '%victoria%'", args: [req.userId, today] })).rows[0].n);
      if (n < 2) {
        await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [req.userId, today, `${prefix}${n + 1}`] });
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
