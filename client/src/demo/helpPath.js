import { FUSED, gameBySlug } from "../v2/fusion.js";

// Las ayudas y tutoriales están escritas para las rutas de siempre (/fulbodle, /torta…). Las rutas
// nuevas /jugar/<juego>/<variante> se traducen a la de siempre para encontrarlas.
export function helpPathOf(pathname) {
  const m = pathname.match(/^\/jugar\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return pathname;
  const found = gameBySlug(m[1]);
  if (!found) return pathname;
  const g = FUSED[found[0]];
  const v = g.variants.find((x) => x.key === m[2]) || g.variants[0];
  return v?.old || pathname;
}
