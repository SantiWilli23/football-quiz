import { useState } from "react";
import { GitCompare } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";

export default function QuePrefieresCard({ data, groupId, onVoted }) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  const handleVote = async (choice) => {
    if (data.my_answer || voting) return;
    setVoting(true);
    setError("");
    try {
      await api.post(`/mode-b/special/${data.id}/answer`, {
        group_id: groupId,
        answer_value: choice,
      });
      onVoted();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el voto");
    } finally {
      setVoting(false);
    }
  };

  const voted = !!data.my_answer;
  const total = Math.max(1, data.votes_a + data.votes_b);
  const pctA = Math.round((data.votes_a / total) * 100);
  const pctB = Math.round((data.votes_b / total) * 100);

  const options = [
    { key: "a", label: data.option_a, votes: data.votes_a, pct: pctA },
    { key: "b", label: data.option_b, votes: data.votes_b, pct: pctB },
  ];

  return (
    <div style={{ borderLeft: "4px solid #10b981", background: "rgba(16,185,129,0.05)", borderRadius: "8px" }}>
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <GitCompare size={12} />
            ¿Qué prefieres?
          </span>
        </div>

        <div className="space-y-2.5">
          {options.map((o) => {
            const isMyVote = voted && data.my_answer === o.key;
            return (
              <button
                key={o.key}
                onClick={() => handleVote(o.key)}
                disabled={voted || voting}
                className={`w-full text-left px-4 py-3.5 rounded-card border relative overflow-hidden transition-colors flex items-center gap-3 ${
                  isMyVote ? "border-emerald-500/50 bg-emerald-500/10" : "border-border bg-bg"
                } ${voted ? "cursor-default" : "hover:border-white/30 cursor-pointer"}`}
              >
                {voted && (
                  <div className="absolute inset-y-0 left-0 bg-emerald-500/10" style={{ width: `${o.pct}%` }} />
                )}
                <span className="text-sm flex-1 font-medium relative">{o.label}</span>
                {voted && (
                  <span className="text-xs font-semibold text-gray-400 relative shrink-0">
                    {o.pct}% ({o.votes})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        {!voted && <p className="text-xs text-gray-500 mt-4">Elegí una opción. Solo se puede votar una vez.</p>}
      </Card>
    </div>
  );
}
