// Motor de fichajes: primero se le oferta al CLUB (por el pase), y sólo si
// acepta se pasa a ofertarle un contrato al JUGADOR. Cada lado decide según
// reglas propias, no simplemente "si tenés la plata, listo".
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
// la acepten o no — ya sabés el número real para la próxima.
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
export function playerDecision(player, sellerTeam, buyerTeam, wageOffered, yearsOffered) {
  let expected = expectedWage(player, sellerTeam, buyerTeam);
  if (yearsOffered <= 1) expected = Math.round(expected * 1.15); // contrato corto, pide más para compensar
  if (buyerTeam.prestige > sellerTeam.prestige) expected = Math.round(expected * 0.92); // el ascenso deportivo pesa

  const ratio = wageOffered / expected;
  const hint = ratio < 0.7 ? "muy_lejos" : ratio < 0.95 ? "lejos" : ratio < 1 ? "cerca" : "alcanzado";
  if (ratio >= 1) {
    return { accepted: true, hint, ratio, expectedWageHint: expected };
  }
  const acceptChance = clamp((ratio - 0.5) * 1.4, 0.02, 0.9);
  const accepted = Math.random() < acceptChance;
  return { accepted, hint, ratio, expectedWageHint: expected };
}

export const HINT_LABEL = {
  muy_lejos: "Ni cerca — subí bastante la cifra.",
  lejos: "Se está acercando, pero todavía falta.",
  cerca: "Muy cerca, con un poco más alcanza.",
  alcanzado: "La oferta llega, pero igual la rechazaron (mala suerte).",
};
