import { useState } from "react";
import Card from "./Card.jsx";

export default function PersonalityCard({ item, onAnswered }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [answered, setAnswered] = useState(false);

  const handleSelect = (index) => {
    if (answered) return;
    setSelectedOption(index);
    setAnswered(true);
    onAnswered && onAnswered({ selected_index: index, selected_text: item.options[index] });
  };

  return (
    <Card>
      <div style={{ borderLeft: "4px solid #a855f7", paddingLeft: "1rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "12px", fontWeight: "600", color: "#a855f7", textTransform: "uppercase" }}>
          👤 Personalidad
        </span>
      </div>

      <h2 style={{ fontSize: "15px", fontWeight: "500", margin: "0.75rem 0" }}>{item.prompt}</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "1rem" }}>
        {item.options.map((option, idx) => (
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
                  ? "rgba(168, 85, 247, 0.1)"
                  : answered
                    ? "var(--surface-1)"
                    : "var(--surface-2)",
              borderColor: selectedOption === idx ? "rgba(168, 85, 247, 0.5)" : "var(--border)",
              borderRadius: "6px",
              cursor: answered ? "default" : "pointer",
              fontSize: "13px",
              color: "var(--text-primary)",
              transition: "all 0.2s",
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {answered && (
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "0.75rem" }}>
          ✓ Respuesta registrada
        </p>
      )}
    </Card>
  );
}
