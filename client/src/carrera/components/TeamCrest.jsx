import { badgeFor } from "../data/teams.js";

// Escudo real cuando lo tenemos confirmado; si no, un escudo placeholder con
// forma de escudo real (no un cuadrado liso) en los colores del club, con
// sus iniciales — así el 90% de los clubes sin logo cargado igual se leen
// como un escudo y no como un cuadrado vacío.
export default function TeamCrest({ team, size = 32, className = "" }) {
  const url = badgeFor(team.id);
  const style = { width: size, height: size };
  if (url) {
    return <img src={url} alt={team.name} className={`object-contain shrink-0 ${className}`} style={style} />;
  }
  const initials = (team.shortName || team.name.slice(0, 3)).toUpperCase();
  return (
    <svg viewBox="0 0 32 36" className={`shrink-0 ${className}`} style={style} role="img" aria-label={team.name}>
      <defs>
        <linearGradient id={`crest-${team.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={team.colors.primary} />
          <stop offset="100%" stopColor={team.colors.secondary} />
        </linearGradient>
      </defs>
      <path
        d="M16 0 L30 4 V17 C30 26 24 32 16 36 C8 32 2 26 2 17 V4 Z"
        fill={`url(#crest-${team.id})`}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fill="#fff"
        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.45)", strokeWidth: 2 }}
      >
        {initials.slice(0, 3)}
      </text>
    </svg>
  );
}
