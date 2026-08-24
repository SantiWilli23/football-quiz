// En el tema Pizarra las tarjetas no son cajas rellenas: son recuadros
// trazados con tiza, y por eso el borde va punteado.
export default function Card({ children, className = "" }) {
  return (
    <div className={`bg-panel border border-dashed border-border rounded-card p-6 ${className}`}>
      {children}
    </div>
  );
}
