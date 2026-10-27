import { useEffect, useState } from "react";
import api from "../api.js";

// Futotal 2.0 se enciende desde el servidor (FUTOTAL2=1), así que el mismo build sirve
// para probar el rediseño o seguir con la app de siempre. Se pregunta una sola vez.
let pending = null;

export function loadFutotal2() {
  if (!pending) pending = api.get("/clubs/features").then((r) => !!r.data.futotal2).catch(() => false);
  return pending;
}

export default function useFutotal2() {
  const [state, setState] = useState({ on: false, ready: false });
  useEffect(() => {
    let alive = true;
    loadFutotal2().then((on) => { if (alive) setState({ on, ready: true }); });
    return () => { alive = false; };
  }, []);
  return state;
}
