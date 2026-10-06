import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { todayStr } from "../utils/points.js";
import { TRANSFER_HIT_POINTS as HIT_POINTS } from "../utils/points-config.js";
import { windowStatus, PHASE_LABEL } from "../utils/season-windows.js";

const predictLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: "Muchos cambios seguidos, esperá un momento." });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/equipo-jugador-players.json"), "utf-8")).jugadores;

const router = Router();

// Mercado: cada ventana hay "rumores" — una figura y 4 destinos posibles (uno es
// quedarse donde está). Cada persona elige uno; cuando el mercado se cierra se
// carga el resultado real (POST /resolve, protegido con un secreto de admin) y
// cada acierto suma 10 puntos. Los puntos se guardan en wordle_results con
// league 'tp<id>' para que sumen al total del perfil y al ranking sin tocar
// la suma de puntos de stats.js.
// Hay dos mercados, Europa y Chile, y cada uno abre solo al inicio y al final
// de su temporada (ver utils/season-windows.js). Fuera de la ventana se ve el
// último mercado de esa región, pero ya no se puede elegir.
const RUMORS_PER_WINDOW = 12;
const DESTINATIONS = {
  europa: ["Real Madrid", "Barcelona", "Manchester City", "Manchester United", "Liverpool", "Arsenal", "Chelsea", "Bayern Munich", "Paris Saint-Germain", "Inter Milan", "Juventus", "AC Milan", "Atletico Madrid", "Tottenham Hotspur", "Napoli", "Borussia Dortmund", "Al Hilal", "Al Nassr"],
  chile: ["Colo-Colo", "Universidad de Chile", "Universidad Católica", "Unión Española", "Palestino", "Cobreloa", "Huachipato", "Coquimbo Unido", "O'Higgins", "Audax Italiano", "Everton de Viña del Mar", "Boca Juniors", "River Plate", "Flamengo", "Palmeiras", "Club América"],
};
const CHILE_CLUBS = DESTINATIONS.chile.slice(0, 11).concat(["Universidad Catolica", "Colo Colo", "Cobresal", "Ñublense", "Deportes Iquique", "Unión La Calera", "Deportes La Serena", "Deportes Limache", "Union La Calera", "Union Espanola", "Everton de Vina", "OHiggins"]);
// Los nombres de la base vienen sin acentos ni signos ("OHiggins", "Union
// Espanola"): se comparan normalizados para no ofrecer el propio club.
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/gi, "n").replace(/[^a-z]/gi, "").toLowerCase();
const sameClub = (a, b) => norm(a) === norm(b) || norm(a).startsWith(norm(b)) || norm(b).startsWith(norm(a));
const isChileClub = (club) => CHILE_CLUBS.some((c) => norm(club) === norm(c));

function windowFor(region) {
  const status = windowStatus(region);
  if (!status.open) return { status, key: null };
  const year = new Date().getFullYear();
  return {
    status,
    key: `${year}-${region}-${status.phase}`,
    label: `Mercado ${status.label} · ${status.phaseLabel} ${year}`,
  };
}

const labelForKey = (key) => {
  const [year, region, phase] = key.split("-");
  return `Mercado ${region === "chile" ? "Chile" : "Europa"} · ${PHASE_LABEL[phase] || phase} ${year}`;
};

function seeded(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const currentClub = (p) => {
  const open = (p.carrera || []).find((c) => c.fin === null);
  return (open || [...p.carrera].sort((a, b) => (b.inicio || 0) - (a.inicio || 0))[0])?.club.replace(/\s*\((cedido|cantera)\)\s*$/i, "");
};

async function ensureRumors(key, region) {
  const have = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM transfer_rumors WHERE window = ?", args: [key] })).rows[0].n);
  if (have > 0) return;
  const rnd = seeded(key);
  // Europa: figuras (la base viene de más a menos conocido) en un club activo.
  // Chile: cualquiera que hoy juegue en un club chileno.
  const active = (p) => currentClub(p) && p.carrera.some((c) => c.fin === null);
  const pool = region === "chile"
    ? ALL.filter((p) => active(p) && isChileClub(currentClub(p)))
    : ALL.slice(0, 220).filter((p) => active(p) && !isChileClub(currentClub(p)));
  for (let i = 0; i < RUMORS_PER_WINDOW && pool.length; i++) {
    const p = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const club = currentClub(p);
    const others = DESTINATIONS[region].filter((d) => !sameClub(d, club));
    const picks = [];
    while (picks.length < 3) picks.push(...others.splice(Math.floor(rnd() * others.length), 1));
    const options = [`Se queda en ${club}`, ...picks];
    await db.execute({
      sql: "INSERT INTO transfer_rumors (window, player_name, options) VALUES (?, ?, ?)",
      args: [key, p.nombre.replace(/\s*\([^)]*\)\s*$/, ""), JSON.stringify(options)],
    });
  }
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const region = req.query.region === "chile" ? "chile" : "europa";
    const win = windowFor(region);
    let key = win.key;
    if (key) {
      await ensureRumors(key, region);
    } else {
      // Cerrado: se muestra el último mercado de esta región, solo para mirar.
      const last = (await db.execute({ sql: "SELECT window FROM transfer_rumors WHERE window LIKE ? ORDER BY id DESC LIMIT 1", args: [`%-${region}-%`] })).rows[0];
      key = last?.window || null;
    }
    const rumors = key ? (await db.execute({ sql: "SELECT id, player_name, options, answer FROM transfer_rumors WHERE window = ? ORDER BY id", args: [key] })).rows : [];
    const mine = new Map((await db.execute({ sql: "SELECT rumor_id, pick FROM transfer_predictions WHERE user_id = ?", args: [req.userId] })).rows.map((r) => [r.rumor_id, r.pick]));
    res.json({
      region,
      open: win.status.open,
      status: win.status,
      window: key ? (win.key ? win.label : labelForKey(key)) : null,
      points: HIT_POINTS,
      rumors: rumors.map((r) => ({ id: r.id, player: r.player_name, options: JSON.parse(r.options), answer: r.answer, pick: mine.get(r.id) || null })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/predict", requireAuth, predictLimiter, async (req, res) => {
  try {
    const id = Number(req.body?.rumorId);
    const pick = String(req.body?.pick || "");
    const r = (await db.execute({ sql: "SELECT window, options, answer FROM transfer_rumors WHERE id = ?", args: [id] })).rows[0];
    if (!r) return res.status(404).json({ error: "Rumor inexistente" });
    if (r.answer) return res.status(400).json({ error: "Este mercado ya se resolvió" });
    const region = String(r.window).includes("-chile-") ? "chile" : "europa";
    if (windowFor(region).key !== r.window) return res.status(403).json({ error: "Este mercado está cerrado: abre al inicio y al final de la temporada" });
    if (!JSON.parse(r.options).includes(pick)) return res.status(400).json({ error: "Opción inválida" });
    await db.execute({
      sql: "INSERT INTO transfer_predictions (user_id, rumor_id, pick) VALUES (?, ?, ?) ON CONFLICT(user_id, rumor_id) DO UPDATE SET pick = excluded.pick",
      args: [req.userId, id, pick],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Carga el destino real y reparte los puntos. Solo con el secreto de admin.
router.post("/resolve", async (req, res) => {
  const secret = process.env.ADMIN_SECRET || process.env.PUSH_CRON_SECRET;
  if (!secret || req.headers["x-admin-secret"] !== secret) return res.status(403).json({ error: "No autorizado" });
  try {
    const id = Number(req.body?.rumorId);
    const answer = String(req.body?.answer || "");
    const r = (await db.execute({ sql: "SELECT options, answer FROM transfer_rumors WHERE id = ?", args: [id] })).rows[0];
    if (!r || r.answer) return res.status(400).json({ error: "Rumor inexistente o ya resuelto" });
    if (!JSON.parse(r.options).includes(answer)) return res.status(400).json({ error: "La respuesta debe ser una de las opciones" });
    await db.execute({ sql: "UPDATE transfer_rumors SET answer = ? WHERE id = ?", args: [answer, id] });
    const hits = (await db.execute({ sql: "SELECT user_id FROM transfer_predictions WHERE rumor_id = ? AND pick = ?", args: [id, answer] })).rows;
    for (const h of hits) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO wordle_results (user_id, date, league, attempts, points) VALUES (?, ?, ?, 0, ?)",
        args: [h.user_id, todayStr(), `tp${id}`, HIT_POINTS],
      });
    }
    res.json({ ok: true, hits: hits.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
