import { useEffect, useState } from "react";
import {
  Lock, Flame, Trophy, Star, Medal, TrendingUp, Wallet, Smile, Meh, Frown,
  HeartPulse, Mail, PenLine, Newspaper, ShieldAlert, PlayCircle, Target,
} from "lucide-react";
import { useCareer } from "../context/CareerContext.jsx";
import { teamById } from "../data/teams.js";
import { getInjury } from "../engine/injuryEngine.js";
import TeamCrest from "./TeamCrest.jsx";
import NationalTeamCard from "./NationalTeamCard.jsx";
import WeeklyDecisionCard from "./WeeklyDecisionCard.jsx";
import CompChip from "./CompChip.jsx";
import { nextEvent, upcoming, windowClosesIn, nextWindow } from "../engine/schedule.js";
import { DAY_LABELS, MONTH_NAMES, dateOfDay, matchReadiness } from "../engine/energy.js";

const CONFIDENCE_GRADIENT = {
  good: "linear-gradient(90deg, rgb(var(--c-emerald)), #3b9dd6)",
  mid:  "linear-gradient(90deg, rgb(var(--c-amber)), rgb(var(--c-amber)))",
  bad:  "linear-gradient(90deg, rgb(var(--c-red)), rgb(var(--c-red)))",
};

const COPA_ROUNDS = ["Dieciseisavos", "Cuartos de final", "Semifinal", "Final"];
const COPA_WEEKS  = [6, 14, 22, 30];

const LEAGUE_LABELS = { premier: "Premier League", laliga: "La Liga", seriea: "Serie A", bundesliga: "Bundesliga" };

// Mismos umbrales que usa CareerContext al cerrar la temporada (evaluateObjective)
// — se repiten acá porque ahí son internos, no exportados, y esto es solo lectura.
const OBJECTIVE_THRESHOLDS = { ganar_liga: 1, top3: 3, top4: 4, top6: 6, top8: 8, top10: 10, top12: 12, salvarse: 17 };
const OBJECTIVE_LABELS = {
  ganar_liga: "Ganar la liga", top3: "Terminar top 3", top4: "Terminar top 4", top6: "Terminar top 6",
  top8: "Terminar top 8", top10: "Terminar top 10", top12: "Terminar top 12", salvarse: "Salvar la categoría",
};

function objectiveProgress(objective, position, leagueSize) {
  const threshold = OBJECTIVE_THRESHOLDS[objective] || 17;
  const onTrack = position <= threshold;
  const span = Math.max(1, leagueSize - threshold);
  const pct = onTrack ? 100 : Math.max(4, Math.min(96, Math.round(((leagueSize - position) / span) * 100)));
  return { threshold, onTrack, pct, label: OBJECTIVE_LABELS[objective] || "Objetivo de la directiva" };
}

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

// Bautizar la temporada en curso con un nombre propio, tipo "La del ascenso
// imposible". Queda pegado a la fila del historial cuando cierra la temporada.
function SeasonNameEditor({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (editing) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSave(draft); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={60}
          placeholder="Ponle un nombre a esta temporada…"
          className="bg-bg border border-border rounded-card px-3 py-1.5 text-sm flex-1 max-w-xs focus:outline-none focus:border-accent"
        />
        <button
          onClick={() => { onSave(draft); setEditing(false); }}
          className="text-xs font-medium px-3 py-1.5 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
        >
          Guardar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value || ""); setEditing(true); }}
      className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      <PenLine size={12} />
      {value ? `"${value}"` : "Ponle un nombre a esta temporada"}
    </button>
  );
}

// Objetivo propio del DT, aparte del que fija la directiva — texto libre
// porque nada arbitrario ("ganar la Champions con juveniles") se puede
// trackear solo, así que el usuario marca a mano cuándo lo cumplió.
function CustomObjectiveCard({ objective, onSet, onToggleDone, onClear }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(objective?.text || "");

  if (!objective && !editing) {
    return (
      <button
        onClick={() => { setDraft(""); setEditing(true); }}
        className="w-full bg-panel border border-dashed border-border rounded-2xl p-4 text-left text-sm text-gray-500 hover:text-gray-300 hover:border-white/30 transition-colors flex items-center gap-2"
      >
        <Target size={14} />
        Ponte un objetivo propio para esta temporada
      </button>
    );
  }

  if (editing) {
    return (
      <div className="bg-panel border border-border rounded-2xl p-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2.5">
          <Target size={13} />
          <span>Tu objetivo personal</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) { onSet(draft.trim()); setEditing(false); }
              if (e.key === "Escape") setEditing(false);
            }}
            maxLength={80}
            placeholder='Ej: "Debutar a 3 canteranos"'
            className="bg-bg border border-border rounded-card px-3 py-1.5 text-sm flex-1 focus:outline-none focus:border-accent"
          />
          <button
            onClick={() => { if (draft.trim()) { onSet(draft.trim()); setEditing(false); } }}
            className="text-xs font-medium px-3 py-1.5 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors shrink-0"
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-semibold text-gray-500">
          <Target size={13} />
          <span>Tu objetivo personal</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
          objective.done ? "text-emerald border-emerald/30 bg-emerald/10" : "text-gray-400 border-border"
        }`}>
          {objective.done ? "Cumplido" : "En progreso"}
        </span>
      </div>
      <p className={`text-sm font-semibold mb-3 ${objective.done ? "line-through text-gray-500" : ""}`}>{objective.text}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleDone}
          className="text-xs font-medium px-3 py-1.5 rounded-card bg-white/5 border border-border hover:border-white/30 transition-colors"
        >
          {objective.done ? "Marcar como pendiente" : "Marcar como cumplido"}
        </button>
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
          Quitar
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ onPlayMatch }) {
  const {
    state, team, currentFixture, isRivalMatch, playNextMatchFirstHalf, playCopaMatch, copaIsAvailable,
    playContinentalMatch, continentalIsAvailable, standingsSorted, resetCareer, acceptJobOffer, declineJobOffer,
    renewContract, releasePlayer,
    preseasonAvailable, playPreseasonMatch, setSeasonName,
    setCustomObjective, toggleCustomObjectiveDone, clearCustomObjective,
    COPA_ROUNDS: CR, COPA_WEEKS: CW, CONTINENTAL_ROUNDS, CONTINENTAL_WEEKS, CONTINENTAL_LABELS,
    maybeOfferNationalTeam, respondToIncomingOffer, counterIncomingOffer, skipPreseason,
  } = useCareer();

  useEffect(() => {
    maybeOfferNationalTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.week]);
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
  const objective = objectiveProgress(team.boardObjective, myPos, standingsSorted.length);

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
        <p className="text-2xl font-bold mb-2">Despedido </p>
        <p className="text-gray-400 mb-6">La directiva perdió la confianza en tu proyecto en {team.name}.</p>
        <button onClick={resetCareer} className="btn btn-primary">
          Empezar nueva carrera
        </button>
      </div>
    );
  }

  // Agenda unificada: el próximo partido de cualquier competición y los que siguen.
  const next = nextEvent(state);
  const agenda = upcoming(state, 6);
  const nextRival = next ? teamById(next.opponentId) : null;
  const nextDate = next ? dateOfDay(state.season || 1, next.weekIdx, next.day) : null;
  const nextIsDerby = next?.comp === "liga" && fixtureIsDerby;
  const readiness = matchReadiness(state);
  const rivalRow = next ? standingsSorted.findIndex((r) => r.teamId === next.opponentId) : -1;
  const closesIn = windowClosesIn(state.week);
  const nextWin = nextWindow(state.week);
  const pendingIncoming = (state.incomingOffers || []).filter((o) => o.status === "pending");
  const myIdx = standingsSorted.findIndex((r) => r.teamId === state.teamId);
  const tableRows = standingsSorted.slice(0, 5).some((r) => r.teamId === state.teamId)
    ? standingsSorted.slice(0, 5)
    : [...standingsSorted.slice(0, 4), standingsSorted[myIdx]].filter(Boolean);

  function playNext() {
    if (!next) return;
    const fn = { liga: handlePlay, copa: handlePlayCopa, europa: handlePlayContinental, amistoso: handlePlayPreseason }[next.comp];
    fn?.();
  }
  const fmt = (d) => `${DAY_LABELS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;

  return (
    <div className="space-y-4">
      <NationalTeamCard />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="space-y-4 min-w-0">
          {/* Próximo partido: cualquier competición, un solo botón. */}
          <section className="p-hero" style={nextIsDerby ? { borderColor: "var(--red)" } : undefined}>
            {next ? (
              <>
                <div className="p-eyebrow">
                  <span className="flex items-center gap-2"><CompChip comp={next.comp} />{next.round}{nextIsDerby && <span style={{ color: "var(--red)" }}>· Clásico</span>}</span>
                  <span className="p-mono">{fmt(nextDate)}</span>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 my-5">
                  <div className="text-center min-w-0"><TeamCrest team={team} size={64} /><p className="text-sm font-semibold mt-1 truncate max-w-[120px]">{team.name}</p></div>
                  <span className="p-num text-4xl" style={{ color: "var(--mute)" }}>VS</span>
                  <div className="text-center min-w-0">{nextRival ? <TeamCrest team={nextRival} size={64} /> : <span className="p-av" style={{ width: 64, height: 64 }}>?</span>}<p className="text-sm font-semibold mt-1 truncate max-w-[120px]">{nextRival?.name || next.opponentName}</p></div>
                  <div className="hidden sm:block ml-auto text-right text-xs p-muted space-y-1">
                    <p>{next.home ? "Local" : "Visitante"}</p>
                    {rivalRow >= 0 && <p>Rival: <b className="p-num text-base" style={{ color: "var(--fg)" }}>{rivalRow + 1}°</b> con {standingsSorted[rivalRow].pts} pts</p>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-[1fr_220px] gap-4 items-end">
                  <div>
                    <div className="flex justify-between text-xs p-muted mb-1"><span>Energía del XI · {readiness.label}</span><b className="p-num text-sm" style={{ color: "var(--fg)" }}>{readiness.energy}</b></div>
                    <div className="p-cbar"><i style={{ width: `${readiness.energy}%` }} /></div>
                  </div>
                  <button onClick={playNext} className="p-btn big" style={{ marginInline: 0 }}>Jugar {next.comp === "amistoso" ? "amistoso" : "partido"}</button>
                </div>
                {next.comp === "amistoso" && <button onClick={skipPreseason} className="p-link mt-1">Saltar la pretemporada</button>}
                {next.comp === "liga" && state.week > 0 && <p className="text-xs p-dim mt-2">Antes del partido puedes planear la semana de entrenamiento en Calendario.</p>}
              </>
            ) : <p className="text-sm p-muted">Terminó la temporada: no quedan partidos.</p>}
          </section>

          {/* Bandeja: lo que espera una decisión tuya. */}
          <section className="p-card space-y-3">
            <div className="p-eyebrow"><span>Bandeja</span></div>
            {closesIn != null && (
              <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#f2b84b14", border: "1px solid var(--gold-line)" }}>
                ⏱ <b>Mercado abierto.</b> {closesIn === 0 ? "Cierra esta semana: último día para cerrar fichajes." : `Cierra en ${closesIn} ${closesIn === 1 ? "semana" : "semanas"}.`}
              </p>
            )}
            {closesIn == null && nextWin && <p className="text-xs p-muted">Mercado cerrado: abre el {nextWin.label.toLowerCase()} en {nextWin.from - state.week} semanas. Puedes dejar fichajes pre-acordados.</p>}
            {(state.pendingSignings || []).length > 0 && <p className="text-xs p-muted">Pre-acuerdos: {(state.pendingSignings || []).map((d) => d.player.name).join(", ")} (se suman al abrir el mercado).</p>}
            <WeeklyDecisionCard />
            {pendingIncoming.map((o) => (
              <div key={o.id} className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
                <p className="p-eyebrow" style={{ justifyContent: "flex-start", color: "var(--blue)" }}>Oferta recibida</p>
                <p className="text-sm mt-1"><b>{o.teamName}</b> ofrece {o.isLoan ? "un préstamo" : <b className="p-num text-base" style={{ color: "var(--gold)" }}>€{o.amount}M</b>} por <b>{o.playerName}</b>.</p>
                {o.playerWilling === false && <p className="text-xs" style={{ color: "var(--red)" }}>{o.playerReason}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button onClick={() => respondToIncomingOffer(o.id, true)} disabled={o.playerWilling === false} className="p-btn sm">Aceptar</button>
                  {!o.isLoan && !o.raisedOnce && <button onClick={() => counterIncomingOffer(o.id)} className="p-btn sm gold">Pedir más</button>}
                  <button onClick={() => respondToIncomingOffer(o.id, false)} className="p-btn sm ghost">Rechazar</button>
                </div>
              </div>
            ))}
            {pendingJobOffers.map((offer) => (
              <div key={offer.id} className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
                <p className="p-eyebrow" style={{ justifyContent: "flex-start", color: "var(--gold)" }}>Oferta de banquillo</p>
                <p className="text-sm mt-1"><b>{offer.fromTeamName}</b> ({LEAGUE_LABELS[offer.fromLeague] || offer.fromLeague}) te ofrece ser su técnico. Dejarías {team.name} y mantienes tu reputación.</p>
                <div className="flex gap-2 mt-2"><button onClick={() => acceptJobOffer(offer.id)} className="p-btn sm gold">Aceptar</button><button onClick={() => declineJobOffer(offer.id)} className="p-btn sm ghost">Rechazar</button></div>
              </div>
            ))}
            {renewalOffers.map((offer) => (
              <div key={offer.playerId} className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
                <p className="p-eyebrow" style={{ justifyContent: "flex-start" }}>Contrato por vencer</p>
                <p className="text-sm mt-1"><b>{offer.name}</b> · {offer.position} · {offer.age} años · OVR {offer.ovr}. Renovar {offer.suggestedYears} año{offer.suggestedYears === 1 ? "" : "s"} a €{offer.suggestedWage}k/sem.</p>
                <div className="flex gap-2 mt-2"><button onClick={() => renewContract(offer.playerId, offer.suggestedYears, offer.suggestedWage)} className="p-btn sm">Renovar</button><button onClick={() => releasePlayer(offer.playerId)} className="p-btn sm ghost">Dejar salir</button></div>
              </div>
            ))}
            {injuredPlayers.length > 0 && (
              <div className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
                <p className="p-eyebrow" style={{ justifyContent: "flex-start", color: "var(--red)" }}><HeartPulse size={13} /> Lesionados ({injuredPlayers.length})</p>
                <ul className="mt-1 text-sm space-y-0.5">{injuredPlayers.map((i) => <li key={i.id} className="flex justify-between gap-2"><span>{i.name} <small className="p-muted">{i.type}</small></span><small style={{ color: "var(--red)" }}>{i.weeksLeft === 1 ? "vuelve próx. sem." : `${i.weeksLeft} sem.`}</small></li>)}</ul>
              </div>
            )}
          </section>

          {(copa?.champion || continental?.champion) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {copa?.champion && <div className="p-card flex items-center gap-3" style={{ borderColor: "var(--gold-line)" }}><Trophy size={28} style={{ color: "var(--gold)" }} /><b>¡Campeón de Copa!</b></div>}
              {continental?.champion && <div className="p-card flex items-center gap-3" style={{ borderColor: "var(--blue)" }}><Trophy size={28} style={{ color: "var(--blue)" }} /><b>¡Campeón de {CONTINENTAL_LABELS[continental.competition]}!</b></div>}
            </div>
          )}

          <section className="p-card">
            <div className="p-eyebrow mb-2"><span className="flex items-center gap-1.5"><Newspaper size={13} /> Noticias</span></div>
            <ul className="space-y-2">{state.news.slice(0, 6).map((n, i) => <li key={i} className="text-sm pl-3" style={{ borderLeft: "2px solid var(--line)" }}>{n}</li>)}</ul>
          </section>
        </div>

        <div className="space-y-4 min-w-0">
          <section className="p-card">
            <div className="p-eyebrow mb-2"><span>Agenda</span></div>
            <ul className="space-y-1">
              {agenda.map((e) => {
                const d = dateOfDay(state.season || 1, e.weekIdx, e.day);
                const t = teamById(e.opponentId);
                return (
                  <li key={e.id} className="flex items-center gap-3 py-1.5">
                    <span className="text-center w-10 shrink-0"><small className="block p-dim text-[10px] uppercase">{DAY_LABELS[(d.getUTCDay() + 6) % 7]}</small><b className="p-num text-xl leading-none">{d.getUTCDate()}</b></span>
                    {t ? <TeamCrest team={t} size={22} /> : <span className="p-av" style={{ width: 22, height: 22, fontSize: 10 }}>{(e.opponentName || "?")[0]}</span>}
                    <span className="flex-1 min-w-0 truncate text-sm">{e.home ? "vs" : "@"} {t?.name || e.opponentName}</span>
                    <CompChip comp={e.comp} short />
                  </li>
                );
              })}
              {agenda.length === 0 && <li className="text-sm p-muted">No quedan partidos esta temporada.</li>}
            </ul>
          </section>

          <section className="p-card">
            <div className="p-eyebrow mb-2"><span>{LEAGUE_LABELS[team.league] || "Liga"}</span><span>{myPos}° de {standingsSorted.length}</span></div>
            <table className="w-full text-sm">
              <tbody>
                {tableRows.map((r) => {
                  const pos = standingsSorted.indexOf(r) + 1;
                  const mine = r.teamId === state.teamId;
                  return (
                    <tr key={r.teamId} style={mine ? { background: "var(--me-bg)" } : undefined}>
                      <td className="p-num text-base w-7 pl-2 py-1" style={{ color: "var(--mute)" }}>{pos}</td>
                      <td className="truncate max-w-[170px] py-1" style={mine ? { color: "var(--acc2)", fontWeight: 600 } : undefined}>{teamById(r.teamId)?.name}</td>
                      <td className="p-num text-base text-right p-muted w-8">{r.played}</td>
                      <td className="p-num text-base text-right w-10 pr-2">{r.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="p-card">
            <div className="p-eyebrow mb-2"><span className="flex items-center gap-1.5"><Target size={13} /> Objetivo de la directiva</span><span style={{ color: objective.onTrack ? "var(--acc2)" : "var(--gold)" }}>{objective.onTrack ? "En camino" : "Afuera"}</span></div>
            <p className="font-semibold">{objective.label}</p>
            <div className="p-cbar mt-2"><i style={{ width: `${objective.pct}%` }} /></div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div><b className="p-num text-xl block">{state.boardConfidence}</b><small className="p-muted text-[11px]">Confianza</small></div>
              <div><b className="p-num text-xl block" style={{ color: "var(--fg)" }}>{prestige}</b><small className="p-muted text-[11px]">Reputación</small></div>
              <div><b className="p-num text-xl block">{avgMorale}</b><small className="p-muted text-[11px]">Moral</small></div>
            </div>
          </section>

          <CustomObjectiveCard objective={state.customObjective} onSet={setCustomObjective} onToggleDone={toggleCustomObjectiveDone} onClear={clearCustomObjective} />
          <SeasonNameEditor value={state.seasonName} onSave={setSeasonName} />
        </div>
      </div>
    </div>
  );
}
