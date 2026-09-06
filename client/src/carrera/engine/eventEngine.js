const GENERIC_EVENTS = [
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
    id: "fan_boost",
    text: "🔥 Los hinchas llenan el estadio. La energía llega al vestuario.",
    moraleBonus: 8,
  },
  {
    id: "locker_room",
    text: "😤 Hay tensiones internas en el vestuario.",
    moraleBonus: -7,
  },
];

function pickRandom(pool) {
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

// Eventos narrativos: usan jugadores reales del plantel para que cada carrera se sienta distinta.
function narrativeEvents(squad) {
  const events = [];
  if (!squad || !squad.length) return events;

  const veterans = squad.filter((p) => !p.isYouth && p.age >= 24);
  const youthPool = squad.filter((p) => p.isYouth || p.age <= 19);
  const captain = [...squad].sort((a, b) => b.ovr - a.ovr)[0];
  const discontent = squad.filter((p) => p.age >= 26);

  if (discontent.length) {
    const p = pickRandom(discontent);
    events.push({
      id: `transfer_request_${p.id}`,
      text: `📣 ${p.name} pide salir del club. No está conforme con su rol en el equipo.`,
      targetMoraleId: p.id,
      targetMoraleDelta: -15,
    });
  }

  if (youthPool.length) {
    const p = pickRandom(youthPool);
    events.push({
      id: `youth_breakout_${p.id}`,
      text: `🌟 Un juvenil de ${p.age} años, ${p.name}, destaca en los entrenamientos. Su valoración sube.`,
      apply: (s) => ({ squad: s.squad.map((pl) => (pl.id === p.id ? { ...pl, ovr: Math.min(pl.potential, pl.ovr + 1) } : pl)) }),
    });
  }

  events.push({
    id: "president_demands",
    text: "🎙️ El presidente exige clasificar a competición europea esta temporada. La presión sube.",
    apply: (s) => ({ boardConfidence: Math.max(0, s.boardConfidence - 3) }),
  });

  if (captain) {
    events.push({
      id: `captain_knock_${captain.id}`,
      text: `🚑 ${captain.name}, tu jugador más valioso, sufre una molestia física antes del próximo partido.`,
      forceInjuryId: captain.id,
    });
  }

  if (veterans.length >= 2) {
    const a = pickRandom(veterans);
    events.push({
      id: `mentor_${a.id}`,
      text: `🧭 ${a.name} se convirtió en referente del vestuario. El grupo se muestra más unido.`,
      moraleBonus: 3,
    });
  }

  return events;
}

// ~8% de probabilidad por semana
export function rollEvent(squad = []) {
  if (Math.random() > 0.08) return null;
  const pool = [...GENERIC_EVENTS, ...narrativeEvents(squad)];
  return pickRandom(pool);
}
