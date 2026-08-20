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
    created_at: u.created_at,
  };
}

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
        total_points: Number(stats.total_points),
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
