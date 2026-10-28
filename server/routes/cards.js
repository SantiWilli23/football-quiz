import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { addDays, todayStr } from "../utils/points.js";
import { simulateMatchEvents } from "../utils/match-engine.js";
import { rankingBetween } from "./stats.js";
import { isoWeekKey } from "../utils/challenges.js";
import { leagueForClub } from "../data/league-clubs.js";
import { grantQuinielaPacks, grantWeeklyGamePacks } from "../utils/daily-games.js";
import { packStatus, redesignOn } from "../utils/clubs.js";
import { careerName } from "../utils/events.js";
import { buildExtraCards, drawExtra, EXTRA_PACKS, extraPub, extrasFor, lineupEffects, refreshFormIfStale, CAPTAIN_CHEM_CAP_EXTRA } from "../utils/card-types.js";

// Reto semanal de Cartas: cada victoria vale 20 + 10 por gol de diferencia,
// más un plus si el rival tenía un equipo más fuerte (ganarle a alguien mejor
// cuesta más) y ×1.5 si le ganaste a una persona real en vez de a la CPU. Se
// guarda la MEJOR victoria de la semana en cada uno de tus grupos, así que
// jugar 50 partidos no infla nada: importa ganar bien, no ganar seguido.
async function submitCardsWeekly(userId, score) {
  const period = isoWeekKey();
  const groups = (await db.execute({ sql: "SELECT group_id FROM group_members WHERE user_id = ?", args: [userId] })).rows;
  for (const { group_id } of groups) {
    const cur = (await db.execute({ sql: "SELECT id, score FROM challenge_scores WHERE game_key = 'cartas' AND period_key = ? AND group_id = ? AND user_id = ?", args: [period, group_id, userId] })).rows[0];
    if (!cur) {
      await db.execute({ sql: "INSERT INTO challenge_scores (game_key, period_key, group_id, user_id, score) VALUES ('cartas', ?, ?, ?, ?)", args: [period, group_id, userId, score] });
    } else if (score > cur.score) {
      await db.execute({ sql: "UPDATE challenge_scores SET score = ?, submitted_at = datetime('now') WHERE id = ?", args: [score, cur.id] });
    }
  }
}

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
  if (redesignOn()) return true; // Futotal 2.0: Cartas es para todos, no depende del club
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
// Jugadores extra para las Cartas (server/data/cartas-jugadores-extra.json): se
// suman a la base; si alguno ya estaba (mismo nombre sin tildes) se descarta.
const normName = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const CARTAS_EXTRA = (() => {
  try {
    const known = new Set([...ALL, ...EXTRA_PLAYERS].map((p) => normName(p.nombre)));
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/cartas-jugadores-extra.json"), "utf-8")).jugadores || [];
    return raw.filter((p) => {
      const k = normName(p.nombre);
      if (known.has(k)) return false;
      known.add(k);
      return true;
    });
  } catch {
    return [];
  }
})();

const ALL_WITH_EXTRAS = [...ALL, ...EXTRA_PLAYERS, ...CARTAS_EXTRA];

const BASE_CARDS = ALL_WITH_EXTRAS.map((p, i) => {
  const bigCount = new Set((p.carrera || []).map((c) => c.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "")).filter((c) => BIG.has(c))).size;
  const minTier = bigCount >= 3 ? 1 : bigCount >= 2 ? 2 : TIERS.length - 1;
  const byRank = Math.min(TIERS.findIndex((t) => i < t.upTo), minTier);
  // Los jugadores del archivo extra pueden traer su propio nivel mínimo ("tier").
  const forced = p.tier ? TIERS.findIndex((t) => t.key === p.tier) : -1;
  const tier = TIERS[forced >= 0 ? Math.min(forced, byRank) : byRank];
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
    born: p.nacimiento || null,
    retired: !isActive(p),
    league: leagueForClub([...clubs].pop())?.key ?? leagueForClub([...clubs].pop()) ?? null,
  };
});

// Cartas especiales (ver server/data/cartas-especiales.json): cada jugador
// puede tener como mucho 2 (además de su carta base) — si aparece en más de
// 2 categorías, se quedan las 2 primeras y el resto no se agrega. La media
// va de 0 a 100, y solo UNA carta en todo el juego puede llegar a 100 (la
// primera que aparezca con ese valor; cualquier otra se topea en 99).
const REAL_PLAYER_BY_NAME = new Map([...ALL, ...EXTRA_PLAYERS, ...CARTAS_EXTRA].map((p) => [p.nombre, p]));

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

// Íconos, Momentos y entrenadores (server/utils/card-types.js).
const CARDS = [...BASE_CARDS, ...SPECIAL_CARDS, ...buildExtraCards(BASE_CARDS)];
const BY_NAME = new Map(CARDS.map((c) => [c.name, c]));
// Los sobres normales/buenos solo salen de la base — las especiales son más
// raras y salen aparte (ver drawCard) para que sigan siendo especiales.
const BY_TIER = Object.fromEntries(TIERS.map((t) => [t.key, BASE_CARDS.filter((c) => c.tier === t.key)]));
const pub = (c) => ({ name: c.name, realName: c.realName, special: c.special, note: c.note || null, tier: c.tier, tierLabel: c.tierLabel, ovr: c.ovr, pos: c.pos, nationality: c.nationality, club: c.club, ...extraPub(c) });

// Tipos de sobre. Cada uno tiene probabilidades por nivel ("weights"), y
// opcionalmente un filtro de jugadores (leyendas, promesas, una liga) y/o una
// carta asegurada (estrella). Si el filtro deja un nivel sin jugadores, ese nivel
// sale del pool general. Siempre son 5 cartas.
const W_NORMAL = { estrella: 3, oro: 12, plata: 30, bronce: 55 }; // = los weights de TIERS
const W_BUENO = { estrella: 8, oro: 25, plata: 35, bronce: 32 };
const W_TOP = { estrella: 20, oro: 35, plata: 30, bronce: 15 };

const PACKS = {
  normal: { label: "Sobre normal", desc: "5 cartas al azar.", price: 30, weights: W_NORMAL },
  bueno: { label: "Sobre bueno", desc: "Más chances de oro y estrella.", price: 90, weights: W_BUENO },
  top: { label: "Sobre top", desc: "Muy buenas chances de estrella, y una mínima de carta especial.", price: 220, weights: W_TOP, special: 0.06 },
  estrella: { label: "Sobre estrella", desc: "Una estrella asegurada y cuatro cartas de nivel top. Con más chance de especial.", price: 420, weights: W_TOP, special: 0.12, guarantee: "estrella" },
  leyendas: { label: "Sobre leyendas", desc: "Solo jugadores retirados, con chances de nivel bueno.", price: 130, weights: W_BUENO, filter: (c) => c.retired },
  promesas: { label: "Sobre promesas", desc: "Solo jóvenes (nacidos desde 2003), con chances de nivel bueno.", price: 110, weights: W_BUENO, filter: (c) => c.born && c.born >= 2003 },
  premier: { label: "Sobre Premier", desc: "Jugadores de clubes de la Premier League.", price: 100, weights: W_BUENO, filter: (c) => c.league === "premier" },
  laliga: { label: "Sobre LaLiga", desc: "Jugadores de clubes de LaLiga.", price: 100, weights: W_BUENO, filter: (c) => c.league === "laliga" },
  seriea: { label: "Sobre Serie A", desc: "Jugadores de clubes de la Serie A.", price: 100, weights: W_BUENO, filter: (c) => c.league === "seriea" },
  bundesliga: { label: "Sobre Bundesliga", desc: "Jugadores de clubes de la Bundesliga.", price: 100, weights: W_BUENO, filter: (c) => c.league === "bundesliga" },
};

Object.assign(PACKS, EXTRA_PACKS); // sobre de Íconos

const FILTERED_POOLS = new Map();
function poolFor(type, tierKey) {
  const def = PACKS[type];
  if (!def?.filter) return BY_TIER[tierKey];
  const key = `${type}|${tierKey}`;
  if (!FILTERED_POOLS.has(key)) {
    const filtered = BY_TIER[tierKey].filter(def.filter);
    FILTERED_POOLS.set(key, filtered.length ? filtered : BY_TIER[tierKey]);
  }
  return FILTERED_POOLS.get(key);
}

const pickOf = (pool) => pool[Math.floor(Math.random() * pool.length)];

// `index` es la posición de la carta dentro del sobre (0 a 4): la carta
// asegurada de un sobre estrella es la primera.
function drawCard(type = "normal", index = 1, pityBonus = 0) {
  const def = PACKS[type] || PACKS.normal;
  const extra = drawExtra(type, index, def); // Ícono, Momento o entrenador
  if (extra) return extra;
  const special = def.special && SPECIAL_CARDS.length > 0 && Math.random() < def.special;
  if (special) return pickOf(SPECIAL_CARDS);
  if (def.guarantee && index === 0) return pickOf(poolFor(type, def.guarantee));
  // Garantía de estrella: cada sobre sin estrella suma 3 puntos a su probabilidad.
  const weights = pityBonus > 0 ? { ...def.weights, estrella: (def.weights.estrella ?? 0) + pityBonus } : def.weights;
  let r = Math.random() * TIERS.reduce((sum, t) => sum + (weights[t.key] ?? t.weight), 0);
  for (const t of TIERS) {
    r -= weights[t.key] ?? t.weight;
    if (r <= 0) return pickOf(poolFor(type, t.key));
  }
  return CARDS[CARDS.length - 1];
}

// El tipo de un sobre queda codificado en su `source`: lo que va antes del primer
// guión ("top-ranking3", "leyendas-tienda1", "estrella-copa4campeon"). Lo demás
// (diario, reto, vidafutN, juego-…) es el sobre normal de siempre.
function qualityOf(source) {
  const prefix = String(source).split("-")[0];
  return PACKS[prefix] ? prefix : "normal";
}

// Sobre por reto del día cumplido (el bonus vive en wordle_results con league 'reto').
async function grantRetoPacks(userId) {
  const rows = (await db.execute({
    sql: "SELECT date FROM wordle_results WHERE user_id = ? AND league = 'reto' ORDER BY date DESC LIMIT 30",
    args: [userId],
  })).rows;
  if (rows.length === 0) return;
  // Una sola ida a la base en vez de hasta 30 inserciones sueltas.
  await db.batch(rows.map((r) => ({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, 'reto')", args: [userId, r.date] })), "write");
}

function mondayOf(dateStr) {
  const day = (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(dateStr, -day);
}

// Sobre "top" para quien salió 1° en el ranking semanal de un grupo con
// Cartas activado — se otorga perezosamente (al visitar Cartas) por cada
// semana YA TERMINADA que todavía no se premió. El date=lunes de esa semana
// hace que sea idempotente vía el UNIQUE(user_id, date, source) de siempre.
const WEEK_WINNER_CACHE = new Map();

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

  // Una semana terminada ya no cambia: su ganador se calcula una vez por grupo
  // y queda en memoria, en vez de rehacer el ranking en cada visita a Cartas.
  const winners = await Promise.all(groups.map(async ({ group_id: groupId }) => {
    const key = `${groupId}|${lastMonday}`;
    if (!WEEK_WINNER_CACHE.has(key)) {
      const top = (await rankingBetween(groupId, lastMonday, lastSunday))[0];
      WEEK_WINNER_CACHE.set(key, top && top.points > 0 ? top.id : null);
    }
    return { groupId, winnerId: WEEK_WINNER_CACHE.get(key) };
  }));
  for (const { groupId, winnerId } of winners) {
    if (winnerId === userId) {
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
    await grantWeeklyGamePacks(req.userId); // podio semanal de los juegos diarios
    await grantQuinielaPacks(req.userId); // sobre de la quiniela, cuando era el juego diario
    const today = todayStr();
    const status = await packStatus(req.userId);
    const packs = status.openable.length;
    const dailyClaimed = !!(await db.execute({ sql: "SELECT 1 FROM card_packs WHERE user_id = ? AND date = ? AND source = 'diario'", args: [req.userId, today] })).rows[0];
    const owned = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM user_cards WHERE user_id = ?", args: [req.userId] })).rows[0].n);
    res.json({ packs, lockedPacks: status.locked.length, dailyClaimed, owned, total: CARDS.length });
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
    await refreshCustomSbcs();
    const { openable, locked } = await packStatus(req.userId);
    const pack = openable.length ? (await db.execute({ sql: "SELECT id, source, theme FROM card_packs WHERE id = ?", args: [openable[0]] })).rows[0] : null;
    if (!pack) return res.status(400).json({ error: locked.length ? "Tus sobres están guardados: entrá a un club con la temporada iniciada para abrirlos" : "No tenés sobres para abrir" });
    const upd = await db.execute({ sql: "UPDATE card_packs SET opened_at = datetime('now') WHERE id = ? AND opened_at IS NULL", args: [pack.id] });
    if (upd.rowsAffected === 0) return res.status(409).json({ error: "Ese sobre ya se abrió" });
    const quality = qualityOf(pack.source);
    // Una lectura de lo que ya tenés + una escritura en lote (antes eran 2 idas
    // a la base por carta, 10 en total, y abrir un sobre se sentía lento).
    const misses = Number((await db.execute({ sql: "SELECT misses FROM card_pity WHERE user_id = ?", args: [req.userId] })).rows[0]?.misses || 0);
    let drawn;
    if (pack.theme === "elite") {
      drawn = drawElitePack(misses);
    } else if (pack.theme && String(pack.theme).startsWith("club:")) {
      drawn = drawWelcomePack(String(pack.theme).slice(5), misses);
    } else if (pack.theme && themeByKey(pack.theme)) {
      drawn = drawThemePack(themeByKey(pack.theme));
    } else {
      drawn = Array.from({ length: 5 }, (_, i) => drawCard(quality, i, misses * 3));
      // Mientras haya un SBC temático activo, cada sobre trae una carta de la temática.
      const active = redesignOn() ? activeTheme(todayStr()) : null;
      if (active) drawn[4] = drawFromTheme(active, quality);
    }
    // Salió una estrella (o una carta especial): se reinicia. Si no, el próximo sobre tiene 3 puntos más.
    const gotStar = drawn.some((c) => c.tier === "estrella" || c.special);
    await db.execute({
      sql: "INSERT INTO card_pity (user_id, misses) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET misses = excluded.misses",
      args: [req.userId, gotStar ? 0 : misses + 1],
    });
    const owned = new Set((await db.execute({ sql: "SELECT player_name FROM user_cards WHERE user_id = ?", args: [req.userId] })).rows.map((r) => r.player_name));
    const cards = drawn.map((c) => {
      const isNew = !owned.has(c.name);
      owned.add(c.name); // si salen dos iguales en el mismo sobre, la segunda ya no es "nueva"
      return { ...pub(c), isNew };
    });
    await db.batch(drawn.map((c) => ({
      sql: "INSERT INTO user_cards (user_id, player_name, count) VALUES (?, ?, 1) ON CONFLICT(user_id, player_name) DO UPDATE SET count = count + 1",
      args: [req.userId, c.name],
    })), "write");
    res.json({ cards, quality, pity: gotStar ? 0 : misses + 1, starBonus: gotStar ? 0 : (misses + 1) * 3 });
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
    await refreshCustomSbcs();
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

    // Si es una repetida que sirve para el desafío temático activo, se avisa antes de venderla.
    if (redesignOn() && !req.body?.confirmTheme && have - count >= 1) {
      const { theme, start } = themePeriod(todayStr());
      if (theme && theme.pool.some((c) => c.name === name)) {
        const done = (await db.execute({ sql: "SELECT 1 FROM card_packs WHERE user_id = ? AND date = ? AND source = ?", args: [req.userId, start, `bueno-sbctema-${theme.key}`] })).rows[0];
        if (!done) return res.status(409).json({ needsConfirm: true, error: `${name} es una repetida que sirve para el desafío de ${theme.label}. ¿La vendés igual?` });
      }
    }

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
const SHOP_PRICE = Object.fromEntries(Object.entries(PACKS).map(([k, d]) => [k, d.price]));

// Oferta del día (Futotal 2.0): un sobre distinto cada día con 30% de descuento, una
// compra por persona. Se elige por la fecha, así que es la misma para todos.
export function dailyDeal(date) {
  const keys = Object.keys(SHOP_PRICE).filter((k) => k !== "normal");
  let h = 0;
  for (const ch of `oferta-${date}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const quality = keys[h % keys.length];
  return { quality, label: PACKS[quality].label, normalPrice: SHOP_PRICE[quality], price: Math.max(5, Math.round((SHOP_PRICE[quality] * 0.7) / 5) * 5) };
}

router.get("/shop", async (req, res) => {
  const deal = redesignOn() ? dailyDeal(todayStr()) : null;
  if (deal) {
    const taken = (await db.execute({ sql: "SELECT 1 FROM card_packs WHERE user_id = ? AND date = ? AND source = ?", args: [req.userId, todayStr(), `${deal.quality}-oferta`] })).rows[0];
    deal.taken = !!taken;
  }
  res.json({
    deal,
    prices: SHOP_PRICE,
    labels: Object.fromEntries(Object.entries(PACKS).map(([k, d]) => [k, d.label])),
    descriptions: Object.fromEntries(Object.entries(PACKS).map(([k, d]) => [k, d.desc])),
  });
});

router.post("/shop/buy", async (req, res) => {
  try {
    const quality = String(req.body?.quality || "");
    let price = SHOP_PRICE[quality];
    if (!price) return res.status(400).json({ error: "Calidad de sobre inválida" });
    const asDeal = !!req.body?.deal && redesignOn();
    if (asDeal) {
      const deal = dailyDeal(todayStr());
      if (deal.quality !== quality) return res.status(400).json({ error: "Esa no es la oferta de hoy" });
      if ((await db.execute({ sql: "SELECT 1 FROM card_packs WHERE user_id = ? AND date = ? AND source = ?", args: [req.userId, todayStr(), `${quality}-oferta`] })).rows[0]) {
        return res.status(409).json({ error: "Ya compraste la oferta de hoy" });
      }
      price = deal.price;
    }

    const wallet = (await db.execute({ sql: "SELECT balance FROM card_wallets WHERE user_id = ?", args: [req.userId] })).rows[0];
    const balance = wallet ? Number(wallet.balance) : 0;
    if (balance < price) return res.status(400).json({ error: "No te alcanzan las monedas" });

    const today = todayStr();
    // "normal" no lleva prefijo (qualityOf lo trata como normal por default);
    // "bueno"/"top" sí, para que qualityOf() les dé las mejores probabilidades.
    const prefix = quality === "normal" ? "tienda" : `${quality}-tienda`;
    const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND date = ? AND source LIKE ?", args: [req.userId, today, `${prefix}%`] })).rows[0].n);
    // La oferta del día va con su propia fuente (`<calidad>-oferta`): sirve de candado de una por día.
    await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [req.userId, today, asDeal ? `${quality}-oferta` : `${prefix}${n + 1}`] });
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
// El once viene con `.extras` (entrenador y capitán ya validados): strengthOf lo usa.
export async function lineupOf(userId) {
  refreshFormIfStale(); // "En forma": actualiza en segundo plano si hace falta
  const row = (await db.execute({ sql: "SELECT players FROM card_lineups WHERE user_id = ?", args: [userId] })).rows[0];
  if (!row) return [];
  let cards;
  try { cards = JSON.parse(row.players).map((n) => BY_NAME.get(n)).filter(Boolean); } catch { return []; }
  try { cards.extras = await extrasFor(userId, cards); } catch { cards.extras = { coach: null, captain: null }; }
  return cards;
}

export function strengthOf(cards) {
  const fx = lineupEffects(cards); // En forma, entrenador, selecciones y capitán
  const base = cards.reduce((s, c) => s + c.ovr, 0) + fx.ovr;
  let chem = 0, nat = 0;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      // Las conexiones de club con el capitán cuentan doble.
      const weight = fx.captain && (cards[i].name === fx.captain || cards[j].name === fx.captain) ? 2 : 1;
      if ([...cards[i].clubs].some((c) => cards[j].clubs.has(c))) chem += weight;
      if (cards[i].nationality === cards[j].nationality) nat += 0.5;
    }
  }
  chem = Math.min(chem, 25 + (fx.captain ? CAPTAIN_CHEM_CAP_EXTRA : 0)) + fx.chem;
  nat = Math.min(nat, 10);
  return { base, chem, nat, total: base + chem + nat, extra: fx.breakdown };
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
    res.json({ ok: true, strength: strengthOf(await lineupOf(req.userId)) });
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
      const weeklyMargin = myGoals - theirGoals;
      const underdog = Math.max(0, Math.round((b.total - a.total) / 11)) * 2;
      await submitCardsWeekly(req.userId, Math.round((20 + 10 * weeklyMargin + underdog) * (Number(vs) ? 1.5 : 1)));
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

// ---------- Carta del día y álbum calendario (Futotal 2.0) ----------
// Si acertás el «¿Quién es?» del partido del día te llevás esa carta con la fecha. Es una
// edición: no se vende ni se entrega en un SBC (vive en daily_cards, no en user_cards).
// Si un día no jugás o fallás, la casilla queda vacía para siempre.
router.get("/album", async (req, res) => {
  try {
    const today = todayStr();
    const month = /^\d{4}-\d{2}$/.test(String(req.query.month || "")) ? String(req.query.month) : today.slice(0, 7);
    const rows = (await db.execute({ sql: "SELECT date, player_name FROM daily_cards WHERE user_id = ? AND date LIKE ?", args: [req.userId, `${month}-%`] })).rows;
    const byDate = new Map(rows.map((r) => [r.date, r.player_name]));
    const [y, m] = month.split("-").map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const list = [];
    for (let d = 1; d <= days; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      const name = byDate.get(date);
      const card = name ? BY_NAME.get(name) : null;
      list.push({ date, future: date > today, player: name || null, tier: card?.tier || null, ovr: card?.ovr || null });
    }
    res.json({ month, days: list, collected: byDate.size });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ---------- Intercambio de repetidas con un amigo del club (Futotal 2.0) ----------
// Una carta repetida tuya por una repetida de él, de la misma categoría (tier). Cada uno
// puede hacer un intercambio por día. La propuesta vence al terminar el día.
async function sharesClub(a, b) {
  return !!(await db.execute({
    sql: "SELECT 1 FROM group_members x JOIN group_members y ON y.group_id = x.group_id AND y.user_id = ? WHERE x.user_id = ? LIMIT 1",
    args: [b, a],
  })).rows[0];
}

const copiesOf = async (userId, name) => Number((await db.execute({ sql: "SELECT count FROM user_cards WHERE user_id = ? AND player_name = ?", args: [userId, name] })).rows[0]?.count || 0);

async function tradeUsedToday(userId, date) {
  return !!(await db.execute({
    sql: "SELECT 1 FROM card_trades WHERE date = ? AND status = 'accepted' AND (from_user = ? OR to_user = ?) LIMIT 1",
    args: [date, userId, userId],
  })).rows[0];
}

router.get("/trades/friends", async (req, res) => {
  try {
    const rows = (await db.execute({
      sql: `SELECT DISTINCT u.id, u.username FROM group_members x
            JOIN group_members y ON y.group_id = x.group_id AND y.user_id <> x.user_id
            JOIN users u ON u.id = y.user_id WHERE x.user_id = ? ORDER BY u.username`,
      args: [req.userId],
    })).rows;
    res.json({ friends: rows.map((r) => ({ id: r.id, username: r.username })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/trades", async (req, res) => {
  try {
    const today = todayStr();
    const rows = (await db.execute({
      sql: `SELECT t.id, t.from_user, t.to_user, t.give, t.want, t.status, t.date, fu.username AS from_name, tu.username AS to_name
            FROM card_trades t JOIN users fu ON fu.id = t.from_user JOIN users tu ON tu.id = t.to_user
            WHERE t.date = ? AND (t.from_user = ? OR t.to_user = ?) ORDER BY t.id DESC`,
      args: [today, req.userId, req.userId],
    })).rows;
    const map = (r) => ({ id: r.id, from: { id: r.from_user, username: r.from_name }, to: { id: r.to_user, username: r.to_name }, give: r.give, want: r.want, status: r.status });
    res.json({ trades: rows.map(map), usedToday: await tradeUsedToday(req.userId, today) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/trades", async (req, res) => {
  try {
    const today = todayStr();
    const toUser = Number(req.body?.toUserId);
    const give = String(req.body?.give || "");
    const want = String(req.body?.want || "");
    if (!Number.isInteger(toUser) || toUser === req.userId || !(await sharesClub(req.userId, toUser))) return res.status(400).json({ error: "Solo podés intercambiar con amigos de tu club" });
    const a = BY_NAME.get(give);
    const b = BY_NAME.get(want);
    if (!a || !b) return res.status(400).json({ error: "Esa carta no existe" });
    if (a.tier !== b.tier) return res.status(400).json({ error: "Tienen que ser de la misma categoría" });
    if (await tradeUsedToday(req.userId, today)) return res.status(409).json({ error: "Hoy ya hiciste un intercambio" });
    if ((await copiesOf(req.userId, give)) < 2) return res.status(400).json({ error: "Solo podés ofrecer cartas repetidas" });
    if ((await copiesOf(toUser, want)) < 2) return res.status(400).json({ error: "Tu amigo no tiene esa carta repetida" });
    const dup = (await db.execute({ sql: "SELECT 1 FROM card_trades WHERE from_user = ? AND date = ? AND status = 'pending'", args: [req.userId, today] })).rows[0];
    if (dup) return res.status(409).json({ error: "Ya tenés una propuesta pendiente hoy" });
    const ins = await db.execute({ sql: "INSERT INTO card_trades (from_user, to_user, give, want, date) VALUES (?, ?, ?, ?, ?)", args: [req.userId, toUser, give, want, today] });
    res.status(201).json({ ok: true, id: Number(ins.lastInsertRowid) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/trades/:id/accept", async (req, res) => {
  try {
    const today = todayStr();
    const t = (await db.execute({ sql: "SELECT * FROM card_trades WHERE id = ?", args: [Number(req.params.id)] })).rows[0];
    if (!t || t.to_user !== req.userId) return res.status(404).json({ error: "Propuesta no encontrada" });
    if (t.status !== "pending") return res.status(409).json({ error: "Esa propuesta ya se resolvió" });
    if (t.date !== today) return res.status(409).json({ error: "La propuesta venció" });
    if (await tradeUsedToday(req.userId, today) || await tradeUsedToday(t.from_user, today)) return res.status(409).json({ error: "Uno de los dos ya hizo un intercambio hoy" });
    if ((await copiesOf(t.from_user, t.give)) < 2 || (await copiesOf(t.to_user, t.want)) < 2) return res.status(409).json({ error: "Alguna de las cartas ya no está repetida" });
    const bump = (user, name, delta) => ({
      sql: "INSERT INTO user_cards (user_id, player_name, count) VALUES (?, ?, ?) ON CONFLICT(user_id, player_name) DO UPDATE SET count = count + ?",
      args: [user, name, Math.max(delta, 0), delta],
    });
    await db.batch([
      bump(t.from_user, t.give, -1), bump(t.to_user, t.give, 1),
      bump(t.to_user, t.want, -1), bump(t.from_user, t.want, 1),
      { sql: "UPDATE card_trades SET status = 'accepted' WHERE id = ?", args: [t.id] },
    ], "write");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/trades/:id/decline", async (req, res) => {
  try {
    const t = (await db.execute({ sql: "SELECT * FROM card_trades WHERE id = ?", args: [Number(req.params.id)] })).rows[0];
    if (!t || (t.to_user !== req.userId && t.from_user !== req.userId)) return res.status(404).json({ error: "Propuesta no encontrada" });
    if (t.status !== "pending") return res.status(409).json({ error: "Esa propuesta ya se resolvió" });
    await db.execute({ sql: "UPDATE card_trades SET status = ? WHERE id = ?", args: [t.from_user === req.userId ? "cancelled" : "declined", t.id] });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ---------- SBC temático (Futotal 2.0) ----------
// Cada 2 semanas hay una temática (Portugal, La Roja, El Clásico…). El desafío pide 11
// cartas REPETIDAS de la temática en una formación a elección (siempre queda una copia de
// cada una) y paga un sobre muy bueno de esa temática. Para que sea alcanzable, mientras
// dura cada sobre ganado trae una carta de la temática y la tienda vende el sobre temático.
const SBC_FORMATIONS = {
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
};
const THEME_SHOP_PRICE = 100;
const THEME_DEFS = [
  { key: "portugal", label: "Portugal", test: (c) => c.nationality === "Portugal" },
  { key: "la_roja", label: "La Roja", test: (c) => c.nationality === "Chile" },
  { key: "clasico", label: "El Clásico", test: (c) => c.clubs.has("Real Madrid") || c.clubs.has("Barcelona") },
  { key: "premier", label: "Premier League", test: (c) => c.league === "premier" },
  { key: "argentina", label: "Argentina", test: (c) => c.nationality === "Argentina" },
  { key: "leyendas", label: "Leyendas", test: (c) => c.retired },
  { key: "brasil", label: "Brasil", test: (c) => c.nationality === "Brasil" },
];
const THEME_POS = ["GK", "DEF", "MID", "FWD"];
const themePool = (def) => CARDS.filter((c) => !c.special && THEME_POS.includes(c.pos) && def.test(c));
// Solo entran temas con suficientes jugadores por línea (al menos 2 arqueros) para que
// cualquiera de las formaciones se pueda armar.
const THEMES = THEME_DEFS.filter((def) => {
  const by = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const c of themePool(def)) by[c.pos] += 1;
  return by.GK >= 2 && by.DEF >= 5 && by.MID >= 5 && by.FWD >= 4;
}).map((def) => ({ ...def, pool: themePool(def) }));
// Desafíos creados por el dueño (tabla custom_sbcs). Se leen de la base cada 30 s y mientras
// uno está activo reemplaza a la temática que rota sola.
export const SBC_FILTERS = {
  nacionalidad: { label: "Nacionalidad", test: (v) => (c) => c.nationality === v },
  club: { label: "Club (que haya jugado)", test: (v) => (c) => c.clubs.has(v) },
  liga: { label: "Liga", test: (v) => (c) => c.league === v },
  retirados: { label: "Retirados", test: () => (c) => !!c.retired },
};
const lineCounts = (pool) => {
  const by = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const c of pool) by[c.pos] += 1;
  return by;
};
export const sbcFeasible = (by) => by.GK >= 2 && by.DEF >= 5 && by.MID >= 5 && by.FWD >= 4;
// Cartas que cumplen el filtro y cuántas hay por línea: sirve de vista previa en el panel.
export function previewSbcFilter(filterType, filterValue) {
  const f = SBC_FILTERS[filterType];
  if (!f) return null;
  const pool = themePool({ test: f.test(String(filterValue || "")) });
  const by = lineCounts(pool);
  return { total: pool.length, by, feasible: sbcFeasible(by) };
}
let customThemes = [];
let customLoadedAt = 0;
export async function refreshCustomSbcs(force = false) {
  if (!force && Date.now() - customLoadedAt < 30_000) return;
  customLoadedAt = Date.now();
  const rows = (await db.execute("SELECT * FROM custom_sbcs ORDER BY start_date")).rows;
  customThemes = rows.map((r) => {
    const f = SBC_FILTERS[r.filter_type];
    const pool = f ? themePool({ test: f.test(String(r.filter_value || "")) }) : [];
    return { key: `custom${r.id}`, label: r.label, pool, start: r.start_date, end: r.end_date, bonusCoins: Number(r.bonus_coins) || 0, custom: true };
  }).filter((t) => sbcFeasible(lineCounts(t.pool)));
}
const themeByKey = (key) => THEMES.find((t) => t.key === key) || customThemes.find((t) => t.key === key) || null;

const THEME_EPOCH = "2026-01-05"; // un lunes: las temáticas cambian cada 14 días desde acá
export function themePeriod(date) {
  const custom = customThemes.find((t) => t.start <= date && date <= t.end);
  if (custom) return { k: -1, start: custom.start, end: custom.end, theme: custom };
  const days = Math.floor((new Date(`${date}T12:00:00Z`) - new Date(`${THEME_EPOCH}T12:00:00Z`)) / 86400000);
  const k = Math.max(0, Math.floor(days / 14));
  const start = addDays(THEME_EPOCH, k * 14);
  return { k, start, end: addDays(start, 13), theme: THEMES.length ? THEMES[k % THEMES.length] : null };
}
const activeTheme = (date) => themePeriod(date).theme;

const TIER_ORDER = ["estrella", "oro", "plata", "bronce"];

// Sobre Élite (podio del mes del club principal): una carta de 90 o más asegurada y cuatro de nivel top.
function drawElitePack(misses = 0) {
  const top = CARDS.filter((c) => c.ovr >= 90 && c.pos);
  const best = top.length ? top : [CARDS.reduce((a, b) => (b.ovr > a.ovr ? b : a))];
  const cards = [pickOf(best)];
  while (cards.length < 5) cards.push(drawCard("top", cards.length, misses * 3));
  return cards;
}

// Sobre de bienvenida: 5 cartas, la primera de tu club favorito (la mejor posible dentro de
// un sorteo «bueno»). Si no hay cartas de ese club, sale un sobre bueno común.
const sameClub = (a, b) => String(a).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === String(b).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function drawWelcomePack(clubName, misses = 0) {
  const canon = careerName(clubName);
  const pool = CARDS.filter((c) => !c.special && THEME_POS.includes(c.pos) && [...c.clubs].some((k) => sameClub(k, canon) || sameClub(k, clubName)));
  const cards = [];
  if (pool.length) cards.push(drawFromTheme({ pool }, "bueno"));
  while (cards.length < 5) cards.push(drawCard("bueno", cards.length, misses * 3));
  return cards;
}
function drawFromTheme(theme, quality = "bueno") {
  const weights = (PACKS[quality] || PACKS.bueno).weights;
  const byTier = (t) => theme.pool.filter((c) => c.tier === t);
  let r = Math.random() * TIERS.reduce((sum, t) => sum + (byTier(t.key).length ? weights[t.key] ?? t.weight : 0), 0);
  for (const t of TIERS) {
    const pool = byTier(t.key);
    if (!pool.length) continue;
    r -= weights[t.key] ?? t.weight;
    if (r <= 0) return pickOf(pool);
  }
  return pickOf(theme.pool);
}
// Sobre muy bueno de la temática: 5 cartas de la temática y la primera es la mejor tier disponible.
function drawThemePack(theme) {
  const top = TIER_ORDER.map((t) => theme.pool.filter((c) => c.tier === t)).find((p) => p.length) || theme.pool;
  const cards = [pickOf(top)];
  for (let i = 1; i < 5; i++) cards.push(drawFromTheme(theme, "bueno"));
  return cards;
}

async function ownedRepeats(userId, theme) {
  const rows = (await db.execute({ sql: "SELECT player_name, count FROM user_cards WHERE user_id = ? AND count >= 2", args: [userId] })).rows;
  const names = new Set(theme.pool.map((c) => c.name));
  return rows.filter((r) => names.has(r.player_name)).map((r) => ({ ...BY_NAME.get(r.player_name), count: Number(r.count) }));
}

function bestFormation(repeats) {
  const have = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const c of repeats) have[c.pos] += 1;
  let best = null;
  for (const [name, need] of Object.entries(SBC_FORMATIONS)) {
    const missing = {};
    let total = 0;
    for (const p of THEME_POS) { const m = Math.max(0, need[p] - have[p]); if (m) missing[p] = m; total += m; }
    if (!best || total < best.total) best = { formation: name, missing, total };
  }
  return { have, best, owned: Math.min(11, 11 - best.total) };
}

router.get("/sbc-tema", async (req, res) => {
  try {
    await refreshCustomSbcs();
    const { theme, start, end } = themePeriod(todayStr());
    if (!theme) return res.json({ theme: null });
    const repeats = await ownedRepeats(req.userId, theme);
    const done = !!(await db.execute({ sql: "SELECT 1 FROM card_packs WHERE user_id = ? AND date = ? AND source = ?", args: [req.userId, start, `bueno-sbctema-${theme.key}`] })).rows[0];
    const { have, best, owned } = bestFormation(repeats);
    res.json({
      theme: { key: theme.key, label: theme.label, start, end }, formations: SBC_FORMATIONS,
      done, shopPrice: THEME_SHOP_PRICE, have, best, owned, total: 11,
      candidates: repeats.sort((a, b) => b.ovr - a.ovr).map((c) => ({ name: c.name, pos: c.pos, ovr: c.ovr, tier: c.tier, count: c.count })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/sbc-tema/submit", async (req, res) => {
  try {
    await refreshCustomSbcs();
    const { theme, start } = themePeriod(todayStr());
    if (!theme) return res.status(404).json({ error: "No hay un desafío activo" });
    const formation = SBC_FORMATIONS[req.body?.formation];
    if (!formation) return res.status(400).json({ error: "Elegí una formación: 4-3-3, 4-4-2 o 3-5-2" });
    const names = Array.isArray(req.body?.players) ? [...new Set(req.body.players)] : [];
    if (names.length !== 11) return res.status(400).json({ error: "El desafío necesita 11 cartas distintas" });
    const source = `bueno-sbctema-${theme.key}`;
    if ((await db.execute({ sql: "SELECT 1 FROM card_packs WHERE user_id = ? AND date = ? AND source = ?", args: [req.userId, start, source] })).rows[0]) {
      return res.status(409).json({ error: "Ya completaste este desafío" });
    }
    const inTheme = new Set(theme.pool.map((c) => c.name));
    const cards = names.map((n) => BY_NAME.get(n));
    if (cards.some((c) => !c || !inTheme.has(c.name))) return res.status(400).json({ error: `Todas las cartas tienen que ser de la temática: ${theme.label}` });
    const count = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const c of cards) count[c.pos] += 1;
    if (THEME_POS.some((p) => count[p] !== formation[p])) return res.status(400).json({ error: "Las cartas no calzan con esa formación" });
    const owned = new Map((await db.execute({ sql: "SELECT player_name, count FROM user_cards WHERE user_id = ?", args: [req.userId] })).rows.map((r) => [r.player_name, Number(r.count)]));
    if (names.some((n) => (owned.get(n) || 0) < 2)) return res.status(400).json({ error: "Solo se entregan cartas repetidas: siempre te queda una copia de cada una" });
    for (const n of names) await db.execute({ sql: "UPDATE user_cards SET count = count - 1 WHERE user_id = ? AND player_name = ? AND count >= 2", args: [req.userId, n] });
    await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source, theme) VALUES (?, ?, ?, ?)", args: [req.userId, start, source, theme.key] });
    if (theme.bonusCoins) await creditWallet(req.userId, theme.bonusCoins);
    res.json({ ok: true, reward: { pack: "muy bueno", theme: theme.label, coins: theme.bonusCoins || 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// El sobre temático se vende en la tienda por monedas (nunca dinero real).
router.post("/sbc-tema/shop", async (req, res) => {
  try {
    await refreshCustomSbcs();
    const { theme } = themePeriod(todayStr());
    if (!theme) return res.status(404).json({ error: "No hay una temática activa" });
    const wallet = (await db.execute({ sql: "SELECT balance FROM card_wallets WHERE user_id = ?", args: [req.userId] })).rows[0];
    const balance = wallet ? Number(wallet.balance) : 0;
    if (balance < THEME_SHOP_PRICE) return res.status(400).json({ error: "No te alcanzan las monedas" });
    const today = todayStr();
    const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM card_packs WHERE user_id = ? AND date = ? AND source LIKE 'bueno-tematica%'", args: [req.userId, today] })).rows[0].n);
    await db.execute({ sql: "INSERT INTO card_packs (user_id, date, source, theme) VALUES (?, ?, ?, ?)", args: [req.userId, today, `bueno-tematica${n + 1}`, theme.key] });
    await creditWallet(req.userId, -THEME_SHOP_PRICE);
    res.json({ ok: true, balance: balance - THEME_SHOP_PRICE });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;

// Pool de jugadores reales (con su OVR y puesto) para otros juegos que necesiten
// "jugadores con nivel", como la Subasta (server/routes/subasta.js).
export function draftPool() {
  return BASE_CARDS.map((c) => ({ name: c.name, ovr: c.ovr, pos: c.pos, nationality: c.nationality, club: c.club }));
}
