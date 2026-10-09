import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Timer, Check, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import ResultScreen from "../components/ResultScreen.jsx";
import { logGame } from "../utils/logGame.js";
import GroupSelector from "../components/GroupSelector.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { playSfx } from "../utils/sfx.js";
import { submitDaily, dailyMessage } from "../utils/dailyGames.js";

// Juego diario: cuenta en la dificultad media (Ultra difícil) y una partida de
// ~30 puntos (ya con el multiplicador) se lleva el máximo del día.
const DAILY_DIFFICULTY = "ultra";
const DAILY_TARGET = 30;

// Arrancás con 20 segundos: cada acierto suma y cada error resta.
const ROUND_SECONDS = 20;
const BONUS_SECONDS = 3;
const PENALTY_SECONDS = 3;
const MAX_SECONDS = 60;
// Cada 5 aciertos seguidos, el 5.º, 10.º, 15.º... vale un punto extra.
const STREAK_STEP = 5;
// Dificultad adaptativa: 3 aciertos seguidos suben un nivel, 2 errores seguidos bajan uno.
const LEVELS = ["dificil", "ultra", "demonio"];
const LEVEL_MULT = { dificil: 1, ultra: 1.5, demonio: 2 };
const UP_AFTER = 3;
const DOWN_AFTER = 2;
const CATEGORY_LABELS = { todas: "Todas", mundiales: "Mundiales", champions: "Champions" };

export default function UnMinuto() {
  // Entrando por el juego diario (?diario=1) solo está la versión diaria: Ultra difícil, todas las categorías.
  const fromDaily = useSearchParams()[0].get("diario") === "1";
  const { activeGroupId: groupId } = useGroups();
  const [difficulties, setDifficulties] = useState([]);
  const [difficulty, setDifficulty] = useState(DAILY_DIFFICULTY);
  const [dailyMsg, setDailyMsg] = useState("");
  const [category, setCategory] = useState("todas");
  const [level, setLevel] = useState(1); // nivel actual en el modo adaptativo (arranca en Ultra)
  const [wrongStreak, setWrongStreak] = useState(0);
  const [weighted, setWeighted] = useState(0); // puntos ya multiplicados por el nivel de cada pregunta
  const [fiftyUsed, setFiftyUsed] = useState(false);
  const [hidden, setHidden] = useState([]); // opciones ocultas por el 50/50 en la pregunta actual
  const adaptive = difficulty === "adaptativo";
  useEffect(() => { api.get("/un-minuto/difficulties").then((r) => setDifficulties(r.data.difficulties)).catch(() => {}); }, []);
  const multiplier = adaptive ? LEVEL_MULT[LEVELS[level]] : difficulties.find((d) => d.id === difficulty)?.multiplier ?? 1;
  const [phase, setPhase] = useState("idle"); // idle | playing | done
  const [question, setQuestion] = useState(null);
  const [seenIds, setSeenIds] = useState([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong"
  const [delta, setDelta] = useState(null); // {n, key}: último ajuste de segundos
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [saveState, setSaveState] = useState(null); // null | "saving" | {improved}
  const timerRef = useRef(null);
  const endedRef = useRef(false);

  const fetchQuestion = useCallback(async (exclude, diff) => {
    setLoadingQuestion(true);
    setFeedback(null);
    setHidden([]);
    try {
      const { data } = await api.get("/un-minuto/question", { params: { exclude: exclude.join(","), difficulty: diff || (difficulty === "adaptativo" ? "ultra" : difficulty), category: category === "todas" ? undefined : category, mode: fromDaily ? "daily" : "fun" } });
      setQuestion(data.question);
    } catch {
      setQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  }, [difficulty, category, fromDaily]);

  const finish = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearInterval(timerRef.current);
    setPhase("done");
    const finalScore = Math.round(weighted);
    // Rendimiento: precisión, pero solo vale entero si contestaste bastantes (12+).
    logGame("un_minuto", { dificil: 3, ultra: 4, demonio: 5, adaptativo: 4 }[difficulty] || 3, answeredCount ? (correctCount / answeredCount) * Math.min(1, correctCount / 12) : 0, correctCount + " aciertos de " + answeredCount);
    // Solo el juego diario suma al grupo: la partida de diversión no manda nada.
    if (fromDaily) {
      submitDaily("un_minuto", finalScore / DAILY_TARGET, finalScore, { mode: "daily" }).then((r) => setDailyMsg(dailyMessage(r)));
    } else {
      // Diversión: sobre según el rendimiento y la dificultad, pero nunca puntos para el grupo.
      submitDaily("un_minuto", Math.min(1, finalScore / DAILY_TARGET), finalScore, { mode: "fun", level: { dificil: "facil", ultra: "normal", demonio: "demonio" }[difficulty] || "normal", seconds: 60 })
        .then((r) => setDailyMsg(dailyMessage(r) || "Partida de diversión: no suma puntos al grupo."));
      return;
    }
    if (!groupId) return;
    setSaveState("saving");
    try {
      const { data } = await api.post("/challenges/submit", {
        gameKey: "un_minuto",
        groupId,
        score: Math.round(weighted),
      });
      setSaveState({ improved: data.improved });
    } catch {
      setSaveState(null);
    }
  }, [groupId, weighted, difficulty, fromDaily, correctCount, answeredCount]);

  function start() {
    endedRef.current = false;
    setDailyMsg("");
    setPhase("playing");
    setCorrectCount(0);
    setPoints(0);
    setWeighted(0);
    setLevel(1);
    setWrongStreak(0);
    setFiftyUsed(false);
    setHidden([]);
    setStreak(0);
    setAnsweredCount(0);
    setSeenIds([]);
    setSecondsLeft(ROUND_SECONDS);
    setDelta(null);
    setSaveState(null);
    fetchQuestion([], adaptive ? "ultra" : undefined);
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

  // Comodín 50/50: una vez por partida, saca dos opciones incorrectas.
  async function useFifty() {
    if (!question || feedback || fiftyUsed) return;
    try {
      const { data } = await api.post("/un-minuto/fifty", { questionId: question.id });
      setHidden(data.remove || []);
      setFiftyUsed(true);
    } catch { /* si falla, no se gasta el comodín */ }
  }

  async function answer(letter) {
    if (!question || feedback) return;
    try {
      const { data } = await api.post("/un-minuto/answer", { questionId: question.id, answer: letter });
      setFeedback(data.correct ? "correct" : "wrong");
      setAnsweredCount((c) => c + 1);
      let nextLevel = level;
      if (data.correct) {
        const nextStreak = streak + 1;
        const bonus = nextStreak % STREAK_STEP === 0;
        setStreak(nextStreak);
        setCorrectCount((c) => c + 1);
        setPoints((p) => p + (1 + (bonus ? 1 : 0)));
        setWeighted((w) => w + (1 + (bonus ? 1 : 0)) * multiplier);
        setWrongStreak(0);
        if (adaptive && nextStreak % UP_AFTER === 0) nextLevel = Math.min(LEVELS.length - 1, level + 1);
        playSfx(bonus ? "win" : "ok");
      } else {
        setStreak(0);
        const nextWrong = wrongStreak + 1;
        if (adaptive && nextWrong >= DOWN_AFTER) { nextLevel = Math.max(0, level - 1); setWrongStreak(0); } else setWrongStreak(nextWrong);
        playSfx("bad");
      }
      if (nextLevel !== level) setLevel(nextLevel);
      const change = data.correct ? BONUS_SECONDS : -PENALTY_SECONDS;
      setDelta({ n: change, key: Date.now() });
      setSecondsLeft((s) => Math.max(0, Math.min(MAX_SECONDS, s + change)));
      const nextSeen = [...seenIds, question.id];
      setSeenIds(nextSeen);
      setTimeout(() => {
        if (!endedRef.current) fetchQuestion(nextSeen, adaptive ? LEVELS[nextLevel] : undefined);
      }, 350);
    } catch {
      // ignora un fallo de red puntual, el usuario puede reintentar la misma pregunta
    }
  }

  return (
    <Layout focus={phase === "playing"}>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Un Minuto</h1>
      <p className="text-gray-400 text-sm mb-4">
        Arrancás con {ROUND_SECONDS} segundos: cada acierto suma {BONUS_SECONDS}s y cada error resta {PENALTY_SECONDS}s. Cada {STREAK_STEP} aciertos seguidos ganás un punto extra. Cuando el reloj llega a cero, se acabó. Tu mejor marca de la semana suma al ranking de retos del grupo.
      </p>

      <GroupSelector />

      {phase === "idle" && (
        <Card className="mt-4 text-center py-10">
          <Timer size={32} className="mx-auto text-accent mb-3" />
          <p className="text-sm text-gray-400 mb-2">Arrancás ya, sin vueltas: preguntas de a una hasta que se acabe el reloj.</p>
          <p className="text-xs text-gray-500 mb-5">Juego diario: la primera partida del día en Difícil te da un puntaje de hasta 20 (de referencia) y un sobre de cartas; el podio del día del grupo suma 5 / 3 / 1 puntos.</p>
          {!fromDaily && <div className="flex gap-1.5 justify-center mb-3 flex-wrap" role="group" aria-label="Categoría">
            {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                aria-pressed={category === id}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${category === id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>}
          {!fromDaily && difficulties.length > 0 && (
            <div className="flex gap-2 justify-center mb-6 flex-wrap">
              {difficulties.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  aria-pressed={difficulty === d.id}
                  className={`px-3 py-2 rounded-card text-sm font-medium border transition-colors ${
                    difficulty === d.id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"
                  }`}
                >
                  {d.label} <span className="text-gray-500">×{d.multiplier}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={start}
            className="btn btn-primary"
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
              {streak >= 2 && <span className="text-amber-500 font-medium mr-3">Racha {streak}</span>}
              {adaptive && <span className="text-accent font-medium mr-3">Nivel {["Difícil", "Ultra", "Demonio"][level]}</span>}
              {Math.round(weighted)} pts{!adaptive && multiplier !== 1 ? ` ×${multiplier}` : ""} · {correctCount} / {answeredCount} correctas
            </span>
          </div>

          <div className="h-3 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={MAX_SECONDS} aria-valuenow={secondsLeft} aria-label="Tiempo restante">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ease-out ${secondsLeft <= 5 ? "bg-bad" : secondsLeft <= 15 ? "bg-amber" : "bg-accent"}`}
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
                    disabled={!!feedback || hidden.includes(letter)}
                    className={`text-left px-3 py-2.5 rounded-card border border-border text-sm hover:border-accent/40 hover:bg-accent/5 disabled:opacity-60 transition-colors ${hidden.includes(letter) ? "invisible" : ""}`}
                  >
                    {question[`option_${letter}`]}
                  </button>
                ))}
              </div>
              {!feedback && (
                <button onClick={useFifty} disabled={fiftyUsed} className="mt-3 text-xs px-3 py-1.5 rounded-card border border-border text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-40">
                  {fiftyUsed ? "50/50 usado" : "Comodín 50/50 (una vez)"}
                </button>
              )}
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
          score={Math.round(weighted)}
          unit={`puntos (${correctCount} aciertos${adaptive ? ", adaptativo" : multiplier !== 1 ? `, ×${multiplier}` : ""})`}
          groupId={groupId}
          saveState={saveState}
          highlight={dailyMsg || undefined}
          onAgain={start}
          shareText={`⚽ Futotal · Un Minuto: ${points} puntos (${correctCount} aciertos) — ¿me ganás?`}
        />
      )}
    </Layout>
  );
}
