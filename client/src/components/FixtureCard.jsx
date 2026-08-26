import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import api from "../api.js";
import { CHALK } from "../theme.js";

const STATUS_LABEL = {
  NS: "Por jugar",
  "1H": "1er tiempo",
  HT: "Entretiempo",
  "2H": "2do tiempo",
  ET: "Alargue",
  P: "Penales",
  FT: "Finalizado",
  AET: "Finalizado (alargue)",
  PEN: "Finalizado (penales)",
  PST: "Postergado",
  CANC: "Cancelado",
  SUSP: "Suspendido",
  TBD: "A confirmar",
};

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "P"]);

function TeamRow({ team, score, isWinner }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {team.logo && (
        <img src={team.logo} alt="" className="w-5 h-5 shrink-0" loading="lazy" />
      )}
      <span className={`text-sm truncate ${isWinner ? "font-semibold" : ""}`}>{team.name}</span>
      <span className={`ml-auto text-sm font-semibold tabular-nums ${isWinner ? "" : "text-gray-500"}`}>
        {score ?? "-"}
      </span>
    </div>
  );
}

function LineupSide({ side }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        {side.team.logo && <img src={side.team.logo} alt="" className="w-4 h-4" loading="lazy" />}
        <span className="text-xs font-semibold truncate">{side.team.name}</span>
        {side.formation && <span className="text-[11px] text-gray-500 ml-auto shrink-0">{side.formation}</span>}
      </div>
      {side.coach && <p className="text-[11px] text-gray-500 mb-2">DT: {side.coach}</p>}
      <ul className="space-y-1">
        {side.starters.map((p, i) => (
          <li key={i} className="text-xs text-gray-300 flex gap-2">
            <span className="text-gray-600 w-5 text-right shrink-0">{p.number ?? ""}</span>
            <span className="truncate">{p.name}</span>
            {p.position && <span className="text-gray-600 ml-auto shrink-0">{p.position}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Una fila de partido. Si está en vivo o terminado, se puede desplegar para
// ver la alineación de los dos equipos (la API sólo la tiene disponible una
// vez que el partido arrancó, así que no tiene sentido ofrecerla antes).
export default function FixtureCard({ fixture }) {
  const [open, setOpen] = useState(false);
  const [lineups, setLineups] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isLive = LIVE_STATUSES.has(fixture.status);
  const canShowLineup = fixture.status !== "NS" && fixture.status !== "TBD" && fixture.status !== "PST";

  const toggle = async () => {
    if (!canShowLineup) return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (lineups) return;

    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/football/fixtures/${fixture.id}/lineups`);
      setLineups(data.lineups);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cargar la alineación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-card border border-border bg-bg overflow-hidden">
      <button
        onClick={toggle}
        disabled={!canShowLineup}
        className={`w-full text-left px-4 py-3 flex items-center gap-4 ${
          canShowLineup ? "cursor-pointer hover:bg-white/5" : "cursor-default"
        } transition-colors`}
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <TeamRow team={fixture.home} score={fixture.score.home} isWinner={fixture.home.winner === true} />
          <TeamRow team={fixture.away} score={fixture.score.away} isWinner={fixture.away.winner === true} />
        </div>
        <div className="shrink-0 text-right">
          <span
            className="text-[11px] font-semibold px-2 py-1 rounded-full border inline-block"
            style={
              isLive
                ? { color: CHALK.red, borderColor: `${CHALK.red}66`, background: `${CHALK.red}1a` }
                : { color: "#9aa3b2", borderColor: "transparent" }
            }
          >
            {isLive && fixture.minute ? `${fixture.minute}'` : STATUS_LABEL[fixture.status] ?? fixture.status}
          </span>
          {canShowLineup && (
            <div className="mt-1 flex justify-end text-gray-500">
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 bg-panel">
          {loading && <p className="text-xs text-gray-500">Cargando alineación...</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {lineups && lineups.length === 2 && (
            <div className="flex gap-4">
              <LineupSide side={lineups[0]} />
              <LineupSide side={lineups[1]} />
            </div>
          )}
          {lineups && lineups.length === 0 && (
            <p className="text-xs text-gray-500">Todavía no hay alineación confirmada para este partido.</p>
          )}
        </div>
      )}
    </div>
  );
}
