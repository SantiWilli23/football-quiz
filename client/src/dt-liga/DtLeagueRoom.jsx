import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { getLeague, pickTeam, startLeague } from "./api.js";

const POLL_MS = 4000;

export default function DtLeagueRoom() {
  const { code } = useParams();
  const [league, setLeague] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [busyTeamId, setBusyTeamId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{league.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{league.leagueKey === "premier" ? "Premier League" : "La Liga"}</p>
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
                  return (
                    <button
                      key={t.id}
                      onClick={() => !isTakenByOther && handlePick(t.id)}
                      disabled={isTakenByOther || busyTeamId === t.id}
                      title={isTakenByOther ? `Ya lo eligió ${owner.username}` : undefined}
                      className={`text-left px-3 py-2.5 rounded-2xl border text-sm transition-colors ${
                        isMine
                          ? "border-accent bg-accent/10 text-accent font-semibold"
                          : isTakenByOther
                          ? "border-border text-gray-600 opacity-50 cursor-not-allowed"
                          : "border-border text-gray-300 hover:border-accent/40"
                      }`}
                    >
                      {t.name}
                      {isTakenByOther && <span className="block text-[10px] text-gray-600 mt-0.5">{owner.username}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {league.isMine && (
              <button
                onClick={handleStart}
                disabled={!everyoneReady || starting}
                className="w-full bg-accent text-black font-semibold py-3 rounded-2xl hover:brightness-110 disabled:opacity-40 transition"
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

        {league.status === "in_progress" && (
          <div className="bg-panel border border-emerald/30 rounded-2xl p-6 text-center">
            <p className="text-lg font-semibold text-emerald mb-1">¡La liga arrancó! 🏆</p>
            <p className="text-sm text-gray-400">
              Vos dirigís <span className="text-white font-medium">{teamName(myTeamId)}</span>.
              El calendario y los partidos entre ligas están en camino — por ahora podés ver quién dirige a quién.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
