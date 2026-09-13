import {
  Lock, Flame, Trophy, Star, Medal, TrendingUp, Wallet, Smile, Meh, Frown,
  HeartPulse, Mail, PenLine, Newspaper, ShieldAlert, PlayCircle,
} from "lucide-react";
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

function moraleIcon(m) {
  if (m >= 60) return Smile;
  if (m >= 40) return Meh;
  return Frown;
}

function clubRepLabel(r) {
  if (r >= 80) return { text: "Ídolo", color: "text-amber" };
  if (r >= 65) return { text: "Querido", color: "text-emerald" };
  if (r >= 45) return { text: "Respetado", color: "text-blue" };
  if (r >= 25) return { text: "Cuestionado", color: "text-orange-400" };
  return { text: "En la cuerda floja", color: "text-red-400" };
}

function competitionMeta(competition) {
  return competition === "champions"
    ? { Icon: Star, color: "text-blue", bg: "bg-blue/5 border-blue/30" }
    : { Icon: Medal, color: "text-orange-400", bg: "bg-orange-500/5 border-orange-500/30" };
}

// Tarjeta compacta reutilizada por Copa y competición continental: mismo
// esqueleto (ícono + estado + rival + CTA o fecha), distinto color.
function CompetitionCard({ Icon, label, color, bg, round, opponentName, available, onPlay, playLabel, unavailableWeek }) {
  return (
    <div className={`rounded-2xl p-4 border ${available ? bg : "bg-panel border-border"}`}>
      <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wide mb-2 font-medium ${available ? color : "text-gray-500"}`}>
        <Icon size={13} />
        <span>{label}</span>
      </div>
      <p className="font-semibold text-sm">{round}</p>
      <p className="text-xs text-gray-500 mb-3">vs {opponentName || "?"}</p>
      {available ? (
        <button
          onClick={onPlay}
          className={`w-full text-sm font-semibold py-2 rounded-xl transition border hover:brightness-110 ${color} ${bg}`}
        >
          {playLabel}
        </button>
      ) : (
        <p className="text-xs text-gray-600">Disponible en la jornada {unavailableWeek}</p>
      )}
    </div>
  );
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
  const MoraleIcon = moraleIcon(avgMorale);

  // Ventana de transferencias
  const w = state.week;
  const windowOpen = (w >= 0 && w <= 7) || (w >= 20 && w <= 24);

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
        <button onClick={resetCareer} className="bg-accent text-onaccent font-semibold px-5 py-2.5 rounded-2xl">
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
          <Lock size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            <span className="font-semibold">Ventana de transferencias cerrada.</span> No podés fichar jugadores hasta la jornada 20 (ventana de invierno).
          </p>
        </div>
      )}

      {/* Club header */}
      <div className="bg-panel border border-border rounded-2xl p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <TeamCrest team={team} size={60} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xl truncate">{team.name}</p>
            <p className="text-sm text-gray-500">{LEAGUE_LABELS[team.league] || team.league} · Temporada {state.season}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 pt-4 border-t border-border">
          <div className="min-w-[140px]">
            <p className="text-[11px] text-gray-500 mb-1.5 uppercase tracking-wide">Confianza directiva</p>
            <div className="w-full max-w-[160px] h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${state.boardConfidence}%`, background: CONFIDENCE_GRADIENT[confTier] }} />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-0.5 uppercase tracking-wide">Reputación DT</p>
            <span className={`text-sm font-semibold ${pLabel.color}`}>{pLabel.text} <span className="text-gray-600 font-normal">({prestige})</span></span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-0.5 uppercase tracking-wide">Vínculo al club</p>
            <span className={`text-sm font-semibold ${cLabel.color}`}>{cLabel.text} <span className="text-gray-600 font-normal">({clubRep})</span></span>
          </div>
        </div>
      </div>

      {/* Próximo partido — la acción principal de la pantalla, ocupa todo el ancho */}
      <div className={`rounded-2xl p-5 border ${fixtureIsDerby ? "bg-gradient-to-br from-red-500/10 to-transparent border-red-500/30" : "bg-gradient-to-br from-accent/10 to-transparent border-accent/25"}`}>
        {fixture ? (
          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-0">
              <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wide mb-2 font-semibold ${fixtureIsDerby ? "text-red-400" : "text-accent"}`}>
                {fixtureIsDerby ? <Flame size={13} /> : <TrendingUp size={13} />}
                <span>{fixtureIsDerby ? "Clásico · Liga" : "Próximo partido · Liga"}</span>
              </div>
              <div className="flex items-center gap-3">
                {rival && <TeamCrest team={rival} size={36} />}
                <div className="min-w-0">
                  <p className="font-bold text-lg truncate">{rival?.name}</p>
                  <p className="text-xs text-gray-500">{fixture.home ? "Local" : "Visitante"} · Jornada {fixture.week}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handlePlay}
              className="shrink-0 w-full sm:w-auto bg-accent text-onaccent font-semibold px-8 py-3 rounded-2xl hover:brightness-110 transition"
            >
              Jugar partido
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin partidos pendientes.</p>
        )}
      </div>

      {/* Franja de stats: posición, presupuesto, moral */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-panel border border-border rounded-2xl p-4">
          <TrendingUp size={16} className="text-gray-500 mb-2" />
          <p className="text-2xl font-bold leading-none">{myPos}°</p>
          <p className="text-[11px] text-gray-500 mt-1.5">de {standingsSorted.length} equipos</p>
        </div>
        <div className="bg-panel border border-border rounded-2xl p-4">
          <Wallet size={16} className="text-gray-500 mb-2" />
          <p className="text-2xl font-bold leading-none">€{state.budget}M</p>
          <p className="text-[11px] text-gray-500 mt-1.5">presupuesto</p>
        </div>
        <div className="bg-panel border border-border rounded-2xl p-4">
          <MoraleIcon size={16} className={`mb-2 ${avgMorale >= 70 ? "text-emerald" : avgMorale >= 45 ? "text-amber" : "text-red-400"}`} />
          <p className="text-2xl font-bold leading-none">{avgMorale}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">moral del plantel</p>
        </div>
      </div>

      {/* Trofeos ganados esta temporada */}
      {(copa?.champion || continental?.champion) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {copa?.champion && (
            <div className="bg-amber/10 border border-amber/40 rounded-2xl p-4 flex items-center gap-3">
              <Trophy size={28} className="text-amber shrink-0" />
              <div>
                <p className="font-bold text-amber text-sm">¡Campeón de Copa!</p>
                <p className="text-xs text-gray-400">Copa del Rey conquistada esta temporada</p>
              </div>
            </div>
          )}
          {continental?.champion && (
            <div className="bg-blue/10 border border-blue/40 rounded-2xl p-4 flex items-center gap-3">
              <Trophy size={28} className="text-blue shrink-0" />
              <div>
                <p className="font-bold text-blue text-sm">¡Campeón de {CONTINENTAL_LABELS[continental.competition]}!</p>
                <p className="text-xs text-gray-400">Título continental conquistado esta temporada</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Otras competiciones en curso */}
      {(preseasonAvailable() || (copa && !copa.champion && !copa.eliminated) || (continental && !continental.champion && !continental.eliminated)) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {preseasonAvailable() && (
            <CompetitionCard
              Icon={PlayCircle}
              label={`Pretemporada · Amistoso ${state.preseason.matchesPlayed + 1}/${state.preseason.total}`}
              color="text-gray-300"
              bg="bg-panel border-border hover:bg-white/5"
              round="Amistoso"
              opponentName={state.preseason.opponents[state.preseason.matchesPlayed]?.name}
              available
              onPlay={handlePlayPreseason}
              playLabel="Jugar amistoso"
            />
          )}
          {copa && !copa.champion && !copa.eliminated && (
            <CompetitionCard
              Icon={Trophy}
              label="Copa del Rey"
              color="text-amber"
              bg="bg-amber/10 border-amber/30"
              round={COPA_ROUNDS[copa.currentRound]}
              opponentName={copa.opponents[copa.currentRound]?.name}
              available={copaIsAvailable()}
              onPlay={handlePlayCopa}
              playLabel="Jugar Copa del Rey"
              unavailableWeek={COPA_WEEKS[copa.currentRound]}
            />
          )}
          {continental && !continental.champion && !continental.eliminated && (() => {
            const meta = competitionMeta(continental.competition);
            return (
              <CompetitionCard
                Icon={meta.Icon}
                label={CONTINENTAL_LABELS[continental.competition]}
                color={meta.color}
                bg={meta.bg}
                round={CONTINENTAL_ROUNDS[continental.currentRound]}
                opponentName={continental.opponents[continental.currentRound]?.name}
                available={continentalIsAvailable()}
                onPlay={handlePlayContinental}
                playLabel={`Jugar ${CONTINENTAL_LABELS[continental.competition]}`}
                unavailableWeek={CONTINENTAL_WEEKS[continental.currentRound]}
              />
            );
          })()}
        </div>
      )}
      {copa?.eliminated && (
        <div className="bg-panel border border-border rounded-2xl p-4 flex items-center gap-2.5">
          <Trophy size={15} className="text-gray-600 shrink-0" />
          <p className="text-sm text-gray-400">Copa del Rey: eliminados en {COPA_ROUNDS[Math.max(0, (copa.currentRound || 1) - 1)]}</p>
        </div>
      )}
      {continental?.eliminated && (
        <div className="bg-panel border border-border rounded-2xl p-4 flex items-center gap-2.5">
          {(() => { const meta = competitionMeta(continental.competition); const Icon = meta.Icon; return <Icon size={15} className="text-gray-600 shrink-0" />; })()}
          <p className="text-sm text-gray-400">{CONTINENTAL_LABELS[continental.competition]}: eliminados en {CONTINENTAL_ROUNDS[Math.max(0, (continental.currentRound || 1) - 1)]}</p>
        </div>
      )}

      {/* Bajas por lesión */}
      {injuredPlayers.length > 0 && (
        <div className="bg-panel border border-border rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-3 font-semibold text-red-400">
            <HeartPulse size={13} />
            <span>Jugadores lesionados ({injuredPlayers.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {injuredPlayers.map(i => (
              <div key={i.id} className="flex items-center justify-between gap-2 border-l-2 border-red-500/50 bg-white/[0.02] rounded-r-xl px-3 py-2">
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
        <div className="bg-panel border border-amber/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-semibold text-amber">
            <Mail size={13} />
            <span>Oferta de banquillo</span>
          </div>
          {pendingJobOffers.map((offer) => {
            const offerTeam = teamById(offer.fromTeamId);
            return (
              <div key={offer.id} className="flex items-center gap-4 flex-wrap border-l-2 border-amber/50 pl-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {offerTeam && <TeamCrest team={offerTeam} size={22} />}
                    <p className="font-semibold">{offer.fromTeamName}</p>
                  </div>
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
        <div className="bg-panel border border-blue/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-semibold text-blue">
            <PenLine size={13} />
            <span>Contratos por vencer</span>
          </div>
          {renewalOffers.map((offer) => (
            <div key={offer.playerId} className="flex items-center gap-4 flex-wrap border-l-2 border-blue/50 pl-3">
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
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-3 font-semibold text-gray-500">
          <Newspaper size={13} />
          <span>Noticias</span>
        </div>
        <ul className="space-y-2.5">
          {state.news.slice(0, 6).map((n, i) => (
            <li key={i} className="text-sm text-gray-300 pl-3 border-l-2 border-border">{n}</li>
          ))}
        </ul>
      </div>

      {/* Historial de Copa */}
      {copa?.results?.length > 0 && (
        <div className="bg-panel border border-border rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-3 font-semibold text-gray-500">
            <Trophy size={13} />
            <span>Copa del Rey — Resultados</span>
          </div>
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
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-3 font-semibold text-gray-500">
            <ShieldAlert size={13} />
            <span>{CONTINENTAL_LABELS[continental.competition]} — Resultados</span>
          </div>
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
