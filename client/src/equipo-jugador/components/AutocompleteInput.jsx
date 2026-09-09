import { useEffect, useRef, useState } from "react";

// Input con autocompletado obligatorio: el jugador SIEMPRE elige de la lista
// que devuelve la base de datos (nunca puede mandar texto libre), así se
// evitan errores de tipeo y no hace falta parsear nombres después.
export default function AutocompleteInput({ placeholder, searchFn, onSelect, disabled, renderExtra }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchFn(query);
        setOptions(results);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(option) {
    onSelect(option);
    setQuery("");
    setOptions([]);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => options.length && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-bg border border-border rounded-2xl px-4 py-3.5 text-base disabled:opacity-40"
      />
      {loading && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">...</span>}
      {open && options.length > 0 && (
        <div className="absolute z-30 mt-1.5 w-full bg-panel border border-border rounded-2xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => pick(opt)}
              className="w-full text-left px-4 py-3 hover:bg-accent/10 transition-colors border-b border-border last:border-0"
            >
              <p className="text-sm font-medium">{opt.name}</p>
              {renderExtra && <p className="text-xs text-gray-500 mt-0.5">{renderExtra(opt)}</p>}
            </button>
          ))}
        </div>
      )}
      {open && !loading && query.trim().length >= 2 && options.length === 0 && (
        <div className="absolute z-30 mt-1.5 w-full bg-panel border border-border rounded-2xl px-4 py-3 text-sm text-gray-500">
          Sin resultados.
        </div>
      )}
    </div>
  );
}
