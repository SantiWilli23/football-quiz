import { useState } from "react";
import { CheckCircle2, Shield, XCircle } from "lucide-react";
import Card from "./Card.jsx";
import { teams, badgeFor } from "../carrera/data/teams.js";

const POOL = teams.filter((t) => !!badgeFor(t.id));

function newRound() {
  const shuffled = [...POOL].sort(() => Math.random() - 0.5);
  const correct = shuffled[0];
  const options = shuffled.slice(0, 4).sort(() => Math.random() - 0.5);
  return { correct, options };
}

export default function EscudoQuiz() {
  const [round, setRound] = useState(newRound);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  if (POOL.length < 4) return null;

  const handlePick = (teamId) => {
    if (selected) return;
    setSelected(teamId);
    const isCorrect = teamId === round.correct.id;
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
  };

  const handleNext = () => {
    setSelected(null);
    setRound(newRound());
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-gray-400" />
          <h3 className="font-semibold text-sm">Adivina el escudo</h3>
        </div>
        {score.total > 0 && (
          <span className="text-xs text-gray-500">{score.correct}/{score.total} aciertos</span>
        )}
      </div>

      <div className="flex flex-col items-center mb-5">
        <img src={badgeFor(round.correct.id)} alt="" className="w-20 h-20 object-contain" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {round.options.map((t) => {
          const isSelected = selected === t.id;
          const isCorrectOption = selected && t.id === round.correct.id;
          const isWrongSelected = selected && isSelected && !isCorrectOption;

          let cls = "border-border hover:border-white/30 bg-bg";
          if (selected) {
            if (isCorrectOption) cls = "border-accent bg-accent/10";
            else if (isWrongSelected) cls = "border-red-500 bg-red-500/10";
            else cls = "border-border bg-bg opacity-60";
          }

          return (
            <button
              key={t.id}
              disabled={!!selected}
              onClick={() => handlePick(t.id)}
              className={`flex items-center justify-between gap-2 px-3.5 py-3 rounded-card border transition-colors text-left ${cls} ${
                selected ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <span className="text-sm font-medium truncate">{t.name}</span>
              {isCorrectOption && <CheckCircle2 size={16} className="text-accent shrink-0" />}
              {isWrongSelected && <XCircle size={16} className="text-red-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          onClick={handleNext}
          className="mt-5 w-full bg-accent hover:bg-accent-dark transition-colors text-black font-semibold rounded-card py-2.5 text-sm"
        >
          Siguiente escudo
        </button>
      )}
    </Card>
  );
}
