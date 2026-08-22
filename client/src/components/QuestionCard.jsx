import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";

const OPTION_LABELS = { a: "A", b: "B", c: "C", d: "D" };
const SLOT_COLORS = {
  1: { border: "#3b82f6", bg: "rgba(59,130,246,0.05)", label: "🌍 General" },
  2: { border: "#10b981", bg: "rgba(16,185,129,0.05)", label: "🇨🇱 Liga Chilena" },
  3: { border: "#f59e0b", bg: "rgba(245,158,11,0.05)", label: "⚽ Europa" },
};

export default function QuestionCard({ item, index, total, onAnswered }) {
  const { question } = item;
  const [selected, setSelected] = useState(item.answered ? item.result.answer : null);
  const [result, setResult] = useState(item.answered ? item.result : null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slotColor = SLOT_COLORS[question.slot] || SLOT_COLORS[1];

  const options = [
    ["a", question.option_a],
    ["b", question.option_b],
    ["c", question.option_c],
    ["d", question.option_d],
  ];

  const handleAnswer = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const { data: res } = await api.post(`/questions/${question.id}/answer`, {
        answer: selected,
      });
      setResult(res);
      onAnswered(res);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo enviar la respuesta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ borderLeft: `4px solid ${slotColor.border}`, background: slotColor.bg, borderRadius: "8px" }}>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full border"
            style={{
              background: `${slotColor.border}20`,
              color: slotColor.border,
              borderColor: `${slotColor.border}40`,
            }}
          >
            {slotColor.label}
          </span>
          <span className="text-xs font-medium text-gray-400">
            {index + 1} de {total}
          </span>
        </div>

      <h2 className="text-xl font-semibold mb-6">{question.question}</h2>

      <div className="space-y-3">
        {options.map(([key, text]) => {
          const isSelected = selected === key;
          const isCorrectOption = result && key === result.correct_answer;
          const isWrongSelected = result && isSelected && !result.is_correct;

          let optionClass = "border-border hover:border-white/30 bg-bg";
          if (result) {
            if (isCorrectOption) optionClass = "border-accent bg-accent/10";
            else if (isWrongSelected) optionClass = "border-red-500 bg-red-500/10";
            else optionClass = "border-border bg-bg opacity-60";
          } else if (isSelected) {
            optionClass = "border-accent bg-accent/10";
          }

          return (
            <button
              key={key}
              disabled={!!result}
              onClick={() => setSelected(key)}
              className={`w-full text-left px-4 py-3.5 rounded-card border transition-colors flex items-center gap-3 ${optionClass} ${
                result ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <span className="w-7 h-7 shrink-0 rounded-full border border-current/40 flex items-center justify-center text-xs font-semibold">
                {OPTION_LABELS[key]}
              </span>
              <span className="text-sm flex-1">{text}</span>
              {result && isCorrectOption && <CheckCircle2 size={18} className="text-accent shrink-0" />}
              {result && isWrongSelected && <XCircle size={18} className="text-red-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

      {!result && (
        <button
          onClick={handleAnswer}
          disabled={!selected || submitting}
          className="mt-6 w-full bg-accent hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-black font-semibold rounded-card py-3 text-sm"
        >
          {submitting ? "Enviando..." : "Responder"}
        </button>
      )}

      {result && (
        <div
          className={`mt-6 rounded-card border px-4 py-3.5 flex items-center justify-between ${
            result.is_correct
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-red-500/40 bg-red-500/10 text-red-400"
          }`}
        >
          <span className="text-sm font-medium">{result.is_correct ? "¡Correcto!" : "Incorrecto"}</span>
          <span className="text-sm font-semibold">
            {result.is_correct ? `+${result.points} puntos` : "+0 puntos"}
          </span>
        </div>
      )}
      </Card>
    </div>
  );
}
