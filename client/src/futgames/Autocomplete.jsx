import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export function normalize(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Buscador con sugerencias compartido por los tres juegos: ignora tildes y
// mayúsculas, busca por cualquier parte del nombre y muestra hasta 8.
export default function Autocomplete({ options, onPick, placeholder, disabled, exclude = [] }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const normalized = useMemo(() => options.map((o) => [o, normalize(o)]), [options]);

  const q = normalize(query);
  const excluded = new Set(exclude);
  const suggestions = q.length >= 2
    ? normalized.filter(([o, n]) => n.includes(q) && !excluded.has(o)).slice(0, 8).map(([o]) => o)
    : [];

  function pick(o) {
    setQuery("");
    setActive(0);
    onPick(o);
  }

  function onKeyDown(e) {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + suggestions.length) % suggestions.length); }
    if (e.key === "Enter") { e.preventDefault(); pick(suggestions[Math.min(active, suggestions.length - 1)]); }
    if (e.key === "Escape") setQuery("");
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-bg border border-border rounded-card px-3 py-2.5 focus-within:border-accent/60">
        <Search size={15} className="text-gray-500 shrink-0" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={placeholder}
          aria-autocomplete="list"
          className="flex-1 bg-transparent text-sm focus:outline-none min-w-0 disabled:opacity-50"
        />
      </div>
      {suggestions.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full bg-panel border border-border rounded-card overflow-hidden shadow-lg">
          {suggestions.map((o, i) => (
            <li key={o} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === active ? "bg-accent/10 text-accent" : "hover:bg-white/5"}`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
