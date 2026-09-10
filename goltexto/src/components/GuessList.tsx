import type { Guess } from "../types/player";
import GuessRow from "./GuessRow";
import { sortByScoreDesc } from "../utils/scoring";

interface Props {
  guesses: Guess[];
  latestPlayerId: number | null;
}

export default function GuessList({ guesses, latestPlayerId }: Props) {
  if (!guesses.length) {
    return <p className="text-sm text-gray-500 text-center py-8">Todavía no probaste ningún jugador.</p>;
  }

  const sorted = sortByScoreDesc(guesses);

  return (
    <div className="space-y-2.5">
      {sorted.map((g, i) => (
        <GuessRow key={g.player.id} order={i + 1} guess={g} isLatest={g.player.id === latestPlayerId} />
      ))}
    </div>
  );
}
