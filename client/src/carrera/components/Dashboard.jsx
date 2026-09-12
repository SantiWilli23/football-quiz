import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import { getInjury } from "../engine/injuryEngine.js";
import TeamCrest from "./TeamCrest.jsx";

const CONFIDENCE_GRADIENT = {
  good: "linear-gradient(90deg, #3fae9a, #3b9dd6)",
  mid:  "linear-gradient(90deg, #d9a441, #f0c674)",
  bad:  "linear-gradient(90deg, #d9534f, #f0907e)",
};

const COPA_ROUNDS = ["Dieciseisavos", "Cuartos de final", "Semifinal", "Final"];
const COPA_WEEKS  = [6, 14, 22, 30];

const LEAGUE_LABELS = { premier: "Premier League", laliga: "La Liga", seriea: "Serie A", bundesliga: "Bundesliga" };

function prestigeLabel(p) {
  if (p >= 80) return { text: "Leyenda", color: "text-amber" };
  if (p >= 60) return { text: "Reconocido", color: "text-emerald" };
  if (p >= 40) return { text: "Emergente", color: "text-blue" };
  return { text: "Desconocido", color: "text-gray-500" };
}

function moraleEmoji(m) {
  if (m >= 85) return "😄";
  if (m >= 60) return "🙂";
  if (m >= 40) return "😐";
  return "😞";
}

function clubRepLabel(r) {
  if (r >= 80) return { text: "Ídolo", color: "text-amber" };
  if (r >= 65) return { text: "Querido", color: "text-emerald" };
  if (r >= 45) return { text: "Respetado", color: "text-blue" };
  if (r >= 25) return { text: "Cuestionado", color: "text-orange-400" };
  return { text: "En la cuerda floja", color: "text-red-400" };
}

function competitionEmojiAndColor(competition) {
  return competition === "champions"
    ? { emoji: "⭐", color: "text-blue", bg: "bg-blue/5 border-blue/30" }
    : { emoji: "🟠", color: "text-orange-400", bg: "bg-orange-500/5 border-orange-500/30" };
}

export default function Dashboard({ onPlayMatch }) {
  const {
    state, team, currentFixture, isRivalMatch, playNextMatchFirstHalf, playCopaMatch, copaIsAvailable,
    playContinentalMatch, continentalIsAvailable, standingsSorted, resetCareer, acceptJobOffer, declineJobOffer,
    renewContract, releasePlayer,
    preseasonAvailable, playPreseasonMatch,
    COPA_ROUNDS: CR, COPA_WEEKS: CW, CONTINENTAL_ROUNDS, CONTINENTAL_WEEKS, CONTINENTAL_LABELS,
  } = useCareer();
  const fixture   = currentFixture();
  const fixtureIsDerby = fixture ? isRivalMatch(fixture.opponentTeamId) : false;
  const rival     = fixture ? teamById(fixture.opponentTeamId) : null;
  const myPos     = standingsSorted.findIndex((r) => r.teamId === state.teamId) + 1;
  const confTier  = state.boardConfidence < 30 ? "bad" : state.boardConfidence < 60 ? "mid" : "good";
  const copa      = state.copa;
  const continental = state.continental;
  const prestige  = state.managerPrestige ?? 50;
  const pLabel    = prestigeLabel(prestige);

  const clubRep = state.clubReputation ?? 50;
  const cLabel = clubRepLabel(clubRep);
  const pendingJobOffers = (state.jobOffers || []).filter((o) => o.status === "pending");
  const renewalOffers = state.renewalOffers || [];

  const injuries = (state.injuries || []).filter(i => i.returnWeek > state.week);
  const injuredPlayers = injuries.map(i => {
    const p = state.squad.find(pl => pl.id === i.playerId);
    return p ? { ...i, name: p.name, weeksLeft: Math.max(0, i.returnWeek - state.week) } : null;
  }).filter(Boolean);

  const avgMorale = state.squad.length
    ? Math.round(state.squad.reduce((sum, p) => sum + ((state.morale || {})[p.id] ?? 70), 0) / state.squad.length)
    : 70;

  // Ventana de transferencias
  const w = state.week;
  const windowOpen = (w >= 0 && w <= 7) || (w >= 20 && w <= 24);
  const nextWindowWeek = w <= 7 ? null : w <= 24 ? null : 20;

  function handlePlay() {
    const result = playNextMatchFirstHalf();
    if (result) onPlayMatch(result);
  }

  function handlePlayCopa() {
    const result = playCopaMatch();
    if (result) onPlayMatch(result);
  }

  function handlePlayContinental() {
    const result = playContinentalMatch();
    if (result) onPlayMatch(result);
  }

  function handlePlayPreseason() {
    const result = playPreseasonMatch();
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
      {/* Banner ventana cerrada */}
      {!windowOpen && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
          <span className="text-red-400 text-sm">🔒</span>
          <p className="text-sm text-red-300">
            <span className="font-semibold">Ventana de transferencias cerrada.</span> No podés fichar jugadores hasta la jornada 20 (ventana de invierno).
          </p>
        </div>
      )}

      {/* Club header */}
      <div className="bg-panel border border-border rounded-2xl p-5 flex items-center gap-4">
        <TeamCrest team={team} size={56} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-lg truncate">{team.name}</p>
          <p className="text-sm text-gray-500">{LEAGUE_LABELS[team.league] || team.league} · Temporada {state.season}</p>
        </div>
        <div className="text-right shrink-0 space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Confianza directiva</p>
            <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${state.boardConfidence}%`, background: CONFIDENCE_GRADIENT[confTier] }} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-0.5">Reputación DT</p>
              <span className={`text-xs font-semibold ${pLabel.color}`}>{pLabel.text} ({prestige})</span>
            </div>
            <div className="text-right border-l border-border pl-3">
              <p className="text-xs text-gray-500 mb-0.5">Vínculo al club</p>
              <span className={`text-xs font-semibold ${cLabel.color}`}>{cLabel.text} ({clubRep})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Próximo partido */}
        <div className={`rounded-2xl p-5 border ${fixtureIsDerby ? "bg-red-500/5 border-red-500/30" : "bg-panel border-border"}`}>
          <p className={`text-xs uppercase tracking-wide mb-2.5 ${fixtureIsDerby ? "text-red-400" : "text-gray-500"}`}>
            {fixtureIsDerby ? "🔥 Clásico · Liga" : "Próximo partido · Liga"}
          </p>
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

        {/* Pretemporada */}
        {preseasonAvailable() && (
          <div className="bg-panel border border-border rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Pretemporada · Amistoso {state.preseason.matchesPlayed + 1}/{state.preseason.total}</p>
            <p className="font-semibold">vs {state.preseason.opponents[state.preseason.matchesPlayed]?.name || "?"}</p>
            <p className="text-xs text-gray-500 mb-4">Probá tu once y tácticas sin afectar la tabla.</p>
            <button onClick={handlePlayPreseason} className="w-full bg-panel border border-accent/40 text-accent font-semibold py-2.5 rounded-2xl hover:bg-accent/10 transition">
              Jugar amistoso
            </button>
          </div>
        )}

        {/* Copa del Rey */}
        {copa && !copa.champion && !copa.eliminated && (
          <div className={`rounded-2xl p-5 border ${copaIsAvailable() ? "bg-amber/5 border-amber/30" : "bg-panel border-border"}`}>
            <p className={`text-xs uppercase tracking-wide mb-2.5 ${copaIsAvailable() ? "text-amber" : "text-gray-500"}`}>
              🏆 Copa del Rey
            </p>
            <p className="font-semibold">{COPA_ROUNDS[copa.currentRound]}</p>
            <p className="text-sm text-gray-400">vs {copa.opponents[copa.currentRound]?.name || "?"}</p>
            {copaIsAvailable() ? (
              <button onClick={handlePlayCopa} className="mt-4 w-full bg-amber/20 text-amber font-semibold py-2.5 rounded-2xl hover:bg-amber/30 transition border border-amber/30">
                Jugar Copa del Rey
              </button>
            ) : (
              <p className="text-xs text-gray-600 mt-2">Disponible a partir de la jornada {COPA_WEEKS[copa.currentRound]}</p>
            )}
          </div>
        )}
        {copa?.champion && (
          <div className="bg-amber/10 border border-amber/40 rounded-2xl p-5 flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div>
              <p className="font-bold text-amber">¡Campeón de Copa!</p>
              <p className="text-xs text-gray-400">Copa del Rey conquistada esta temporada</p>
            </div>
          </div>
        )}
        {copa?.eliminated && (
          <div className="bg-panel border border-border rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Copa del Rey</p>
            <p className="text-sm text-gray-400">Eliminados en {COPA_ROUNDS[Math.max(0, (copa.currentRound || 1) - 1)]}</p>
          </div>
        )}

        {/* Competición continental */}
        {continental && !continental.champion && !continental.eliminated && (() => {
          const ce = competitionEmojiAndColor(continental.competition);
          const label = CONTINENTAL_LABELS[continental.competition];
          return (
            <div className={`rounded-2xl p-5 border ${continentalIsAvailable() ? ce.bg : "bg-panel border-border"}`}>
              <p className={`text-xs uppercase tracking-wide mb-2.5 ${continentalIsAvailable() ? ce.color : "text-gray-500"}`}>
                {ce.emoji} {label}
              </p>
              <p className="font-semibold">{CONTINENTAL_ROUNDS[continental.currentRound]}</p>
              <p className="text-sm text-gray-400">vs {continental.opponents[continental.currentRound]?.name || "?"}</p>
              {continentalIsAvailable() ? (
                <button onClick={handlePlayContinental} className={`mt-4 w-full font-semibold py-2.5 rounded-2xl transition border ${ce.color} ${ce.bg} hover:brightness-110`}>
                  Jugar {label}
                </button>
              ) : (
                <p className="text-xs text-gray-600 mt-2">Disponible a partir de la jornada {CONTINENTAL_WEEKS[continental.currentRound]}</p>
              )}
            </div>
          );
        })()}
        {continental?.champion && (
          <div className="bg-blue/10 border border-blue/40 rounded-2xl p-5 flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div>
              <p className="font-bold text-blue">¡Campeón de {CONTINENTAL_LABELS[continental.competition]}!</p>
              <p className="text-xs text-gray-400">Título continental conquistado esta temporada</p>
            </div>
          </div>
        )}
        {continental?.eliminated && (
          <div className="bg-panel border border-border rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{CONTINENTAL_LABELS[continental.competition]}</p>
            <p className="text-sm text-gray-400">Eliminados en {CONTINENTAL_ROUNDS[Math.max(0, (continental.currentRound || 1) - 1)]}</p>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Tabla de posiciones</p>
          <p className="text-4xl font-bold text-accent leading-none">{myPos}°</p>
          <p className="text-xs text-gray-500 mt-2">de {standingsSorted.length} equipos</p>
        </div>

        {/* Presupuesto + Moral */}
        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Recursos</p>
          <p className="text-3xl font-bold leading-none">€{state.budget}M</p>
          <p className="text-xs text-gray-500 mt-1">presupuesto de fichajes</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-lg">{moraleEmoji(avgMorale)}</span>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Moral del plantel</span>
                <span>{avgMorale}/100</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${avgMorale}%`, background: avgMorale >= 70 ? "#3fae9a" : avgMorale >= 45 ? "#d9a441" : "#d9534f" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bajas por lesión */}
      {injuredPlayers.length > 0 && (
        <div className="bg-panel border border-red-500/20 rounded-2xl p-5">
          <p className="text-xs text-red-400 uppercase tracking-wide mb-2.5">🏥 Jugadores lesionados ({injuredPlayers.length})</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {injuredPlayers.map(i => (
              <div key={i.id} className="flex items-center justify-between gap-2 bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-gray-500">{i.type}</p>
                </div>
                <span className="text-xs text-red-400 shrink-0">
                  {i.weeksLeft === 1 ? "vuelve próx. sem." : `${i.weeksLeft} sem.`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ofertas de otros clubes */}
      {pendingJobOffers.length > 0 && (
        <div className="bg-amber/5 border border-amber/30 rounded-2xl p-5 space-y-3">
          <p className="text-xs text-amber uppercase tracking-wide font-semibold">📩 Oferta de banquillo</p>
          {pendingJobOffers.map((offer) => {
            const offerTeam = teamById(offer.fromTeamId);
            return (
              <div key={offer.id} className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{offer.fromTeamName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {LEAGUE_LABELS[offer.fromLeague] || offer.fromLeague} · Te ofrecen el puesto de técnico principal
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">Aceptar implica dejar {team.name} y empezar de cero en ese club. Mantenés tu reputación acumulada.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => acceptJobOffer(offer.id)}
                    className="text-sm font-medium px-4 py-2 rounded-2xl bg-amber/15 text-amber border border-amber/30 hover:bg-amber/25 transition-colors"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => declineJobOffer(offer.id)}
                    className="text-sm font-medium px-4 py-2 rounded-2xl bg-panel border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contratos por vencer */}
      {renewalOffers.length > 0 && (
        <div className="bg-blue/5 border border-blue/30 rounded-2xl p-5 space-y-3">
          <p className="text-xs text-blue uppercase tracking-wide font-semibold">✍️ Contratos por vencer</p>
          {renewalOffers.map((offer) => (
            <div key={offer.playerId} className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{offer.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {offer.position} · {offer.age} años · OVR {offer.ovr}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Renovar: {offer.suggestedYears} año{offer.suggestedYears === 1 ? "" : "s"} a €{offer.suggestedWage}k/sem
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => renewContract(offer.playerId, offer.suggestedYears, offer.suggestedWage)}
                  className="text-sm font-medium px-4 py-2 rounded-2xl bg-blue/15 text-blue border border-blue/30 hover:bg-blue/25 transition-colors"
                >
                  Renovar
                </button>
                <button
                  onClick={() => releasePlayer(offer.playerId)}
                  className="text-sm font-medium px-4 py-2 rounded-2xl bg-panel border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                >
                  Dejar salir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Noticias */}
      <div className="bg-panel border border-border rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Noticias</p>
        <ul className="space-y-2">
          {state.news.slice(0, 6).map((n, i) => (
            <li key={i} className="text-sm text-gray-300">{n}</li>
          ))}
        </ul>
      </div>

      {/* Historial de Copa */}
      {copa?.results?.length > 0 && (
        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">Copa del Rey — Resultados</p>
          <div className="space-y-1.5">
            {copa.results.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{COPA_ROUNDS[r.round]}</span>
                <span className={r.won ? "text-emerald" : "text-red-400"}>
                  {r.myGoals}-{r.rivalGoals} {r.won ? "✓" : "✗"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial continental */}
      {continental?.results?.length > 0 && (
        <div className="bg-panel border border-border rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2.5">{CONTINENTAL_LABELS[continental.competition]} — Resultados</p>
          <div className="space-y-1.5">
            {continental.results.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{CONTINENTAL_ROUNDS[r.round]}</span>
                <span className={r.won ? "text-emerald" : "text-red-400"}>
                  {r.myGoals}-{r.rivalGoals} {r.won ? "✓" : "✗"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
