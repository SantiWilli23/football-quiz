import type { Guess } from "../types/player";

// Interpola de un gris apagado al azul de acento según el score (0-99). El
// 100 se resuelve aparte como fila destacada en acento.
function barColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  // gray-600 (#6f7074) -> accent (#3b9dd6)
  const from = { r: 0x6f, g: 0x70, b: 0x74 };
  const to = { r: 0x3b, g: 0x9d, b: 0xd6 };
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(from.r, to.r)}, ${mix(from.g, to.g)}, ${mix(from.b, to.b)})`;
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
      className={`rounded-xl border px-4 py-3.5 transition-all ${
        isExact
          ? "bg-accent/15 border-accent shadow-[0_2px_8px_rgba(59,157,214,0.2)]"
          : isLatest
          ? "border-accent/60 bg-panel shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
          : "border-border bg-panel"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[11px] font-medium tabular-nums w-4 shrink-0 text-gray-500">
            {order}
          </span>
          <span className={`text-sm truncate ${isLatest || isExact ? "font-semibold text-white" : "font-medium text-gray-200"}`}>{player.name}</span>
        </div>
        <span className={`text-xl font-bold tabular-nums shrink-0 ${isExact ? "text-accent" : "text-white"}`}>{score}</span>
      </div>

      {!isExact && (
        <div className="w-full h-1.5 rounded-full bg-bg overflow-hidden mb-2.5">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${score}%`, backgroundColor: barColor(score) }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {[player.team, player.league, player.nationality, player.position, `${player.age} años`].map((val) => (
          <span
            key={val}
            className={`text-[11px] px-2 py-0.5 rounded-full ${
              isExact ? "bg-accent/20 text-accent" : "bg-bg text-gray-400"
            }`}
          >
            {val}
          </span>
        ))}
      </div>
    </div>
  );
}
