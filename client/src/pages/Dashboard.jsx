import { useEffect, useState } from "react";
import { Flame, Users, Target, CheckCircle2, XCircle } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

const OPTION_LABELS = { a: "A", b: "B", c: "C", d: "D" };

export default function Dashboard() {
  const { stats, refreshMe } = useAuth();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState([]);

  const loadToday = async () => {
    try {
      const { data } = await api.get("/questions/today");
      setData(data);
      if (data.answered) {
        setResult(data.result);
        setSelected(data.result.answer);
      }
    } catch {
      setData(null);
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

  const handleAnswer = async () => {
    if (!selected || !data?.question) return;
    setSubmitting(true);
    setError("");
    try {
      const { data: res } = await api.post(`/questions/${data.question.id}/answer`, {
        answer: selected,
      });
      setResult(res);
      await refreshMe();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo enviar la respuesta");
    } finally {
      setSubmitting(false);
    }
  };

  const options = data?.question
    ? [
        ["a", data.question.option_a],
        ["b", data.question.option_b],
        ["c", data.question.option_c],
        ["d", data.question.option_d],
      ]
    : [];

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pregunta del día</h1>
          <p className="text-gray-400 text-sm mb-6">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </p>

          {!data && (
            <Card>
              <p className="text-gray-400">No hay pregunta disponible por ahora. Volvé más tarde.</p>
            </Card>
          )}

          {data?.question && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/30">
                  {data.question.category}
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-gray-400 border border-border capitalize">
                  {data.question.difficulty}
                </span>
              </div>

              <h2 className="text-xl font-semibold mb-6">{data.question.question}</h2>

              <div className="space-y-3">
                {options.map(([key, text]) => {
                  const isSelected = selected === key;
                  const isCorrectOption = result && key === result.correct_answer;
                  const isWrongSelected = result && isSelected && !result.is_correct;

                  let optionClass =
                    "border-border hover:border-white/30 bg-bg";
                  if (result) {
                    if (isCorrectOption) optionClass = "border-accent bg-accent/10";
                    else if (isWrongSelected) optionClass = "border-red-500 bg-red-500/10";
                    else optionClass = "border-border bg-bg opacity-60";
                  } else if (isSelected) {
                    optionClass = "border-accent bg-accent/10";
                  }

                  return (
                    <button
                      key={key}
                      disabled={!!result}
                      onClick={() => setSelected(key)}
                      className={`w-full text-left px-4 py-3.5 rounded-card border transition-colors flex items-center gap-3 ${optionClass} ${
                        result ? "cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <span className="w-7 h-7 shrink-0 rounded-full border border-current/40 flex items-center justify-center text-xs font-semibold">
                        {OPTION_LABELS[key]}
                      </span>
                      <span className="text-sm flex-1">{text}</span>
                      {result && isCorrectOption && <CheckCircle2 size={18} className="text-accent shrink-0" />}
                      {result && isWrongSelected && <XCircle size={18} className="text-red-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

              {!result && (
                <button
                  onClick={handleAnswer}
                  disabled={!selected || submitting}
                  className="mt-6 w-full bg-accent hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-black font-semibold rounded-card py-3 text-sm"
                >
                  {submitting ? "Enviando..." : "Responder"}
                </button>
              )}

              {result && (
                <div
                  className={`mt-6 rounded-card border px-4 py-3.5 flex items-center justify-between ${
                    result.is_correct
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-red-500/40 bg-red-500/10 text-red-400"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {result.is_correct ? "¡Correcto!" : "Incorrecto"}
                  </span>
                  <span className="text-sm font-semibold">
                    {result.is_correct ? `+${result.points} puntos` : "+0 puntos"}
                  </span>
                </div>
              )}
            </Card>
          )}
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
