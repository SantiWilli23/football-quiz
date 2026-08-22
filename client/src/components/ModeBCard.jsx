import { useEffect, useState } from "react";
import { Check, GitCompare, PenLine, Sparkles, Target, UserCircle2, Users, X } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Card from "./Card.jsx";
import Avatar from "./Avatar.jsx";

const KINDS = {
  quien_es_mas: { color: "#3b82f6", icon: Users, label: "¿Quién es más?" },
  que_prefieres: { color: "#10b981", icon: GitCompare, label: "¿Qué prefieres?" },
  personalidad: { color: "#a855f7", icon: UserCircle2, label: "Personalidad" },
  grupal: { color: "#f59e0b", icon: PenLine, label: "Pregunta del grupo" },
};

const OPTION_LETTERS = ["A", "B", "C", "D"];

function Step({ n, label, active, done, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{
          background: done || active ? color : "transparent",
          color: done || active ? "#000" : "#6b7280",
          border: done || active ? "none" : "1px solid #374151",
        }}
      >
        {done ? "✓" : n}
      </span>
      <span className="text-[11px] hidden sm:inline" style={{ color: active ? color : "#6b7280" }}>
        {label}
      </span>
    </div>
  );
}

export default function ModeBCard({ data, groupId, onChanged }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reactions, setReactions] = useState(data.reactions || []);

  // Las reacciones se manejan localmente para que respondan al toque, pero
  // tienen que resincronizarse cuando el padre recarga (polling o voto propio).
  useEffect(() => {
    setReactions(data.reactions || []);
  }, [data.reactions]);

  const kind = KINDS[data.kind];
  const Icon = kind.icon;
  const answered = !!data.my_answer;
  const predicted = !!data.my_prediction;

  const post = async (path, body, onError) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data: res } = await api.post(path, body);
      return res;
    } catch (err) {
      setError(err.response?.data?.error || onError);
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (value) => {
    if (answered) return;
    const res = await post(
      "/mode-b/answer",
      { question_kind: data.kind, question_id: data.id, group_id: groupId, value },
      "No se pudo registrar tu respuesta"
    );
    if (res) onChanged();
  };

  const submitPrediction = async (value) => {
    if (!answered || predicted) return;
    const res = await post(
      "/mode-b/predict",
      { question_kind: data.kind, question_id: data.id, group_id: groupId, value },
      "No se pudo registrar tu predicción"
    );
    if (res) onChanged();
  };

  const toggleReaction = async (emoji) => {
    const res = await post(
      "/mode-b/react",
      { question_kind: data.kind, question_id: data.id, group_id: groupId, emoji },
      "No se pudo reaccionar"
    );
    if (res) setReactions(res.reactions);
  };

  const maxVotes = data.revealed ? Math.max(1, ...data.results.map((r) => r.votes)) : 1;
  const votesFor = (value) => data.results?.find((r) => r.value === value)?.votes ?? 0;

  // Antes de revelar los botones eligen respuesta, después predicción.
  const handleClick = (value) => (answered ? submitPrediction(value) : submitAnswer(value));

  return (
    <div style={{ borderLeft: `4px solid ${kind.color}`, background: `${kind.color}0d`, borderRadius: "8px" }}>
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5"
            style={{ background: `${kind.color}26`, color: kind.color, borderColor: `${kind.color}66` }}
          >
            <Icon size={12} />
            {kind.label}
            {data.kind === "personalidad" && `: ${data.personality}`}
            {data.kind === "grupal" && ` de ${data.author}`}
          </span>

          <div className="flex items-center gap-3">
            <Step n="1" label="Respondé" color={kind.color} active={!answered} done={answered} />
            <Step
              n="2"
              label="Predecí"
              color={kind.color}
              active={answered && !predicted}
              done={predicted}
            />
            <Step n="3" label="Resultados" color={kind.color} active={data.revealed} done={data.revealed} />
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-2">{data.prompt}</h2>

        <p className="text-xs mb-5" style={{ color: answered && !predicted ? kind.color : "#6b7280" }}>
          {!answered && "Elegí tu respuesta."}
          {answered && !predicted && "Ahora adiviná: ¿qué va a votar la mayoría del grupo? (+15 pts si acertás)"}
          {data.revealed && "Resultados del grupo"}
        </p>

        <div className="space-y-2.5">
          {data.options.map((option, idx) => {
            const isMyAnswer = data.my_answer === option.value;
            const isMyPrediction = data.my_prediction === option.value;
            const isWinner = data.revealed && data.winners.includes(option.value);
            const votes = votesFor(option.value);
            const pct = data.revealed ? Math.round((votes / maxVotes) * 100) : 0;
            // Tu voto y (una vez revelado) la opción ganadora se pintan con el
            // color de la card; el resto queda con el borde neutro.
            const highlighted = isMyAnswer || (data.revealed && isWinner);

            return (
              <button
                key={option.value}
                onClick={() => handleClick(option.value)}
                disabled={data.revealed || busy || (answered && predicted)}
                style={
                  highlighted
                    ? { borderColor: `${kind.color}80`, background: `${kind.color}1a` }
                    : undefined
                }
                className={`w-full text-left px-4 py-3 rounded-card border relative overflow-hidden transition-colors flex items-center gap-3 ${
                  highlighted ? "" : "border-border bg-bg"
                } ${data.revealed ? "cursor-default" : "cursor-pointer hover:border-white/30"}`}
              >
                {data.revealed && (
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${pct}%`, background: `${kind.color}1a` }}
                  />
                )}

                {data.kind === "quien_es_mas" ? (
                  <Avatar user={{ ...option, username: option.label }} size={32} className="relative" />
                ) : (
                  <span
                    className="w-8 h-8 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold relative"
                    style={{ borderColor: `${kind.color}66`, color: kind.color, background: `${kind.color}14` }}
                  >
                    {OPTION_LETTERS[idx]}
                  </span>
                )}

                <span className="text-sm flex-1 relative">
                  {option.label}
                  {data.kind === "quien_es_mas" && String(option.value) === String(user?.id) && (
                    <span className="text-gray-500"> (vos)</span>
                  )}
                </span>

                <span className="flex items-center gap-1.5 shrink-0 relative">
                  {isMyAnswer && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: `${kind.color}26`, color: kind.color }}
                    >
                      tu voto
                    </span>
                  )}
                  {isMyPrediction && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-gray-300 flex items-center gap-1">
                      <Target size={9} />
                      predicción
                    </span>
                  )}
                  {data.revealed && (
                    <span className="text-xs font-semibold text-gray-400">{votes}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        {data.revealed && (
          <>
            <div
              className={`mt-5 rounded-card border px-4 py-3 flex items-center gap-2 text-sm ${
                data.prediction_hit
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-white/5 text-gray-400"
              }`}
            >
              {data.prediction_hit ? <Check size={16} /> : <X size={16} />}
              <span className="font-medium">
                {data.prediction_hit
                  ? "Adivinaste lo que votó la mayoría · +15 pts"
                  : "Esta vez no le pegaste a la mayoría"}
              </span>
              <span className="ml-auto text-xs text-gray-500">{data.total_votes} votos</span>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => toggleReaction(r.emoji)}
                  disabled={busy}
                  className={`px-2.5 py-1 rounded-full border text-sm transition-colors flex items-center gap-1.5 ${
                    r.mine
                      ? "border-white/40 bg-white/10"
                      : "border-border bg-bg hover:border-white/30"
                  }`}
                >
                  <span>{r.emoji}</span>
                  {r.count > 0 && <span className="text-xs text-gray-400 font-medium">{r.count}</span>}
                </button>
              ))}
              <span className="text-[11px] text-gray-600 flex items-center gap-1 ml-1">
                <Sparkles size={10} />
                Reaccioná al resultado
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
