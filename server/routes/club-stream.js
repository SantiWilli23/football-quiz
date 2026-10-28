import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/client.js";
import { bus } from "../utils/bus.js";

// Tabla en vivo (SSE): EventSource no puede mandar el encabezado Authorization, así que el
// token viaja en la URL (?token=). Solo se entrega lo que pasa en clubes de los que eres miembro.
const router = Router();
const HEARTBEAT_MS = 25_000;

router.get("/:id", async (req, res) => {
  let userId;
  try { userId = jwt.verify(String(req.query.token || ""), process.env.JWT_SECRET).userId; } catch { return res.status(401).end(); }
  const groupId = Number(req.params.id);
  try {
    const member = (await db.execute({ sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", args: [groupId, userId] })).rows[0];
    if (!member) return res.status(403).end();
  } catch { return res.status(500).end(); }

  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders?.();
  res.write("retry: 5000\n\n");

  const names = new Map();
  const onPoints = async (e) => {
    if (e.groupId !== groupId) return;
    if (!names.has(e.userId)) names.set(e.userId, (await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [e.userId] })).rows[0]?.username || "Alguien");
    res.write(`event: points\ndata: ${JSON.stringify({ userId: e.userId, username: names.get(e.userId), points: e.points, source: e.source })}\n\n`);
  };
  bus.on("points", onPoints);
  const beat = setInterval(() => res.write(": latido\n\n"), HEARTBEAT_MS);
  req.on("close", () => { clearInterval(beat); bus.off("points", onPoints); });
});

export default router;
