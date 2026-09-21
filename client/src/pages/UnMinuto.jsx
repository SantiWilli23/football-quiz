import { useCallback, useEffect, useRef, useState } from "react";
import { Timer, Check, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import ResultScreen from "../components/ResultScreen.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import { useGroups } from "../context/GroupContext.jsx";

// Arrancás con 20 segundos: cada acierto suma y cada error resta.
const ROUND_SECONDS = 20;
const BONUS_SECONDS = 3;
const PENALTY_SECONDS = 3;
const MAX_SECONDS = 60;

export default function UnMinuto() {
  const { activeGroupId: groupId } = useGroups();
  const [phase, setPhase] = useState("idle"); // idle | playing | done
  const [question, setQuestion] = useState(null);
  const [seenIds, setSeenIds] = useState([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong"
  const [delta, setDelta] = useState(null); // {n, key}: último ajuste de segundos
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [saveState, setSaveState] = useState(null); // null | "saving" | {improved}
  const timerRef = useRef(null);
  const endedRef = useRef(false);

  const fetchQuestion = useCallback(async (exclude) => {
    setLoadingQuestion(true);
    setFeedback(null);
    try {
      const { data } = await api.get("/un-minuto/question", { params: { exclude: exclude.join(",") } });
      setQuestion(data.question);
    } catch {
      setQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  }, []);

  const finish = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearInterval(timerRef.current);
    setPhase("done");
    if (!groupId) return;
    setSaveState("saving");
    try {
      const { data } = await api.post("/challenges/submit", {
        gameKey: "un_minuto",
        groupId,
        score: correctCount,
      });
      setSaveState({ improved: data.improved });
    } catch {
      setSaveState(null);
    }
  }, [groupId, correctCount]);

  function start() {
    endedRef.current = false;
    setPhase("playing");
    setCorrectCount(0);
    setAnsweredCount(0);
    setSeenIds([]);
    setSecondsLeft(ROUND_SECONDS);
    setDelta(null);
    setSaveState(null);
    fetchQuestion([]);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (phase === "playing" && secondsLeft <= 0) finish();
  }, [phase, secondsLeft, finish]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  async function answer(letter) {
    if (!question || feedback) return;
    try {
      const { data } = await api.post("/un-minuto/answer", { questionId: question.id, answer: letter });
      setFeedback(data.correct ? "correct" : "wrong");
      setAnsweredCount((c) => c + 1);
      if (data.correct) setCorrectCount((c) => c + 1);
      const change = data.correct ? BONUS_SECONDS : -PENALTY_SECONDS;
      setDelta({ n: change, key: Date.now() });
      setSecondsLeft((s) => Math.max(0, Math.min(MAX_SECONDS, s + change)));
      const nextSeen = [...seenIds, question.id];
      setSeenIds(nextSeen);
      setTimeout(() => {
        if (!endedRef.current) fetchQuestion(nextSeen);
      }, 350);
    } catch {
      // ignora un fallo de red puntual, el usuario puede reintentar la misma pregunta
    }
  }

  return (
    <Layout focus={phase === "playing"}>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Un Minuto</h1>
      <p className="text-gray-400 text-sm mb-4">
        Arrancás con {ROUND_SECONDS} segundos: cada acierto suma {BONUS_SECONDS}s y cada error resta {PENALTY_SECONDS}s. Cuando el reloj llega a cero, se acabó. Tu mejor marca de la semana suma al ranking de retos del grupo.
      </p>

      <GroupSelector />

      {phase === "idle" && (
        <Card className="mt-4 text-center py-10">
          <Timer size={32} className="mx-auto text-accent mb-3" />
          <p className="text-sm text-gray-400 mb-5">Arrancás ya, sin vueltas: preguntas de a una hasta que se acabe el reloj.</p>
          <button
            onClick={start}
            className="px-6 py-2.5 rounded-card bg-accent text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Arrancar
          </button>
        </Card>
      )}

      {phase === "playing" && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-2xl font-bold tabular-nums ${secondsLeft <= 10 ? "text-red-400" : ""}`}>
              {secondsLeft}s
              {delta && (
                <span key={delta.key} className={`ml-2 text-sm font-semibold animate-result-pop ${delta.n > 0 ? "text-emerald" : "text-red-400"}`}>
                  {delta.n > 0 ? "+" : ""}{delta.n}s
                </span>
              )}
            </span>
            <span className="text-sm text-gray-400">
              {correctCount} / {answeredCount} correctas
            </span>
          </div>

          <div className="h-3 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={MAX_SECONDS} aria-valuenow={secondsLeft} aria-label="Tiempo restante">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ease-out ${secondsLeft <= 5 ? "bg-bad" : "bg-accent"}`}
              style={{ width: `${Math.min(100, (secondsLeft / 40) * 100)}%` }}
            />
          </div>

          {loadingQuestion && !question && <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>}

          {question && (
            <Card>
              <p className="font-medium mb-4">{question.question}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {["a", "b", "c", "d"].map((letter) => (
                  <button
                    key={letter}
                    onClick={() => answer(letter)}
                    disabled={!!feedback}
                    className="text-left px-3 py-2.5 rounded-card border border-border text-sm hover:border-accent/40 hover:bg-accent/5 disabled:opacity-60 transition-colors"
                  >
                    {question[`option_${letter}`]}
                  </button>
                ))}
              </div>
              {feedback && (
                <p className={`mt-3 text-sm font-medium flex items-center gap-1.5 ${feedback === "correct" ? "text-emerald" : "text-red-400"}`}>
                  {feedback === "correct" ? <Check size={15} /> : <X size={15} />}
                  {feedback === "correct" ? "¡Bien!" : "Fallaste"}
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      {phase === "done" && (
        <ResultScreen
          score={correctCount}
          unit={`aciertos en ${ROUND_SECONDS} segundos`}
          groupId={groupId}
          saveState={saveState}
          onAgain={start}
          shareText={`⚽ Futotal · Un Minuto: ${correctCount} aciertos en ${ROUND_SECONDS}s — ¿me ganás?`}
        />
      )}
    </Layout>
  );
}
