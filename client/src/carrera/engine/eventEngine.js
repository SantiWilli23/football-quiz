const EVENTS = [
  {
    id: "sponsor_deal",
    text: "💼 Un nuevo patrocinador firma con el club. Presupuesto +€2M.",
    apply: (s) => ({ budget: Math.round((s.budget + 2) * 20) / 20 }),
  },
  {
    id: "board_boost",
    text: "📢 La directiva respalda públicamente al cuerpo técnico.",
    apply: (s) => ({ boardConfidence: Math.min(100, s.boardConfidence + 8) }),
  },
  {
    id: "media_pressure",
    text: "📰 La prensa critica los resultados. La directiva pide una reacción.",
    apply: (s) => ({ boardConfidence: Math.max(0, s.boardConfidence - 6) }),
  },
  {
    id: "budget_boost",
    text: "💰 El presidente anuncia una inversión extraordinaria. +€5M al presupuesto.",
    apply: (s) => ({ budget: Math.round((s.budget + 5) * 20) / 20 }),
  },
  {
    id: "budget_cut",
    text: "💸 Ajuste económico del club. El presupuesto de fichajes baja €3M.",
    apply: (s) => ({ budget: Math.max(0, Math.round((s.budget - 3) * 20) / 20) }),
  },
  {
    id: "prestige_boost",
    text: "🏆 Tu trabajo empieza a reconocerse. Tu reputación como técnico sube.",
    apply: (s) => ({ managerPrestige: Math.min(100, (s.managerPrestige ?? 50) + 6) }),
  },
  {
    id: "prestige_hit",
    text: "📉 Los malos resultados recientes empañan tu reputación.",
    apply: (s) => ({ managerPrestige: Math.max(0, (s.managerPrestige ?? 50) - 5) }),
  },
  {
    id: "fan_boost",
    text: "🔥 Los hinchas llenan el estadio. La energía llega al vestuario.",
    moraleBonus: 8,
  },
  {
    id: "locker_room",
    text: "😤 Hay tensiones internas en el vestuario.",
    moraleBonus: -7,
  },
  {
    id: "fitness_camp",
    text: "💪 El preparador físico organizó una semana exigente. El plantel está al 100%.",
    moraleBonus: 4,
  },
  {
    id: "scout_news",
    text: "🔭 Tus reclutadores detectaron movimientos interesantes en el mercado.",
  },
  {
    id: "injury_scare",
    text: "🏥 Un susto en el entrenamiento, pero sin novedades. El plantel sigue sano.",
  },
  {
    id: "fan_protest",
    text: "😡 Los hinchas protestan por los resultados. La presión aumenta.",
    apply: (s) => ({ boardConfidence: Math.max(0, s.boardConfidence - 4) }),
    moraleBonus: -4,
  },
  {
    id: "young_talent",
    text: "⭐ Un juvenil de la cantera impresiona en los entrenamientos.",
  },
  {
    id: "referee_dispute",
    text: "🟥 Una decisión arbitral polémica generó malestar en el grupo.",
    moraleBonus: -3,
  },
];

// ~8% de probabilidad por semana
export function rollEvent() {
  if (Math.random() > 0.08) return null;
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}
