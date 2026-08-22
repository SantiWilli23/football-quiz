import { useState } from "react";
import { Sparkles } from "lucide-react";
import Card from "./Card.jsx";

export default function SpecialQuestionCard({ item, onAnswered }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [answered, setAnswered] = useState(false);

  const handleSelect = (idx) => {
    if (answered) return;
    setSelectedOption(idx);
    setAnswered(true);
    onAnswered && onAnswered({ selected_index: idx });
  };

  const getLabel = () => {
    if (item.type === "quien_es_mas") return "¿Quién es más?";
    if (item.type === "que_prefieres") return "¿Qué prefieres?";
    return "Pregunta especial";
  };

  const getColor = () => {
    if (item.type === "quien_es_mas") return "#3b82f6";
    if (item.type === "que_prefieres") return "#10b981";
    return "#f59e0b";
  };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1rem" }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: getColor(),
            background: `${getColor()}20`,
            padding: "6px 12px",
            borderRadius: "6px",
            border: `1px solid ${getColor()}40`,
            textTransform: "uppercase",
          }}
        >
          {getLabel()}
        </span>
      </div>

      <h2 style={{ fontSize: "15px", fontWeight: "500", margin: "0.75rem 0" }}>{item.prompt}</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "1rem" }}>
        {item.candidates || item.options
          ? (item.candidates || item.options).map((option, idx) => {
              const label = item.candidates ? option.username : option;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={answered}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    border: `0.5px solid var(--border)`,
                    background:
                      selectedOption === idx
                        ? `${getColor()}15`
                        : answered
                          ? "var(--surface-1)"
                          : "var(--surface-2)",
                    borderColor: selectedOption === idx ? `${getColor()}50` : "var(--border)",
                    borderRadius: "6px",
                    cursor: answered ? "default" : "pointer",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    transition: "all 0.2s",
                  }}
                >
                  {label}
                </button>
              );
            })
          : null}
      </div>

      {answered && (
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "0.75rem" }}>
          ✓ Respuesta registrada
        </p>
      )}
    </Card>
  );
}
