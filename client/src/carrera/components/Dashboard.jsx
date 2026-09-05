import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import TeamCrest from "./TeamCrest.jsx";

export default function Dashboard({ onPlayMatch }) {
  const { state, team, currentFixture, playNextMatch, standingsSorted, resetCareer } = useCareer();
  const fixture = currentFixture();
  const rival = fixture ? teamById(fixture.opponentTeamId) : null;
  const myPos = standingsSorted.findIndex((r) => r.teamId === state.teamId) + 1;

  function handlePlay() {
    const result = playNextMatch();
    if (result) onPlayMatch(result);
  }

  if (state.gameOver) {
    return (
      <div className="text-center py-16">
        <p className="text-2xl font-bold mb-2">Despedido 😔</p>
        <p className="text-gray-400 mb-6">La directiva perdió la confianza en tu proyecto en {team.name}.</p>
        <button onClick={resetCareer} className="bg-accent text-black font-semibold px-5 py-2.5 rounded-card">
          Empezar nueva carrera
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-card p-4 flex items-center gap-3">
        <TeamCrest team={team} size={48} />
        <div className="min-w-0">
          <p className="font-semibold truncate">{team.name}</p>
          <p className="text-xs text-gray-500">{team.league === "premier" ? "Premier League" : "La Liga"} · Temporada {state.season}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">Confianza directiva</p>
          <div className="w-28 h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden">
            <div className={`h-full ${state.boardConfidence < 30 ? "bg-red" : state.boardConfidence < 60 ? "bg-amber" : "bg-emerald"}`} style={{ width: `${state.boardConfidence}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-panel border border-border rounded-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Próximo partido</p>
          {fixture ? (
            <>
              <p className="font-semibold">{fixture.home ? `vs ${rival.name} (Local)` : `vs ${rival.name} (Visitante)`}</p>
              <p className="text-xs text-gray-500 mb-3">Jornada {fixture.week}</p>
              <button onClick={handlePlay} className="w-full bg-accent text-black font-semibold py-2 rounded-card hover:brightness-110">
                Jugar partido
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-400">Sin partidos pendientes.</p>
          )}
        </div>

        <div className="bg-panel border border-border rounded-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tabla de posiciones</p>
          <p className="text-3xl font-bold text-accent">{myPos}°</p>
          <p className="text-xs text-gray-500">de {standingsSorted.length} equipos</p>
        </div>

        <div className="bg-panel border border-border rounded-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Presupuesto de fichajes</p>
          <p className="text-2xl font-bold">€{state.budget}M</p>
        </div>

        <div className="bg-panel border border-border rounded-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Plantilla</p>
          <p className="text-2xl font-bold">{state.squad.length}</p>
          <p className="text-xs text-gray-500">jugadores disponibles</p>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-card p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Noticias</p>
        <ul className="space-y-1.5">
          {state.news.slice(0, 5).map((n, i) => (
            <li key={i} className="text-sm text-gray-300">{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
