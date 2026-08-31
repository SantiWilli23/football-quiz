import { useId } from "react";

// Los avatares se dibujan con SVG dentro de la app: nada de imágenes externas
// ni de subir fotos de nadie. La configuración es un objeto chico que se
// guarda como JSON en el usuario.
export const SKINS = [
  "#f8dcc4",
  "#f2d0b4",
  "#e0ac82",
  "#d18b5c",
  "#c68642",
  "#a1653a",
  "#8d5524",
  "#5c3317",
];

export const HAIR_COLORS = [
  "#0f0f0f",
  "#2c1b18",
  "#5a3825",
  "#a55728",
  "#d6b370",
  "#f2e2b0",
  "#b9b9b9",
  "#ffffff",
  "#2f6fa8",
  "#c2185b",
  "#2e7d32",
  "#7b1fa2",
];

export const BACKGROUNDS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#ec4899",
  "#6366f1",
  "#84cc16",
  "#f97316",
  "#0ea5e9",
  "#64748b",
];

export const JERSEY_COLORS = [
  "#ffffff",
  "#1e293b",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#eab308",
  "#7c3aed",
  "#f97316",
];

export const HAIRS = [
  "corto",
  "rulos",
  "largo",
  "gorro",
  "pelado",
  "afro",
  "mohicano",
  "jopo",
  "colita",
  "raya",
  "ondulado",
  "trenzas",
  "flequillo",
  "punta",
  "recogido",
  "media",
];

export const FACES = ["sonrisa", "seria", "grito", "picara", "enojada", "sorprendida", "guino", "triste"];

export const ACCESSORIES = [
  "ninguno",
  "anteojos",
  "vincha",
  "barba",
  "bigote",
  "gorra",
  "pintura",
  "sol",
];

export const JERSEYS = ["lisa", "rayas", "banda", "mitades"];

export const DEFAULT_AVATAR = {
  bg: BACKGROUNDS[0],
  skin: SKINS[2],
  hair: "corto",
  hairColor: HAIR_COLORS[1],
  face: "sonrisa",
  accessory: "ninguno",
  jersey: "lisa",
  jerseyColor: JERSEY_COLORS[0],
};

export function parseAvatarConfig(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    // Los avatares guardados antes de que existiera la camiseta no traen esas
    // claves: el merge con el default las completa en vez de romper el dibujo.
    return { ...DEFAULT_AVATAR, ...parsed };
  } catch {
    return null;
  }
}

function Hair({ style, color }) {
  if (style === "pelado") return null;
  if (style === "gorro") {
    return (
      <>
        <path d="M18 34 Q50 4 82 34 L82 38 L18 38 Z" fill={color} />
        <rect x="14" y="36" width="72" height="7" rx="3.5" fill={color} opacity="0.75" />
      </>
    );
  }
  if (style === "rulos") {
    return (
      <>
        <circle cx="30" cy="30" r="13" fill={color} />
        <circle cx="50" cy="23" r="15" fill={color} />
        <circle cx="70" cy="30" r="13" fill={color} />
      </>
    );
  }
  if (style === "afro") {
    return (
      <>
        <circle cx="50" cy="28" r="27" fill={color} />
        <circle cx="26" cy="38" r="14" fill={color} />
        <circle cx="74" cy="38" r="14" fill={color} />
      </>
    );
  }
  if (style === "mohicano") {
    return (
      <>
        <path d="M22 40 Q50 30 78 40 Q70 32 50 32 Q30 32 22 40 Z" fill={color} opacity="0.85" />
        <path d="M44 34 Q50 2 56 34 Z" fill={color} />
      </>
    );
  }
  if (style === "jopo") {
    return (
      <>
        <path d="M22 38 Q50 12 78 38 Q70 28 50 28 Q30 28 22 38 Z" fill={color} />
        <path d="M56 28 Q68 8 82 16 Q70 16 62 30 Z" fill={color} />
      </>
    );
  }
  if (style === "colita") {
    return (
      <>
        <path d="M22 38 Q50 10 78 38 Q70 26 50 26 Q30 26 22 38 Z" fill={color} />
        <circle cx="83" cy="44" r="9" fill={color} />
      </>
    );
  }
  if (style === "raya") {
    return (
      <>
        <path d="M22 38 Q50 10 78 38 Q70 26 50 26 Q30 26 22 38 Z" fill={color} />
        <path d="M50 26 L50 38" stroke="#00000055" strokeWidth="2" />
      </>
    );
  }
  if (style === "largo") {
    return <path d="M20 40 Q50 6 80 40 L80 70 Q74 54 72 40 L28 40 Q26 54 20 70 Z" fill={color} />;
  }
  if (style === "ondulado") {
    return (
      <>
        <path d="M22 38 Q50 10 78 38 Q70 26 50 26 Q30 26 22 38 Z" fill={color} />
        <path d="M22 38 Q30 44 36 38 Q42 32 48 38 Q54 44 60 38 Q66 32 72 38 Q76 40 78 38" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round"/>
      </>
    );
  }
  if (style === "trenzas") {
    return (
      <>
        <path d="M22 38 Q50 10 78 38 Q70 26 50 26 Q30 26 22 38 Z" fill={color} />
        <path d="M38 38 Q40 50 38 62 Q36 70 38 78" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round"/>
        <path d="M62 38 Q60 50 62 62 Q64 70 62 78" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round"/>
      </>
    );
  }
  if (style === "flequillo") {
    return (
      <>
        <path d="M22 38 Q50 10 78 38 Q70 26 50 26 Q30 26 22 38 Z" fill={color} />
        <path d="M28 36 Q40 46 52 36 Q60 30 78 38" stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"/>
      </>
    );
  }
  if (style === "punta") {
    return (
      <>
        <path d="M22 38 Q50 20 78 38 Q70 30 50 30 Q30 30 22 38 Z" fill={color} />
        <path d="M38 30 L34 12 L42 28 Z" fill={color} />
        <path d="M50 28 L50 8 L56 26 Z" fill={color} />
        <path d="M62 30 L66 12 L58 28 Z" fill={color} />
      </>
    );
  }
  if (style === "recogido") {
    return (
      <>
        <path d="M22 38 Q50 16 78 38 Q70 28 50 28 Q30 28 22 38 Z" fill={color} />
        <circle cx="50" cy="20" r="8" fill={color} />
      </>
    );
  }
  if (style === "media") {
    return (
      <>
        <path d="M22 38 Q50 10 78 38 Q70 26 50 26 Q30 26 22 38 Z" fill={color} />
        <path d="M22 38 L22 55 Q26 46 28 38" fill={color} />
        <path d="M78 38 L78 55 Q74 46 72 38" fill={color} />
      </>
    );
  }
  return <path d="M22 38 Q50 10 78 38 Q70 26 50 26 Q30 26 22 38 Z" fill={color} />;
}

function Face({ style }) {
  const dot = (cx) => <circle cx={cx} cy="50" r="3.5" fill="#1a1a1a" />;

  let eyes;
  if (style === "grito" || style === "sorprendida") {
    eyes = (
      <>
        <ellipse cx="39" cy="50" rx="4" ry="5.5" fill="#1a1a1a" />
        <ellipse cx="61" cy="50" rx="4" ry="5.5" fill="#1a1a1a" />
      </>
    );
  } else if (style === "picara" || style === "guino") {
    eyes = (
      <>
        <path d="M34 50 Q39 46 44 50" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
        {dot(61)}
      </>
    );
  } else if (style === "enojada") {
    eyes = (
      <>
        {dot(39)}
        {dot(61)}
        <path d="M32 42 L46 46" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
        <path d="M68 42 L54 46" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
      </>
    );
  } else if (style === "triste") {
    eyes = (
      <>
        {dot(39)}
        {dot(61)}
        <path d="M32 44 L46 41" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M68 44 L54 41" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      </>
    );
  } else {
    eyes = (
      <>
        {dot(39)}
        {dot(61)}
      </>
    );
  }

  const mouths = {
    seria: <path d="M41 65 L59 65" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />,
    grito: <ellipse cx="50" cy="66" rx="8" ry="10" fill="#1a1a1a" />,
    sorprendida: <circle cx="50" cy="66" r="6" fill="#1a1a1a" />,
    picara: <path d="M40 63 Q50 71 58 62" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />,
    guino: <path d="M40 63 Q50 71 58 62" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />,
    enojada: <path d="M40 68 Q50 60 60 68" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />,
    triste: <path d="M40 69 Q50 61 60 69" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />,
  };

  return (
    <>
      {eyes}
      {mouths[style] ?? (
        <path d="M39 62 Q50 72 61 62" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
    </>
  );
}

function Accessory({ style, hairColor }) {
  if (style === "anteojos") {
    return (
      <>
        <circle cx="39" cy="50" r="9" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
        <circle cx="61" cy="50" r="9" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
        <path d="M48 50 L52 50" stroke="#1a1a1a" strokeWidth="2.5" />
      </>
    );
  }
  if (style === "sol") {
    return (
      <>
        <path d="M28 46 H48 V56 Q38 60 30 54 Z" fill="#1a1a1a" />
        <path d="M52 46 H72 V54 Q64 60 54 56 Z" fill="#1a1a1a" />
        <path d="M48 48 H52" stroke="#1a1a1a" strokeWidth="3" />
      </>
    );
  }
  if (style === "vincha") {
    return <rect x="22" y="38" width="56" height="6" rx="3" fill="#ffffff" opacity="0.92" />;
  }
  if (style === "gorra") {
    return (
      <>
        <path d="M20 40 Q50 12 80 40 Z" fill="#1e293b" />
        <rect x="16" y="39" width="68" height="6" rx="3" fill="#0f172a" />
      </>
    );
  }
  if (style === "barba") {
    return (
      <path
        d="M28 58 Q30 84 50 86 Q70 84 72 58 Q66 74 50 74 Q34 74 28 58 Z"
        fill={hairColor}
        opacity="0.9"
      />
    );
  }
  if (style === "bigote") {
    return <path d="M40 60 Q50 55 60 60 Q50 63 40 60 Z" fill={hairColor} />;
  }
  if (style === "pintura") {
    return (
      <>
        <rect x="24" y="46" width="16" height="5" rx="2.5" fill="#ef4444" opacity="0.75" />
        <rect x="60" y="46" width="16" height="5" rx="2.5" fill="#ef4444" opacity="0.75" />
      </>
    );
  }
  return null;
}

const SHIRT_PATH = "M26 92 Q26 80 38 76 L62 76 Q74 80 74 92 L74 100 L26 100 Z";

// El clipPath necesita un id, y los ids de SVG son globales en el documento:
// con varios avatares en la misma pantalla se pisarían entre sí, así que cada
// instancia genera el suyo.
function Jersey({ style, color, clipId }) {
  const contrast = color === "#ffffff" ? "#1e293b" : "#ffffff";

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={SHIRT_PATH} />
        </clipPath>
      </defs>
      <path d={SHIRT_PATH} fill={color} />
      <g clipPath={`url(#${clipId})`}>
        {style === "rayas" && (
          <>
            <rect x="34" y="74" width="6" height="28" fill={contrast} opacity="0.85" />
            <rect x="47" y="74" width="6" height="28" fill={contrast} opacity="0.85" />
            <rect x="60" y="74" width="6" height="28" fill={contrast} opacity="0.85" />
          </>
        )}
        {style === "banda" && (
          <rect x="24" y="84" width="52" height="7" fill={contrast} opacity="0.85" />
        )}
        {style === "mitades" && (
          <rect x="50" y="74" width="26" height="28" fill={contrast} opacity="0.85" />
        )}
      </g>
    </g>
  );
}

function AvatarSvg({ config, size }) {
  const c = { ...DEFAULT_AVATAR, ...config };
  const clipId = useId();

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden="true">
      <rect width="100" height="100" rx="50" fill={c.bg} />
      <Jersey style={c.jersey} color={c.jerseyColor} clipId={clipId} />
      <ellipse cx="50" cy="54" rx="29" ry="32" fill={c.skin} />
      <Hair style={c.hair} color={c.hairColor} />
      <Face style={c.face} />
      <Accessory style={c.accessory} hairColor={c.hairColor} />
    </svg>
  );
}

// Si el usuario todavía no armó su muñequito, se cae a la inicial de siempre.
export default function Avatar({ user, size = 32, className = "" }) {
  const config = parseAvatarConfig(user?.avatar_config);
  const initial = user?.avatar || user?.username?.charAt(0).toUpperCase() || "?";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 ${
        config ? "" : "bg-accent/15 border border-accent/30 text-accent font-semibold"
      } ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      title={user?.username}
    >
      {config ? <AvatarSvg config={config} size={size} /> : initial}
    </span>
  );
}

export { AvatarSvg };
