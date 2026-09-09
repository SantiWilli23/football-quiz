import type { Guess } from "../types/player";

// Interpola de gris claro a casi-negro según el score (0-99). El 100 se
// resuelve aparte como fila invertida (fondo negro, texto blanco).
function barColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const from = 0xe2, to = 0x1a;
  const v = Math.round(from + (to - from) * t);
  const hex = v.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

interface Props {
  order: number;
  guess: Guess;
  isLatest: boolean;
}

export default function GuessRow({ order, guess, isLatest }: Props) {
  const { player, score } = guess;
  const isExact = score >= 100;

  return (
    <div
      className={`border px-4 py-3 transition-colors ${
        isExact
          ? "bg-black text-white border-black"
          : isLatest
          ? "border-black border-2"
          : "border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs tabular-nums ${isExact ? "text-gray-300" : "text-gray-500"}`}>#{order}</span>
          <span className={`text-sm truncate ${isLatest ? "font-semibold" : "font-medium"}`}>{player.name}</span>
        </div>
        <span className={`text-lg font-bold tabular-nums shrink-0 ${isExact ? "text-white" : "text-black"}`}>{score}</span>
      </div>

      {!isExact && (
        <div className="w-full h-2 bg-gray-200">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${score}%`, backgroundColor: barColor(score) }}
          />
        </div>
      )}

      <div className={`flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs ${isExact ? "text-gray-300" : "text-gray-500"}`}>
        <span>{player.team}</span>
        <span>{player.league}</span>
        <span>{player.nationality}</span>
        <span>{player.position}</span>
        <span>{player.age} años</span>
      </div>
    </div>
  );
}
