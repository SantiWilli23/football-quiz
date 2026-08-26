// Tabla de posiciones. Las primeras 4 posiciones se marcan (zona de
// copas continentales) y las últimas 3 también (descenso) — son lecturas
// de un vistazo que cualquiera que sigue una liga espera encontrar.
export default function StandingsTable({ table }) {
  if (table.length === 0) {
    return <p className="text-sm text-gray-500">No hay tabla disponible todavía.</p>;
  }

  const total = table.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[560px]">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-border">
            <th className="py-2 pr-2 font-medium w-8">#</th>
            <th className="py-2 pr-2 font-medium">Equipo</th>
            <th className="py-2 px-2 font-medium text-center">PJ</th>
            <th className="py-2 px-2 font-medium text-center">G</th>
            <th className="py-2 px-2 font-medium text-center">E</th>
            <th className="py-2 px-2 font-medium text-center">P</th>
            <th className="py-2 px-2 font-medium text-center">DG</th>
            <th className="py-2 pl-2 font-medium text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => {
            const zone =
              row.position <= 4 ? "border-l-2 border-accent/60" : row.position > total - 3 ? "border-l-2 border-red-500/50" : "border-l-2 border-transparent";
            return (
              <tr key={row.team.id} className={`border-b border-border/60 ${zone}`}>
                <td className="py-2 pr-2 pl-2 tabular-nums text-gray-400">{row.position}</td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {row.team.logo && <img src={row.team.logo} alt="" className="w-5 h-5 shrink-0" loading="lazy" />}
                    <span className="truncate">{row.team.name}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center tabular-nums text-gray-400">{row.played}</td>
                <td className="py-2 px-2 text-center tabular-nums text-gray-400">{row.won}</td>
                <td className="py-2 px-2 text-center tabular-nums text-gray-400">{row.drawn}</td>
                <td className="py-2 px-2 text-center tabular-nums text-gray-400">{row.lost}</td>
                <td className="py-2 px-2 text-center tabular-nums text-gray-400">
                  {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                </td>
                <td className="py-2 pl-2 text-center tabular-nums font-semibold">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent/60 inline-block" /> Copas continentales
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/50 inline-block" /> Descenso
        </span>
      </div>
    </div>
  );
}
