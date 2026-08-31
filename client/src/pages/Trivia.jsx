import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
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

const LIVE_REFRESH_MS = 15000;

export default function Trivia() {
  const { stats, refreshMe } = useAuth();
  const { groups, activeGroupId: groupId } = useGroups();
  const [questions, setQuestions] = useState(null);
  const [modeBData, setModeBData] = useState(null);
  const [mode, setMode] = useState("a");

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
              <ShareButton trivia={questions} modeB={modeBData} />
              <GroupSelector className="mr-1" />
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
                  />
                ))}
                {groupId && <BonusCard groupId={groupId} />}
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
