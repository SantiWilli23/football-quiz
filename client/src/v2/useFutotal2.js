import { useEffect, useState } from "react";
import api from "../api.js";
import { useVersion } from "../demo/version.js";

// Futotal 2.0 viene encendido; el servidor lo apaga con FUTOTAL2=0. Se pregunta una sola vez y
// mientras llega la respuesta (o sin señal) se usa la última conocida, así no parpadea la app vieja.
let pending = null;
const cached = () => { try { return localStorage.getItem("fq_v2") !== "0"; } catch { return true; } };

export function loadFutotal2() {
  if (!pending) {
    pending = api.get("/public/features").then((r) => ({ on: !!r.data.futotal2, games: r.data.games || [] })).catch(() => ({ on: cached(), games: [] }));
    // Con el rediseño encendido se registra el service worker para poder abrir sin señal, y se
    // marca <html data-v2> (el aspecto nuevo). La respuesta se recuerda para el próximo arranque.
    pending.then(({ on }) => {
      document.documentElement.toggleAttribute("data-v2", on);
      try { localStorage.setItem("fq_v2", on ? "1" : "0"); } catch { /* sin storage */ }
      if (on && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
  return pending;
}

export default function useFutotal2() {
  const [state, setState] = useState({ on: cached(), ready: false, games: [] });
  // Futotal 1 (solo para el dueño): la app de antes, sin el rediseño.
  const f1 = useVersion().version === "f1";
  useEffect(() => { if (f1) document.documentElement.removeAttribute("data-v2"); else if (state.on) document.documentElement.setAttribute("data-v2", ""); }, [f1, state.on]);
  useEffect(() => {
    let alive = true;
    loadFutotal2().then(({ on, games }) => { if (alive) setState({ on, ready: true, games }); });
    return () => { alive = false; };
  }, []);
  return f1 ? { ...state, on: false, games: [] } : state;
}
