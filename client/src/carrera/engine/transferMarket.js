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
  return Math.round(player.value * contractFactor * importanceFactor * listedFactor * 20) / 20;
}

// El club acepta o no la oferta por el pase. Nunca revela el número exacto
// que pedía — sólo si la oferta estuvo lejos, cerca, o alcanzó.
export function clubDecision(player, sellerTeam, offerAmount) {
  const ask = askingPrice(player, sellerTeam);
  const ratio = offerAmount / ask;
  const acceptChance = clamp((ratio - 0.85) * 2.3, 0.03, 0.97);
  const accepted = Math.random() < acceptChance;
  const hint = ratio < 0.65 ? "muy_lejos" : ratio < 0.9 ? "lejos" : ratio < 1 ? "cerca" : "alcanzado";
  return { accepted, hint, ratio };
}

// Cuánto necesita mejorar su sueldo para mudarse, según si el club nuevo es
// una mejora de verdad o un paso atrás en su carrera.
export function expectedWage(player, sellerTeam, buyerTeam) {
  const prestigeGap = buyerTeam.prestige - sellerTeam.prestige;
  const minRaise = prestigeGap >= 3 ? 0.95 : prestigeGap >= 1 ? 1.08 : prestigeGap >= -1 ? 1.25 : prestigeGap >= -3 ? 1.5 : 1.9;
  return Math.round(player.wage * minRaise);
}

// El jugador acepta o no el contrato ofrecido (sueldo semanal + años).
export function playerDecision(player, sellerTeam, buyerTeam, wageOffered, yearsOffered) {
  const expected = expectedWage(player, sellerTeam, buyerTeam);
  const ratio = wageOffered / expected;
  const ambitionBonus = buyerTeam.prestige > sellerTeam.prestige ? 0.12 : 0;
  const yearsPenalty = yearsOffered <= 1 ? -0.1 : 0;
  const acceptChance = clamp((ratio - 0.88) * 2.1 + ambitionBonus + yearsPenalty, 0.03, 0.97);
  const accepted = Math.random() < acceptChance;
  const hint = ratio < 0.7 ? "muy_lejos" : ratio < 0.95 ? "lejos" : ratio < 1 ? "cerca" : "alcanzado";
  return { accepted, hint, ratio, expectedWageHint: expected };
}

export const HINT_LABEL = {
  muy_lejos: "Ni cerca — subí bastante la cifra.",
  lejos: "Se está acercando, pero todavía falta.",
  cerca: "Muy cerca, con un poco más alcanza.",
  alcanzado: "La oferta llega, pero igual la rechazaron (mala suerte).",
};
