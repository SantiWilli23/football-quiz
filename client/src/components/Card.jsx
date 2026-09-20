// Tres niveles en vez de uno solo para todo — antes cada tarjeta llevaba el
// mismo borde + fondo + esquina, sin importar si era el contenedor de una
// sección, una fila de una lista o el único dato que de verdad importa en
// la pantalla. Ahora eso se elige con `variant`:
//   - "panel"   (default): el de siempre — contenedor de una sección.
//   - "row":     un ítem dentro de una lista — sin caja propia, solo un
//                separador abajo. Se usa DENTRO de un "panel".
//   - "feature": lo único destacado de la pantalla — borde de acento y
//                fondo con degradé. Usar como mucho una vez por pantalla.
const VARIANTS = {
  panel: "bg-panel border border-border rounded-2xl card-pad",
  row: "border-b border-border last:border-0 py-3",
  feature: "border border-accent/40 rounded-2xl card-pad bg-gradient-to-br from-accent/10 to-transparent",
};

export default function Card({ children, className = "", variant = "panel" }) {
  return <div className={`${VARIANTS[variant] || VARIANTS.panel} ${className}`}>{children}</div>;
}
