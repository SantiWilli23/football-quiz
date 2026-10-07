import { useId } from "react";

// Escudo del grupo, guardado como JSON en groups_t.avatar (ver
// server/routes/groups.js): forma, dos colores, diseño, símbolo e iniciales.
// Los escudos de antes (solo color + iniciales) siguen funcionando: lo que
// falta se completa con los valores por defecto. Las listas tienen que quedar
// iguales a las del servidor.
export const CREST_COLORS = [
  "#4ade80", "#ffb400", "#3b9dd6", "#e85d5d", "#a78bfa", "#f472b6", "#facc15", "#22d3ee",
  "#16a34a", "#1d4ed8", "#7c3aed", "#dc2626", "#f97316", "#0f172a", "#ffffff", "#94a3b8",
];
export const CREST_SHAPES = ["escudo", "redondo", "cuadrado", "rombo", "clasico"];
export const CREST_PATTERNS = ["liso", "mitades", "franjas", "banda", "cruz", "diagonal"];
export const CREST_SYMBOLS = ["iniciales", "estrella", "balon", "corona", "rayo", "corazon"];

export const CREST_LABELS = {
  escudo: "Escudo", redondo: "Redondo", cuadrado: "Cuadrado", rombo: "Rombo", clasico: "Clásico",
  liso: "Liso", mitades: "Mitades", franjas: "Franjas", banda: "Banda", cruz: "Cruz", diagonal: "Diagonal",
  iniciales: "Iniciales", estrella: "Estrella", balon: "Balón", corona: "Corona", rayo: "Rayo", corazon: "Corazón",
};

export const DEFAULT_CREST = {
  color: CREST_COLORS[0], color2: "#0f172a", shape: "escudo", pattern: "liso", symbol: "iniciales", initials: "",
};

export function parseCrest(group) {
  if (!group) return null;
  try {
    const c = JSON.parse(group.avatar || "null");
    if (c && c.color) {
      return {
        ...DEFAULT_CREST,
        ...c,
        initials: String(c.initials || group.name || "FT").trim().slice(0, 3).toUpperCase(),
      };
    }
  } catch { /* grupo viejo sin escudo guardado */ }
  return { ...DEFAULT_CREST, color: "#6b7280", initials: (group.name || "FT").trim().slice(0, 2).toUpperCase() };
}

const SHAPE_PATHS = {
  escudo: "M50 2 L96 20 L96 62 Q96 84 50 98 Q4 84 4 62 L4 20 Z",
  redondo: "M50 3 A47 47 0 1 1 49.99 3 Z",
  cuadrado: "M12 4 H88 Q96 4 96 12 V88 Q96 96 88 96 H12 Q4 96 4 88 V12 Q4 4 12 4 Z",
  rombo: "M50 2 L97 50 L50 98 L3 50 Z",
  clasico: "M6 6 H94 V56 Q94 82 50 98 Q6 82 6 56 Z",
};

const SYMBOL_PATHS = {
  corona: "M26 68 L28 38 L40 52 L50 32 L60 52 L72 38 L74 68 Z",
  rayo: "M57 22 L33 57 H48 L42 82 L68 44 H53 Z",
  corazon: "M50 78 C18 56 27 28 44 37 Q50 41 50 46 Q50 41 56 37 C73 28 82 56 50 78 Z",
};

function starPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function luminance(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function Pattern({ pattern, color }) {
  if (pattern === "mitades") return <rect x="50" y="0" width="50" height="100" fill={color} />;
  if (pattern === "franjas") {
    return (
      <>
        <rect x="22" y="0" width="14" height="100" fill={color} />
        <rect x="43" y="0" width="14" height="100" fill={color} />
        <rect x="64" y="0" width="14" height="100" fill={color} />
      </>
    );
  }
  if (pattern === "banda") return <rect x="0" y="38" width="100" height="24" fill={color} />;
  if (pattern === "cruz") {
    return (
      <>
        <rect x="42" y="0" width="16" height="100" fill={color} />
        <rect x="0" y="40" width="100" height="16" fill={color} />
      </>
    );
  }
  if (pattern === "diagonal") return <polygon points="0,22 22,0 100,78 78,100" fill={color} />;
  return null;
}

// Un SVG dentro de un contenedor cuadrado: escala sin pixelarse a cualquier
// tamaño. El símbolo lleva contorno para leerse sobre cualquier diseño.
export default function Crest({ group, crest, size = 36, className = "" }) {
  const c = crest ? { ...DEFAULT_CREST, ...crest } : parseCrest(group);
  const clipId = useId();
  const path = SHAPE_PATHS[c.shape] || SHAPE_PATHS.escudo;
  const ink = luminance(c.color) > 0.6 ? "#0f172a" : "#ffffff";
  const outline = ink === "#ffffff" ? "#0f172a" : "#ffffff";
  const initials = (c.initials || "").slice(0, 3);
  const fontSize = initials.length >= 3 ? 27 : initials.length === 2 ? 33 : 40;
  const symStyle = { fill: ink, stroke: outline, strokeWidth: 3, strokeLinejoin: "round", paintOrder: "stroke" };

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <clipPath id={clipId}><path d={path} /></clipPath>
        <linearGradient id={`${clipId}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.color} />
          <stop offset="1" stopColor={c.color} stopOpacity="0.78" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="100" height="100" fill={`url(#${clipId}g)`} />
        <Pattern pattern={c.pattern} color={c.color2} />
      </g>
      <path d={path} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="3" />
      {c.symbol === "iniciales" && (
        <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontWeight="800" fontSize={fontSize} {...symStyle} fontFamily="system-ui, sans-serif">
          {initials}
        </text>
      )}
      {c.symbol === "estrella" && <polygon points={starPoints(50, 52, 27)} {...symStyle} />}
      {c.symbol === "balon" && (
        <g {...symStyle} fill={ink}>
          <circle cx="50" cy="52" r="22" fill="none" stroke={ink} strokeWidth="4" />
          <polygon points="50,40 61,48 57,60 43,60 39,48" fill={ink} stroke="none" />
        </g>
      )}
      {SYMBOL_PATHS[c.symbol] && <path d={SYMBOL_PATHS[c.symbol]} {...symStyle} />}
    </svg>
  );
}
