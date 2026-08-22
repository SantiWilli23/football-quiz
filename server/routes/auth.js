import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { getCurrentStreak, getBestStreak } from "../utils/points.js";

const router = Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatar: u.avatar,
    avatar_config: u.avatar_config,
    created_at: u.created_at,
  };
}

// El avatar es un muñequito dibujado con SVG en el cliente; acá sólo se guarda
// su configuración. Se valida contra listas cerradas para que nadie meta
// cualquier cosa en un campo que después se pinta en la pantalla de todos.
const AVATAR_OPTIONS = {
  bg: ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#14b8a6"],
  skin: ["#f2d0b4", "#e0ac82", "#c68642", "#8d5524", "#5c3317"],
  hairColor: ["#2c1b18", "#5a3825", "#a55728", "#d6b370", "#b9b9b9", "#2f6fa8"],
  hair: ["corto", "rulos", "largo", "gorro", "pelado"],
  face: ["sonrisa", "seria", "grito", "picara"],
  accessory: ["ninguno", "anteojos", "vincha", "barba"],
};

router.put("/avatar", requireAuth, async (req, res) => {
  const config = req.body?.config;
  if (!config || typeof config !== "object") {
    return res.status(400).json({ error: "Falta la configuración del avatar" });
  }

  const clean = {};
  for (const [key, allowed] of Object.entries(AVATAR_OPTIONS)) {
    if (!allowed.includes(config[key])) {
      return res.status(400).json({ error: `Valor inválido para ${key}` });
    }
    clean[key] = config[key];
  }

  try {
    await db.execute({
      sql: "UPDATE users SET avatar_config = ? WHERE id = ?",
      args: [JSON.stringify(clean), req.userId],
    });
    res.json({ avatar_config: JSON.stringify(clean) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  try {
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE username = ? OR email = ?",
      args: [username, email],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "El usuario o email ya existe" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const avatar = username.trim().charAt(0).toUpperCase();

    const result = await db.execute({
      sql: "INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)",
      args: [username, email, password_hash, avatar],
    });

    const userId = Number(result.lastInsertRowid);
    const token = signToken(userId);
    const userRow = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] });

    res.status(201).json({ token, user: publicUser(userRow.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.put("/password", requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};

  if (!current_password || !new_password) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: "La contraseña nueva debe tener al menos 6 caracteres" });
  }
  if (new_password === current_password) {
    return res.status(400).json({ error: "La contraseña nueva tiene que ser distinta" });
  }

  try {
    const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Se pide la actual aunque ya estés logueado: si alguien te deja la sesión
    // abierta, no debería poder cambiarte la contraseña y dejarte afuera.
    if (!(await bcrypt.compare(current_password, user.password_hash))) {
      return res.status(401).json({ error: "La contraseña actual no es correcta" });
    }

    await db.execute({
      sql: "UPDATE users SET password_hash = ? WHERE id = ?",
      args: [await bcrypt.hash(new_password, 10), req.userId],
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.put("/username", requireAuth, async (req, res) => {
  const username = String(req.body?.username ?? "").trim();

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: "El nombre debe tener entre 3 y 20 caracteres" });
  }

  try {
    const taken = await db.execute({
      sql: "SELECT id FROM users WHERE username = ? AND id != ?",
      args: [username, req.userId],
    });
    if (taken.rows.length > 0) {
      return res.status(409).json({ error: "Ese nombre ya está en uso" });
    }

    const currentResult = await db.execute({
      sql: "SELECT username FROM users WHERE id = ?",
      args: [req.userId],
    });
    const previous = currentResult.rows[0]?.username;

    // La inicial del avatar se recalcula sola; sólo importa para quien todavía
    // no armó su muñequito.
    await db.execute({
      sql: "UPDATE users SET username = ?, avatar = ? WHERE id = ?",
      args: [username, username.charAt(0).toUpperCase(), req.userId],
    });

    // Las preguntas de personalidad guardan el nombre del protagonista y
    // además lo tienen escrito dentro del texto ("Si willy fuera a la
    // cárcel..."), así que hay que actualizar las dos cosas o quedan hablando
    // de alguien que ya no existe.
    if (previous && previous !== username) {
      await db.execute({
        sql: `UPDATE personality_questions
              SET personality_name = ?, prompt_template = REPLACE(prompt_template, ?, ?)
              WHERE personality_name = ?`,
        args: [username, previous, username, previous],
      });
    }

    res.json({ ok: true, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.userId] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const statsResult = await db.execute({
      sql: `SELECT
              COUNT(*) AS answered,
              COALESCE(SUM(is_correct), 0) AS correct,
              COALESCE(SUM(points), 0) AS total_points
            FROM answers WHERE user_id = ?`,
      args: [req.userId],
    });
    const stats = statsResult.rows[0];
    const answered = Number(stats.answered);
    const correct = Number(stats.correct);

    // Los puntos de Modo B se liquidan por grupo y día en `mode_b_scores`; acá
    // se suman todos los grupos del usuario para el total general.
    const modeBResult = await db.execute({
      sql: "SELECT COALESCE(SUM(points), 0) AS points FROM mode_b_scores WHERE user_id = ?",
      args: [req.userId],
    });
    const mode_b_points = Number(modeBResult.rows[0].points);
    const trivia_points = Number(stats.total_points);

    const [current_streak, best_streak] = await Promise.all([
      getCurrentStreak(req.userId),
      getBestStreak(req.userId),
    ]);

    res.json({
      user: publicUser(user),
      stats: {
        answered,
        correct,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
        trivia_points,
        mode_b_points,
        total_points: trivia_points + mode_b_points,
        current_streak,
        best_streak,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
