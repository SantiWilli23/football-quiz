import api from "../api.js";

// Medición simple (Futotal 2.0): nunca rompe nada si falla.
export function track(name, props) {
  api.post("/analytics", { name, props }).catch(() => {});
}
