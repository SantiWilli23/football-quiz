// Agenda de la temporada del Modo DT: TODOS los partidos en un solo calendario, con su día.
//
// Antes la Copa y Europa eran tarjetas sueltas ("Disponible en la jornada X") que se podían dejar
// colgadas. Ahora cada partido tiene fecha: la liga el sábado, Europa el martes y la Copa el
// miércoles de su semana, y los amistosos de pretemporada antes de la primera fecha. El próximo
// partido es siempre el primero sin jugar, y la liga de una semana no se juega mientras quede
// pendiente un partido de entre semana de esa misma semana.
//
// Semana (`weekIdx`): la semana en curso es `state.week` (cuántas fechas de liga se jugaron). La
// fecha de liga N se juega el sábado de la semana N-1.

import { teamById } from "../data/teams.js";

export const COPA_WEEKS = [6, 14, 22, 30];
export const CONTINENTAL_WEEKS = [10, 18, 26, 34];
export const COPA_ROUNDS = ["Dieciseisavos", "Cuartos de final", "Semifinal", "Final"];
export const CONTINENTAL_ROUNDS = ["Fase de grupos", "Cuartos de final", "Semifinal", "Final"];
const CONTINENTAL_LABELS = { champions: "Champions League", europa: "Europa League" };

// La copa nacional según la liga del club.
export const CUP_NAMES = { premier: "FA Cup", laliga: "Copa del Rey", seriea: "Coppa Italia", bundesliga: "DFB-Pokal" };
export const cupName = (league) => CUP_NAMES[league] || "Copa";

export const COMP = {
  amistoso: { label: "Amistoso", short: "AMI", color: "#8ba69a" },
  liga: { label: "Liga", short: "LIG", color: "#2fb673" },
  copa: { label: "Copa", short: "COP", color: "#f2b84b" },
  europa: { label: "Europa", short: "EUR", color: "#4aa8e8" },
};

const DAY = { amistoso: [0, 2, 3], europa: 1, copa: 2, liga: 5 };

// Ventanas de fichajes por semana: verano (0–7) e invierno (20–24).
export const WINDOWS = [{ id: "verano", label: "Mercado de verano", from: 0, to: 7 }, { id: "invierno", label: "Mercado de invierno", from: 20, to: 24 }];
export function windowAt(week) {
  return WINDOWS.find((w) => week >= w.from && week <= w.to) || null;
}
// Semanas que faltan para que cierre la ventana abierta (0 = cierra esta semana), o null.
export function windowClosesIn(week) {
  const w = windowAt(week);
  return w ? w.to - week : null;
}
export function nextWindow(week) {
  return WINDOWS.find((w) => w.from > week) || null;
}

const byOrder = (a, b) => a.weekIdx - b.weekIdx || a.day - b.day;

// Todos los partidos de la temporada (los de copa que ya no se juegan, por eliminación, no salen).
export function seasonSchedule(s, league = teamById(s?.teamId)?.league) {
  if (!s) return [];
  const events = [];
  const pre = s.preseason;
  if (pre && pre.total) {
    (pre.opponents || []).forEach((o, i) => {
      const played = i < (pre.matchesPlayed || 0);
      if (!played && pre.done) return; // pretemporada saltada
      const r = pre.results?.[i];
      events.push({ id: `ami-${i}`, comp: "amistoso", weekIdx: 0, day: DAY.amistoso[i] ?? i, opponentId: o.id, opponentName: o.name, home: true, round: `Amistoso ${i + 1}/${pre.total}`, played, result: r ? { my: r.myGoals, rival: r.rivalGoals } : null });
    });
  }
  (s.calendar || []).forEach((c) => {
    events.push({ id: `liga-${c.week}`, comp: "liga", weekIdx: c.week - 1, day: DAY.liga, opponentId: c.opponentTeamId, home: c.home, round: `Jornada ${c.week}`, played: c.played, result: c.result ? { my: c.result.myGoals, rival: c.result.rivalGoals } : null });
  });
  const cup = (key, data, weeks, rounds, label) => {
    if (!data) return;
    (data.opponents || []).forEach((o, i) => {
      const res = (data.results || []).find((r) => r.round === i);
      const out = data.eliminated && !res && i >= (data.currentRound ?? 0);
      if (out) return;
      events.push({
        id: `${key}-${i}`, comp: key, weekIdx: weeks[i], day: DAY[key], opponentId: o.id, opponentName: o.name, home: i % 2 === 0, round: `${label} · ${rounds[i]}`,
        played: !!res, result: res ? { my: res.myGoals, rival: res.rivalGoals, won: res.won } : null,
      });
    });
  };
  cup("copa", s.copa, COPA_WEEKS, COPA_ROUNDS, cupName(league));
  if (s.continental) cup("europa", s.continental, CONTINENTAL_WEEKS, CONTINENTAL_ROUNDS, CONTINENTAL_LABELS[s.continental.competition] || "Europa");
  return events.sort(byOrder);
}

// El próximo partido a jugar (cualquier competición), o null si terminó la temporada.
export function nextEvent(s) {
  return seasonSchedule(s).find((e) => !e.played) || null;
}

export function upcoming(s, n = 5) {
  return seasonSchedule(s).filter((e) => !e.played).slice(0, n);
}

// ¿Se puede jugar ya la fecha de liga de esta semana? No, si antes hay un partido de entre semana.
export function midweekBlocking(s) {
  const next = nextEvent(s);
  return next && next.comp !== "liga" && next.comp !== "amistoso" ? next : null;
}
