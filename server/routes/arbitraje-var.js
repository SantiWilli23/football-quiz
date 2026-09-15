import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Modo Arbitraje/VAR: banco de jugadas fijo (no hace falta tabla propia, el
// puntaje final se manda al framework genérico de "retos" como cualquier
// otro juego semanal, mismo patrón que Un Minuto). "correct" es el índice
// de la decisión correcta dentro de "options".
const DECISIONS = ["Sigue el juego", "Amarilla", "Roja", "Penal", "Fuera de juego", "Gol anulado"];

const SITUATIONS = [
  { id: 1, text: "El defensor llega tarde y golpea el tobillo del rival en el área, sin jugar la pelota.", correct: 3 },
  { id: 2, text: "Un jugador protesta enérgicamente un fallo, pero sin agredir ni faltar el respeto.", correct: 0 },
  { id: 3, text: "Entrada por detrás, a destiempo, con los tapones altos sobre la espinilla del rival.", correct: 2 },
  { id: 4, text: "El delantero recibe un pase estando un metro adelantado de la última línea defensiva.", correct: 4 },
  { id: 5, text: "Mano de un defensor dentro del área, con el brazo pegado al cuerpo, en un rebote inesperado.", correct: 0 },
  { id: 6, text: "Mano de un defensor dentro del área con el brazo extendido y separado del cuerpo, ampliando la superficie corporal.", correct: 3 },
  { id: 7, text: "Segundo amarillo del partido para el mismo jugador tras una falta táctica.", correct: 2 },
  { id: 8, text: "Gol convertido tras una jugada donde el pasador estaba en posición adelantada.", correct: 5 },
  { id: 9, text: "Un jugador simula una falta dentro del área para intentar ganar un penal.", correct: 1 },
  { id: 10, text: "Choque fortuito entre dos jugadores disputando el balón limpiamente, sin intención ni imprudencia.", correct: 0 },
  { id: 11, text: "El arquero sale y derriba al delantero fuera del área, en última instancia.", correct: 2 },
  { id: 12, text: "Falta táctica clara para cortar un contragolpe peligroso a mitad de cancha.", correct: 1 },
  { id: 13, text: "El balón pega en la mano de un defensor que está cayendo al piso, en una posición natural.", correct: 0 },
  { id: 14, text: "Un jugador empuja con las dos manos a un rival en la espalda dentro del área.", correct: 3 },
  { id: 15, text: "Codazo intencional lejos del balón, visto claramente en la repetición.", correct: 2 },
  { id: 16, text: "El delantero estaba en posición adelantada pero no participó de la jugada ni interfirió a nadie.", correct: 0 },
  { id: 17, text: "Un jugador suplente ingresa al campo sin autorización y toca el balón en una jugada activa.", correct: 1 },
  { id: 18, text: "Falta de tarjeta reincidente sobre el mismo rival por tercera vez en el partido.", correct: 1 },
  { id: 19, text: "Pisotón intencional al tobillo del rival mientras está en el piso, lejos del balón.", correct: 2 },
  { id: 20, text: "Gol de cabeza tras un córner, sin ninguna infracción previa.", correct: 0 },
];

function publicSituation(s) {
  return { id: s.id, text: s.text, options: DECISIONS };
}

router.get("/situation", (req, res) => {
  const exclude = String(req.query.exclude || "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));

  const pool = SITUATIONS.filter((s) => !exclude.includes(s.id));
  const list = pool.length ? pool : SITUATIONS;
  const picked = list[Math.floor(Math.random() * list.length)];
  res.json({ situation: publicSituation(picked) });
});

router.post("/decide", (req, res) => {
  const situationId = Number(req.body?.situationId);
  const decisionIdx = Number(req.body?.decisionIdx);
  const situation = SITUATIONS.find((s) => s.id === situationId);
  if (!situation || !Number.isInteger(decisionIdx)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  res.json({ correct: situation.correct === decisionIdx, correctIdx: situation.correct });
});

export default router;
