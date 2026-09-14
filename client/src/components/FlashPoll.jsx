import { useCallback, useEffect, useState } from "react";
import { Zap, X } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function FlashPoll({ groupId }) {
  const { user } = useAuth();
  const [poll, setPoll] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data } = await api.get("/polls/active", { params: { groupId } });
      setPoll(data.poll);
      setMyChoice(data.myChoice ?? null);
    } catch {
      setPoll(null);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitPoll(e) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/polls", { groupId, question, optionA, optionB });
      setPoll(data.poll);
      setMyChoice(null);
      setCreating(false);
      setQuestion("");
      setOptionA("");
      setOptionB("");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la encuesta");
    }
  }

  async function vote(choice) {
    try {
      const { data } = await api.post(`/polls/${poll.id}/vote`, { choice });
      setPoll(data.poll);
      setMyChoice(data.myChoice);
    } catch {
      // ignora un fallo puntual, el usuario puede reintentar
    }
  }

  async function close() {
    try {
      await api.post(`/polls/${poll.id}/close`);
      setPoll(null);
      setMyChoice(null);
    } catch {
      // ignora
    }
  }

  const total = poll ? poll.votes_a + poll.votes_b : 0;
  const pctA = total > 0 ? Math.round((poll.votes_a / total) * 100) : 0;
  const pctB = total > 0 ? Math.round((poll.votes_b / total) * 100) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-accent" />
          <h3 className="font-semibold">Encuesta relámpago</h3>
        </div>
        {!poll && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
          >
            Lanzar una
          </button>
        )}
      </div>

      {!poll && !creating && (
        <p className="text-sm text-gray-500">Nadie lanzó una encuesta todavía. Tirá una pregunta rápida al grupo.</p>
      )}

      {creating && (
        <form onSubmit={submitPoll} className="space-y-2.5">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Tu pregunta..."
            maxLength={140}
            className="w-full bg-bg border border-border rounded-card px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <input
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              placeholder="Opción A"
              maxLength={40}
              className="flex-1 bg-bg border border-border rounded-card px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <input
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              placeholder="Opción B"
              maxLength={40}
              className="flex-1 bg-bg border border-border rounded-card px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!question.trim() || !optionA.trim() || !optionB.trim()}
              className="text-xs font-medium px-4 py-2 rounded-card bg-accent text-bg disabled:opacity-40 transition-opacity"
            >
              Publicar
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-xs text-gray-500 hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {poll && (
        <div>
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-sm font-medium">{poll.question}</p>
            {poll.created_by === user?.id && (
              <button onClick={close} title="Cerrar encuesta" className="text-gray-500 hover:text-red-400 shrink-0">
                <X size={15} />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {[["a", poll.option_a, pctA, poll.votes_a], ["b", poll.option_b, pctB, poll.votes_b]].map(([choice, label, pct, count]) => (
              <button
                key={choice}
                onClick={() => vote(choice)}
                className={`w-full text-left px-3 py-2.5 rounded-card border relative overflow-hidden transition-colors ${
                  myChoice === choice ? "border-accent/50" : "border-border hover:border-white/30"
                }`}
              >
                <div className="absolute inset-y-0 left-0 bg-accent/10" style={{ width: `${pct}%` }} />
                <div className="relative flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <span className="text-xs text-gray-400">{pct}% ({count})</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
