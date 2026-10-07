import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

const DIFFICULTY_LABELS = ["", "Muy fácil", "Fácil", "Media", "Difícil", "Muy difícil"];

function formatDate(dateStr) {
  const d = new Date(String(dateStr).replace(" ", "T") + (String(dateStr).includes("T") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// Verde si fue una gran partida, ámbar si fue regular, rojo si salió mal.
function ratingColor(rating) {
  if (rating >= 70) return "text-emerald-500";
  if (rating >= 40) return "text-amber-500";
  return "text-red-400";
}

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
      <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
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

export default function History() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(undefined);

  useEffect(() => {
    setData(undefined);
    api.get("/game-history", { params: { page } }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [page]);

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Historial de juegos</h1>
          <p className="text-gray-400 text-sm">
            Cada partida con su puntaje de rendimiento (0-100): depende de qué tan difícil era y de cómo te fue. No suma al ranking.
          </p>
        </div>
        {data && data.total > 0 && (
          <div className="text-right">
            <p className="t-eyebrow">Promedio</p>
            <p className={`text-3xl font-bold tabular-nums ${ratingColor(data.average)}`}>{data.average}</p>
          </div>
        )}
      </div>

      {data === undefined && <Card><p className="text-sm text-gray-500 py-4 text-center">Cargando...</p></Card>}
      {data === null && <Card><p className="text-gray-400 text-center py-6">No se pudo cargar el historial.</p></Card>}
      {data && data.games.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <Gamepad2 className="mx-auto text-gray-600 mb-3" size={32} />
            <p className="text-gray-400">Todavía no jugaste ningún juego. Las partidas nuevas aparecen acá.</p>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {data?.games.map((g, i) => (
          <Card key={`${g.game_key}-${g.played_at}-${i}`}>
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{g.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {DIFFICULTY_LABELS[g.difficulty]} · rendimiento {g.performance}%{g.detail ? ` · ${g.detail}` : ""}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{formatDate(g.played_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-2xl font-bold tabular-nums ${ratingColor(g.rating)}`}>{g.rating}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-600">puntaje</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onChange={setPage} />
    </Layout>
  );
}
