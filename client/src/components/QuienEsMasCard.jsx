import { useState } from "react";
import { Users } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Card from "./Card.jsx";

export default function QuienEsMasCard({ data, groupId, onVoted }) {
  const { user } = useAuth();
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  const handleVote = async (candidateId) => {
    if (data.my_answer || voting) return;
    setVoting(true);
    setError("");
    try {
      await api.post(`/mode-b/special/${data.id}/answer`, {
        group_id: groupId,
        answer_value: candidateId,
      });
      onVoted();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el voto");
    } finally {
      setVoting(false);
    }
  };

  const voted = !!data.my_answer;
  const maxVotes = Math.max(1, ...data.results.map((r) => r.votes));

  return (
    <div style={{ borderLeft: "4px solid #3b82f6", background: "rgba(59,130,246,0.05)", borderRadius: "8px" }}>
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
            <Users size={12} />
            ¿Quién es más?
          </span>
        </div>

        <h2 className="text-xl font-semibold mb-6">{data.prompt}</h2>

        <div className="space-y-2.5">
          {data.candidates.map((c) => {
            const result = data.results.find((r) => r.user_id === c.id);
            const votes = result?.votes ?? 0;
            const isMyVote = voted && String(data.my_answer) === String(c.id);
            const pct = voted ? Math.round((votes / maxVotes) * 100) : 0;

            return (
              <button
                key={c.id}
                onClick={() => handleVote(c.id)}
                disabled={voted || voting}
                className={`w-full text-left px-4 py-3 rounded-card border relative overflow-hidden transition-colors flex items-center gap-3 ${
                  isMyVote ? "border-blue-500/50 bg-blue-500/10" : "border-border bg-bg"
                } ${voted ? "cursor-default" : "hover:border-white/30 cursor-pointer"}`}
              >
                {voted && (
                  <div className="absolute inset-y-0 left-0 bg-blue-500/10" style={{ width: `${pct}%` }} />
                )}
                <span className="w-8 h-8 shrink-0 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-semibold relative">
                  {c.avatar || c.username.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm flex-1 relative">
                  {c.username}
                  {c.id === user?.id && <span className="text-gray-500"> (vos)</span>}
                </span>
                {voted && <span className="text-xs font-semibold text-gray-400 relative shrink-0">{votes} votos</span>}
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        {!voted && (
          <p className="text-xs text-gray-500 mt-4">Tocá un nombre para votar. Solo se puede votar una vez.</p>
        )}
      </Card>
    </div>
  );
}
