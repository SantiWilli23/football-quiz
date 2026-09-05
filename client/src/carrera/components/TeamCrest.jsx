import { badgeFor } from "../data/teams.js";

// Escudo real cuando lo tenemos confirmado; si no, un cuadrado con los
// colores reales del club (evita mostrar imágenes rotas).
export default function TeamCrest({ team, size = 32, className = "" }) {
  const url = badgeFor(team.id);
  const style = { width: size, height: size };
  if (url) {
    return <img src={url} alt={team.name} className={`object-contain shrink-0 ${className}`} style={style} />;
  }
  return (
    <div
      className={`rounded-card shrink-0 ${className}`}
      style={{ ...style, background: `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary})` }}
    />
  );
}
