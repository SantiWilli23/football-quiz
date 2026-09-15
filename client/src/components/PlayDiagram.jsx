// No hay fotos reales de jugadas disponibles (no hay dataset ni permiso para
// scrapear imágenes de partidos), así que cada categoría de jugada tiene un
// diagrama esquemático propio — una cancha estilizada con las posiciones que
// importan para esa decisión (línea de fuera de juego, área, brazo, etc.),
// en vez de texto solo. Colores por variable CSS para que respete el tema.
const PITCH = (
  <>
    <rect x="4" y="4" width="192" height="112" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.35" />
    <line x1="100" y1="4" x2="100" y2="116" stroke="currentColor" strokeOpacity="0.35" />
    <circle cx="100" cy="60" r="14" fill="none" stroke="currentColor" strokeOpacity="0.35" />
  </>
);

function AreaBox({ side = "left" }) {
  const x = side === "left" ? 4 : 152;
  return <rect x={x} y="30" width="44" height="60" fill="none" stroke="currentColor" strokeOpacity="0.35" />;
}

const DIAGRAMS = {
  area_foul: (accent) => (
    <svg viewBox="0 0 200 120" className="w-full h-28">
      {PITCH}
      <AreaBox side="left" />
      <circle cx="30" cy="60" r="5" fill={accent} />
      <circle cx="38" cy="55" r="5" fill="currentColor" opacity="0.6" />
      <path d="M30 60 L38 55" stroke={accent} strokeWidth="2" strokeDasharray="2 2" />
      <circle cx="34" cy="58" r="2.5" fill="#fff" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  ),
  protest: (accent) => (
    <svg viewBox="0 0 200 120" className="w-full h-28">
      {PITCH}
      <circle cx="100" cy="60" r="6" fill="currentColor" opacity="0.7" />
      <circle cx="112" cy="55" r="5" fill={accent} />
      <path d="M107 55 Q100 50 96 58" stroke={accent} strokeWidth="2" fill="none" />
      <path d="M107 60 Q98 62 95 68" stroke={accent} strokeWidth="2" fill="none" />
    </svg>
  ),
  tackle: (accent) => (
    <svg viewBox="0 0 200 120" className="w-full h-28">
      {PITCH}
      <circle cx="90" cy="70" r="5" fill="currentColor" opacity="0.6" />
      <circle cx="105" cy="58" r="5" fill={accent} />
      <path d="M100 63 L92 68" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <circle cx="88" cy="72" r="2.5" fill="#fff" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  ),
  offside: (accent) => (
    <svg viewBox="0 0 200 120" className="w-full h-28">
      {PITCH}
      <AreaBox side="right" />
      <line x1="150" y1="4" x2="150" y2="116" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx="140" cy="45" r="5" fill="currentColor" opacity="0.6" />
      <circle cx="155" cy="70" r="5" fill={accent} />
      <circle cx="160" cy="60" r="2.5" fill="#fff" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  ),
  handball: (accent) => (
    <svg viewBox="0 0 200 120" className="w-full h-28">
      {PITCH}
      <AreaBox side="left" />
      <circle cx="25" cy="55" r="5" fill={accent} />
      <path d="M25 55 L15 45" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <circle cx="13" cy="43" r="2.5" fill="#fff" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  ),
  goal_review: (accent) => (
    <svg viewBox="0 0 200 120" className="w-full h-28">
      {PITCH}
      <rect x="4" y="45" width="6" height="30" fill="none" stroke="currentColor" strokeOpacity="0.5" />
      <circle cx="30" cy="60" r="2.5" fill="#fff" stroke="currentColor" strokeWidth="0.5" />
      <path d="M30 60 L10 60" stroke={accent} strokeWidth="2" strokeDasharray="2 2" />
      <circle cx="10" cy="60" r="5" fill={accent} opacity="0.7" />
    </svg>
  ),
  violent: (accent) => (
    <svg viewBox="0 0 200 120" className="w-full h-28">
      {PITCH}
      <circle cx="95" cy="60" r="5" fill="currentColor" opacity="0.6" />
      <circle cx="108" cy="60" r="5" fill={accent} />
      <path d="M100 55 L104 58 L100 65" stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
};

export default function PlayDiagram({ type }) {
  const render = DIAGRAMS[type] || DIAGRAMS.tackle;
  return (
    <div className="rounded-card border border-border bg-bg text-gray-500 p-2 mb-4">
      {render("rgb(var(--c-accent))")}
    </div>
  );
}
