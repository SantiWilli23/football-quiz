// Motor de fichajes: primero se le oferta al CLUB (por el pase), y sólo si
// acepta se pasa a ofertarle un contrato al JUGADOR. Cada lado decide según
// reglas propias, no simplemente "si tienes la plata, listo".
import { ROLES, expectedRole } from "./playerForm.js";

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Cuánto pide realmente el club por el jugador, más allá del valor de
// mercado de tabla: un jugador con poco contrato se malvende, uno que es la
// estrella de un club chico se sobrevalora.
export function askingPrice(player, sellerTeam) {
  const contractLeft = player.contractYears ?? 2;
  const contractFactor = contractLeft <= 1 ? 0.7 : contractLeft === 2 ? 0.88 : contractLeft >= 4 ? 1.15 : 1.0;
  const importance = clamp((player.ovr - sellerTeam.prestige * 7) / 12, 0, 1);
  const importanceFactor = 1 + importance * 0.4;
  const listedFactor = player.transferListed ? 0.8 : 1;
  // Canterano: el club no lo suelta barato ni loco — es de la casa.
  const academyFactor = player.academyProduct && !player.transferListed ? 1.5 : 1;
  return Math.round(player.value * contractFactor * importanceFactor * listedFactor * academyFactor * 20) / 20;
}

// El club acepta o no la oferta por el pase. Si la oferta iguala o supera lo
// que pide (ratio >= 1) el trato se cierra SIEMPRE — nada de rechazar una
// oferta que cumple el precio pedido, eso se sentía como una lotería injusta.
// Por debajo del precio pedido sigue siendo un albur (más chance cuanto más
// cerca), pero ya no hay sorpresa cuando pagás lo que piden. La cifra exacta
// (askingPrice) siempre viaja en la respuesta: apenas hacés UNA oferta —
// la acepten o no — ya sabes el número real para la próxima.
export function clubDecision(player, sellerTeam, offerAmount) {
  const ask = askingPrice(player, sellerTeam);
  const ratio = offerAmount / ask;
  const hint = ratio < 0.65 ? "muy_lejos" : ratio < 0.9 ? "lejos" : ratio < 1 ? "cerca" : "alcanzado";
  // Un canterano no se cierra solo con igualar el precio pedido — el club
  // duda incluso con la plata en la mano, así que hay que pasarse bastante.
  const acceptThreshold = player.academyProduct && !player.transferListed ? 1.2 : 1;
  if (ratio >= acceptThreshold) {
    return { accepted: true, hint, ratio, askingPrice: ask };
  }
  const chanceMult = player.academyProduct && !player.transferListed ? 0.6 : 1.5;
  const acceptChance = clamp((ratio - 0.5) * chanceMult, 0.01, 0.9);
  const accepted = Math.random() < acceptChance;
  return { accepted, hint, ratio, askingPrice: ask };
}

// Cuánto necesita mejorar su sueldo para mudarse, según si el club nuevo es
// una mejora de verdad o un paso atrás en su carrera.
export function expectedWage(player, sellerTeam, buyerTeam) {
  const prestigeGap = buyerTeam.prestige - sellerTeam.prestige;
  const minRaise = prestigeGap >= 3 ? 0.95 : prestigeGap >= 1 ? 1.08 : prestigeGap >= -1 ? 1.25 : prestigeGap >= -3 ? 1.5 : 1.9;
  return Math.round(player.wage * minRaise);
}

// El jugador acepta o no el contrato ofrecido (sueldo semanal + años). Mismo
// criterio que el club: si el sueldo iguala o supera lo que el jugador
// necesita para mudarse, acepta siempre — ofertas por debajo son un riesgo,
// no una moneda al aire incluso cumpliendo el número.
export function playerDecision(player, sellerTeam, buyerTeam, wageOffered, yearsOffered, roleOffered = null, buyerSquad = null) {
  let expected = expectedWage(player, sellerTeam, buyerTeam);
  // Relevancia: el jugador también pide un lugar. Si le prometen menos de lo que espera,
  // exige más plata; si le prometen más, se conforma con menos.
  const wantedRole = buyerSquad ? expectedRole(player, buyerSquad) : ROLES.rotacion;
  const offeredRole = ROLES[roleOffered] || wantedRole;
  const roleGap = wantedRole.rank - offeredRole.rank; // positivo = le ofrecen menos de lo que quiere
  expected = Math.round(expected * (roleGap > 0 ? 1 + 0.22 * roleGap : 1 + 0.06 * roleGap));
  if (yearsOffered <= 1) expected = Math.round(expected * 1.15); // contrato corto, pide más para compensar
  if (buyerTeam.prestige > sellerTeam.prestige) expected = Math.round(expected * 0.92); // el ascenso deportivo pesa

  const ratio = wageOffered / expected;
  const hint = ratio < 0.7 ? "muy_lejos" : ratio < 0.95 ? "lejos" : ratio < 1 ? "cerca" : "alcanzado";
  const roleTalk = roleGap > 0
    ? `Quiero ser ${wantedRole.label.toLowerCase()} y me ofreces ${offeredRole.label.toLowerCase()}.`
    : roleGap < 0 ? `Me gusta que me ofrezcas ser ${offeredRole.label.toLowerCase()}.` : `Ser ${offeredRole.label.toLowerCase()} me parece bien.`;
  const extra = { wantedRole: wantedRole.id, offeredRole: offeredRole.id, roleTalk };
  if (ratio >= 1) {
    return { accepted: true, hint, ratio, expectedWageHint: expected, ...extra };
  }
  const acceptChance = clamp((ratio - 0.5) * 1.4, 0.02, 0.9);
  const accepted = Math.random() < acceptChance;
  return { accepted, hint, ratio, expectedWageHint: expected, ...extra };
}

export const HINT_LABEL = {
  muy_lejos: "Ni cerca — sube bastante la cifra.",
  lejos: "Se está acercando, pero todavía falta.",
  cerca: "Muy cerca, con un poco más alcanza.",
  alcanzado: "La oferta llega, pero igual la rechazaron (mala suerte).",
};

// ---------- Fichajes 2.0: negociación por rondas (sin azar) ----------
// Cada negociación tiene hasta 3 rondas por ventana. El club (o el jugador):
//   - acepta si llegas a lo que pide;
//   - si estás cerca (≥ 80 %), te contesta con una CONTRAOFERTA concreta que puedes aceptar tal cual;
//     en cada ronda la contraoferta baja un poco (cede para cerrar);
//   - si estás lejos, rechaza y te dice cuánto pide. Muy lejos (< 65 %) se enoja y corta la charla.
// Al pasar la tercera ronda sin acuerdo, el club se levanta de la mesa por unas semanas.
export const MAX_ROUNDS = 3;
const round05 = (v) => Math.round(v * 20) / 20;

export function negotiate(ask, amount, round = 1, { counterFrom = 0.8, angryBelow = 0.65 } = {}) {
  const r = Math.max(1, Math.min(MAX_ROUNDS, round));
  const ratio = ask > 0 ? amount / ask : 1;
  if (ratio >= 1) return { verdict: "accept", ask, price: amount, ratio };
  // Lo que acepta esta ronda: el precio pedido, y en las rondas siguientes cede 3 % y 5 %.
  const floor = round05(ask * [1, 0.97, 0.95][r - 1]);
  if (amount >= floor) return { verdict: "accept", ask, price: amount, ratio };
  if (ratio >= counterFrom) {
    const counter = Math.max(floor, round05(amount + (ask - amount) * 0.6));
    return { verdict: "counter", ask, counter, ratio, last: r >= MAX_ROUNDS };
  }
  return { verdict: "reject", ask, ratio, angry: ratio < angryBelow, last: r >= MAX_ROUNDS };
}

// El club por el pase. Un canterano no se vende ni al precio: hay que pasarse un 20 %.
// Pagar en dos cuotas (mitad ahora, mitad la temporada que viene) le cuesta al comprador un 5 % más.
export function clubNegotiation(player, sellerTeam, amount, round = 1, { installments = false } = {}) {
  let ask = askingPrice(player, sellerTeam);
  if (player.academyProduct && !player.transferListed) ask = round05(ask * 1.2);
  if (installments) ask = round05(ask * 1.05);
  return negotiate(ask, amount, round);
}

// El jugador por su contrato (sueldo en €k/semana). Mismas reglas que playerDecision, sin azar.
export function playerNegotiation(player, sellerTeam, buyerTeam, wageOffered, yearsOffered, roleOffered = null, buyerSquad = null, round = 1) {
  let expected = expectedWage(player, sellerTeam, buyerTeam);
  const wantedRole = buyerSquad ? expectedRole(player, buyerSquad) : ROLES.rotacion;
  const offeredRole = ROLES[roleOffered] || wantedRole;
  const roleGap = wantedRole.rank - offeredRole.rank;
  expected = Math.round(expected * (roleGap > 0 ? 1 + 0.22 * roleGap : 1 + 0.06 * roleGap));
  if (yearsOffered <= 1) expected = Math.round(expected * 1.15);
  if (buyerTeam.prestige > sellerTeam.prestige) expected = Math.round(expected * 0.92);
  // El jugador no se ofende: casi siempre contesta con lo que quiere ganar (salvo ofertas absurdas).
  const res = negotiate(expected, wageOffered, round, { counterFrom: 0.5, angryBelow: 0 });
  const roleTalk = roleGap > 0
    ? `Quiero ser ${wantedRole.label.toLowerCase()} y me ofreces ${offeredRole.label.toLowerCase()}.`
    : roleGap < 0 ? `Me gusta que me ofrezcas ser ${offeredRole.label.toLowerCase()}.` : `Ser ${offeredRole.label.toLowerCase()} me parece bien.`;
  return { ...res, counter: res.counter != null ? Math.round(res.counter) : undefined, wantedRole: wantedRole.id, offeredRole: offeredRole.id, roleTalk };
}

// ---------- Masa salarial ----------
// Tope de sueldos del plantel (€k/semana): lo que pagaba el club al empezar más un 20 % de margen,
// y crece con el prestigio del DT. Fichar por encima del tope no se puede.
export function wageTotal(squad) {
  return Math.round((squad || []).filter((p) => !p.isYouth).reduce((n, p) => n + (p.wage || 0), 0));
}
export function wageCapOf(state) {
  const base = state.wageCap ?? Math.round(wageTotal(state.squad) * 1.2);
  const prestige = ((state.managerPrestige ?? 50) - 50) / 100; // −0,5 … +0,5
  return Math.round(base * (1 + Math.max(0, prestige) * 0.2));
}

// ---------- Necesidades del plantel ----------
export const LINES = [
  { id: "ARQ", label: "Arqueros", positions: ["GK"], want: 2 },
  { id: "DEF", label: "Defensas", positions: ["CB", "LB", "RB", "LWB", "RWB"], want: 7 },
  { id: "MED", label: "Mediocampo", positions: ["CDM", "CM", "CAM", "LM", "RM"], want: 7 },
  { id: "DEL", label: "Delanteros", positions: ["ST", "CF", "LW", "RW"], want: 5 },
];
export function lineOf(position) {
  return LINES.find((l) => l.positions.includes(position))?.id || "MED";
}

// Por línea: cuántos hay, el nivel de los que juegan y si hace falta reforzar (0 = bien, 1 = ojo, 2 = urgente).
export function squadNeeds(squad) {
  const pool = (squad || []).filter((p) => !p.isYouth);
  const all = pool.length ? pool.reduce((n, p) => n + p.ovr, 0) / pool.length : 70;
  return LINES.map((l) => {
    const ps = pool.filter((p) => lineOf(p.position) === l.id).sort((a, b) => b.ovr - a.ovr);
    const starters = ps.slice(0, l.id === "ARQ" ? 1 : l.id === "DEL" ? 3 : 4);
    const level = starters.length ? Math.round(starters.reduce((n, p) => n + p.ovr, 0) / starters.length) : 0;
    const short = Math.max(0, l.want - ps.length);
    const weak = level && level < all - 3;
    const status = short >= 2 || !level ? 2 : short || weak ? 1 : 0;
    return { ...l, count: ps.length, level, short, status };
  });
}

// Respuesta a "pedir más" por una oferta recibida: si el club tenía margen (la oferta estaba por
// debajo del valor) la sube un 15 %; si ya pagaba de más, se retira.
export function raiseIncoming(offer, player) {
  const value = player?.value ?? offer.amount;
  const raised = round05(offer.amount * 1.15);
  return raised <= value * 1.1 ? { raised: true, amount: raised } : { raised: false };
}
