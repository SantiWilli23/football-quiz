import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import TeamCrest from "./TeamCrest.jsx";

export default function SeasonCalendar() {
  const { state, standingsSorted } = useCareer();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold mb-3">Tabla de posiciones</h2>
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead className="bg-panel text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-2 py-2">Equipo</th>
                <th className="px-2 py-2">PJ</th>
                <th className="px-2 py-2">G</th>
                <th className="px-2 py-2">E</th>
                <th className="px-2 py-2">P</th>
                <th className="px-2 py-2">GF</th>
                <th className="px-2 py-2">GC</th>
                <th className="px-2 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standingsSorted.map((row, i) => {
                const t = teamById(row.teamId);
                const mine = row.teamId === state.teamId;
                return (
                  <tr key={row.teamId} className={`border-t border-border ${mine ? "bg-accent/10" : ""}`}>
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className={`px-2 py-2 truncate max-w-[140px] ${mine ? "font-semibold text-accent" : ""}`}>
                      <span className="flex items-center gap-2"><TeamCrest team={t} size={18} />{t?.name}</span>
                    </td>
                    <td className="px-2 py-2 text-center">{row.played}</td>
                    <td className="px-2 py-2 text-center">{row.won}</td>
                    <td className="px-2 py-2 text-center">{row.drawn}</td>
                    <td className="px-2 py-2 text-center">{row.lost}</td>
                    <td className="px-2 py-2 text-center">{row.gf}</td>
                    <td className="px-2 py-2 text-center">{row.ga}</td>
                    <td className="px-2 py-2 text-center font-semibold">{row.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Calendario</h2>
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {state.calendar.map((c) => {
            const rival = teamById(c.opponentTeamId);
            return (
              <div key={c.week} className={`flex items-center justify-between text-sm px-3 py-2 rounded-card border ${c.played ? "border-border bg-panel/50" : "border-border bg-panel"}`}>
                <span className="text-gray-500 w-16 shrink-0">J{c.week}</span>
                <span className="flex-1 truncate">{c.home ? `vs ${rival?.name} (L)` : `vs ${rival?.name} (V)`}</span>
                <span className="shrink-0 font-medium">
                  {c.played ? `${c.result.myGoals}-${c.result.rivalGoals}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
