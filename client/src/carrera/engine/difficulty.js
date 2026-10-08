// Dificultad del Modo DT (se elige en Configuración). La Media es la de siempre.
export const DIFFICULTIES = {
  facil: {
    id: "facil", label: "Fácil",
    desc: "Los rivales rinden un poco menos y el club te da más presupuesto cada temporada.",
    rivalOvr: -3, budget: 1.15,
  },
  media: {
    id: "media", label: "Media",
    desc: "La dificultad de siempre: rivales y presupuesto sin ajustes.",
    rivalOvr: 0, budget: 1,
  },
  dificil: {
    id: "dificil", label: "Difícil",
    desc: "Los rivales rinden más y el presupuesto de cada temporada es más ajustado.",
    rivalOvr: 3, budget: 0.85,
  },
};

export const difficultyOf = (s) => DIFFICULTIES[s?.difficulty] || DIFFICULTIES.media;
