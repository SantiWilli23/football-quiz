import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "../types/player";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

interface Props {
  players: Player[];
  guessedIds: Set<number>;
  disabled: boolean;
  onSubmit: (player: Player) => void;
  errorMessage: string | null;
}

export default function GuessInput({ players, guessedIds, disabled, onSubmit, errorMessage }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (q.length < 1) return [];
    return players
      .filter((p) => normalize(p.name).includes(q))
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, 8);
  }, [query, players]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(player: Player) {
    onSubmit(player);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder="Escribí el nombre de un futbolista…"
        className="w-full border border-black px-4 py-3 text-sm outline-none focus:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      />

      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full border border-black bg-white max-h-72 overflow-y-auto">
          {suggestions.map((p) => {
            const already = guessedIds.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-200 last:border-0 hover:bg-gray-100 transition-colors ${
                  already ? "text-gray-400" : "text-black"
                }`}
              >
                {p.name}
                {already && <span className="text-xs ml-2">(ya lo probaste)</span>}
                <span className="text-xs text-gray-500 ml-2">{p.team}</span>
              </button>
            );
          })}
        </div>
      )}

      {open && query.trim().length > 0 && suggestions.length === 0 && (
        <div className="absolute z-20 mt-1 w-full border border-black bg-white px-4 py-3 text-sm text-gray-600">
          No encontramos a nadie con ese nombre.
        </div>
      )}

      {errorMessage && <p className="text-sm text-gray-600 mt-2">{errorMessage}</p>}
    </div>
  );
}
