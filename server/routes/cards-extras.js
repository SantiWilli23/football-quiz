import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { lineupOf } from "./cards.js";
import {
  coachCards, isCoachCard, saveExtras, squadProgress, SQUAD_RULE, formList, formUpdated,
  refreshFormIfStale, lineupEffects, FORM_BONUS,
} from "../utils/card-types.js";

// Entrenador, capitán, colecciones de selección y jugadores "en forma" de Cartas.
// Mismo acceso que Cartas: solo si algún grupo tuyo lo tiene activado.
const router = Router();
router.use(requireAuth);

router.use(async (req, res, next) => {
  try {
    const row = (await db.execute({
      sql: `SELECT 1 FROM group_members gm JOIN groups_t g ON g.id = gm.group_id
            WHERE gm.user_id = ? AND g.cards_enabled = 1 LIMIT 1`,
      args: [req.userId],
    })).rows[0];
    if (!row) return res.status(404).json({ error: "Cartas no está activado en ninguno de tus grupos" });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

const pubCoach = (c) => ({ name: c.name, realName: c.realName, special: c.special, note: c.note, tier: c.tier, tierLabel: c.tierLabel, ovr: c.ovr, pos: c.pos, nationality: c.nationality, club: c.club, kind: c.kind });
const realOf = (cardName) => String(cardName).split(" · ")[0];

async function ownedNames(userId) {
  return (await db.execute({ sql: "SELECT player_name FROM user_cards WHERE user_id = ?", args: [userId] })).rows.map((r) => r.player_name);
}

router.get("/", async (req, res) => {
  try {
    refreshFormIfStale();
    const [lineup, owned] = await Promise.all([lineupOf(req.userId), ownedNames(req.userId)]);
    const ownedSet = new Set(owned);
    const extras = lineup.extras || { coach: null, captain: null };
    res.json({
      coach: extras.coach ? pubCoach(extras.coach) : null,
      captain: extras.captain,
      coaches: coachCards().filter((c) => ownedSet.has(c.name)).map(pubCoach),
      squads: squadProgress(owned.map(realOf), lineup),
      squadRule: SQUAD_RULE,
      effects: lineup.length === 11 ? lineupEffects(lineup).breakdown : null,
      form: { bonus: FORM_BONUS, players: formList().slice(0, 40), updatedAt: formUpdated() || null },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.put("/", async (req, res) => {
  try {
    const lineup = await lineupOf(req.userId);
    const coach = req.body?.coach ? String(req.body.coach) : null;
    const captain = req.body?.captain ? String(req.body.captain) : null;

    if (coach) {
      if (!isCoachCard(coach)) return res.status(400).json({ error: "Esa carta no es un entrenador" });
      const owned = new Set(await ownedNames(req.userId));
      if (!owned.has(coach)) return res.status(400).json({ error: "Ese entrenador no lo tenés" });
    }
    if (captain && !lineup.some((c) => c.name === captain)) {
      return res.status(400).json({ error: "El capitán tiene que estar en tu once guardado" });
    }
    await saveExtras(req.userId, { coach, captain });
    const fresh = await lineupOf(req.userId);
    res.json({ ok: true, effects: fresh.length === 11 ? lineupEffects(fresh).breakdown : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
