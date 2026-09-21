import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { getCurrentStreak, todayStr } from "../utils/points.js";

const router = Router();
router.use(requireAuth);

// Pase de temporada: un tema por mes con misiones que se miden con datos que ya
// existen (trivia, Fichado, retos del día, racha, cartas). Cada misión aporta XP
// proporcional a su avance; los 5 escalones dan sobres de cartas y títulos.
const THEMES = ["Copa Libertadores", "Champions League", "Copa América", "Eurocopa", "Mundial", "Clásicos", "Derbis eternos", "Mercado de pases", "Fecha FIFA", "Ligas del mundo", "Ídolos", "Fiesta de fin de año"];
const TIERS = [
  { tier: 1, xp: 100, label: "1 sobre de cartas", pack: true },
  { tier: 2, xp: 200, label: "Título «Aficionado»", title: "Aficionado" },
  { tier: 3, xp: 300, label: "1 sobre de cartas", pack: true },
  { tier: 4, xp: 400, label: "Título «Crack»", title: "Crack" },
  { tier: 5, xp: 500, label: "2 sobres y el título «Leyenda del mes»", pack: 2, title: "Leyenda del mes" },
];

async function missions(userId, month) {
  const from = `${month}-01`;
  const to = `${month}-31`;
  const n = async (sql, args) => Number((await db.execute({ sql, args })).rows[0]?.n || 0);
  return [
    { key: "trivia", label: "Responder 30 preguntas de la trivia", target: 30, progress: await n("SELECT COUNT(*) AS n FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.user_id = ? AND q.scheduled_date >= ? AND q.scheduled_date <= ?", [userId, from, to]) },
    { key: "fichado", label: "Ganar 10 Fichados", target: 10, progress: await n("SELECT COUNT(*) AS n FROM fichado_games WHERE user_id = ? AND status = 'won' AND date >= ? AND date <= ?", [userId, from, to]) },
    { key: "retos", label: "Cumplir 12 retos del día", target: 12, progress: await n("SELECT COUNT(*) AS n FROM wordle_results WHERE user_id = ? AND league = 'reto' AND date >= ? AND date <= ?", [userId, from, to]) },
    { key: "racha", label: "Llegar a 7 días de racha", target: 7, progress: await getCurrentStreak(userId) },
    { key: "cartas", label: "Juntar 40 cartas distintas", target: 40, progress: await n("SELECT COUNT(*) AS n FROM user_cards WHERE user_id = ?", [userId]) },
  ];
}

router.get("/", async (req, res) => {
  try {
    const month = todayStr().slice(0, 7);
    const ms = await missions(req.userId, month);
    const xp = Math.round(ms.reduce((s, m) => s + Math.min(1, m.progress / m.target) * 100, 0));
    const claimed = new Set((await db.execute({ sql: "SELECT tier FROM season_claims WHERE user_id = ? AND season = ?", args: [req.userId, month] })).rows.map((r) => Number(r.tier)));
    const titles = (await db.execute({ sql: "SELECT title, season FROM user_titles WHERE user_id = ? ORDER BY season DESC", args: [req.userId] })).rows;
    res.json({
      season: month,
      theme: THEMES[Number(month.slice(5, 7)) - 1],
      xp,
      missions: ms.map((m) => ({ ...m, progress: Math.min(m.progress, m.target) })),
      tiers: TIERS.map((t) => ({ tier: t.tier, xp: t.xp, label: t.label, reached: xp >= t.xp, claimed: claimed.has(t.tier) })),
      titles: titles.map((t) => ({ title: t.title, season: t.season })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/claim", async (req, res) => {
  try {
    const month = todayStr().slice(0, 7);
    const tier = TIERS.find((t) => t.tier === Number(req.body?.tier));
    if (!tier) return res.status(400).json({ error: "Escalón inexistente" });
    const ms = await missions(req.userId, month);
    const xp = Math.round(ms.reduce((s, m) => s + Math.min(1, m.progress / m.target) * 100, 0));
    if (xp < tier.xp) return res.status(400).json({ error: "Todavía no llegaste a ese escalón" });
    const ins = await db.execute({ sql: "INSERT OR IGNORE INTO season_claims (user_id, season, tier) VALUES (?, ?, ?)", args: [req.userId, month, tier.tier] });
    if (ins.rowsAffected === 0) return res.status(409).json({ error: "Ya lo reclamaste" });
    const packs = tier.pack === true ? 1 : tier.pack || 0;
    for (let i = 0; i < packs; i++) {
      await db.execute({ sql: "INSERT OR IGNORE INTO card_packs (user_id, date, source) VALUES (?, ?, ?)", args: [req.userId, todayStr(), `pase-${month}-${tier.tier}-${i + 1}`] });
    }
    if (tier.title) await db.execute({ sql: "INSERT OR IGNORE INTO user_titles (user_id, title, season) VALUES (?, ?, ?)", args: [req.userId, tier.title, month] });
    res.json({ ok: true, packs, title: tier.title || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
