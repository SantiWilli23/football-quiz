import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
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

export default function History() {
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

  const handleFilterChange = (key) => {
    setFilter(key);
    setPage(1);
  };

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-1">Mis preguntas</h1>
      <p className="text-gray-400 text-sm mb-6">Historial de preguntas respondidas</p>

      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
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

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-card text-sm border border-border text-gray-400 disabled:opacity-30 hover:text-white hover:border-white/30 transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {data.page} de {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="px-3 py-1.5 rounded-card text-sm border border-border text-gray-400 disabled:opacity-30 hover:text-white hover:border-white/30 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </Layout>
  );
}
