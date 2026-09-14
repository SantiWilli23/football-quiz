import { useState } from "react";
import { Trophy, Eye } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { teams, badgeFor } from "../carrera/data/teams.js";

const ROUNDS = 10;
const BLUR_STEPS = [14, 9, 5, 2]; // se va destapando con cada pista, si el usuario la pide

// Solo clubes con escudo real cargado (ver CLUB_LOGOS en carrera/data/teams.js)
// — ya están en el bundle porque los usa Carrera DT, así que este modo no
// necesita ningún asset nuevo.
const POOL = teams.filter((t) => badgeFor(t.id));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRounds() {
  const chosen = shuffle(POOL).slice(0, ROUNDS);
  return chosen.map((team) => {
    const sameLeague = POOL.filter((t) => t.league === team.league && t.id !== team.id);
    const decoys = shuffle(sameLeague.length >= 3 ? sameLeague : POOL.filter((t) => t.id !== team.id)).slice(0, 3);
    return { team, options: shuffle([team, ...decoys]) };
  });
}

export default function CrestQuiz() {
  const { activeGroupId: groupId } = useGroups();
  const [phase, setPhase] = useState("idle"); // idle | playing | done
  const [rounds, setRounds] = useState([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [blurLevel, setBlurLevel] = useState(0);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong"
  const [saveState, setSaveState] = useState(null);

  const current = rounds[index];
  const blur = BLUR_STEPS[Math.min(blurLevel, BLUR_STEPS.length - 1)];

  function start() {
    setRounds(buildRounds());
    setIndex(0);
    setCorrectCount(0);
    setBlurLevel(0);
    setFeedback(null);
    setSaveState(null);
    setPhase("playing");
  }

  function revealMore() {
    setBlurLevel((b) => Math.min(b + 1, BLUR_STEPS.length - 1));
  }

  async function answer(teamId) {
    if (feedback) return;
    const correct = teamId === current.team.id;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) setCorrectCount((c) => c + 1);

    setTimeout(async () => {
      if (index + 1 < rounds.length) {
        setIndex((i) => i + 1);
        setBlurLevel(0);
        setFeedback(null);
      } else {
        setPhase("done");
        if (groupId) {
          setSaveState("saving");
          try {
            const finalCorrect = correct ? correctCount + 1 : correctCount;
            const { data } = await api.post("/challenges/submit", { gameKey: "escudos", groupId, score: finalCorrect });
            setSaveState({ improved: data.improved });
          } catch {
            setSaveState(null);
          }
        }
      }
    }, 700);
  }

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Escudos borrosos</h1>
      <p className="text-gray-400 text-sm mb-4">
        {ROUNDS} escudos reales, cada vez más nítidos si pedís una pista. Tu mejor marca de la semana suma al ranking de retos del grupo.
      </p>

      <GroupSelector />

      {phase === "idle" && (
        <Card className="mt-4 text-center py-10">
          <Trophy size={32} className="mx-auto text-accent mb-3" />
          <p className="text-sm text-gray-400 mb-5">¿Cuántos clubes reconocés solo por el escudo, bien borroso?</p>
          <button
            onClick={start}
            className="px-6 py-2.5 rounded-card bg-accent text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Arrancar
          </button>
        </Card>
      )}

      {phase === "playing" && current && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Escudo {index + 1} / {rounds.length}</span>
            <span className="text-gray-400">{correctCount} correctas</span>
          </div>

          <Card>
            <div className="flex flex-col items-center gap-4">
              <img
                src={badgeFor(current.team.id)}
                alt="Escudo a adivinar"
                className="w-32 h-32 object-contain transition-[filter]"
                style={{ filter: `blur(${blur}px)` }}
              />

              {!feedback && blurLevel < BLUR_STEPS.length - 1 && (
                <button
                  onClick={revealMore}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <Eye size={13} /> Pista (menos borroso)
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {current.options.map((opt) => {
                  const isCorrectOpt = feedback && opt.id === current.team.id;
                  const isWrongPick = feedback === "wrong" && opt.id === current.team.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => answer(opt.id)}
                      disabled={!!feedback}
                      className={`text-left px-3 py-2.5 rounded-card border text-sm transition-colors disabled:opacity-70 ${
                        isCorrectOpt
                          ? "border-emerald/50 bg-emerald/10 text-emerald"
                          : "border-border hover:border-accent/40 hover:bg-accent/5"
                      } ${isWrongPick ? "border-emerald/50 bg-emerald/10 text-emerald" : ""}`}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>

              {feedback && (
                <p className={`text-sm font-medium ${feedback === "correct" ? "text-emerald" : "text-red-400"}`}>
                  {feedback === "correct" ? "¡Bien!" : `Era ${current.team.name}`}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {phase === "done" && (
        <Card className="mt-4 text-center py-10">
          <Trophy size={32} className="mx-auto text-accent mb-3" />
          <p className="text-3xl font-bold mb-1">{correctCount} / {ROUNDS}</p>
          <p className="text-sm text-gray-400 mb-5">escudos acertados</p>
          {!groupId && <p className="text-xs text-gray-500 mb-5">Unite a un grupo para que tu marca cuente en un ranking.</p>}
          {saveState === "saving" && <p className="text-xs text-gray-500 mb-5">Guardando marca...</p>}
          {saveState && saveState !== "saving" && (
            <p className="text-xs text-accent mb-5">
              {saveState.improved ? "Nueva mejor marca de la semana" : "Guardado (no superó tu mejor marca de esta semana)"}
            </p>
          )}
          <button
            onClick={start}
            className="px-6 py-2.5 rounded-card bg-accent text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Jugar de nuevo
          </button>
        </Card>
      )}
    </Layout>
  );
}
