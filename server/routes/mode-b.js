import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { todayStr } from "../utils/points.js";

const router = Router();
router.use(requireAuth);

// Obtener preguntas Modo B para hoy (quién es más + qué prefieres + personalidad)
router.get("/today", async (req, res) => {
  const groupId = Number(req.query.groupId);
  if (!groupId) return res.status(400).json({ error: "Falta groupId" });

  try {
    const today = todayStr();

    // Obtener preguntas especiales
    const specialResult = await db.execute({
      sql: "SELECT type, prompt FROM special_questions WHERE scheduled_date = ?",
      args: [today],
    });

    const quienEsMas = specialResult.rows.find((q) => q.type === "quien_es_mas");
    const quePrefieres = specialResult.rows.find((q) => q.type === "que_prefieres");

    if (!quienEsMas || !quePrefieres) {
      return res.status(404).json({ error: "No hay preguntas especiales para hoy" });
    }

    // Obtener miembros del grupo para pregunta personalizada
    const membersResult = await db.execute({
      sql: `SELECT u.id, u.username FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?`,
      args: [groupId],
    });

    const members = membersResult.rows;
    if (members.length === 0) {
      return res.status(400).json({ error: "El grupo no tiene miembros" });
    }

    // Seleccionar personalidad aleatoria del grupo
    const randomMember = members[Math.floor(Math.random() * members.length)];

    res.json({
      questions: [
        {
          id: 1,
          type: "quien_es_mas",
          prompt: quienEsMas.prompt,
          candidates: members,
        },
        {
          id: 2,
          type: "que_prefieres",
          prompt: quePrefieres.prompt,
          options: ["Opción A", "Opción B"],
        },
        {
          id: 3,
          type: "personalidad",
          prompt: `Si ${randomMember.username} fuera a la cárcel, ¿por qué sería?`,
          options: [
            "Por abusar de cebollitas al pedir gol",
            "Por arruinar predicciones con análisis",
            "Por festejar goles como si ganara Libertadores",
            "Por llevar 10 camisetas al partido",
          ],
          personality: randomMember.username,
        },
      ],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
