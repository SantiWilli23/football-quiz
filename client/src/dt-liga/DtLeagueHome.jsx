import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { myLeagues, createLeague, joinLeague } from "./api.js";
import { useGroups } from "../context/GroupContext.jsx";

const LEAGUE_OPTIONS = [
  { key: "premier", label: "Premier League" },
  { key: "laliga", label: "La Liga" },
  { key: "seriea", label: "Serie A" },
  { key: "bundesliga", label: "Bundesliga" },
];

export default function DtLeagueHome() {
  const navigate = useNavigate();
  const { groups, loading: groupsLoading } = useGroups();
  const [leagues, setLeagues] = useState(null);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [leagueKey, setLeagueKey] = useState("premier");
  const [weeksPerMonth, setWeeksPerMonth] = useState(4);
  const [groupId, setGroupId] = useState(null);
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    myLeagues().then(setLeagues).catch(() => setLeagues([]));
  }, []);

  useEffect(() => {
    if (!groupId && groups.length > 0) setGroupId(groups[0].id);
  }, [groups, groupId]);

  async function handleCreate() {
    if (!name.trim() || !groupId) return;
    setCreating(true);
    setError(null);
    try {
      const league = await createLeague(name.trim(), leagueKey, weeksPerMonth, groupId);
      navigate(`/dt-liga/${league.inviteCode}`);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la liga");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (joinCode.trim().length < 4) return;
    setJoining(true);
    setError(null);
    try {
      const league = await joinLeague(joinCode.trim().toUpperCase());
      navigate(`/dt-liga/${league.inviteCode}`);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo unir a esa liga");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-white p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Liga Online DT</h1>
            <p className="text-sm text-gray-500 mt-0.5">Armá una liga con amigos: cada uno dirige un club real.</p>
          </div>
          <Link to="/panel" className="text-xs text-gray-500 hover:text-white shrink-0">🏠 Salir</Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        {leagues && leagues.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tus ligas</p>
            <div className="space-y-2">
              {leagues.map((l) => (
                <Link
                  key={l.id}
                  to={`/dt-liga/${l.inviteCode}`}
                  className="flex items-center justify-between gap-3 bg-panel border border-border rounded-2xl px-4 py-3 hover:border-accent/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{l.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {LEAGUE_OPTIONS.find((o) => o.key === l.leagueKey)?.label || l.leagueKey} · {l.memberCount} jugador{l.memberCount === 1 ? "" : "es"}
                      {l.myTeamId ? ` · tu equipo: ${l.myTeamId}` : " · sin equipo elegido"}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full border shrink-0 ${
                    l.status === "lobby" ? "border-amber/40 text-amber" : "border-emerald/40 text-emerald"
                  }`}>
                    {l.status === "lobby" ? "Esperando" : l.status === "in_progress" ? "En curso" : "Terminada"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {groupsLoading ? (
          <p className="text-sm text-gray-500 text-center py-6">Cargando…</p>
        ) : groups.length === 0 ? (
          <div className="bg-amber/10 border border-amber/30 rounded-2xl px-4 py-3 text-sm text-amber">
            Necesitás estar en un grupo (el mismo de Trivia/Duelos) para crear o unirte a una liga —
            la Liga Online DT es solo para gente de tu grupo, así los puntos van al mismo ranking.
          </div>
        ) : (
          <>
            <div className="bg-panel border border-border rounded-2xl p-5 space-y-4">
              <p className="text-sm font-semibold">Crear una liga nueva</p>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Grupo</label>
                <select
                  value={groupId ?? ""}
                  onChange={(e) => setGroupId(Number(e.target.value))}
                  className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1.5">
                  Solo miembros de este grupo pueden unirse, y los puntos semanales de la liga suman a su ranking.
                </p>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la liga"
                maxLength={60}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm"
              />
              <div className="flex gap-2">
                {LEAGUE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setLeagueKey(opt.key)}
                    className={`flex-1 py-2.5 rounded-2xl border text-sm font-medium transition-colors ${
                      leagueKey === opt.key ? "border-accent bg-accent/10 text-accent" : "border-border text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Jornadas por mes (define cuándo se espera a todos)</label>
                <input
                  type="number" min={1} max={20} value={weeksPerMonth}
                  onChange={(e) => setWeeksPerMonth(Number(e.target.value))}
                  className="w-24 bg-bg border border-border rounded-2xl px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-600 mt-1.5">
                  Cada jugador puede adelantar sus partidos contra la CPU cuando quiera dentro del mes —
                  recién al terminarlo se espera a que todos hayan cerrado sus partidos.
                </p>
              </div>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || !groupId || creating}
                className="w-full bg-accent text-black font-semibold py-2.5 rounded-2xl hover:brightness-110 disabled:opacity-40 transition"
              >
                {creating ? "Creando…" : "Crear liga"}
              </button>
            </div>

            <div className="bg-panel border border-border rounded-2xl p-5 space-y-4">
              <p className="text-sm font-semibold">Unirte con un código</p>
              <p className="text-xs text-gray-500">Solo funciona si sos parte del mismo grupo que la liga.</p>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  maxLength={8}
                  className="flex-1 bg-bg border border-border rounded-2xl px-4 py-3 text-sm tracking-widest uppercase text-center"
                />
                <button
                  onClick={handleJoin}
                  disabled={joinCode.trim().length < 4 || joining}
                  className="px-5 bg-panel border border-accent/40 text-accent font-semibold rounded-2xl hover:bg-accent/10 disabled:opacity-40 transition"
                >
                  Unirse
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
