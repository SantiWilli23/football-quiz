import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import useAlerts from "../hooks/useAlerts.js";

// Campana con contador: junta en un panel lo que antes eran avisos sueltos
// (trivia sin responder, duelos que esperan tu turno, retos semanales).
export default function AlertsBell({ align = "left", className = "" }) {
  const items = useAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Avisos${items.length ? `: ${items.length} pendientes` : ""}`}
        aria-expanded={open}
        className="relative p-2 rounded-card text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-bad text-onaccent text-xs font-semibold leading-4 text-center">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute z-40 mt-2 w-72 max-w-[85vw] rounded-xl border border-border bg-panel shadow-xl p-2 ${align === "right" ? "right-0" : "left-0"}`}>
          <p className="t-eyebrow px-2 pt-1 pb-2">Avisos</p>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 px-2 pb-2">No te falta nada por hoy.</p>
          ) : (
            items.map((it) => (
              <Link
                key={it.key}
                to={it.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <it.icon size={15} className="text-accent shrink-0" />
                <span className="flex-1">{it.label}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
