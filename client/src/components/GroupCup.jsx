import { useEffect, useState } from "react";
import { Swords, Trophy, X } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Card from "./Card.jsx";

const BRACKET_SIZES = [4, 8];

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function SquadDraft({ cup, onJoined }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState([]);
  const [squad, setSquad] = useState([]); // [{id, name}]
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    api
      .get(`/group-cup/${cup.id}/players`, { params: { q: debouncedQuery.trim() } })
      .then(({ data }) => setResults(data.players.filter((p) => !squad.some((s) => s.id === p.id))))
      .catch(() => setResults([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const addPlayer = (p) => {
    if (squad.length >= cup.squadSize) return;
    setSquad((prev) => [...prev, { id: p.id, name: p.name }]);
    setResults([]);
    setQuery("");
  };

  const removePlayer = (id) => setSquad((prev) => prev.filter((p) => p.id !== id));

  const confirm = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post(`/group-cup/${cup.id}/join`, { squad: squad.map((p) => p.id) });
      onJoined(data.cup);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo armar el equipo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-card border border-border bg-bg p-4 space-y-3">
      <p className="text-sm font-medium">
        Armá tu plantel: elegí {cup.squadSize} jugadores reales ({squad.length}/{cup.squadSize})
      </p>

      <div className="flex flex-wrap gap-2">
        {squad.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent">
            {p.name}
            <button onClick={() => removePlayer(p.id)}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {squad.length < cup.squadSize && (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugador..."
            className="w-full bg-panel border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-panel border border-border rounded-card overflow-hidden shadow-lg">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addPlayer(p)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent/10 transition-colors"
                >
                  {p.name} <span className="text-xs text-gray-500">· {p.position || p.nationality}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={confirm}
        disabled={squad.length !== cup.squadSize || loading}
        className="w-full bg-accent hover:bg-accent-dark disabled:opacity-40 text-black font-semibold rounded-card py-2.5 text-sm transition-colors"
      >
        {loading ? "Confirmando..." : "Confirmar equipo"}
      </button>
    </div>
  );
}

function Bracket({ cup }) {
  const byId = Object.fromEntries(cup.participants.map((p) => [p.id, p]));
  const rounds = [...new Set(cup.matches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-5 overflow-x-auto">
      {rounds.map((round) => (
        <div key={round}>
          <p className="text-xs font-semibold text-gray-500 mb-2">
            {cup.matches.filter((m) => m.round === round).length === 1 ? "Final" : `Ronda ${round}`}
          </p>
          <div className="flex gap-3 flex-wrap">
            {cup.matches
              .filter((m) => m.round === round)
              .map((m) => {
                const a = byId[m.participantAId];
                const b = byId[m.participantBId];
                return (
                  <div key={m.id} className="rounded-card border border-border bg-bg px-3 py-2.5 min-w-[190px]">
                    {[
                      [a, m.scoreA],
                      [b, m.scoreB],
                    ].map(([p, score], i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between text-sm py-0.5 ${
                          m.played && m.winnerId === p?.id ? "font-semibold text-accent" : "text-gray-300"
                        }`}
                      >
                        <span className="truncate">{p?.username || "?"}</span>
                        <span className="tabular-nums">{m.played ? score : "-"}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GroupCup({ groupId }) {
  const { user } = useAuth();
  const [cup, setCup] = useState(undefined); // undefined = cargando, null = no hay
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [bracketSize, setBracketSize] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api
      .get("/group-cup", { params: { groupId } })
      .then(({ data }) => setCup(data.cup))
      .catch(() => setCup(null));
  };

  useEffect(() => {
    if (!groupId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (!cup || cup.status === "finished") return;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cup?.id, cup?.status]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/group-cup", { groupId, name: name.trim() || "Copa del grupo", bracketSize });
      setCup(data.cup);
      setShowCreate(false);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la copa");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/group-cup/${cup.id}/start`);
      setCup(data.cup);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo iniciar la copa");
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/group-cup/${cup.id}/advance`);
      setCup(data.cup);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo avanzar de ronda");
    } finally {
      setBusy(false);
    }
  };

  if (cup === undefined) return null;

  const champion =
    cup?.status === "finished" ? cup.participants.find((p) => !p.eliminated) : null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Swords size={15} className="text-accent" />
        <h3 className="font-semibold">Copa del grupo</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Cada uno arma su equipo draftando jugadores reales. Los cupos que nadie eligió se llenan con CPU y se juega a eliminación directa.
      </p>

      {!cup && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-card text-sm font-medium bg-accent hover:bg-accent-dark text-black transition-colors"
        >
          Crear copa
        </button>
      )}

      {!cup && showCreate && (
        <form onSubmit={create} className="space-y-3 max-w-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la copa"
            className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            {BRACKET_SIZES.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setBracketSize(n)}
                className={`flex-1 py-2 rounded-card border text-sm font-medium ${
                  bracketSize === n ? "border-accent bg-accent/10 text-accent" : "border-border text-gray-400"
                }`}
              >
                {n} equipos
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="bg-accent hover:bg-accent-dark disabled:opacity-50 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
          >
            {busy ? "Creando..." : "Crear copa"}
          </button>
        </form>
      )}

      {cup && cup.status === "lobby" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {cup.name} · {cup.participants.length}/{cup.bracketSize} equipos (los cupos vacíos se llenan con CPU)
          </p>

          <div className="flex flex-wrap gap-2">
            {cup.participants.map((p) => (
              <span key={p.id} className="text-xs px-3 py-1.5 rounded-full border border-border bg-bg">
                {p.username}
                {p.userId === user?.id ? " (vos)" : ""}
              </span>
            ))}
          </div>

          {!cup.iJoined && <SquadDraft cup={cup} onJoined={setCup} />}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {cup.isMine && (
            <button
              onClick={start}
              disabled={busy}
              className="w-full sm:w-auto bg-accent hover:bg-accent-dark disabled:opacity-40 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
            >
              {busy ? "Iniciando..." : "Iniciar copa"}
            </button>
          )}
        </div>
      )}

      {cup && (cup.status === "in_progress" || cup.status === "finished") && (
        <div className="space-y-5">
          {cup.status === "finished" && champion && (
            <div className="flex items-center gap-3 rounded-card border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <Trophy size={20} className="text-amber-400" />
              <p className="text-sm font-semibold">{champion.username} se consagró campeón de {cup.name}</p>
            </div>
          )}

          <Bracket cup={cup} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          {cup.isMine && cup.status === "in_progress" && (
            <button
              onClick={advance}
              disabled={busy}
              className="bg-accent hover:bg-accent-dark disabled:opacity-40 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
            >
              {busy ? "Resolviendo..." : "Avanzar ronda"}
            </button>
          )}

          {cup.status === "finished" && (
            <button
              onClick={() => setCup(null)}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Crear una copa nueva
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
