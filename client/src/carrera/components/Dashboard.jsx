import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import TeamCrest from "./TeamCrest.jsx";

// Degradé de la barra de confianza según el tramo — mismo espíritu que el
// semáforo anterior (rojo/ámbar/verde) pero como transición de dos colores
// en vez de un color plano, como pide el nuevo diseño del inicio.
const CONFIDENCE_GRADIENT = {
  good: "linear-gradient(90deg, #3fae9a, #3b9dd6)",
  mid: "linear-gradient(90deg, #d9a441, #f0c674)",
  bad: "linear-gradient(90deg, #d9534f, #f0907e)",
};

export default function Dashboard({ onPlayMatch }) {
  const { state, team, currentFixture, playNextMatch, standingsSorted, resetCareer } = useCareer();
  const fixture = currentFixture();
  const rival = fixture ? teamById(fixture.opponentTeamId) : null;
  const myPos = standingsSorted.findIndex((r) => r.teamId === state.teamId) + 1;
  const confTier = state.boardConfidence < 30 ? "bad" : state.boardConfidence < 60 ? "mid" : "good";

  function handlePlay() {
    const result = playNextMatch();
    if (result) onPlayMatch(result);
  }

  if (state.gameOver) {
    return (
      <div className="text-center py-16">
        <p className="text-2xl font-bold mb-2">Despedido 😔</p>
        <p className="text-gray-400 mb-6">La directiva perdió la confianza en tu proyecto en {team.name}.</p>
        <button onClick={resetCareer} className="bg-accent text-black font-semibold px-5 py-2.5 rounded-2xl">
          Empezar nueva carrera
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-panel border border-border rounded-2xl p-5 flex items-center gap-4">
        <TeamCrest team={team} size={56} />
        <div className="min-w-0">
          <p className="font-semibold text-lg truncate">{team.name}</p>
          <p className="text-sm text-gray-500">{team.league === "premier" ? "Premier League" : "La Liga"} · Temporada {state.season}</p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-xs text-gray-500 mb-1.5">Confianza directiva</p>
          <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-[width]" style={{ width: `${state.boardConfidence}%`, background: CONFIDENCE_GRADIENT[confTier] }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Próximo partido</p>
          {fixture ? (
            <>
              <p className="font-semibold text-lg">{fixture.home ? `vs ${rival.name} (Local)` : `vs ${rival.name} (Visitante)`}</p>
              <p className="text-xs text-gray-500 mb-4">Jornada {fixture.week}</p>
              <button onClick={handlePlay} className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 transition">
                Jugar partido
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-400">Sin partidos pendientes.</p>
          )}
        </div>

        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Tabla de posiciones</p>
          <p className="text-4xl font-bold text-accent leading-none">{myPos}°</p>
          <p className="text-xs text-gray-500 mt-2">de {standingsSorted.length} equipos</p>
        </div>

        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Presupuesto de fichajes</p>
          <p className="text-3xl font-bold leading-none">€{state.budget}M</p>
        </div>

        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Plantilla</p>
          <p className="text-3xl font-bold leading-none">{state.squad.length}</p>
          <p className="text-xs text-gray-500 mt-2">jugadores disponibles</p>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Noticias</p>
        <ul className="space-y-2">
          {state.news.slice(0, 5).map((n, i) => (
            <li key={i} className="text-sm text-gray-300">{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
