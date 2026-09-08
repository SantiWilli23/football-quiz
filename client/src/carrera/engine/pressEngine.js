// Conferencia de prensa post-partido: 3 formas de responder, cada una con
// un efecto distinto en confianza directiva, moral del plantel y reputación.
const QUESTION_SETS = {
  win: {
    question: "¿Cómo definís la victoria de hoy?",
    options: [
      { id: "confident", label: "\"El equipo lo mereció, hicimos un gran partido.\"", effects: { boardConfidence: 2, moraleAll: 3 } },
      { id: "humble", label: "\"Con humildad, hay que seguir trabajando igual.\"", effects: { clubReputation: 2 } },
      { id: "ambitious", label: "\"Esto recién empieza, vamos por más.\"", effects: { managerPrestige: 2, boardConfidence: 1, moraleAll: -1 } },
    ],
  },
  draw: {
    question: "¿Qué análisis hacés del empate?",
    options: [
      { id: "selfcritic", label: "\"Nos faltó pegar en los metros finales, autocrítica.\"", effects: { clubReputation: 1 } },
      { id: "content", label: "\"Un punto afuera siempre suma.\"", effects: { moraleAll: 1, boardConfidence: -1 } },
      { id: "referee", label: "\"El árbitro nos perjudicó en un par de jugadas.\"", effects: { moraleAll: 2, boardConfidence: -2 } },
    ],
  },
  loss: {
    question: "¿A qué atribuís la derrota?",
    options: [
      { id: "selfcritic", label: "\"Asumo la responsabilidad, no estuvimos a la altura.\"", effects: { boardConfidence: 3, moraleAll: -1 } },
      { id: "support", label: "\"El plantel dio todo, hay que bancarlos.\"", effects: { moraleAll: 3, boardConfidence: -1 } },
      { id: "defensive", label: "\"No estuvimos finos, pero seguimos con el plan.\"", effects: { managerPrestige: -1, boardConfidence: -2 } },
    ],
  },
};

export function getPressQuestion(myGoals, rivalGoals) {
  if (myGoals > rivalGoals) return QUESTION_SETS.win;
  if (myGoals < rivalGoals) return QUESTION_SETS.loss;
  return QUESTION_SETS.draw;
}
