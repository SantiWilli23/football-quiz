import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { GAMES } from "../data/gameCatalog.js";

const PAGES = [
  { label: "Inicio", to: "/panel" },
  { label: "Trivia", to: "/trivia" },
  { label: "Juegos", to: "/juegos" },
  { label: "En vivo", to: "/futbol" },
  { label: "Mi grupo", to: "/grupo" },
  { label: "Estadísticas", to: "/estadisticas" },
  { label: "Historial", to: "/historial" },
  { label: "Ranking global", to: "/ranking-global" },
  { label: "Vida FUT", to: "/vida-fut" },
  { label: "Mi perfil", to: "/perfil" },
];

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Ctrl/Cmd+K: saltar a cualquier pantalla o juego escribiendo unas letras.
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const entries = useMemo(
    () => [
      ...PAGES.map((p) => ({ ...p, kind: "Pantalla" })),
      ...GAMES.filter((g) => g.available !== false && (g.to || g.href)).map((g) => ({
        label: g.label, to: g.to, href: g.href, kind: "Juego",
      })),
    ],
    [],
  );
  const results = entries.filter((e) => norm(e.label).includes(norm(query))).slice(0, 8);

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setCursor(0);
      } else if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  function go(entry) {
    if (!entry) return;
    setOpen(false);
    if (entry.to) navigate(entry.to);
    else window.location.href = entry.href;
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-start justify-center pt-[15vh] px-4" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Buscador rápido"
        className="w-full max-w-md bg-panel border border-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search size={15} className="text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              else if (e.key === "Enter") go(results[cursor]);
            }}
            placeholder="Ir a un juego o pantalla…"
            className="flex-1 bg-transparent py-3.5 text-sm focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-500 border border-border rounded px-1.5">Esc</kbd>
        </div>
        <ul className="p-2 max-h-72 overflow-y-auto">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">Sin resultados</li>}
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.label}`}>
              <button
                onClick={() => go(r)}
                onMouseEnter={() => setCursor(i)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left ${
                  i === cursor ? "bg-accent/10 text-accent" : "text-gray-300"
                }`}
              >
                {r.label}
                <span className="text-[11px] text-gray-500">{r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
