import { useEffect, useState } from "react";
import { Flame, Users, Target } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import BonusCard from "../components/BonusCard.jsx";

export default function Dashboard() {
  const { stats, refreshMe } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [groups, setGroups] = useState([]);

  const loadToday = async () => {
    try {
      const { data } = await api.get("/questions/today");
      setQuestions(data.questions);
    } catch {
      setQuestions([]);
    }
  };

  const loadGroups = async () => {
    try {
      const { data } = await api.get("/groups");
      setGroups(data.groups);
    } catch {
      setGroups([]);
    }
  };

  useEffect(() => {
    loadToday();
    loadGroups();
  }, []);

  const handleAnswered = (index, result) => {
    setQuestions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, answered: true, result } : item))
    );
    refreshMe();
  };

  const answeredCount = questions?.filter((q) => q.answered).length ?? 0;

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold">Preguntas del día</h1>
            {questions && questions.length > 0 && (
              <span className="text-sm text-gray-400">
                {answeredCount} / {questions.length} respondidas
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-6">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </p>

          {questions && questions.length === 0 && (
            <Card>
              <p className="text-gray-400">No hay preguntas disponibles por ahora. Volvé más tarde.</p>
            </Card>
          )}

          <div className="space-y-6">
            {questions?.map((item, i) => (
              <QuestionCard
                key={item.question.id}
                item={item}
                index={i}
                total={questions.length}
                onAnswered={(result) => handleAnswered(i, result)}
              />
            ))}
            {groups.length > 0 && <BonusCard groupId={groups[0].id} />}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 text-orange-400 mb-1">
              <Flame size={18} />
              <span className="text-sm font-medium">Racha actual</span>
            </div>
            <p className="text-3xl font-bold">{stats?.current_streak ?? 0} días</p>
            <p className="text-xs text-gray-500 mt-1">Mejor racha: {stats?.best_streak ?? 0} días</p>
          </Card>

          <Card>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <Users size={18} />
              <span className="text-sm font-medium">Mi grupo</span>
            </div>
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500">Todavía no estás en ningún grupo.</p>
            ) : (
              <div className="space-y-2">
                {groups.slice(0, 3).map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{g.name}</span>
                    <span className="text-gray-500 text-xs shrink-0 ml-2">{g.member_count} miembros</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <Target size={18} />
              <span className="text-sm font-medium">Mis stats</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">Puntos</p>
                <p className="font-semibold text-lg">{stats?.total_points ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Aciertos</p>
                <p className="font-semibold text-lg">{stats?.accuracy ?? 0}%</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
