import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import api from "../api.js";
import { CHALK } from "../theme.js";
import LineupPitch from "./LineupPitch.jsx";

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

const LEAGUE_TONE = { premier: "purple", laliga: "red", serie_a: "blue", bundesliga: "amber", ligue1: "cyan", chile: "emerald" };

function Side({ team, isWinner, align }) {
  const right = align === "right";
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${right ? "flex-row-reverse text-right" : ""}`}>
      {team.logo ? <img src={team.logo} alt="" className="w-8 h-8 shrink-0 object-contain" loading="lazy" /> : <span className="w-8 h-8 shrink-0 rounded-full bg-white/10" />}
      <span className={`text-sm truncate ${isWinner ? "font-bold" : "font-medium"}`}>{team.name}</span>
    </div>
  );
}

function LineupSide({ side }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        {side.team.logo && <img src={side.team.logo} alt="" className="w-4 h-4" loading="lazy" />}
        <span className="text-xs font-semibold truncate">{side.team.name}</span>
        {side.formation && <span className="text-xs text-gray-500 ml-auto shrink-0">{side.formation}</span>}
      </div>
      {side.coach && <p className="text-xs text-gray-500 mb-2">DT: {side.coach}</p>}
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
export default function FixtureCard({ fixture, league }) {
  const tone = LEAGUE_TONE[league || fixture.leagueKey] || "accent";
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
    <div className={`tone-${tone} rounded-card border border-border bg-bg overflow-hidden`} style={{ borderLeft: "4px solid rgb(var(--tone))" }}>
      <button
        onClick={toggle}
        disabled={!canShowLineup}
        className={`w-full text-left px-4 py-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 ${
          canShowLineup ? "cursor-pointer hover:bg-white/5" : "cursor-default"
        } transition-colors`}
      >
        <Side team={fixture.home} isWinner={fixture.home.winner === true} />
        <div className="text-center min-w-[84px]">
          {fixture.score.home == null ? (
            <p className="text-lg font-bold tabular-nums leading-none">{new Date(fixture.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
          ) : (
            <p className="text-2xl font-bold tabular-nums leading-none tracking-tight">{fixture.score.home} - {fixture.score.away}</p>
          )}
          <p className={`mt-1.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 ${isLive ? "rounded-full px-2.5 py-0.5 mx-auto w-fit text-white" : ""}`} style={isLive ? { background: CHALK.red } : { color: "#9aa3b2" }}>
            {isLive && <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-white" />}
            {isLive && fixture.minute ? `${fixture.minute}'` : STATUS_LABEL[fixture.status] ?? fixture.status}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 min-w-0">
          <Side team={fixture.away} isWinner={fixture.away.winner === true} align="right" />
          {canShowLineup && <span className="text-gray-500 shrink-0">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 bg-panel">
          {loading && <p className="text-xs text-gray-500">Cargando alineación...</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {lineups && lineups.length === 2 && (
            <LineupPitch lineups={lineups} />
          )}
          {lineups && lineups.length === 0 && (
            <p className="text-xs text-gray-500">Todavía no hay alineación confirmada para este partido.</p>
          )}
        </div>
      )}
    </div>
  );
}
