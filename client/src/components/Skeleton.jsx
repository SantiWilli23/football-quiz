// Esqueletos de carga: la misma forma que el contenido final, así nada salta
// de lugar cuando llegan los datos. La animación se apaga sola con
// prefers-reduced-motion (ver .skeleton en index.css).
export function SkeletonBlock({ className = "" }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

// Filas tipo ranking: número + avatar + nombre + puntos.
export function SkeletonRows({ rows = 5, avatar = true }) {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonBlock className="w-6 h-4" />
          {avatar && <SkeletonBlock className="w-8 h-8 !rounded-full shrink-0" />}
          <SkeletonBlock className="h-4 flex-1 max-w-[160px]" />
          <SkeletonBlock className="w-12 h-4 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// Bloque tipo tarjeta: título + un par de líneas.
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-panel border border-border rounded-2xl p-6 space-y-3" role="status" aria-label="Cargando">
      <SkeletonBlock className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-3.5 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
