import { getManagersSquads, getPlayerOffers, sendPlayerOffer, respondPlayerOffer } from "./api.js";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import ClubPanel from "./ClubPanel.jsx";
import CompChip from "../carrera/components/CompChip.jsx";

// Competición del servidor → color de la agenda (liga, copa nacional o copa europea).
const chipOf = (comp) => (comp === "liga" ? "liga" : ["champions", "europa", "conference"].includes(comp) ? "europa" : "copa");
import { dateOfDay, MONTH_NAMES } from "../carrera/engine/energy.js";
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
          <p className="text-sm text-gray-400">No encontramos esa liga, o no eres parte de ella.</p>
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
      <div className="w-full max-w-[1500px] mx-auto space-y-5">
        <div className="p-card flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="p-eyebrow" style={{ justifyContent: "flex-start" }}>Liga Online DT · {league.leagueKey === "premier" ? "Premier League" : "La Liga"}{league.season > 1 ? ` · Temporada ${league.season}` : ""}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate" style={{ fontFamily: "var(--f-d)" }}>{league.name}</h1>
            <p className="text-sm p-muted mt-0.5">
              {league.status === "in_progress" && `${league.weeksPerMonth} jornada${league.weeksPerMonth === 1 ? "" : "s"} por mes`}
              {league.status === "finished" && "Temporada terminada"}
              {league.status === "lobby" && "Esperando que arranque"}
              {league.marketLabel && <span style={{ color: "var(--gold)" }}> · {league.marketLabel} abierto</span>}
            </p>
          </div>
          {league.status === "in_progress" && league.totalWeeks > 0 && (() => {
            const months = Math.max(1, Math.ceil(league.totalWeeks / (league.weeksPerMonth || 4)));
            return (
              <div className="w-48">
                <p className="p-eyebrow"><span>Mes</span><span>{league.currentMonth} de {months}</span></p>
                <div className="p-cbar mt-1"><i style={{ width: `${Math.min(100, (league.currentMonth / months) * 100)}%` }} /></div>
              </div>
            );
          })()}
          <Link to="/dt-liga" className="p-btn ghost sm shrink-0">Mis ligas</Link>
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
                {m.username}{m.isMe && " (tú)"} — {m.teamId ? teamName(m.teamId) : "sin equipo"}
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
                Elige tu equipo {myTeamId && `(actual: ${teamName(myTeamId)})`}
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
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] border-b sticky top-0 z-10 -mx-4 px-4" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 94%, transparent)", backdropFilter: "blur(8px)" }} role="tablist" aria-label="Secciones de la liga">
              {[["fixtures", "Jornada"], ["club", "Mi club"], ["calendar", "Calendario"], ["standings", "Tabla"], ["score", "Puntaje"], ["market", "Mercado"], ["config", "Ajustes"]].map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className="relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors" style={{ color: tab === id ? "var(--fg)" : "var(--mute)" }}>
                  {label}
                  {tab === id && <i className="absolute left-2 right-2 bottom-0 h-[3px] rounded-t" style={{ background: "var(--acc)" }} />}
                </button>
              ))}
            </div>

            {league.preseasonOpen && tab === "fixtures" && (myTeamId
              ? <ClubPanel code={code} league={league} myTeamId={myTeamId} view="preseason" />
              : <p className="text-sm text-gray-500">Todavía no tienes club en esta liga.</p>)}
            {!league.preseasonOpen && tab === "fixtures" && myTeamId && <ClubPanel code={code} league={league} myTeamId={myTeamId} view="preseasonCalendar" />}
            {!league.preseasonOpen && tab === "fixtures" && (
              <FixturesTab code={code} league={league} myTeamId={myTeamId} onAdvanced={setLeague} onReload={load} />
            )}
            {tab === "calendar" && myTeamId && <ClubPanel code={code} league={league} myTeamId={myTeamId} view="preseasonCalendar" />}
            {tab === "calendar" && <CalendarTab code={code} myTeamId={myTeamId} />}
            {tab === "standings" && <StandingsTab code={code} myTeamId={myTeamId} />}
            {tab === "score" && <ScoreTab code={code} league={league} onReload={load} />}
            {tab === "club" && (myTeamId ? <ClubPanel code={code} league={league} myTeamId={myTeamId} /> : <p className="text-sm text-gray-500">Todavía no tienes club en esta liga.</p>)}
            {tab === "market" && <MarketTab code={code} league={league} />}
            {tab === "config" && <ConfigTab league={league} />}
          </>
        )}
      </div>
    </div>
  );
}

// Configuración de la pantalla de la liga (se guarda en este dispositivo).
const SHOW_OTHERS_KEY = "dt_liga_show_others";
const readShowOthers = () => { try { return localStorage.getItem(SHOW_OTHERS_KEY) === "1"; } catch { return false; } };

function FixturesTab({ code, league, myTeamId, onAdvanced, onReload }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(null); // mes de la liga que se muestra (null = el activo)
  const [selWeek, setSelWeek] = useState(null); // jornada elegida en el calendario
  const showOthers = readShowOthers();
  const [busyId, setBusyId] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await getFixtures(code, month || undefined);
      setData(result);
    } catch {
      setData(null);
    }
  }, [code, month]);

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
  // El calendario muestra por defecto solo tus partidos; los del resto se activan en Configuración.
  const weeks = [...new Set(data.fixtures.map((f) => f.week))].sort((a, b) => a - b);
  const mineOf = (w) => data.fixtures.filter((f) => f.week === w && f.involvesMe && !f.bye);
  const defaultWeek = weeks.find((w) => mineOf(w).some((f) => !f.played)) ?? weeks[0];
  const activeWeek = weeks.includes(selWeek) ? selWeek : defaultWeek;
  const visible = {};
  if (activeWeek != null) visible[activeWeek] = data.fixtures.filter((f) => f.week === activeWeek && (showOthers || f.involvesMe || f.bye));

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 text-sm text-red-300">{error}</div>}

      {(() => {
        // Tu próximo partido del mes, con su botón: lo primero que se busca al entrar.
        const nx = data.fixtures.find((f) => f.involvesMe && !f.played && !f.bye);
        if (!nx || seasonOver) return null;
        const mineHome = nx.homeTeamId === myTeamId;
        return (
          <section className="p-hero">
            <div className="p-eyebrow"><span className="flex items-center gap-2"><CompChip comp={chipOf(nx.comp)} />{nx.comp === "liga" ? `Jornada ${nx.week}` : `${nx.compLabel} · ${nx.roundLabel || ""}`}</span><span>{mineHome ? "Local" : "Visitante"}</span></div>
            <div className="flex items-center justify-between gap-3 my-4">
              <b className="text-lg sm:text-2xl truncate" style={{ fontFamily: "var(--f-d)" }}>{nx.homeTeamName}</b>
              <span className="p-num text-3xl" style={{ color: "var(--mute)" }}>VS</span>
              <b className="text-lg sm:text-2xl truncate text-right" style={{ fontFamily: "var(--f-d)" }}>{nx.awayTeamName}</b>
            </div>
            {nx.canPlaySolo && <button onClick={() => handlePlaySolo(nx.id)} disabled={busyId === nx.id} className="p-btn big">{busyId === nx.id ? "Jugando…" : "Jugar partido"}</button>}
            {nx.canPlayLive && <button onClick={() => navigate(`/dt-liga/${code}/live/${nx.id}`)} className="p-btn big">🔴 Jugar en vivo</button>}
            {!nx.canPlaySolo && !nx.canPlayLive && <p className="text-sm p-muted">{nx.locked ? "Este mes ya se cerró." : nx.isPvp ? `Contra ${mineHome ? nx.awayManager : nx.homeManager}: se juega en vivo con los dos conectados.` : "Todavía no se puede jugar."}</p>}
          </section>
        );
      })()}

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

      <MonthGrid
        data={data}
        weeks={weeks}
        activeWeek={activeWeek}
        onSelect={setSelWeek}
        mineOf={mineOf}
        onMonth={(delta) => { setSelWeek(null); setMonth(Math.min(data.totalMonths, Math.max(1, data.month + delta))); }}
        showOthers={showOthers}
        fixtures={data.fixtures}
        myTeamId={myTeamId}
      />

      {Object.entries(visible).map(([week, fixtures]) => (
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
              {f.comp !== "liga" && <span title={`${f.compLabel} · ${f.roundLabel}`}><CompChip comp={chipOf(f.comp)} short /></span>}
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
          <p className="text-sm text-emerald font-medium">🏆 La temporada terminó — mira la tabla final y el puntaje.</p>
          {league.isMine && <NextSeasonButton code={code} league={league} onStarted={() => { load(); onReload?.(); }} />}
        </div>
      ) : monthDone ? (
        <p className="text-sm text-gray-500 text-center py-2">Se jugaron todos los partidos de este mes. Para pasar al siguiente, todos los jugadores tienen que dar "Listo".</p>
      ) : (
        <p className="text-xs text-gray-600 text-center">
          Juega tus partidos contra la CPU cuando quieras. Los que son contra otro jugador se juegan en vivo, los dos conectados a la vez.
        </p>
      )}
    </div>
  );
}

// Configuración de la liga para este dispositivo.
function ConfigTab({ league }) {
  const [showOthers, setShowOthers] = useState(readShowOthers);
  function toggle(v) {
    setShowOthers(v);
    try { localStorage.setItem(SHOW_OTHERS_KEY, v ? "1" : "0"); } catch { /* sin storage */ }
  }
  const DIFF = { facil: "Fácil", media: "Media", dificil: "Difícil" };
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 bg-panel border border-border rounded-2xl p-4 cursor-pointer">
        <input type="checkbox" checked={showOthers} onChange={(e) => toggle(e.target.checked)} className="mt-1 accent-[rgb(var(--c-accent))]" />
        <span>
          <span className="block text-sm font-semibold">Ver los partidos del resto en el calendario</span>
          <span className="block text-xs text-gray-500 mt-0.5">Por defecto la Jornada solo muestra tus partidos. Activalo para ver también los de los demás clubes de la liga.</span>
        </span>
      </label>
      <div className="bg-panel border border-border rounded-2xl p-4 text-sm">
        <p className="font-semibold">Dificultad de los clubes CPU</p>
        <p className="text-xs text-gray-500 mt-0.5">Se elige al crear la liga y no cambia una vez que arranca.</p>
        <p className="mt-2">{DIFF[league.cpuDifficulty] || "Media"}</p>
      </div>
    </div>
  );
}

const GRID_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Calendario del mes: cada jornada cae en su sábado. En cada sábado se ven tus partidos (y los del resto si lo
// activaste en Configuración). Tocar un sábado elige esa jornada y abajo aparecen sus partidos.
function MonthGrid({ data, weeks, activeWeek, onSelect, mineOf, onMonth, showOthers, fixtures, myTeamId }) {
  if (!weeks.length) return null;
  const saturday = (w) => dateOfDay(data.season || 1, w - 1, 5);
  const shown = saturday(activeWeek ?? weeks[0]);
  const year = shown.getUTCFullYear();
  const mon = shown.getUTCMonth();
  const first = new Date(Date.UTC(year, mon, 1));
  const daysInMonth = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const weekOfDay = new Map();
  weeks.forEach((w) => { const d = saturday(w); if (d.getUTCFullYear() === year && d.getUTCMonth() === mon) weekOfDay.set(d.getUTCDate(), w); });
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const title = MONTH_NAMES[mon][0].toUpperCase() + MONTH_NAMES[mon].slice(1);

  return (
    <div className="bg-panel border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{title} {year}</h3>
        <div className="flex gap-1">
          <button onClick={() => onMonth(-1)} disabled={data.month <= 1} aria-label="Mes anterior" className="p-1.5 rounded-card border border-border text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={15} /></button>
          <button onClick={() => onMonth(data.activeMonth - data.month)} className="px-2.5 py-1.5 rounded-card border border-border text-xs text-gray-300 hover:text-white">Mes actual</button>
          <button onClick={() => onMonth(1)} disabled={data.month >= data.totalMonths} aria-label="Mes siguiente" className="p-1.5 rounded-card border border-border text-gray-400 hover:text-white disabled:opacity-30"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-gray-500">{GRID_DAYS.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d == null) return <span key={"e" + i} />;
          const w = weekOfDay.get(d);
          const mine = w ? mineOf(w) : [];
          const othersCount = w && showOthers ? fixtures.filter((f) => f.week === w && !f.involvesMe && !f.bye).length : 0;
          const m = mine[0];
          const selected = w != null && w === activeWeek;
          const body = m ? (
            <>
              <span className="block truncate text-[10px] text-gray-300">vs {m.homeTeamId === myTeamId ? m.awayTeamName : m.homeTeamName}</span>
              <span className={"block text-[11px] font-bold " + (m.played ? "text-white" : "text-accent")}>{m.played ? m.homeGoals + "-" + m.awayGoals : "Jugar"}</span>
            </>
          ) : w ? <span className="block text-[10px] text-gray-500">J{w}</span> : null;
          return (
            <button
              key={d}
              type="button"
              disabled={!w}
              onClick={() => w && onSelect(w)}
              aria-label={w ? "Jornada " + w + ", " + d + " de " + MONTH_NAMES[mon] : String(d)}
              className={"min-h-[56px] rounded-xl border p-1 text-center flex flex-col items-center justify-start gap-0.5 " + (selected ? "border-accent bg-accent/15" : w ? (m && !m.played ? "border-accent/40 bg-accent/5" : "border-border bg-bg/40 hover:border-white/30") : "border-border/50 bg-panel/40 text-gray-600")}
            >
              <span className={"text-[11px] " + (w ? "text-white font-semibold" : "")}>{d}</span>
              {body}
              {othersCount > 0 && <span className="text-[9px] text-gray-500">+{othersCount} más</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500">{showOthers ? "Se ven tus partidos y los del resto de la liga." : "Se ven tus partidos. Para ver también los del resto, activalo en Configuración."}</p>
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
  const [offers, setOffers] = useState({ received: [], sent: [], marketOpen: false });
  const [squads, setSquads] = useState([]);
  const [openMgr, setOpenMgr] = useState(null);
  const [bidFor, setBidFor] = useState(null); // { sellerId, playerId, amount }
  const [counterFor, setCounterFor] = useState(null); // { id, amount }
  const [proposingTo, setProposingTo] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    getTrades(code).then(setTrades).catch(() => setTrades([]));
    getPlayerOffers(code).then(setOffers).catch(() => {});
    getManagersSquads(code).then((d) => setSquads(d.managers || [])).catch(() => setSquads([]));
  }, [code]);
  useEffect(() => { load(); }, [load]);

  const me = league.members.find((m) => m.isMe);
  const others = league.members.filter((m) => !m.isMe && m.teamId);
  const pendingWithUser = (userId) =>
    trades.some((t) => t.status === "pending" && ((t.fromUserId === userId) || (t.toUserId === userId)) && (t.fromUserId === me?.userId || t.toUserId === me?.userId));

  async function run(fn, ok) {
    setError(null); setMsg(null);
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (err) { setError(err.response?.data?.error || "No se pudo completar"); }
  }

  if (!me?.teamId) return <p className="text-sm text-gray-500 text-center py-6">No diriges ningún equipo en esta liga.</p>;

  const pending = trades.filter((t) => t.status === "pending");
  const resolved = trades.filter((t) => t.status !== "pending");
  const recv = offers.received.filter((o) => o.status === "pending" || o.status === "countered");
  const sent = offers.sent.filter((o) => ["pending", "countered", "accepted"].includes(o.status));
  const old = [...offers.received, ...offers.sent].filter((o) => !["pending", "countered", "accepted"].includes(o.status));
  const field = { background: "var(--bg)", borderColor: "var(--line)" };

  return (
    <div className="space-y-4">
      <div className="p-card" style={{ borderColor: offers.marketOpen ? "var(--gold-line)" : "var(--line)" }}>
        <p className="p-eyebrow" style={{ justifyContent: "flex-start" }}>{offers.marketOpen ? "Mercado abierto" : "Mercado cerrado"}</p>
        <p className="text-sm mt-1">{offers.marketOpen ? "Puedes ofertar por jugadores de los otros managers. El que vende acepta, rechaza o te contraoferta." : "Las ofertas entre managers abren en el mercado de verano y en el de invierno."}</p>
      </div>
      {error && <div className="rounded-2xl px-4 py-2.5 text-sm" style={{ background: "#ef5b5b1a", border: "1px solid #ef5b5b55", color: "var(--red)" }}>{error}</div>}
      {msg && <p className="text-sm" style={{ color: "var(--acc2)" }}>{msg}</p>}

      <section className="p-card space-y-2">
        <p className="p-eyebrow"><span>Ofertas por tus jugadores</span><span>{recv.length}</span></p>
        {!recv.length && <p className="text-sm p-muted">Nadie te ofertó por ahora.</p>}
        {recv.map((o) => (
          <div key={o.id} className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
            <p className="text-sm"><b>{o.buyerName}</b> ofrece <b className="p-num text-base" style={{ color: "var(--gold)" }}>€{o.amount}M</b> por <b>{o.playerName}</b> <small className="p-muted">(OVR {o.ovr})</small></p>
            {o.status === "countered" ? (
              <p className="text-xs p-muted mt-1">Le contraofertaste €{o.counterAmount}M. Esperando su respuesta.</p>
            ) : counterFor?.id === o.id ? (
              <div className="flex gap-2 mt-2 items-center">
                <input type="number" step={0.5} value={counterFor.amount} onChange={(e) => setCounterFor({ ...counterFor, amount: Number(e.target.value) })} className="w-24 rounded-lg border px-2 py-1.5 text-sm" style={field} aria-label="Contraoferta en millones" />
                <button onClick={() => run(() => respondPlayerOffer(code, o.id, "counter", counterFor.amount), "Contraoferta enviada.").then(() => setCounterFor(null))} className="p-btn sm gold">Contraofertar</button>
                <button onClick={() => setCounterFor(null)} className="p-btn sm ghost">Cancelar</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => run(() => respondPlayerOffer(code, o.id, "accept"), "Vendido: se aplica al abrir Mi club.")} className="p-btn sm">Aceptar</button>
                <button onClick={() => setCounterFor({ id: o.id, amount: Math.round(o.amount * 1.2 * 2) / 2 })} className="p-btn sm gold">Contraofertar</button>
                <button onClick={() => run(() => respondPlayerOffer(code, o.id, "reject"))} className="p-btn sm ghost">Rechazar</button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="p-card space-y-2">
        <p className="p-eyebrow"><span>Tus ofertas</span><span>{sent.length}</span></p>
        {!sent.length && <p className="text-sm p-muted">No tienes ofertas abiertas.</p>}
        {sent.map((o) => (
          <div key={o.id} className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
            <p className="text-sm">Ofreciste <b className="p-num text-base">€{o.amount}M</b> a {o.sellerName} por <b>{o.playerName}</b></p>
            {o.status === "pending" && <p className="text-xs p-muted mt-1">Esperando respuesta.</p>}
            {o.status === "accepted" && <p className="text-xs mt-1" style={{ color: "var(--acc2)" }}>¡Trato cerrado! Se suma a tu plantel al abrir Mi club.</p>}
            {o.status === "countered" && (
              <div className="mt-2">
                <p className="text-sm">{o.sellerName} pide <b className="p-num text-base" style={{ color: "var(--gold)" }}>€{o.counterAmount}M</b>.</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => run(() => respondPlayerOffer(code, o.id, "accept"), "¡Trato cerrado! Se suma al abrir Mi club.")} className="p-btn sm gold">Aceptar €{o.counterAmount}M</button>
                  <button onClick={() => run(() => respondPlayerOffer(code, o.id, "reject"))} className="p-btn sm ghost">No, gracias</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="p-card space-y-2">
        <p className="p-eyebrow"><span>Plantillas de los otros managers</span></p>
        {!squads.length && <p className="text-sm p-muted">Todavía no hay otros managers con plantel guardado.</p>}
        {squads.map((mg) => (
          <div key={mg.userId} className="rounded-xl" style={{ background: "var(--panel2)" }}>
            <button onClick={() => setOpenMgr(openMgr === mg.userId ? null : mg.userId)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm" aria-expanded={openMgr === mg.userId}>
              <span><b>{mg.username}</b> <span className="p-muted">· {mg.teamName} · {mg.players.length} jugadores</span></span>
              <span className="p-muted">{openMgr === mg.userId ? "▲" : "▼"}</span>
            </button>
            {openMgr === mg.userId && (
              <ul className="px-3 pb-3 space-y-1">
                {mg.players.map((p) => {
                  const bidding = bidFor?.playerId === p.id && bidFor?.sellerId === mg.userId;
                  return (
                    <li key={p.id} className="flex items-center gap-2 text-sm py-1 flex-wrap" style={{ borderTop: "1px solid var(--line)" }}>
                      <span className="p-num w-9 text-base" style={{ color: "var(--acc2)" }}>{p.ovr}</span>
                      <span className="flex-1 min-w-[140px] truncate">{p.name} <small className="p-muted">{p.position} · {p.age} a · €{p.value}M</small></span>
                      {bidding ? (
                        <span className="flex gap-1.5 items-center">
                          <input type="number" step={0.5} value={bidFor.amount} onChange={(e) => setBidFor({ ...bidFor, amount: Number(e.target.value) })} className="w-20 rounded-lg border px-2 py-1 text-sm" style={field} aria-label="Oferta en millones" />
                          <button onClick={() => run(() => sendPlayerOffer(code, mg.userId, p.id, bidFor.amount), "Oferta enviada.").then(() => setBidFor(null))} className="p-btn sm">Enviar</button>
                          <button onClick={() => setBidFor(null)} className="p-btn sm ghost">✕</button>
                        </span>
                      ) : (
                        <button disabled={!offers.marketOpen} onClick={() => setBidFor({ sellerId: mg.userId, playerId: p.id, amount: p.value })} className="p-btn sm ghost">Ofertar</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </section>

      <details className="p-card">
        <summary className="cursor-pointer text-sm font-semibold">Intercambiar clubes con otro manager</summary>
        <div className="space-y-2 mt-3">
          {pending.map((t) => (
            <div key={t.id} className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-3" style={{ background: "var(--panel2)" }}>
              <p className="text-sm">{t.isMine ? `Le ofreciste ${t.fromTeamName} a ${t.toUsername} a cambio de ${t.toTeamName}` : `${t.fromUsername} te ofrece ${t.fromTeamName} a cambio de tu ${t.toTeamName}`}</p>
              {!t.isMine ? (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => run(() => respondTrade(code, t.id, true))} className="p-btn sm">Aceptar</button>
                  <button onClick={() => run(() => respondTrade(code, t.id, false))} className="p-btn sm ghost">Rechazar</button>
                </div>
              ) : <span className="text-xs p-muted shrink-0">esperando respuesta</span>}
            </div>
          ))}
          {others.map((m) => (
            <div key={m.userId} className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-3" style={{ background: "var(--panel2)" }}>
              <p className="text-sm">{m.username} — dirige {league.allTeams.find((t) => t.id === m.teamId)?.name || m.teamId}</p>
              <button onClick={() => { setProposingTo(m.userId); run(() => proposeTrade(code, m.userId)).finally(() => setProposingTo(null)); }} disabled={proposingTo === m.userId || pendingWithUser(m.userId)} className="p-btn sm ghost">
                {pendingWithUser(m.userId) ? "Ya hay propuesta" : "Proponer cambio"}
              </button>
            </div>
          ))}
          {resolved.length > 0 && <p className="text-xs p-muted">Historial: {resolved.map((t) => `${t.fromUsername} ↔ ${t.toUsername} (${t.status === "accepted" ? "aceptado" : t.status === "rejected" ? "rechazado" : "cancelado"})`).join(" · ")}</p>}
        </div>
      </details>

      {old.length > 0 && (
        <details>
          <summary className="text-xs p-muted cursor-pointer">Historial de ofertas ({old.length})</summary>
          <ul className="mt-2 space-y-1 text-xs p-muted">{old.map((o) => <li key={o.id}>{o.buyerName} → {o.sellerName}: {o.playerName} €{o.amount}M · {o.status === "rejected" ? "rechazada" : o.status === "withdrawn" ? "retirada" : "cancelada"}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
