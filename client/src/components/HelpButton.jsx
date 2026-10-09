import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CircleHelp, X } from "lucide-react";
import { helpFor } from "../data/helpTexts.js";

// Botón «?» de cada pantalla: abre un resumen de cómo se juega o de cómo
// funciona. Los textos viven en data/helpTexts.js. `inline` = dentro de una
// barra (arriba a la derecha, en la barra superior o en el modo enfoque).
export default function HelpButton({ inline = false }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const help = helpFor(pathname);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!help) return null;

  const pos = inline ? "" : "fixed right-4 top-3 z-40 shadow-lg";
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${pos} flex items-center justify-center w-9 h-9 rounded-full border border-border bg-panel text-gray-300 hover:text-white hover:border-gray-500 transition-colors`}
        aria-label={`Ayuda: ${help.title}`}
        title="Cómo funciona"
      >
        <CircleHelp size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[9990] bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={help.title}
            className="bg-panel border border-border rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="text-lg font-bold">{help.title}</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">{help.intro}</p>
            {help.points.length > 0 && (
              <ul className="space-y-2.5 text-sm text-gray-300 mb-5">
                {help.points.map((p) => (
                  <li key={p} className="flex gap-2"><span className="text-accent shrink-0">•</span><span>{p}</span></li>
                ))}
              </ul>
            )}
            <button onClick={() => setOpen(false)} className="btn btn-primary w-full">Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}
