import { helpFor } from "../data/helpTexts.js";

// Tutorial general de Futotal. Se muestra la primera vez (Inicio) y se puede
// repetir desde Perfil › Ajustes. El último paso ofrece a dónde ir: cada opción
// lleva `favorites`, que Inicio guarda como secciones destacadas.
export const GENERAL_TUTORIAL = {
  title: "Tutorial de Futotal",
  steps: [
    {
      title: "¡Bienvenido a Futotal!",
      body: "Trivia y juegos de fútbol para jugar con tus amigos. En pocos pasos sabés cómo funciona todo.",
    },
    {
      title: "Primero, los grupos",
      body: "Un grupo es tu pandilla. Todo lo que jugás suma a un ranking semanal que se reinicia cada lunes.",
      points: [
        "Creás un grupo o entrás con un código de invitación.",
        "Podés estar en varios grupos y cambiar de uno a otro arriba.",
        "Con 10 o más miembros, el grupo puede activar una Liga con dos divisiones.",
      ],
    },
    {
      title: "Dos formas de jugar",
      body: "Cada juego diario tiene dos versiones que no se mezclan.",
      points: [
        "Diario: una partida por día, igual para todos. Da puntos (0 a 20 según cómo te fue). El podio del grupo suma 5, 3 y 1 extra.",
        "Diversión: partidas libres, las que quieras. Nunca dan puntos; dan sobres de cartas según rendimiento, dificultad y tiempo de juego.",
      ],
    },
    {
      title: "Puntos, sobres y cartas",
      points: [
        "Los puntos suman al ranking semanal del grupo.",
        "Los sobres traen jugadores, íconos y entrenadores para armar tu equipo en Cartas.",
        "Cada pantalla tiene un botón «?» con sus reglas, y cada juego tiene su propio tutorial ahí mismo.",
      ],
    },
    {
      title: "¿Qué querés jugar hoy?",
      body: "Elegí y te llevamos. Lo que elijas queda destacado en Inicio.",
      choices: [
        { label: "Algo rápido", hint: "Trivia, Un Minuto, Fichado", to: "/trivia", favorites: ["/trivia", "/juegos"] },
        { label: "Contra amigos", hint: "Duelos, grupo y retos semanales", to: "/grupo", favorites: ["/grupo", "/trivia"] },
        { label: "Una carrera larga", hint: "Modo DT, Presidente, Cotrero", to: "/juegos", favorites: ["/juegos", "/vida-fut"] },
      ],
    },
  ],
};

// Tutorial de una pantalla o juego, armado a partir de sus textos de ayuda
// (data/helpTexts.js). Así cada juego tiene tutorial sin repetir textos: la
// primera página es qué es, y después las reglas de a dos por página.
const RULES_PER_PAGE = 2;

export function tutorialFor(pathname) {
  const help = helpFor(pathname);
  if (!help) return null;
  const steps = [{ title: help.title, body: help.intro }];
  for (let i = 0; i < help.points.length; i += RULES_PER_PAGE) {
    steps.push({
      title: i === 0 ? "Cómo se juega" : "Puntos y reglas",
      points: help.points.slice(i, i + RULES_PER_PAGE),
    });
  }
  return { title: `Tutorial · ${help.title}`, steps };
}
