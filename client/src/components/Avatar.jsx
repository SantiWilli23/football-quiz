// Los avatares se dibujan con SVG dentro de la app: nada de imágenes externas
// ni de subir fotos de nadie. La configuración es un objeto chico que se
// guarda como JSON en el usuario.
export const SKINS = ["#f2d0b4", "#e0ac82", "#c68642", "#8d5524", "#5c3317"];
export const HAIR_COLORS = ["#2c1b18", "#5a3825", "#a55728", "#d6b370", "#b9b9b9", "#2f6fa8"];
export const BACKGROUNDS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#14b8a6"];
export const HAIRS = ["corto", "rulos", "largo", "gorro", "pelado"];
export const FACES = ["sonrisa", "seria", "grito", "picara"];
export const ACCESSORIES = ["ninguno", "anteojos", "vincha", "barba"];

export const DEFAULT_AVATAR = {
  bg: BACKGROUNDS[0],
  skin: SKINS[1],
  hair: "corto",
  hairColor: HAIR_COLORS[0],
  face: "sonrisa",
  accessory: "ninguno",
};

export function parseAvatarConfig(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
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
  if (style === "largo") {
    return (
      <>
        <path d="M20 40 Q50 6 80 40 L80 70 Q74 54 72 40 L28 40 Q26 54 20 70 Z" fill={color} />
      </>
    );
  }
  return <path d="M22 38 Q50 10 78 38 Q70 26 50 26 Q30 26 22 38 Z" fill={color} />;
}

function Face({ style }) {
  const eyes =
    style === "grito" ? (
      <>
        <ellipse cx="39" cy="50" rx="4" ry="5" fill="#1a1a1a" />
        <ellipse cx="61" cy="50" rx="4" ry="5" fill="#1a1a1a" />
      </>
    ) : style === "picara" ? (
      <>
        <path d="M34 50 Q39 46 44 50" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="61" cy="50" r="3.5" fill="#1a1a1a" />
      </>
    ) : (
      <>
        <circle cx="39" cy="50" r="3.5" fill="#1a1a1a" />
        <circle cx="61" cy="50" r="3.5" fill="#1a1a1a" />
      </>
    );

  const mouth =
    style === "seria" ? (
      <path d="M41 65 L59 65" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
    ) : style === "grito" ? (
      <ellipse cx="50" cy="66" rx="8" ry="10" fill="#1a1a1a" />
    ) : style === "picara" ? (
      <path d="M40 63 Q50 71 58 62" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
    ) : (
      <path d="M39 62 Q50 72 61 62" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
    );

  return (
    <>
      {eyes}
      {mouth}
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
  if (style === "vincha") {
    return <rect x="22" y="38" width="56" height="6" rx="3" fill="#ffffff" opacity="0.9" />;
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
  return null;
}

function AvatarSvg({ config, size }) {
  const c = { ...DEFAULT_AVATAR, ...config };
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden="true">
      <rect width="100" height="100" rx="50" fill={c.bg} />
      <ellipse cx="50" cy="56" rx="30" ry="33" fill={c.skin} />
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
