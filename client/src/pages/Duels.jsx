import { useCallback, useEffect, useState } from "react";
import { Check, Circle, Flame, HelpCircle, Star, Sword, Swords, Trophy, X, Zap } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Avatar from "../components/Avatar.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import { CHALK, DUEL_CHALK } from "../theme.js";

const COLOR = CHALK.red;

const DIFFICULTY_STYLE = {
  dificil: { label: "Difícil", emoji: "🔥", color: DUEL_CHALK.dificil },
  ultra: { label: "Ultra difícil", emoji: "💀", color: DUEL_CHALK.ultra },
  demonio: { label: "Demonio", emoji: "😈", color: DUEL_CHALK.demonio },
};
const LETTERS = { a: "A", b: "B", c: "C", d: "D" };

const RESULT_STYLE = {
  ganado: { label: "Ganaste", className: "text-accent" },
  perdido: { label: "Perdiste", className: "text-red-400" },
  empate: { label: "Empate", className: "text-gray-400" },
};

// Pantalla de juego: una pregunta por vez, con la corrección al instante.
function DuelPlay({ duelId, onFinished, onCancel }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/duels/${duelId}`);
      setData(data);
    } catch {
      setError("No se pudo cargar el duelo");
    }
  }, [duelId]);

  useEffect(() => {
    load();
  }, [load]);

  const current = data?.questions.find((q) => !q.answered);

  const submit = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data: res } = await api.post(`/duels/${duelId}/answer`, {
        question_id: current.id,
        answer: selected,
      });
      setFeedback(res);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo enviar la respuesta");
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    setFeedback(null);
    setSelected(null);
    if (feedback.answered >= feedback.total_questions) {
      onFinished();
      return;
    }
    await load();
  };

  if (!data) {
    return (
      <Card>
        <p className="text-sm text-gray-500">{error || "Cargando duelo..."}</p>
      </Card>
    );
  }

  if (!current) {
    return (
      <Card>
        <p className="text-sm text-gray-400 mb-4">Ya respondiste todas tus preguntas de este duelo.</p>
        <button
          onClick={onFinished}
          className="bg-accent hover:bg-accent-dark text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
        >
          Volver
        </button>
      </Card>
    );
  }

  return (
    <div style={{ borderLeft: `4px solid ${COLOR}`, background: `${COLOR}0d`, borderRadius: "8px" }}>
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5"
            style={{ background: `${COLOR}26`, color: COLOR, borderColor: `${COLOR}66` }}
          >
            <Swords size={12} />
            {data.difficulty_label ?? "Duelo"}
          </span>
          <span className="text-xs text-gray-500">
            Pregunta {current.index} de {data.total_questions}
          </span>
        </div>

        <h2 className="text-xl font-semibold mb-6">{current.question}</h2>

        <div className="space-y-2.5">
          {current.options.map((option) => {
            const isSelected = selected === option.value;
            const isCorrect = feedback && feedback.correct_answer === option.value;
            const isWrongPick = feedback && isSelected && !feedback.is_correct;

            let cls = "border-border bg-bg";
            if (feedback) {
              if (isCorrect) cls = "border-accent bg-accent/10";
              else if (isWrongPick) cls = "border-red-500 bg-red-500/10";
              else cls = "border-border bg-bg opacity-60";
            } else if (isSelected) {
              cls = "border-accent bg-accent/10";
            }

            return (
              <button
                key={option.value}
                onClick={() => !feedback && setSelected(option.value)}
                disabled={!!feedback}
                className={`w-full text-left px-4 py-3.5 rounded-card border transition-colors flex items-center gap-3 ${cls} ${
                  feedback ? "cursor-default" : "cursor-pointer"
                }`}
              >
                <span className="w-7 h-7 shrink-0 rounded-full border border-current/40 flex items-center justify-center text-xs font-semibold">
                  {LETTERS[option.value]}
                </span>
                <span className="text-sm flex-1">{option.label}</span>
                {feedback && isCorrect && <Check size={17} className="text-accent shrink-0" />}
                {feedback && isWrongPick && <X size={17} className="text-red-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        {!feedback ? (
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={submit}
              disabled={!selected || busy}
              className="bg-accent hover:bg-accent-dark disabled:opacity-40 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
            >
              {busy ? "Enviando..." : "Responder"}
            </button>
            <button onClick={onCancel} className="text-sm text-gray-500 hover:text-white transition-colors">
              Seguir después
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <p className={`text-sm font-medium mb-3 ${feedback.is_correct ? "text-accent" : "text-red-400"}`}>
              {feedback.is_correct ? "¡Correcto!" : "Incorrecto"}
            </p>
            <button
              onClick={next}
              className="bg-accent hover:bg-accent-dark text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
            >
              {feedback.answered >= feedback.total_questions ? "Terminar" : "Siguiente"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Duels() {
  const { user } = useAuth();
  const { activeGroupId: groupId, groups } = useGroups();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [error, setError] = useState("");
  const [challenging, setChallenging] = useState(false);
  const [difficulty, setDifficulty] = useState("dificil");
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data === "mentiroso:close") setSelectedGame(null);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const load = useCallback(async () => {
    if (!groupId) {
      setData(null);
      return;
    }
    try {
      const [duelsRes, statsRes] = await Promise.all([
        api.get("/duels", { params: { groupId } }),
        api.get("/stats/mode-b", { params: { groupId } }),
      ]);
      setData(duelsRes.data);
      setMembers(statsRes.data.leaderboard.filter((m) => m.id !== user?.id));
    } catch {
      setData(null);
    }
  }, [groupId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const challenge = async (opponentId) => {
    setChallenging(true);
    setError("");
    try {
      const { data: created } = await api.post("/duels", { group_id: groupId, opponent_id: opponentId, difficulty });
      await load();
      setPlaying(created.id);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear el duelo");
    } finally {
      setChallenging(false);
    }
  };

  const GAME_TYPES = [
    {
      key: "trivia",
      label: "Trivia",
      icon: HelpCircle,
      description: "Preguntas de trivia uno a uno",
      available: true,
    },
    {
      key: "8a2",
      label: "Draft 8a2",
      icon: Star,
      description: "Armá tu equipo y enfrentate",
      available: false,
    },
    {
      key: "mentiroso",
      label: "Mentiroso",
      icon: Zap,
      description: "¿Sabés más jugadores que el otro?",
      available: true,
    },
  ];

  if (groups.length === 0) {
    return (
      <Layout>
        <h1 className="text-xl sm:text-2xl font-bold mb-1">Duelos</h1>
        <p className="text-gray-400 text-sm mb-6">Uno contra uno, con las preguntas más difíciles</p>
        <Card>
          <p className="text-gray-400 text-center py-6">Necesitás estar en un grupo para jugar duelos.</p>
        </Card>
      </Layout>
    );
  }

  if (playing) {
    return (
      <Layout>
        <h1 className="text-xl sm:text-2xl font-bold mb-6">Duelo en curso</h1>
        <DuelPlay
          duelId={playing}
          onFinished={async () => {
            setPlaying(null);
            await load();
          }}
          onCancel={() => setPlaying(null)}
        />
      </Layout>
    );
  }

  const duels = data?.duels ?? [];
  const myTurn = duels.filter((d) => d.status === "esperando" && d.my_turn);
  const waiting = duels.filter((d) => d.status === "esperando" && !d.my_turn);
  const finished = duels.filter((d) => d.status === "terminado");
  const record = data?.record;

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-1">Duelos</h1>
          <p className="text-gray-400 text-sm">Uno contra uno — elegí el juego</p>
        </div>
        <GroupSelector />
      </div>

      {/* Selector de tipo de duelo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {GAME_TYPES.map(({ key, label, icon: Icon, description, available }) => (
          <div
            key={key}
            onClick={() => available && key === "mentiroso" && setSelectedGame("mentiroso")}
            className={`px-4 py-3.5 rounded-card border transition-colors ${
              available
                ? key === "mentiroso"
                  ? "border-accent/40 bg-accent/5 cursor-pointer hover:border-accent hover:bg-accent/10"
                  : "border-accent/40 bg-accent/5 cursor-default"
                : "border-border bg-panel opacity-50 cursor-default"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} className={available ? "text-accent" : "text-gray-500"} />
              <span className={`text-sm font-semibold ${available ? "text-white" : "text-gray-500"}`}>
                {label}
              </span>
              {!available && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/60 text-gray-500 border border-gray-600/40">
                  Pronto
                </span>
              )}
              {available && key === "mentiroso" && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                  Jugar
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        ))}
      </div>

      {/* Mentiroso embebido */}
      {selectedGame === "mentiroso" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Zap size={16} className="text-accent" />
              Mentiroso
            </h2>
            <button
              onClick={() => setSelectedGame(null)}
              className="text-xs text-gray-500 hover:text-white transition-colors border border-border rounded-full px-3 py-1.5"
            >
              ✕ Cerrar
            </button>
          </div>
          <div className="rounded-card overflow-hidden border border-border" style={{ height: "600px" }}>
            <iframe
              src="/mentiroso.html"
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              title="Mentiroso"
            />
          </div>
        </div>
      )}

      {record && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Swords size={17} style={{ color: COLOR }} />
            <h2 className="font-semibold">Mi récord en el grupo</h2>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Ganados</p>
              <p className="text-2xl font-bold text-accent">{record.won}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Empatados</p>
              <p className="text-2xl font-bold">{record.drawn}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Perdidos</p>
              <p className="text-2xl font-bold text-red-400">{record.lost}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Puntos</p>
              <p className="text-2xl font-bold">{record.points}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-600 mt-3">
            Los puntos dependen del nivel del duelo y cuentan para la temporada del grupo.
          </p>
        </Card>
      )}

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {myTurn.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={17} className="text-orange-400" />
            <h2 className="font-semibold">Te toca jugar</h2>
          </div>
          <div className="space-y-2">
            {myTurn.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 px-4 py-3 rounded-card border border-orange-500/40 bg-orange-500/5"
              >
                <Avatar user={d.rival} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {d.i_challenged ? "Desafiaste a" : "Te desafió"} {d.rival.username}
                  </p>
                  <p className="text-xs text-gray-500">
                    {DIFFICULTY_STYLE[d.difficulty]?.emoji} {d.difficulty_label} · {d.my_answered}/
                    {d.total_questions} respondidas
                  </p>
                </div>
                <button
                  onClick={() => setPlaying(d.id)}
                  className="px-4 py-2 rounded-card text-sm font-semibold text-black shrink-0 transition-opacity hover:opacity-90"
                  style={{ background: COLOR }}
                >
                  {d.my_answered > 0 ? "Seguir" : "Jugar"}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="font-semibold mb-4">Desafiar a alguien</h2>

        <p className="text-xs text-gray-500 mb-2">Nivel del duelo</p>
        <div className="flex gap-2 mb-5 flex-wrap">
          {Object.entries(DIFFICULTY_STYLE).map(([key, style]) => {
            const rules = data?.difficulties?.[key];
            const active = difficulty === key;
            return (
              <button
                key={key}
                onClick={() => setDifficulty(key)}
                aria-pressed={active}
                style={
                  active ? { borderColor: `${style.color}99`, background: `${style.color}1a` } : undefined
                }
                className={`px-3 py-2 rounded-card text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  active ? "" : "border-border text-gray-400 hover:text-white hover:border-white/30"
                }`}
              >
                <span>{style.emoji}</span>
                <span style={active ? { color: style.color } : undefined}>{style.label}</span>
                {rules && <span className="text-gray-500">· {rules.win} pts</span>}
              </button>
            );
          })}
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-gray-500">Sos el único miembro del grupo por ahora.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 rounded-card border border-border"
              >
                <div className="relative shrink-0">
                  <Avatar user={m} size={32} />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-panel bg-gray-600"
                    title="Desconectado"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{m.username}</span>
                  <span className="text-[10px] text-gray-600">Sin actividad reciente</span>
                </div>
                <button
                  onClick={() => challenge(m.id)}
                  disabled={challenging}
                  className="px-4 py-2 rounded-card text-sm font-medium border border-border text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-40 transition-colors shrink-0"
                >
                  Desafiar
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {waiting.length > 0 && (
        <Card className="mb-6">
          <h2 className="font-semibold mb-4">Esperando al rival</h2>
          <div className="space-y-2">
            {waiting.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-card border border-border">
                <Avatar user={d.rival} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{d.rival.username}</p>
                  <p className="text-xs text-gray-500">
                    Ya jugaste. Le faltan {d.total_questions - d.rival_answered} preguntas.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {finished.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-4">Duelos terminados</h2>
          <div className="space-y-2">
            {finished.map((d) => {
              const style = RESULT_STYLE[d.result];
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-card border border-border"
                >
                  <Avatar user={d.rival} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">contra {d.rival.username}</p>
                    <p className="text-xs text-gray-500">
                      {DIFFICULTY_STYLE[d.difficulty]?.emoji} {d.my_correct}–{d.rival_correct} de{" "}
                      {d.total_questions}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${style.className}`}>{style.label}</p>
                    <p className="text-[11px] text-gray-600">+{d.points} pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {duels.length === 0 && (
        <p className="text-sm text-gray-500">Todavía no jugaste ningún duelo.</p>
      )}
    </Layout>
  );
}
