import { useCallback, useEffect, useState } from "react";
import { Radio, Skull, Swords, Timer } from "lucide-react";
import { Link } from "react-router-dom";
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

export default function Trivia() {
  const { stats, refreshMe } = useAuth();
  const { groups, activeGroupId: groupId } = useGroups();
  const [questions, setQuestions] = useState(null);
  const [modeBData, setModeBData] = useState(null);
  const [mode, setMode] = useState("a");
  const [timedMode, setTimedMode] = useState(false);
  const [powerupUsage, setPowerupUsage] = useState(loadPowerupUsage);

  const budget = powerupBudget(stats?.current_streak ?? 0);
  const powerupsLeft = { fifty: Math.max(0, budget.fifty - powerupUsage.fifty), skip: Math.max(0, budget.skip - powerupUsage.skip) };

  const handleUsePowerup = (type) => {
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
    setQuestions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, answered: true, result } : item))
    );
    refreshMe();
  };

  const handleModeBChanged = async () => {
    await loadModeB();
    refreshMe();
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h1 className="text-xl sm:text-2xl font-bold">Trivia del día</h1>
            <div className="flex items-center gap-2">
              <ShareButton trivia={questions} modeB={modeBData} stats={stats} />
              <GroupSelector className="mr-1" />
              {mode === "a" && (
                <button
                  onClick={() => setTimedMode((v) => !v)}
                  title="Modo contrarreloj: 20 segundos por pregunta"
                  className={`flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded border transition-colors ${
                    timedMode
                      ? "bg-red-500/20 border-red-500 text-red-400"
                      : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  <Timer size={14} /> Contrarreloj
                </button>
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

          <div className="flex items-center gap-2 mb-4">
            <Link
              to="/duelos"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              <Swords size={14} /> Duelos
            </Link>
            <Link
              to="/supervivencia"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              <Skull size={14} /> Supervivencia
            </Link>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <p className="text-gray-400 text-sm">
              {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {mode === "b" && modeBData && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                <Radio size={11} className="text-purple-400 animate-pulse" />
                en vivo
              </span>
            )}
          </div>

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
                {questions?.map((item, i) => (
                  <QuestionCard
                    key={item.question.id}
                    item={item}
                    index={i}
                    total={questions.length}
                    onAnswered={(result) => handleAnswered(i, result)}
                    timedMode={timedMode}
                    powerups={powerupsLeft}
                    onUsePowerup={handleUsePowerup}
                  />
                ))}
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

        <div className="space-y-6">
          {groupId && <GroupStreakCard groupId={groupId} />}
          <Card>
            <p className="text-xs text-gray-500 mb-2">Racha actual</p>
            <p className="text-3xl font-bold">{stats?.current_streak ?? 0} días</p>
            <p className="text-xs text-gray-500 mt-1">Mejor: {stats?.best_streak ?? 0} días</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-2">Mis puntos</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-gray-600">Trivia</p>
                <p className="font-semibold">{stats?.trivia_points ?? 0}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-600">Especial</p>
                <p className="font-semibold text-purple-400">{stats?.mode_b_points ?? 0}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
