// Escudo del grupo: un color + hasta 3 iniciales, guardado como JSON en
// groups_t.avatar (ver server/routes/groups.js). Si el grupo es de antes de
// este cambio, `avatar` es null y se cae a un escudo gris con la primera
// letra del nombre — nunca rompe, solo se ve menos personalizado.
export const CREST_COLORS = ["#4ade80", "#ffb400", "#3b9dd6", "#e85d5d", "#a78bfa", "#f472b6", "#facc15", "#22d3ee"];

export function parseCrest(group) {
  if (!group) return null;
  try {
    const c = JSON.parse(group.avatar || "null");
    if (c && c.color && c.initials) return { ...c, initials: String(c.initials).trim().slice(0, 3).toUpperCase() };
  } catch { /* grupo viejo sin escudo guardado */ }
  return { color: "#6b7280", initials: (group.name || "FT").trim().slice(0, 2).toUpperCase() };
}

export default function Crest({ group, size = 36, className = "" }) {
  const { color, initials } = parseCrest(group);
  const font = Math.max(10, Math.round(size * 0.38));
  return (
    <div
      className={`shrink-0 flex items-center justify-center font-bold text-black/80 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: font,
        background: `linear-gradient(160deg, ${color}, color-mix(in srgb, ${color} 60%, black))`,
        clipPath: "polygon(50% 0%, 100% 20%, 100% 65%, 50% 100%, 0% 65%, 0% 20%)",
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
