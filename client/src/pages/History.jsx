import { useEffect, useState } from "react";
import { CheckCircle2, Target, XCircle } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

function formatLocalDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "correct", label: "Correctas" },
  { key: "incorrect", label: "Incorrectas" },
];

const KIND_LABELS = {
  quien_es_mas: { label: "¿Quién es más?", color: "#3b82f6" },
  que_prefieres: { label: "¿Qué prefieres?", color: "#10b981" },
  personalidad: { label: "Personalidad", color: "#a855f7" },
};

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-6">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-card text-sm border border-border text-gray-400 disabled:opacity-30 hover:text-white hover:border-white/30 transition-colors"
      >
        Anterior
      </button>
      <span className="text-sm text-gray-500">
        Página {page} de {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-card text-sm border border-border text-gray-400 disabled:opacity-30 hover:text-white hover:border-white/30 transition-colors"
      >
        Siguiente
      </button>
    </div>
  );
}

function TriviaHistory() {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { page };
    if (filter !== "all") params.filter = filter;
    api
      .get("/questions/history", { params })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [filter, page]);

  return (
    <>
      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-card text-sm font-medium border transition-colors ${
              filter === f.key
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-gray-400 hover:text-white hover:border-white/30"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!loading && data?.history.length === 0 && (
        <Card>
          <p className="text-gray-400 text-center py-6">No hay preguntas para mostrar</p>
        </Card>
      )}

      <div className="space-y-3">
        {data?.history.map((item, idx) => (
          <Card key={idx}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-border">
                    {item.category}
                  </span>
                  <span className="text-xs text-gray-600">{formatLocalDate(item.scheduled_date)}</span>
                </div>
                <p className="text-sm font-medium mb-2">{item.question}</p>
                <p className="text-xs text-gray-500">
                  Tu respuesta:{" "}
                  <span className={item.is_correct ? "text-accent" : "text-red-400"}>
                    {item.your_answer.toUpperCase()}
                  </span>
                  {!item.is_correct && (
                    <>
                      {" "}
                      · Correcta: <span className="text-accent">{item.correct_answer.toUpperCase()}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {item.is_correct ? (
                  <CheckCircle2 className="text-accent" size={20} />
                ) : (
                  <XCircle className="text-red-400" size={20} />
                )}
                <span className="text-xs font-semibold text-gray-400">+{item.points} pts</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onChange={setPage} />
    </>
  );
}

function ModeBHistory({ groupId }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    api
      .get("/mode-b/history", { params: { groupId, page } })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [groupId, page]);

  if (!groupId) {
    return (
      <Card>
        <p className="text-gray-400 text-center py-6">Necesitás estar en un grupo.</p>
      </Card>
    );
  }

  if (!loading && (!data || data.days.length === 0)) {
    return (
      <Card>
        <p className="text-gray-400 text-center py-6">
          Todavía no hay días cerrados. Los resultados aparecen acá cuando termina el día.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {data?.days.map((day) => (
          <Card key={day.date}>
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
              <span className="text-sm font-semibold">{formatLocalDate(day.date)}</span>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{day.answered_count}/3 respondidas</span>
                <span className="flex items-center gap-1">
                  <Target size={11} />
                  {day.correct_predictions} acertadas
                </span>
                <span className="font-semibold text-purple-400">+{day.points} pts</span>
              </div>
            </div>

            <div className="space-y-3">
              {day.questions.map((q, i) => {
                const kind = KIND_LABELS[q.kind];
                return (
                  <div key={i} className="pl-3" style={{ borderLeft: `2px solid ${kind.color}66` }}>
                    <p className="text-[11px] mb-1" style={{ color: kind.color }}>
                      {kind.label}
                    </p>
                    <p className="text-sm mb-1.5">{q.prompt}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>
                        Votaste: <span className="text-gray-300">{q.your_answer ?? "—"}</span>
                      </span>
                      <span>
                        Ganó: <span className="text-gray-300">{q.winner ?? "—"}</span>
                      </span>
                      {q.your_prediction && (
                        <span className={q.prediction_hit ? "text-accent" : "text-gray-600"}>
                          Predijiste: {q.your_prediction} {q.prediction_hit ? "✓" : "✗"}
                        </span>
                      )}
                      <span className="text-gray-600">{q.total_votes} votos</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onChange={setPage} />
    </>
  );
}

export default function History() {
  const [tab, setTab] = useState("trivia");
  const [groupId, setGroupId] = useState(null);

  useEffect(() => {
    api
      .get("/groups")
      .then(({ data }) => setGroupId(data.groups[0]?.id ?? null))
      .catch(() => setGroupId(null));
  }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Mis preguntas</h1>
          <p className="text-gray-400 text-sm">Todo lo que respondiste hasta ahora</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("trivia")}
            className={`px-3 py-1 text-sm font-medium rounded border ${
              tab === "trivia"
                ? "bg-blue-500/20 border-blue-500 text-blue-400"
                : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-500"
            }`}
          >
            Trivia
          </button>
          <button
            onClick={() => setTab("especial")}
            className={`px-3 py-1 text-sm font-medium rounded border ${
              tab === "especial"
                ? "bg-purple-500/20 border-purple-500 text-purple-400"
                : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-500"
            }`}
          >
            Especial
          </button>
        </div>
      </div>

      {tab === "trivia" ? <TriviaHistory /> : <ModeBHistory groupId={groupId} />}
    </Layout>
  );
}
