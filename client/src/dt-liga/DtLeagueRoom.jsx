import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import ClubPanel from "./ClubPanel.jsx";
import {
  getLeague, pickTeam, startLeague, setCpuDifficulty,
  getFixtures, getStandings, advanceWeek, playFixtureSolo,
  proposeTrade, getTrades, respondTrade,
} from "./api.js";
import { MonthPanel, NextSeasonButton, ScoreTab } from "./SeasonPanels.jsx";

const POLL_MS = 4000;
const CPU_DIFFICULTIES = [
  ["facil", "Fácil", "Los clubes CPU rinden un poco menos."],
  ["media", "Media", "Sin ajustes."],
  ["dificil", "Difícil", "Los clubes CPU rinden más."],
];

export default function DtLeagueRoom() {
  const { code } = useParams();
  const [league, setLeague] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [busyTeamId, setBusyTeamId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("fixtures"); // fixtures | standings | tactics

  const load = useCallback(async () => {
    try {
      const data = await getLeague(code);
      setLeague(data);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) setNotFound(true);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!league || league.status !== "lobby") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [league, load]);

  async function handlePick(teamId) {
    setBusyTeamId(teamId);
    setError(null);
    try {
      const updated = await pickTeam(code, teamId);
      setLeague(updated);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo elegir ese equipo");
    } finally {
      setBusyTeamId(null);
    }
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const updated = await startLeague(code);
      setLeague(updated);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo arrancar la liga");
    } finally {
      setStarting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-bg text-white p-4 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-400">No encontramos esa liga, o no sos parte de ella.</p>
          <Link to="/dt-liga" className="text-sm text-accent hover:underline">Volver</Link>
        </div>
      </div>
    );
  }

  if (!league) {
    return <div className="min-h-screen bg-bg text-white p-4 flex items-center justify-center"><p className="text-sm text-gray-500">Cargando…</p></div>;
  }

  const myTeamId = league.members.find((m) => m.isMe)?.teamId || null;
  const takenBy = (teamId) => league.members.find((m) => m.teamId === teamId);
  const teamName = (teamId) => league.allTeams.find((t) => t.id === teamId)?.name || teamId;
  const everyoneReady = league.members.every((m) => m.teamId) && league.members.length >= 2;

  return (
    <div className="min-h-screen bg-bg text-white p-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="hero-b rounded-3xl p-5 sm:p-6 flex items-center justify-between gap-3" style={{ "--hero-a": "var(--c-accent)", "--hero-b": "var(--c-purple)" }}>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{league.name}</h1>
            <p className="text-sm text-gray-300 mt-1">
              {league.leagueKey === "premier" ? "Premier League" : "La Liga"}
              {league.status === "in_progress" && ` · ${league.weeksPerMonth} jornada${league.weeksPerMonth === 1 ? "" : "s"} por mes`}
              {league.status === "finished" && " · Temporada terminada"}
            </p>
          </div>
          <Link to="/dt-liga" className="text-xs text-gray-500 hover:text-white shrink-0">🏠 Mis ligas</Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        {league.status === "lobby" && (
          <div className="bg-panel border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">Código de invitación</p>
              <p className="text-2xl font-bold tracking-widest">{league.inviteCode}</p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Jugadores ({league.members.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {league.members.map((m) => (
              <span
                key={m.userId}
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  m.isMe ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-gray-300"
                }`}
              >
                {m.username}{m.isMe && " (vos)"} — {m.teamId ? teamName(m.teamId) : "sin equipo"}
              </span>
            ))}
          </div>
        </div>

        {league.status === "lobby" && league.draftMode && (
          <div className="bg-panel border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Draft — orden de turnos</p>
            {!league.draftOrder ? (
              <p className="text-sm text-gray-500">Se sortea apenas se sume alguien más a la liga.</p>
            ) : (
              <>
                <p className="text-sm mb-2">
                  {league.draftTurnUserId
                    ? league.draftTurnUserId === league.members.find((m) => m.isMe)?.userId
                      ? "🎯 Es tu turno de elegir."
                      : `Turno de ${league.members.find((m) => m.userId === league.draftTurnUserId)?.username || "otro jugador"}.`
                    : "Todos eligieron equipo."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {league.draftOrder.map((uid, i) => {
                    const m = league.members.find((x) => x.userId === uid);
                    const isTurn = uid === league.draftTurnUserId;
                    return (
                      <span
                        key={uid}
                        className={`text-xs px-2.5 py-1 rounded-full border ${
                          isTurn ? "border-accent bg-accent/10 text-accent font-semibold" : "border-border text-gray-500"
                        }`}
                      >
                        {i + 1}. {m?.username || "?"}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {league.status === "lobby" && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Elegí tu equipo {myTeamId && `(actual: ${teamName(myTeamId)})`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {league.allTeams.map((t) => {
                  const owner = takenBy(t.id);
                  const isMine = owner?.isMe;
                  const isTakenByOther = owner && !isMine;
                  const notMyTurn =
                    league.draftMode && !!league.draftOrder && !myTeamId &&
                    league.draftTurnUserId !== null &&
                    league.draftTurnUserId !== league.members.find((m) => m.isMe)?.userId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => !isTakenByOther && !notMyTurn && handlePick(t.id)}
                      disabled={isTakenByOther || notMyTurn || busyTeamId === t.id}
                      title={isTakenByOther ? `Ya lo eligió ${owner.username}` : notMyTurn ? "Todavía no es tu turno" : undefined}
                      className={`text-left px-3 py-2.5 rounded-2xl border text-sm transition-colors ${
                        isMine
                          ? "border-accent bg-accent/10 text-accent font-semibold"
                          : isTakenByOther || notMyTurn
                          ? "border-border text-gray-600 opacity-50 cursor-not-allowed"
                          : "border-border text-gray-300 hover:border-accent/40"
                      }`}
                    >
                      {t.name}
                      {isTakenByOther && <span className="block text-xs text-gray-600 mt-0.5">{owner.username}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {league.isMine && (
              <div className="bg-panel border border-border rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Dificultad de los clubes CPU</p>
                <div className="grid grid-cols-3 gap-2">
                  {CPU_DIFFICULTIES.map(([id, label, hint]) => (
                    <button
                      key={id}
                      onClick={async () => { try { await setCpuDifficulty(code, id); load(); } catch (err) { setError(err.response?.data?.error || "No se pudo cambiar la dificultad"); } }}
                      aria-pressed={league.cpuDifficulty === id}
                      className={`text-left px-3 py-2 rounded-2xl border text-sm transition-colors ${league.cpuDifficulty === id ? "border-accent bg-accent/10 text-accent" : "border-border text-gray-300 hover:border-white/30"}`}
                    >
                      <span className="font-semibold">{label}</span>
                      <span className="block text-[11px] text-gray-500 mt-0.5">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {league.isMine && (
              <button
                onClick={handleStart}
                disabled={!everyoneReady || starting}
                className="btn btn-primary w-full transition"
              >
                {!everyoneReady
                  ? "Esperando a que todos elijan equipo…"
                  : starting
                  ? "Arrancando…"
                  : "Arrancar temporada"}
              </button>
            )}
            {!league.isMine && (
              <p className="text-sm text-gray-500 text-center">Esperando a que el anfitrión arranque la temporada…</p>
            )}
          </>
        )}

        {(league.status === "in_progress" || league.status === "finished") && (
          <>
            <div className="flex gap-1">
              {[["fixtures", "Jornada"], ["club", "Mi club"], ["calendar", "Calendario"], ["standings", "Tabla"], ["score", "Puntaje"], ["market", "Mercado"]].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`${{ fixtures: "tone-accent", club: "tone-emerald", calendar: "tone-purple", standings: "tone-blue", score: "tone-amber", market: "tone-pink" }[id]} px-4 py-2 rounded-full text-sm font-semibold ${
                    tab === id ? "tile-b text-white" : "text-gray-400 border border-border hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "fixtures" && (
              <FixturesTab code={code} league={league} myTeamId={myTeamId} onAdvanced={setLeague} onReload={load} />
            )}
            {tab === "calendar" && <CalendarTab code={code} myTeamId={myTeamId} />}
            {tab === "standings" && <StandingsTab code={code} myTeamId={myTeamId} />}
            {tab === "score" && <ScoreTab code={code} league={league} onReload={load} />}
            {tab === "club" && (myTeamId ? <ClubPanel code={code} league={league} myTeamId={myTeamId} /> : <p className="text-sm text-gray-500">Todavía no tenés club en esta liga.</p>)}
            {tab === "market" && <MarketTab code={code} league={league} />}
          </>
        )}
      </div>
    </div>
  );
}

function FixturesTab({ code, league, myTeamId, onAdvanced, onReload }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await getFixtures(code);
      setData(result);
    } catch {
      setData(null);
    }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  async function handlePlaySolo(fixtureId) {
    setBusyId(fixtureId);
    setError(null);
    try {
      await playFixtureSolo(code, fixtureId);
      await load();
      onReload?.();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo jugar ese partido");
    } finally {
      setBusyId(null);
    }
  }

  // Botón de conveniencia: resuelve los CPU-vs-CPU pendientes del mes sin
  // esperar a que alguien más entre a mirar la liga.
  async function handleResolveCpu() {
    setResolving(true);
    setError(null);
    try {
      const result = await advanceWeek(code);
      onAdvanced((prev) => ({ ...prev, status: result.finished ? "finished" : "in_progress" }));
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo resolver");
    } finally {
      setResolving(false);
    }
  }

  if (!data) return <p className="text-sm text-gray-500 text-center py-6">Cargando…</p>;

  const seasonOver = league.status === "finished";
  const monthDone = data.fixtures.length > 0 && data.fixtures.every((f) => f.played);
  const pendingOthers = data.fixtures.filter((f) => !f.played && !f.involvesMe);
  const byWeek = {};
  data.fixtures.forEach((f) => { (byWeek[f.week] ||= []).push(f); });

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 text-sm text-red-300">{error}</div>}

      {league.status === "in_progress" && <MonthPanel code={code} onChanged={() => { load(); onReload?.(); }} />}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Mes {data.month} / {data.totalMonths}{data.season > 1 ? " · Temporada " + data.season : ""}
        </p>
        {!seasonOver && (
          <button
            onClick={handleResolveCpu}
            disabled={resolving}
            className="text-xs text-gray-500 hover:text-white disabled:opacity-40"
          >
            {resolving ? "Resolviendo…" : "↻ Resolver partidos de CPU"}
          </button>
        )}
      </div>

      {Object.entries(byWeek).map(([week, fixtures]) => (
        <div key={week} className="space-y-1.5">
          <p className="text-xs text-gray-600 uppercase tracking-wide">Jornada {week}</p>
          {fixtures.filter((f) => !f.bye).map((f) => (
            <div
              key={f.id}
              className={`flex items-center gap-3 px-4 phone:px-3 phone:flex-wrap py-2.5 rounded-2xl border text-sm ${
                f.isClasico ? "border-amber/40 bg-amber/5" : f.involvesMe ? "border-accent/40 bg-accent/5" : "border-border bg-panel"
              }`}
            >
              {f.isClasico && <span title="El clásico de la jornada" className="shrink-0">⭐</span>}
              {f.comp !== "liga" && (
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-accent/30 text-accent" title={f.compLabel}>{f.compLabel} · {f.roundLabel}</span>
              )}
              <span className={`flex-1 text-right ${f.homeTeamId === myTeamId ? "font-semibold text-accent" : ""}`}>{f.homeTeamName}</span>
              <span className="w-16 text-center font-bold tabular-nums shrink-0">
                {f.played ? `${f.homeGoals} - ${f.awayGoals}` : "vs"}
                {f.played && f.winner && f.homeGoals === f.awayGoals && <span className="block text-[10px] font-normal text-amber">pen. {f.winner === f.homeTeamId ? f.homeTeamName : f.awayTeamName}</span>}
              </span>
              <span className={`flex-1 ${f.awayTeamId === myTeamId ? "font-semibold text-accent" : ""}`}>{f.awayTeamName}</span>

              <span className="shrink-0 w-32 text-right phone:w-full phone:text-center">
                {f.played && f.walkover && (
                  <span className="text-xs text-amber">walkover</span>
                )}
                {!f.played && f.locked && f.involvesMe && (
                  <span className="text-xs text-gray-600">Mes cerrado</span>
                )}
                {!f.played && f.canPlaySolo && (
                  <button
                    onClick={() => handlePlaySolo(f.id)}
                    disabled={busyId === f.id}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 disabled:opacity-40 transition-colors"
                  >
                    {busyId === f.id ? "…" : "Jugar"}
                  </button>
                )}
                {!f.played && f.canPlayLive && (
                  <button
                    onClick={() => navigate(`/dt-liga/${code}/live/${f.id}`)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                  >
                    🔴 En vivo
                  </button>
                )}
                {!f.played && f.isPvp && !f.involvesMe && (
                  <button
                    onClick={() => navigate(`/dt-liga/${code}/live/${f.id}`)}
                    title={`${f.homeManager} vs ${f.awayManager}`}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-panel border border-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                  >
                    👀 Mirar
                  </button>
                )}
              </span>
            </div>
          ))}
          <ByesLine fixtures={fixtures.filter((f) => f.bye)} myTeamId={myTeamId} />
        </div>
      ))}

      {seasonOver ? (
        <div className="text-center space-y-2 py-2">
          <p className="text-sm text-emerald font-medium">🏆 La temporada terminó — mirá la tabla final y el puntaje.</p>
          {league.isMine && <NextSeasonButton code={code} league={league} onStarted={() => { load(); onReload?.(); }} />}
        </div>
      ) : monthDone ? (
        <p className="text-sm text-gray-500 text-center py-2">Se jugaron todos los partidos de este mes. Para pasar al siguiente, todos los jugadores tienen que dar "Listo".</p>
      ) : (
        <p className="text-xs text-gray-600 text-center">
          Jugá tus partidos contra la CPU cuando quieras. Los que son contra otro jugador se juegan en vivo, los dos conectados a la vez.
        </p>
      )}
    </div>
  );
}

// Clubes que pasan de ronda sin jugar (los mejores sembrados de las copas con llave incompleta).
function ByesLine({ fixtures, myTeamId }) {
  if (!fixtures.length) return null;
  const groups = {};
  fixtures.forEach((f) => { (groups[f.compLabel + " · " + f.roundLabel] ||= []).push(f); });
  return Object.entries(groups).map(([label, list]) => {
    const mine = list.find((f) => f.homeTeamId === myTeamId);
    return (
      <details key={label} className="text-xs text-gray-500 px-1">
        <summary className="cursor-pointer select-none">
          {label}: {mine ? "tu club pasa directo" : list.length + " clubes pasan directo"}
        </summary>
        <p className="mt-1 leading-relaxed">{list.map((f) => f.homeTeamName).join(", ")}</p>
      </details>
    );
  });
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MATCH_DAY = 5; // los partidos caen el sábado, igual que en el Modo DT solo

// Calendario del mes de la liga: todos los días de cada jornada, con los partidos el sábado.
function CalendarTab({ code, myTeamId }) {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(null);
  const [openWeek, setOpenWeek] = useState(null);

  useEffect(() => {
    getFixtures(code, month || undefined).then((d) => {
      setData(d);
      if (month == null) setMonth(d.month);
    }).catch(() => setData(null));
  }, [code, month]);

  if (!data) return <p className="text-sm text-gray-500 text-center py-6">Cargando…</p>;

  const weeks = [...new Set(data.fixtures.map((f) => f.week))].sort((a, b) => a - b);
  const byWeek = (w) => data.fixtures.filter((f) => f.week === w);
  const nextWeek = weeks.find((w) => byWeek(w).some((f) => !f.played));
  const shown = openWeek ?? nextWeek ?? weeks[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Mes {data.month} de {data.totalMonths}</h3>
        <div className="flex gap-1">
          <button onClick={() => { setOpenWeek(null); setMonth(Math.max(1, data.month - 1)); }} disabled={data.month <= 1} aria-label="Mes anterior" className="p-2 rounded-card border border-border text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={16} /></button>
          <button onClick={() => { setOpenWeek(null); setMonth(data.activeMonth); }} className="px-3 py-2 rounded-card border border-border text-xs text-gray-300 hover:text-white">Mes actual</button>
          <button onClick={() => { setOpenWeek(null); setMonth(Math.min(data.totalMonths, data.month + 1)); }} disabled={data.month >= data.totalMonths} aria-label="Mes siguiente" className="p-2 rounded-card border border-border text-gray-400 hover:text-white disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-1 text-center text-[11px] uppercase tracking-wide text-gray-500">
          <span />{DAY_LABELS.map((l) => <span key={l}>{l}</span>)}
        </div>
        {weeks.map((w) => {
          const list = byWeek(w);
          const mine = list.find((f) => f.involvesMe);
          const done = list.every((f) => f.played);
          return (
            <div key={w} className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-1 items-stretch">
              <button onClick={() => setOpenWeek(w)} className={`text-xs font-semibold rounded-xl border px-1 py-2 ${shown === w ? "border-accent bg-accent/15 text-accent" : "border-border text-gray-400 hover:text-white"}`}>J{w}</button>
              {DAY_LABELS.map((l, i) => (
                <div key={l} className={`min-h-[48px] rounded-xl border p-1 text-center text-[10px] leading-tight flex flex-col items-center justify-center gap-0.5 ${i === MATCH_DAY ? (done ? "border-border bg-panel text-gray-400" : w === nextWeek ? "border-accent bg-accent/10" : "border-amber/40 bg-amber/5") : "border-border bg-panel/50 text-gray-600"}`}>
                  {i === MATCH_DAY && (
                    <>
                      <span className="font-semibold text-gray-300">{list.length} partido{list.length === 1 ? "" : "s"}</span>
                      {mine && <span className={mine.played ? (mine.homeTeamId === myTeamId ? mine.homeGoals > mine.awayGoals : mine.awayGoals > mine.homeGoals) ? "text-good" : mine.homeGoals === mine.awayGoals ? "text-amber" : "text-bad" : "text-accent"}>{mine.played ? `${mine.homeGoals}-${mine.awayGoals}` : "el tuyo"}</span>}
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {shown != null && (
        <div className="bg-panel border border-border rounded-2xl p-4">
          <p className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-3">Jornada {shown}</p>
          <ul className="space-y-1.5">
            {byWeek(shown).map((f) => (
              <li key={f.id} className={`flex items-center justify-between gap-3 text-sm ${f.involvesMe ? "text-white font-semibold" : "text-gray-300"}`}>
                <span className="truncate">{f.homeTeamName} <span className="text-gray-600">vs</span> {f.awayTeamName}</span>
                <span className="tabular-nums shrink-0 text-gray-400">{f.played ? `${f.homeGoals} - ${f.awayGoals}` : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StandingsTab({ code, myTeamId }) {
  const [standings, setStandings] = useState(null);

  useEffect(() => {
    getStandings(code).then(setStandings).catch(() => setStandings([]));
  }, [code]);

  if (!standings) return <p className="text-sm text-gray-500 text-center py-6">Cargando…</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-panel text-gray-500 text-xs uppercase">
          <tr>
            <th className="text-left px-3 py-2.5">#</th>
            <th className="text-left px-3 py-2.5">Equipo</th>
            <th className="px-2 py-2.5">PJ</th>
            <th className="px-2 py-2.5">G</th>
            <th className="px-2 py-2.5">E</th>
            <th className="px-2 py-2.5">P</th>
            <th className="px-2 py-2.5">DG</th>
            <th className="px-2 py-2.5" title="Tier del club (1 = el más fuerte)">Tier</th>
            <th className="px-2 py-2.5">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.teamId} className={`border-t border-border ${s.teamId === myTeamId ? "bg-accent/5" : ""}`}>
              <td className="px-3 py-2 text-gray-500">{s.position}</td>
              <td className="px-3 py-2">
                <span className={s.teamId === myTeamId ? "font-semibold text-accent" : ""}>{s.teamName}</span>
                {s.manager && <span className="text-xs text-gray-500 ml-1.5">({s.manager})</span>}
              </td>
              <td className="px-2 py-2 text-center tabular-nums">{s.played}</td>
              <td className="px-2 py-2 text-center tabular-nums">{s.won}</td>
              <td className="px-2 py-2 text-center tabular-nums">{s.drawn}</td>
              <td className="px-2 py-2 text-center tabular-nums">{s.lost}</td>
              <td className="px-2 py-2 text-center tabular-nums">{s.gf - s.ga}</td>
              <td className="px-2 py-2 text-center tabular-nums text-gray-400" title={`Se esperaba el ${s.expectedPosition}°`}>{s.tier}</td>
              <td className="px-2 py-2 text-center font-bold tabular-nums">{s.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketTab({ code, league }) {
  const [trades, setTrades] = useState([]);
  const [proposingTo, setProposingTo] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setTrades(await getTrades(code));
    } catch {
      setTrades([]);
    }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const me = league.members.find((m) => m.isMe);
  const others = league.members.filter((m) => !m.isMe && m.teamId);
  const pendingWithUser = (userId) =>
    trades.some((t) => t.status === "pending" && ((t.fromUserId === userId) || (t.toUserId === userId)) && (t.fromUserId === me?.userId || t.toUserId === me?.userId));

  async function handlePropose(toUserId) {
    setProposingTo(toUserId);
    setError(null);
    try {
      await proposeTrade(code, toUserId);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo mandar la propuesta");
    } finally {
      setProposingTo(null);
    }
  }

  async function handleRespond(tradeId, accept) {
    setError(null);
    try {
      await respondTrade(code, tradeId, accept);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo responder");
    }
  }

  if (!me?.teamId) {
    return <p className="text-sm text-gray-500 text-center py-6">No dirigís ningún equipo en esta liga.</p>;
  }

  const pending = trades.filter((t) => t.status === "pending");
  const resolved = trades.filter((t) => t.status !== "pending");

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 text-sm text-red-300">{error}</div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Propuestas pendientes</p>
          {pending.map((t) => (
            <div key={t.id} className="bg-panel border border-border rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm">
                {t.isMine
                  ? `Le ofreciste ${t.fromTeamName} a ${t.toUsername} a cambio de ${t.toTeamName}`
                  : `${t.fromUsername} te ofrece ${t.fromTeamName} a cambio de tu ${t.toTeamName}`}
              </p>
              {!t.isMine && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleRespond(t.id, true)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald/15 text-emerald border border-emerald/40 hover:bg-emerald/25 transition-colors"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleRespond(t.id, false)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              )}
              {t.isMine && <span className="text-xs text-gray-500 shrink-0">esperando respuesta</span>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Proponer intercambio de club</p>
        {others.length === 0 && <p className="text-sm text-gray-500">No hay otros managers con club en esta liga.</p>}
        {others.map((m) => (
          <div key={m.userId} className="bg-panel border border-border rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm">{m.username} — dirige {league.allTeams.find((t) => t.id === m.teamId)?.name || m.teamId}</p>
            <button
              onClick={() => handlePropose(m.userId)}
              disabled={proposingTo === m.userId || pendingWithUser(m.userId)}
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/40 hover:bg-accent/20 disabled:opacity-40 transition-colors shrink-0"
            >
              {pendingWithUser(m.userId) ? "Ya hay propuesta" : "Proponer cambio"}
            </button>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <details>
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">Historial ({resolved.length})</summary>
          <div className="mt-2 space-y-1.5">
            {resolved.map((t) => (
              <p key={t.id} className="text-xs text-gray-500">
                {t.fromUsername} ↔ {t.toUsername} — <span className={t.status === "accepted" ? "text-emerald" : "text-red-400"}>{t.status === "accepted" ? "aceptado" : t.status === "rejected" ? "rechazado" : "cancelado"}</span>
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
