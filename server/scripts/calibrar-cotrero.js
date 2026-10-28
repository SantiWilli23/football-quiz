// Calibración de Cotrero: simula carreras con elecciones «razonables» (acepta ofertas de un club
// igual o mejor, el resto al azar) y muestra cómo se reparten las etiquetas por versión y ritmo.
// Uso: node scripts/calibrar-cotrero.js [cantidad por versión, 10000 por defecto]
import * as E from "../utils/career-engine.js";

const N = Number(process.argv[2] || 10000);
function play(game, mode, i) {
  const pos = game === "cotrero_medio" ? (i % 2 ? "FWD" : "MID") : ["GK", "DEF", "MID", "FWD"][i % 4];
  const { player } = E.validatePlayer(game, { surname: "Prueba", number: 9, foot: "diestro", nation: "Chile", pos, profile: "velocidad" });
  let s = E.newCareer(game, mode, player, i * 7919 + 13);
  for (let k = 1; !s.retired && k < 700; k++) {
    let choice;
    if (s.phase === "summary") choice = "continue";
    else if (s.phase === "transfer") { const b = s.offers.map((o, j) => [o.level, j]).sort((a, c) => c[0] - a[0])[0]; choice = i % 3 && b[0] >= s.club.level ? `club:${b[1]}` : "stay"; }
    else choice = s.pending.options[(i + k * 7) % s.pending.options.length].key;
    s = E.act(s, { choice });
  }
  return s;
}
for (const [game, mode] of [["cotrero", "intensa"], ["cotrero", "normal"], ["cotrero", "expres"], ["cotrero_medio", "normal"]]) {
  const labels = {};
  let total = 0;
  for (let i = 1; i <= N; i++) { const s = play(game, mode, i); labels[s.final.label] = (labels[s.final.label] || 0) + 1; total += s.final.score; }
  console.log(`${game}/${mode}: media ${Math.round(total / N)} ·`, Object.entries(labels).map(([k, v]) => `${k} ${(100 * v / N).toFixed(1)}%`).join(" · "));
}
