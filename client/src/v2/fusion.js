import { lazy } from "react";

// Juegos fusionados de Futotal 2.0: cada uno reúne a los juegos parecidos de antes como
// «variantes». Cada variante conserva su pantalla, su guardado y su ruta de servidor; lo que
// cambia es la entrada (`/jugar/<juego>/<variante>`), los chips para pasar de una a otra y los
// récords. `keys` son las claves con las que cada variante guarda su historial.
export const FUSED = {
  quien_es: {
    slug: "quien-es", label: "¿Quién es?",
    variants: [
      { key: "parecido", label: "Parecido", old: "/fulbodle", keys: ["fichado"], Page: lazy(() => import("../pages/Wordle.jsx")) },
      { key: "carrera", label: "Carrera", old: "/quien-es", keys: ["quien_es"], Page: lazy(() => import("../pages/QuienEs.jsx")) },
      { key: "traspasos", label: "Traspasos", old: "/traspasos", keys: ["traspasos"], Page: lazy(() => import("../pages/Traspasos.jsx")) },
    ],
  },
  que_club: {
    slug: "que-club", label: "¿Qué club?",
    variants: [
      { key: "escudos", label: "Escudos", old: "/escudos", keys: ["escudos"], Page: lazy(() => import("../pages/CrestQuiz.jsx")) },
      { key: "plantel", label: "Plantel", old: "/torta", keys: ["torta"], Page: lazy(() => import("../pages/Torta.jsx")) },
    ],
  },
  mas_o_menos: {
    slug: "mas-o-menos", label: "Más o menos",
    variants: [
      { key: "compro", label: "¿A quién me compro?", old: "/a-quien-me-compro", keys: ["a_quien_me_compro"], Page: lazy(() => import("../pages/AQuienMeCompro.jsx")) },
      { key: "piramide", label: "Pirámide", old: "/piramide", keys: ["piramide"], Page: lazy(() => import("../pages/Piramide.jsx")) },
    ],
  },
  trivia: {
    slug: "trivia", label: "Trivia",
    variants: [
      { key: "un-minuto", label: "Un minuto", old: "/un-minuto", keys: ["un_minuto"], Page: lazy(() => import("../pages/UnMinuto.jsx")) },
      { key: "supervivencia", label: "Supervivencia", old: "/supervivencia", keys: [], multi: true, Page: lazy(() => import("../pages/Survival.jsx")) },
    ],
  },
  var: {
    slug: "var", label: "VAR",
    variants: [
      { key: "arbitro", label: "Árbitro", old: "/arbitraje-var", keys: ["arbitraje_var"], Page: lazy(() => import("../pages/ArbitrajeVar.jsx")) },
      { key: "votacion", label: "Votación del club", old: "/var-votacion", keys: [], Page: lazy(() => import("../pages/VarVotacion.jsx")) },
    ],
  },
  cotrero: {
    slug: "cotrero", label: "Cotrero",
    variants: [
      { key: "simple", label: "Simple", old: "/cotrero.html", keys: [], Page: lazy(() => import("./CotreroSimple.jsx")) },
      { key: "medio", label: "Medio", old: "/cotrero-medio.html", keys: [], Page: lazy(() => import("./CotreroMedio.jsx")) },
    ],
  },
  draft: {
    slug: "draft", label: "Draft",
    variants: [
      { key: "solo", label: "Solo (8a2)", old: "/draft-europeo.html", keys: [], Page: lazy(() => import("./DraftSolo.jsx")) },
      { key: "copa", label: "Copa 8a2", old: "/copa-8a2", keys: [], Page: lazy(() => import("../pages/Copa8a2.jsx")) },
      { key: "subasta", label: "Subasta", old: "/subasta", keys: [], Page: lazy(() => import("../pages/Subasta.jsx")) },
      { key: "amigo", label: "Contra un amigo", old: null, keys: [], Page: lazy(() => import("./DraftAmigo.jsx")) },
    ],
  },
  bingo: {
    slug: "bingo", label: "Bingo",
    variants: [
      { key: "bingo", label: "Bingo", old: "/bingo", keys: ["tateti"], Page: lazy(() => import("../pages/Bingo.jsx")) },
    ],
  },
};

export const gameBySlug = (slug) => Object.entries(FUSED).find(([, g]) => g.slug === slug) || null;

// Rutas viejas → nueva ruta del juego fusionado. `/tateti` ya redirigía a `/bingo`.
export const LEGACY = (() => {
  const out = { "/tateti": ["bingo", "bingo"] };
  for (const [game, g] of Object.entries(FUSED)) for (const v of g.variants) if (v.old) out[v.old] = [game, v.key];
  return out;
})();

export const fusedPath = (game, variantKey) => {
  const g = FUSED[game];
  return variantKey && g.variants.length > 1 ? `/jugar/${g.slug}/${variantKey}` : `/jugar/${g.slug}`;
};

// Si esta ruta vieja ya se fusionó (y el juego está abierto), devuelve la nueva conservando la
// query. `diario=1` se descarta: el diario rotativo se retiró.
export function redirectFor(pathname, search, enabled) {
  const hit = LEGACY[pathname.replace(/\/+$/, "") || "/"];
  if (!hit || !enabled.includes(hit[0])) return null;
  const params = new URLSearchParams(search);
  params.delete("diario");
  const qs = params.toString();
  return `${fusedPath(hit[0], hit[1])}${qs ? `?${qs}` : ""}`;
}

const LAST = (game) => `fq2_variante:${game}`;
export function lastVariant(game) {
  const g = FUSED[game];
  try {
    const k = localStorage.getItem(LAST(game));
    if (g.variants.some((v) => v.key === k)) return k;
  } catch { /* sin storage */ }
  return g.variants[0].key;
}
export function rememberVariant(game, key) {
  try { localStorage.setItem(LAST(game), key); } catch { /* sin storage */ }
}
