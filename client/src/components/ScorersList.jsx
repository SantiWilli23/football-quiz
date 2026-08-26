import { CHALK } from "../theme.js";

// Ranking de goleadores. El líder se destaca porque es el dato que la
// mayoría viene a buscar acá; el resto son filas neutras.
export default function ScorersList({ scorers }) {
  if (scorers.length === 0) {
    return <p className="text-sm text-gray-500">No hay goleadores disponibles todavía.</p>;
  }

  return (
    <div className="space-y-2">
      {scorers.map((entry, i) => (
        <div
          key={entry.player.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-card border border-border bg-bg"
        >
          <span
            className="w-6 text-center text-sm font-semibold tabular-nums shrink-0"
            style={i === 0 ? { color: CHALK.yellow } : undefined}
          >
            {i + 1}
          </span>
          {entry.player.photo && (
            <img src={entry.player.photo} alt="" className="w-8 h-8 rounded-full shrink-0" loading="lazy" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{entry.player.name}</p>
            {entry.team && <p className="text-xs text-gray-500 truncate">{entry.team.name}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold tabular-nums">{entry.goals} goles</p>
            <p className="text-[11px] text-gray-500">{entry.assists} asistencias</p>
          </div>
        </div>
      ))}
    </div>
  );
}
