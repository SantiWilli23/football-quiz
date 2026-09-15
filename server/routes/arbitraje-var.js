import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Modo Arbitraje/VAR: banco de jugadas fijo (no hace falta tabla propia, el
// puntaje final se manda al framework genérico de "retos" como cualquier
// otro juego semanal, mismo patrón que Un Minuto). "correct" es el índice
// de la decisión correcta dentro de "options".
//
// Las jugadas están pensadas para ser POLÉMICAS a propósito — el reglamento
// real de fuera de juego/manos/roja tiene casos límite documentados que
// generan debate en cualquier transmisión, así que cada una trae un
// "why" que explica el criterio exacto que la resuelve (se muestra recién
// después de responder, junto con la decisión correcta). "diagram" clasifica
// el tipo de jugada para el dibujo esquemático de la cancha — no hay fotos
// reales de partidos disponibles, así que se ilustra la posición/acción con
// un diagrama genérico por categoría en vez de texto solo.
const DECISIONS = ["Sigue el juego", "Amarilla", "Roja", "Penal", "Fuera de juego", "Gol anulado"];

const SITUATIONS = [
  { id: 1, text: "El defensor llega tarde y golpea el tobillo del rival en el área, sin jugar la pelota — pero el delantero ya había perdido el control y el remate iba directo afuera.", correct: 3, diagram: "area_foul", why: "El contacto imprudente dentro del área es penal aunque la jugada ya no fuera a terminar en gol — el VAR no evalúa si el remate iba a entrar, solo si hubo infracción." },
  { id: 2, text: "Un jugador va corriendo hasta el árbitro, agita los brazos y le grita a centímetros de la cara, sin tocarlo ni insultarlo.", correct: 1, diagram: "protest", why: "Invadir el espacio personal del árbitro de forma agresiva y sostenida es amarilla por conducta antideportiva, aunque no haya contacto ni insulto." },
  { id: 3, text: "Entrada por detrás, a destiempo, con los tapones altos sobre la espinilla del rival — el jugador frena en el último instante y el contacto es leve.", correct: 1, diagram: "tackle", why: "Frenar antes del impacto baja la intensidad real del contacto: sigue siendo falta, pero sin fuerza ni riesgo de lesión no llega a roja — sólo amarilla." },
  { id: 4, text: "El delantero recibe un pase con el hombro apenas por delante de la línea defensiva — el resto del cuerpo está en posición legal.", correct: 0, diagram: "offside", why: "Desde 2022 el VAR solo sanciona fuera de juego por partes del cuerpo habilitadas para jugar el balón (no el hombro) — con esa parte adelantada, sigue el juego." },
  { id: 5, text: "Mano de un defensor dentro del área, con el brazo pegado al cuerpo, en un rebote a corta distancia que no le da tiempo a reaccionar.", correct: 0, diagram: "handball", why: "Brazo pegado al cuerpo + distancia corta que no permite reacción = posición natural, no es mano punible aunque el balón termine tocándolo." },
  { id: 6, text: "Mano de un defensor dentro del área con el brazo extendido y separado del cuerpo en una posición que agranda artificialmente su volumen, aunque no mire hacia el balón.", correct: 3, diagram: "handball", why: "No hace falta \"querer\" tocarla: agrandar el volumen corporal con el brazo separado ya alcanza para penal, sin importar hacia dónde mire el jugador." },
  { id: 7, text: "Segundo amarillo del partido para el mismo jugador tras una falta táctica que corta un avance, sin agresividad.", correct: 2, diagram: "tackle", why: "Dos amarillas en el mismo partido son roja automática (doble amonestación), sin importar que la segunda haya sido una falta menor." },
  { id: 8, text: "Gol convertido tras una jugada donde el pasador estaba adelantado, pero el balón le llegó tras rebotar en un rival que interceptó el pase original.", correct: 5, diagram: "goal_review", why: "Un rebote en un defensor NO \"resetea\" el fuera de juego si el balón sigue viniendo de la misma jugada — se sigue mirando la posición al momento del pase original." },
  { id: 9, text: "Un jugador se deja caer dentro del área tras un roce mínimo, exagerando la caída para reclamar penal.", correct: 1, diagram: "protest", why: "La simulación (engañar al árbitro fingiendo una falta que no existió con esa intensidad) es amarilla — no roja, salvo casos extremos y reiterados." },
  { id: 10, text: "Choque fortuito entre dos jugadores disputando el balón limpiamente, ambos con los ojos puestos en la pelota, sin intención ni imprudencia de ninguno.", correct: 0, diagram: "tackle", why: "Sin intención, imprudencia ni fuerza excesiva de ninguno de los dos, un choque disputando el balón limpiamente no es sancionable." },
  { id: 11, text: "El arquero sale, no llega a la pelota y derriba al delantero justo en el borde del área — el punto de contacto queda dudoso entre adentro y afuera.", correct: 2, diagram: "area_foul", why: "Cuando el punto de contacto es dudoso, se define por dónde estaba el balón en el momento de la falta — si el balón seguía dentro del área, es adentro aunque el arquero haya salido." },
  { id: 12, text: "Falta táctica clara para cortar un contragolpe peligroso a mitad de cancha, sujetando la camiseta sin caída del rival.", correct: 1, diagram: "tackle", why: "Cortar un contragolpe claro con una falta táctica (sin jugar el balón) es amarilla obligatoria por el protocolo de \"oportunidad clara de gol\" interrumpida a mitad de cancha." },
  { id: 13, text: "El balón pega en la mano de un defensor que está cayendo al piso perdiendo el equilibrio, con el brazo buscando apoyo de forma instintiva.", correct: 0, diagram: "handball", why: "Un brazo usado para amortiguar una caída perdiendo el equilibrio se considera posición natural del cuerpo, no una mano punible." },
  { id: 14, text: "Un jugador empuja con las dos manos a un rival en la espalda dentro del área, quien cae pero el árbitro duda si ya iba a caerse solo.", correct: 3, diagram: "area_foul", why: "Si hubo empuje real con las dos manos, es penal aunque el rival pudiera haber perdido el equilibrio solo — el contacto ilegal ya existió." },
  { id: 15, text: "Codazo lejos del balón, con contacto real en la cara del rival, pero sin que se vea intención clara en la repetición.", correct: 2, diagram: "violent", why: "El VAR sanciona por el RESULTADO del contacto (golpe con fuerza en la cara) más que por poder probar la intención — roja igual sin \"mala intención\" evidente." },
  { id: 16, text: "El delantero estaba en posición adelantada cuando su compañero remató, pero se quedó quieto lejos de la jugada sin tocar el balón ni molestar a nadie.", correct: 0, diagram: "offside", why: "Estar adelantado no alcanza: hace falta interferir en la jugada, un rival o el balón — parado lejos y sin participar, no hay sanción." },
  { id: 17, text: "Un defensor, ya amonestado, comete una falta clara pero blanda (sin fuerza) sobre el mismo rival por segunda vez.", correct: 1, diagram: "tackle", why: "Una falta blanda sin agravantes no escala a roja directa solo por ser reincidente en un único episodio — ojo: si ya tenía amarilla previa, esta amarilla sería la segunda (ver situación de doble amonestación)." },
  { id: 18, text: "Pisotón al tobillo del rival mientras está en el piso, en una disputa por el balón donde ambos caen forcejeando.", correct: 1, diagram: "tackle", why: "Sin poder confirmar intención clara en una caída conjunta forcejeando, el criterio del VAR es no escalar a roja por un contacto que puede ser accidental en la caída." },
  { id: 19, text: "Gol de cabeza tras un córner, con un leve empujón previo entre dos jugadores dentro del área que no afecta la disputa por el balón.", correct: 0, diagram: "goal_review", why: "El forcejeo normal dentro del área en un córner (sin infracción clara que afecte la jugada) es parte del juego — el gol sube." },
  { id: 20, text: "El defensor, último hombre, jala de la camiseta al delantero que se le escapa mano a mano con el arquero ya batido — el delantero no cae, sigue corriendo y remata desviado.", correct: 2, diagram: "violent", why: "Cortar una ocasión manifiesta de gol como último hombre es roja directa (DOGSO) aunque el delantero no haya caído ni la jugada terminara en gol — se sanciona la infracción a la ocasión, no el resultado final del remate." },
];

function publicSituation(s) {
  return { id: s.id, text: s.text, options: DECISIONS, diagram: s.diagram };
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
  res.json({ correct: situation.correct === decisionIdx, correctIdx: situation.correct, why: situation.why });
});

export default router;
