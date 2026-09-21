import { useCallback, useEffect, useState } from "react";
import { Crown, Plus, Swords, Trophy, Users } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

const DIFFICULTY_LABEL = { dificil: "Difícil", ultra: "Ultra difícil", demonio: "Demonio" };
const ROUND_NAME = (round, totalRounds) => {
  const fromFinal = totalRounds - round;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semifinal";
  if (fromFinal === 2) return "Cuartos de final";
  return `Ronda ${round}`;
};

function MatchBox({ match, myId, onPlay }) {
  const isMine = match.player_a?.id === myId || match.player_b?.id === myId;
  const myTurn = isMine && match.duel_status === "esperando";
  const bothSet = match.player_a && match.player_b;

  return (
    <div className={`rounded-card border px-3 py-2.5 ${match.winner_id ? "border-border bg-panel" : bothSet ? "border-accent/30 bg-accent/5" : "border-border bg-bg/40"}`}>
      {[match.player_a, match.player_b].map((p, i) => {
        const won = match.winner_id && p?.id === match.winner_id;
        return (
          <div key={i} className={`flex items-center gap-2 py-0.5 ${i === 0 ? "mb-1" : ""}`}>
            {p ? <Avatar user={p} size={20} /> : <div className="w-5 h-5 rounded-full bg-white/5 shrink-0" />}
            <span className={`text-xs flex-1 truncate ${won ? "font-semibold text-accent" : p ? "text-gray-300" : "text-gray-600"}`}>
              {p?.username ?? "Por definir"}
            </span>
            {match.score && <span className="text-xs text-gray-500 shrink-0">{i === 0 ? match.score.a : match.score.b}</span>}
            {won && <Crown size={11} className="text-accent shrink-0" />}
          </div>
        );
      })}
      {match.decided_by_coin && <p className="text-xs text-gray-600 mt-1">Empate — se definió a penales</p>}
      {myTurn && (
        <button
          onClick={() => onPlay(match.duel_id)}
          className="mt-2 w-full text-xs font-semibold py-1.5 rounded-card bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors"
        >
          Jugar
        </button>
      )}
    </div>
  );
}

function TournamentDetail({ id, onPlay, onBack }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/duel-tournaments/${id}`);
      setData(data);
    } catch {
      setError("No se pudo cargar el torneo");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/duel-tournaments/${id}/start`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo arrancar el torneo");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="text-sm text-gray-500">{error || "Cargando torneo..."}</p>;

  const { tournament, players, rounds, total_rounds } = data;
  const champion = players.find((p) => p.id === tournament.champion_id);

  return (
    <div>
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-white transition-colors mb-4">
        ← Volver a torneos
      </button>

      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Trophy size={16} className="text-accent" />
            {tournament.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {DIFFICULTY_LABEL[tournament.difficulty]} · {players.length} anotados
          </p>
        </div>
        {tournament.status === "abierto" && tournament.is_creator && (
          <button
            onClick={start}
            disabled={busy}
            className="px-4 py-2 rounded-card text-sm font-semibold bg-accent text-onaccent hover:brightness-110 disabled:opacity-40 transition"
          >
            {busy ? "Armando..." : "Arrancar torneo"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {champion && (
        <div className="bg-amber/10 border border-amber/40 rounded-card px-4 py-3 mb-4 flex items-center gap-3">
          <Trophy size={22} className="text-amber shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber">¡{champion.username} se coronó campeón!</p>
            <p className="text-xs text-gray-400">Torneo "{tournament.name}" terminado</p>
          </div>
        </div>
      )}

      {tournament.status === "abierto" ? (
        <div>
          <p className="text-xs text-gray-500 mb-2">Anotados (hace falta una potencia de 2: 2, 4, 8...)</p>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 text-xs bg-panel border border-border rounded-full pl-1 pr-3 py-1">
                <Avatar user={p} size={18} />
                {p.username}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4 overflow-x-auto">
          {rounds.map(({ round, matches }) => (
            <div key={round}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {ROUND_NAME(round, total_rounds)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matches.map((m) => (
                  <MatchBox key={m.id} match={m} myId={user?.id} onPlay={onPlay} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DuelTournaments({ groupId, onPlay }) {
  const [tournaments, setTournaments] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState("dificil");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data } = await api.get("/duel-tournaments", { params: { groupId } });
      setTournaments(data.tournaments);
    } catch {
      setTournaments([]);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/duel-tournaments", { group_id: groupId, name: name.trim(), difficulty });
      setName("");
      setCreating(false);
      await load();
      setOpenId(data.id);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear el torneo");
    } finally {
      setBusy(false);
    }
  };

  const join = async (id) => {
    setError("");
    try {
      await api.post(`/duel-tournaments/${id}/join`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo unir al torneo");
    }
  };

  if (openId) {
    return (
      <TournamentDetail
        id={openId}
        onPlay={onPlay}
        onBack={() => { setOpenId(null); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Swords size={16} className="text-accent" />
          Torneos del grupo
        </h3>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors"
        >
          <Plus size={13} />
          Nuevo torneo
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {creating && (
        <div className="bg-bg border border-border rounded-card p-3 mb-4 space-y-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del torneo"
            maxLength={60}
            className="w-full bg-panel border border-border rounded-card px-3 py-2 text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            {Object.entries(DIFFICULTY_LABEL).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDifficulty(key)}
                className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
                  difficulty === key ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={create}
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-card text-sm font-semibold bg-accent text-onaccent hover:brightness-110 disabled:opacity-40 transition"
          >
            {busy ? "Creando..." : "Crear"}
          </button>
        </div>
      )}

      {tournaments.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay torneos en este grupo.</p>
      ) : (
        <div className="space-y-2">
          {tournaments.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-card border border-border">
              <Trophy size={18} className={t.status === "terminado" ? "text-amber" : "text-gray-500"} />
              <div className="flex-1 min-w-0">
                <button onClick={() => setOpenId(t.id)} className="text-sm font-medium hover:text-accent transition-colors truncate block text-left">
                  {t.name}
                </button>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Users size={11} />
                  {t.player_count} anotados · {t.difficulty_label} ·{" "}
                  {t.status === "abierto" ? "Inscripción abierta" : t.status === "en_curso" ? "En curso" : "Terminado"}
                </p>
              </div>
              {t.status === "abierto" && !t.joined && (
                <button
                  onClick={() => join(t.id)}
                  className="text-xs font-medium px-3 py-1.5 rounded-card border border-accent/40 text-accent hover:bg-accent/10 transition-colors shrink-0"
                >
                  Unirme
                </button>
              )}
              {t.status === "abierto" && t.joined && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-accent/15 text-accent border border-accent/30 shrink-0">
                  Anotado
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
