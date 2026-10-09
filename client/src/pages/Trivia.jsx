import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Radio, Timer } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import BonusCard from "../components/BonusCard.jsx";
import ModeBCard from "../components/ModeBCard.jsx";
import GroupQuestionComposer from "../components/GroupQuestionComposer.jsx";
import ShareButton from "../components/ShareButton.jsx";
import GroupStreakCard from "../components/GroupStreakCard.jsx";
import EscudoQuiz from "../components/EscudoQuiz.jsx";
import { celebrateScore } from "../utils/celebrate.js";
import { submitDaily } from "../utils/dailyGames.js";

const LIVE_REFRESH_MS = 15000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Más racha, más comodines disponibles por día — incentiva volver seguido sin
// regalar de más a quien recién empieza.
function powerupBudget(streak) {
  if (streak >= 10) return { fifty: 3, skip: 2 };
  if (streak >= 5) return { fifty: 2, skip: 1 };
  if (streak >= 2) return { fifty: 1, skip: 1 };
  return { fifty: 1, skip: 0 };
}

function loadPowerupUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem("fq_powerups") || "{}");
    if (raw.date !== todayKey()) return { fifty: 0, skip: 0 };
    return { fifty: raw.fifty || 0, skip: raw.skip || 0 };
  } catch {
    return { fifty: 0, skip: 0 };
  }
}

function savePowerupUsage(usage) {
  localStorage.setItem("fq_powerups", JSON.stringify({ date: todayKey(), ...usage }));
}

function loadEarned() {
  try {
    const raw = JSON.parse(localStorage.getItem("fq_earned_fifty") || "{}");
    return raw.date === todayKey() ? raw.n || 0 : 0;
  } catch {
    return 0;
  }
}

export default function Trivia() {
  const { stats, refreshMe } = useAuth();
  const { groups, activeGroupId: groupId } = useGroups();
  const [questions, setQuestions] = useState(null);
  const [modeBData, setModeBData] = useState(null);
  const [mode, setMode] = useState("a");
  const [powerupUsage, setPowerupUsage] = useState(loadPowerupUsage);
  const [earnedFifty, setEarnedFifty] = useState(loadEarned); // 50/50 ganados por racha de aciertos
  const [earnMsg, setEarnMsg] = useState("");
  const runRef = useRef(0); // aciertos seguidos en esta sesión
  // Una pregunta a la vez: se contesta y "Siguiente" pasa a la próxima.
  // Arranca en la primera sin responder (si ya respondiste alguna hoy).
  const [current, setCurrent] = useState(0);
  const [skippedIds, setSkippedIds] = useState([]);
  const [started, setStarted] = useState(false); // la trivia no arranca (ni corre el reloj) hasta tocar Iniciar
  // Entrando por "Juego diario" (?diario=1) la trivia cuenta como el juego del día (puntaje + sobre).
  const fromDaily = useSearchParams()[0].get("diario") === "1";
  const dailySentRef = useRef(false);

  const budget = powerupBudget(stats?.current_streak ?? 0);
  const powerupsLeft = { fifty: Math.max(0, budget.fifty + earnedFifty - powerupUsage.fifty), skip: Math.max(0, budget.skip - powerupUsage.skip) };

  const handleUsePowerup = (type) => {
    if (type === "skip" && questions?.[current]) setSkippedIds((ids) => [...ids, questions[current].question.id]);
    setPowerupUsage((prev) => {
      const next = { ...prev, [type]: prev[type] + 1 };
      savePowerupUsage(next);
      return next;
    });
  };

  const loadTrivia = async () => {
    try {
      const { data } = await api.get("/questions/today");
      setQuestions(data.questions);
      const firstOpen = data.questions.findIndex((q) => !q.answered);
      setCurrent(firstOpen === -1 ? data.questions.length : firstOpen);
    } catch {
      setQuestions([]);
    }
  };

  const loadModeB = useCallback(async () => {
    if (!groupId) {
      setModeBData(null);
      return;
    }
    try {
      const { data } = await api.get("/mode-b/today", { params: { groupId } });
      setModeBData(data);
    } catch {
      setModeBData(null);
    }
  }, [groupId]);

  useEffect(() => {
    loadTrivia();
  }, []);

  useEffect(() => {
    if (mode === "b") loadModeB();
  }, [mode, loadModeB]);

  useEffect(() => {
    if (mode !== "b" || !groupId) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadModeB();
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [mode, groupId, loadModeB]);

  const handleAnswered = (index, result) => {
    runRef.current = result?.is_correct ? runRef.current + 1 : 0;
    if (runRef.current > 0 && runRef.current % 3 === 0) {
      setEarnedFifty((n) => {
        const next = n + 1;
        try { localStorage.setItem("fq_earned_fifty", JSON.stringify({ date: todayKey(), n: next })); } catch { /* sin storage */ }
        return next;
      });
      setEarnMsg("¡3 aciertos seguidos! Ganaste un 50/50 gratis.");
    } else {
      setEarnMsg("");
    }
    setQuestions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, answered: true, result } : item))
    );
    refreshMe();
  };

  // Al pasar la última: felicitaciones con lo que sumó la trivia de hoy.
  const goNext = () => {
    const next = current + 1;
    setCurrent(next);
    if (next >= questions.length) {
      const pts = questions.reduce((n, q) => n + (q.result?.points || 0), 0);
      const ok = questions.filter((q) => q.result?.is_correct).length;
      celebrateScore({ points: pts, unit: "puntos en la trivia de hoy", detail: `${ok} de ${questions.length} correctas` });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!fromDaily || dailySentRef.current || !questions?.length || current < questions.length) return;
    dailySentRef.current = true;
    const ok = questions.filter((q) => q.result?.is_correct).length;
    submitDaily("trivia", ok / questions.length, ok, { mode: "daily" });
  }, [fromDaily, questions, current]);

  const currentItem = questions?.[current];
  const currentDone = currentItem && (currentItem.answered || skippedIds.includes(currentItem.question.id));
  const triviaPoints = questions ? questions.reduce((n, q) => n + (q.result?.points || 0), 0) : 0;
  const triviaCorrect = questions ? questions.filter((q) => q.result?.is_correct).length : 0;

  const handleModeBChanged = async () => {
    await loadModeB();
    refreshMe();
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-2xl border border-border bg-panel p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4">
            <div className="strip-cell tone-amber">
              <p className="text-xs uppercase tracking-wider text-gray-500">Racha</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums text-tone mt-1">{stats?.current_streak ?? 0} <span className="text-sm font-medium text-gray-500">días</span></p>
            </div>
            <div className="strip-cell tone-emerald">
              <p className="text-xs uppercase tracking-wider text-gray-500">Mejor racha</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums text-tone mt-1">{stats?.best_streak ?? 0} <span className="text-sm font-medium text-gray-500">días</span></p>
            </div>
            <div className="strip-cell tone-blue">
              <p className="text-xs uppercase tracking-wider text-gray-500">Puntos de trivia</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums text-tone mt-1">{stats?.trivia_points ?? 0}</p>
            </div>
            <div className="strip-cell tone-pink">
              <p className="text-xs uppercase tracking-wider text-gray-500">Puntos especial</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums text-tone mt-1">{stats?.mode_b_points ?? 0}</p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h1 className="text-xl sm:text-2xl font-bold">Trivia del día</h1>
            <div className="flex items-center gap-2">
              <ShareButton trivia={questions} modeB={modeBData} stats={stats} />
              <GroupSelector className="mr-1" />
              {mode === "a" && (
                <span
                  title="Tenés 20 segundos por pregunta — así nadie tiene tiempo de googlear la respuesta"
                  className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded border border-red-500/40 bg-red-500/10 text-red-400"
                >
                  <Timer size={14} /> 20s por pregunta
                </span>
              )}
              <button
                onClick={() => setMode("a")}
                className={`px-3 py-1 text-sm font-medium rounded border ${
                  mode === "a"
                    ? "bg-blue-500/20 border-blue-500 text-blue-400"
                    : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-500"
                }`}
              >
                Trivia
              </button>
              <button
                onClick={() => setMode("b")}
                className={`px-3 py-1 text-sm font-medium rounded border ${
                  mode === "b"
                    ? "bg-purple-500/20 border-purple-500 text-purple-400"
                    : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-500"
                }`}
              >
                Especial
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <p className="text-gray-400 text-sm">
              {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {mode === "b" && modeBData && (
              <span className="text-xs text-gray-500 flex items-center gap-1.5">
                <Radio size={11} className="text-purple-400 animate-pulse" />
                en vivo
              </span>
            )}
          </div>

          {mode === "a" && questions && questions.length > 0 && (
            <div className="flex gap-1.5 mb-5" role="img" aria-label={`${questions.filter((q) => q.answered).length} de ${questions.length} respondidas`}>
              {questions.map((q, i) => (
                <span
                  key={q.question.id}
                  className={`flex-1 h-1.5 rounded-full ${
                    !q.answered ? "bg-white/10" : q.result?.is_correct ? "bg-good" : "bg-bad"
                  }`}
                />
              ))}
            </div>
          )}

          {mode === "a" && questions && questions.length === 0 && (
            <Card>
              <p className="text-gray-400">No hay preguntas disponibles por ahora. Volvé más tarde.</p>
            </Card>
          )}

          {mode === "b" && !groupId && (
            <Card>
              <p className="text-gray-400">Necesitás estar en un grupo para ver las preguntas especiales.</p>
            </Card>
          )}

          <div className="space-y-6">
            {mode === "a" ? (
              <>
                {earnMsg && <p className="text-sm font-semibold text-accent">{earnMsg}</p>}
                {currentItem && !started && (
                  <Card className="text-center py-10">
                    <Timer size={32} className="mx-auto text-accent mb-3" />
                    <p className="text-lg font-bold mb-1">Trivia del día</p>
                    <p className="text-sm text-gray-400 mb-1">{questions.length} preguntas · 20 segundos por pregunta</p>
                    <p className="text-xs text-gray-500 mb-5">
                      {questions.some((q) => q.answered) ? `Ya respondiste ${questions.filter((q) => q.answered).length} de ${questions.length}. Seguís donde quedaste.` : "El reloj arranca cuando tocás Iniciar."}
                    </p>
                    <button onClick={() => setStarted(true)} className="btn btn-primary">
                      {questions.some((q) => q.answered) ? "Continuar" : "Iniciar"}
                    </button>
                  </Card>
                )}
                {currentItem && started && (
                  <>
                    <QuestionCard
                      key={currentItem.question.id}
                      item={currentItem}
                      index={current}
                      total={questions.length}
                      onAnswered={(result) => handleAnswered(current, result)}
                      timedMode
                      powerups={powerupsLeft}
                      onUsePowerup={handleUsePowerup}
                    />
                    {currentDone && (
                      <button onClick={goNext} className="btn btn-primary w-full inline-flex items-center justify-center gap-2">
                        {current + 1 < questions.length ? "Siguiente pregunta" : "Ver resultado"} <ArrowRight size={16} />
                      </button>
                    )}
                  </>
                )}
                {questions && questions.length > 0 && current >= questions.length && (
                  <Card className="text-center py-8">
                    <p className="text-sm text-gray-400 mb-1">Trivia de hoy terminada</p>
                    <p className="text-4xl font-bold tabular-nums">{triviaCorrect}/{questions.length}</p>
                    <p className="text-sm text-gray-400 mt-1">correctas · +{triviaPoints} puntos</p>
                    <p className="text-xs text-gray-500 mt-3">Mañana hay preguntas nuevas.</p>
                  </Card>
                )}
                {groupId && <BonusCard groupId={groupId} />}
                <EscudoQuiz />
              </>
            ) : (
              modeBData &&
              groupId && (
                <>
                  <ModeBCard
                    data={modeBData.quien_es_mas}
                    groupId={groupId}
                    onChanged={handleModeBChanged}
                  />
                  <ModeBCard
                    data={modeBData.que_prefieres}
                    groupId={groupId}
                    onChanged={handleModeBChanged}
                  />
                  <ModeBCard
                    data={modeBData.personalidad}
                    groupId={groupId}
                    onChanged={handleModeBChanged}
                  />
                  {modeBData.grupal?.pending ? (
                    <GroupQuestionComposer groupId={groupId} onCreated={handleModeBChanged} />
                  ) : (
                    <ModeBCard
                      data={modeBData.grupal}
                      groupId={groupId}
                      onChanged={handleModeBChanged}
                    />
                  )}
                </>
              )
            )}
          </div>
        </div>

        {groupId && <GroupStreakCard groupId={groupId} />}
      </div>
    </Layout>
  );
}
