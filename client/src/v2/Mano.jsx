import { useEffect, useState } from "react";
import { Hand } from "lucide-react";

// Tutorial sin texto largo: una mano animada que muestra qué tocar y, como mucho, 3 o 4
// palabras. Se muestra la primera vez de cada juego y se puede saltar. La marca de «ya lo
// vi» vive en localStorage (si no hay storage, simplemente no se recuerda).
const key = (id) => `fq_mano_${id}`;
const seen = (id) => { try { return localStorage.getItem(key(id)) === "1"; } catch { return false; } };
const mark = (id) => { try { localStorage.setItem(key(id), "1"); } catch { /* sin storage */ } };
export const resetManos = () => {
  try { Object.keys(localStorage).filter((k) => k.startsWith("fq_mano_")).forEach((k) => localStorage.removeItem(k)); } catch { /* sin storage */ }
};

export default function Mano({ id, text, children }) {
  const [open, setOpen] = useState(() => !seen(id));
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => { mark(id); setOpen(false); }, 6000);
    return () => clearTimeout(t);
  }, [open, id]);

  if (!open) return children;
  const skip = () => { mark(id); setOpen(false); };
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-4" role="note">
        <div className="flex flex-col items-center">
          <Hand size={34} className="mano-tap text-white drop-shadow-lg" aria-hidden="true" />
          <span className="mt-1 rounded-full bg-black/75 px-3 py-1 text-sm font-semibold text-white">{text}</span>
        </div>
      </div>
      <button onClick={skip} className="absolute right-0 top-0 z-20 rounded-full border border-border bg-bg/90 px-3 py-1 text-xs text-gray-300">Saltar</button>
      <style>{`@keyframes mano-tap{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14px) scale(.92)}}.mano-tap{animation:mano-tap 1.1s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.mano-tap{animation:none}}`}</style>
    </div>
  );
}

// Guía «agregar a inicio»: después del primer partido. En iPhone es la única forma de recibir avisos.
export function AddToHome() {
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem("fq_home_hint") !== "1" && !window.matchMedia("(display-mode: standalone)").matches && !navigator.standalone; } catch { return false; }
  });
  if (!show) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const close = () => { try { localStorage.setItem("fq_home_hint", "1"); } catch { /* sin storage */ } setShow(false); };
  return (
    <div className="rounded-2xl border border-border bg-panel p-4 text-sm">
      <p className="t-eyebrow">Tenlo a mano</p>
      <p className="mt-1 font-semibold">Agrega Futotal a tu inicio</p>
      <ol className="mt-2 space-y-1 text-gray-300">
        {ios
          ? <><li>1. Toca Compartir (el cuadrado con flecha).</li><li>2. «Agregar a pantalla de inicio».</li><li>3. Así te llegan los avisos.</li></>
          : <><li>1. Toca el menú ⋮ del navegador.</li><li>2. «Agregar a pantalla de inicio».</li><li>3. Entra desde ahí cada día.</li></>}
      </ol>
      <button onClick={close} className="btn btn-secondary btn-sm mt-3">Listo</button>
    </div>
  );
}
