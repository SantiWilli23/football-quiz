import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Card from "./Card.jsx";

export default function BonusCard({ groupId }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/bonus/today", { params: { groupId } });
      setData(data);
    } catch {
      setData(null);
    }
  };

  useEffect(() => {
    if (groupId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Refresca los votos del resto del grupo sin recargar la página. Se pausa
  // mientras la pestaña está en segundo plano.
  useEffect(() => {
    if (!groupId) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const handleVote = async (candidateId) => {
    if (!data || data.voted || voting) return;
    setVoting(true);
    setError("");
    try {
      await api.post(`/bonus/${data.bonus_question.id}/vote`, {
        group_id: groupId,
        voted_for_id: candidateId,
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el voto");
    } finally {
      setVoting(false);
    }
  };

  if (!groupId || !data) return null;

  const maxVotes = Math.max(1, ...data.results.map((r) => r.votes));

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center gap-1.5">
          <Sparkles size={12} />
          Pregunta bonus
        </span>
      </div>

      <h2 className="text-xl font-semibold mb-6">{data.bonus_question.prompt}</h2>

      <div className="space-y-2.5">
        {data.candidates.map((c) => {
          const result = data.results.find((r) => r.user_id === c.id);
          const votes = result?.votes ?? 0;
          const isMyVote = data.my_vote === c.id;
          const pct = data.voted ? Math.round((votes / maxVotes) * 100) : 0;

          return (
            <button
              key={c.id}
              onClick={() => handleVote(c.id)}
              disabled={data.voted || voting}
              className={`w-full text-left px-4 py-3 rounded-card border relative overflow-hidden transition-colors flex items-center gap-3 ${
                isMyVote ? "border-orange-500/50 bg-orange-500/10" : "border-border bg-bg"
              } ${data.voted ? "cursor-default" : "hover:border-white/30 cursor-pointer"}`}
            >
              {data.voted && (
                <div
                  className="absolute inset-y-0 left-0 bg-orange-500/10"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="w-8 h-8 shrink-0 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-xs font-semibold relative">
                {c.avatar || c.username.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm flex-1 relative">
                {c.username}
                {c.id === user?.id && <span className="text-gray-500"> (vos)</span>}
              </span>
              {data.voted && (
                <span className="text-xs font-semibold text-gray-400 relative shrink-0">{votes} votos</span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

      {!data.voted && (
        <p className="text-xs text-gray-500 mt-4">Tocá un nombre para votar. Solo se puede votar una vez.</p>
      )}
    </Card>
  );
}
