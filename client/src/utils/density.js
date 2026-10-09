// Densidad de las tarjetas: única opción "cómoda" (el aire de siempre).
// Se deja el atributo fijo para que el padding de .card-pad no cambie.
export function applyStoredDensity() {
  document.documentElement.setAttribute("data-density", "comoda");
}
