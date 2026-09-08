// Asigna dorsales únicos (1-99) al plantel: el arquero titular más OVR
// arranca con la 1, el resto se numera por orden de aparición.
export function assignInitialNumbers(squad) {
  const gks = squad.filter((p) => p.position === "GK").sort((a, b) => b.ovr - a.ovr);
  const rest = squad.filter((p) => p.position !== "GK");
  let n = 1;
  const out = [];
  gks.forEach((p) => out.push({ ...p, number: n++ }));
  rest.forEach((p) => out.push({ ...p, number: n++ }));
  return out;
}

export function nextAvailableNumber(squad) {
  const used = new Set(squad.map((p) => p.number).filter(Boolean));
  for (let n = 1; n <= 99; n++) if (!used.has(n)) return n;
  return 99;
}
