import { useState } from "react";
import { UserCircle2 } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";

const OPTION_LABELS = { a: "A", b: "B", c: "C", d: "D" };

export default function PersonalityCard({ data, groupId, onVoted }) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  const handleVote = async (key) => {
    if (data.my_answer || voting) return;
    setVoting(true);
    setError("");
    try {
      await api.post(`/mode-b/personality/${data.id}/answer`, {
        group_id: groupId,
        answer: key,
      });
      onVoted();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar la respuesta");
    } finally {
      setVoting(false);
    }
  };

  const voted = !!data.my_answer;
  const maxVotes = Math.max(1, ...data.results.map((r) => r.votes));
  const options = [
    ["a", data.options[0]],
    ["b", data.options[1]],
    ["c", data.options[2]],
    ["d", data.options[3]],
  ];

  return (
    <div style={{ borderLeft: "4px solid #a855f7", background: "rgba(168,85,247,0.05)", borderRadius: "8px" }}>
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1.5">
            <UserCircle2 size={12} />
            Personalidad: {data.personality}
          </span>
        </div>

        <h2 className="text-xl font-semibold mb-6">{data.prompt}</h2>

        <div className="space-y-2.5">
          {options.map(([key, text]) => {
            const result = data.results.find((r) => r.option === key);
            const votes = result?.votes ?? 0;
            const isMyVote = voted && data.my_answer === key;
            const pct = voted ? Math.round((votes / maxVotes) * 100) : 0;

            return (
              <button
                key={key}
                onClick={() => handleVote(key)}
                disabled={voted || voting}
                className={`w-full text-left px-4 py-3.5 rounded-card border relative overflow-hidden transition-colors flex items-center gap-3 ${
                  isMyVote ? "border-purple-500/50 bg-purple-500/10" : "border-border bg-bg"
                } ${voted ? "cursor-default" : "hover:border-white/30 cursor-pointer"}`}
              >
                {voted && (
                  <div className="absolute inset-y-0 left-0 bg-purple-500/10" style={{ width: `${pct}%` }} />
                )}
                <span className="w-7 h-7 shrink-0 rounded-full border border-purple-500/40 text-purple-400 flex items-center justify-center text-xs font-semibold relative">
                  {OPTION_LABELS[key]}
                </span>
                <span className="text-sm flex-1 relative">{text}</span>
                {voted && <span className="text-xs font-semibold text-gray-400 relative shrink-0">{votes} votos</span>}
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
