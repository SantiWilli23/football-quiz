import { useEffect, useState } from "react";
import { Flame, Gamepad2, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

const DIFFICULTY_LABELS = ["", "Muy fácil", "Fácil", "Media", "Difícil", "Muy difícil"];
const TABS = [["reciente", "Reciente"], ["historico", "Histórico"], ["tops", "Tops"]];

function formatDate(dateStr) {
  const d = new Date(String(dateStr).replace(" ", "T") + (String(dateStr).includes("T") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// Verde si fue una gran partida, ámbar si fue regular, rojo si salió mal (puntuación de 1 a 1000).
function scoreColor(score) {
  if (score >= 700) return "text-emerald-500";
  if (score >= 400) return "text-amber-500";
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

function GameRow({ g, rank }) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        {rank != null && <span className="w-7 text-center text-lg font-bold tabular-nums text-gray-500 shrink-0">{rank}</span>}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm flex items-center gap-2">
            {g.label}
            {g.pleno && <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">Pleno</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {DIFFICULTY_LABELS[g.difficulty]} · rendimiento {g.performance}%{g.detail ? ` · ${g.detail}` : ""}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{formatDate(g.played_at)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${scoreColor(g.score)}`}>{g.score}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-600">de 1000</p>
        </div>
      </div>
    </Card>
  );
}

function Empty({ text }) {
  return (
    <Card>
      <div className="text-center py-8">
        <Gamepad2 className="mx-auto text-gray-600 mb-3" size={32} />
        <p className="text-gray-400">{text}</p>
      </div>
    </Card>
  );
}

function Recent() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(undefined);

  useEffect(() => {
    setData(undefined);
    api.get("/game-history", { params: { page } }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [page]);

  return (
    <>
      {data && data.total > 0 && (
        <p className="text-xs text-gray-500 mb-3">Promedio de todas tus partidas: <span className={`font-bold ${scoreColor(data.average)}`}>{data.average}</span> / 1000</p>
      )}
      {data === undefined && <Card><p className="text-sm text-gray-500 py-4 text-center">Cargando...</p></Card>}
      {data === null && <Card><p className="text-gray-400 text-center py-6">No se pudo cargar el historial.</p></Card>}
      {data && data.games.length === 0 && <Empty text="Todavía no jugaste ningún juego. Las partidas nuevas aparecen acá." />}
      <div className="space-y-2">
        {data?.games.map((g, i) => <GameRow key={`${g.game_key}-${g.played_at}-${i}`} g={g} />)}
      </div>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onChange={setPage} />
    </>
  );
}

function Historic() {
  const [data, setData] = useState(undefined);
  useEffect(() => { api.get("/game-history/historic").then((r) => setData(r.data)).catch(() => setData(null)); }, []);

  if (data === undefined) return <Card><p className="text-sm text-gray-500 py-4 text-center">Cargando...</p></Card>;
  if (data === null) return <Card><p className="text-gray-400 text-center py-6">No se pudo cargar el histórico.</p></Card>;
  if (data.games.length === 0) return <Empty text="Cuando juegues vas a ver acá tus promedios y tus rachas de plenos." />;

  return (
    <>
      <p className="text-xs text-gray-500 mb-3">Un pleno es una partida con el rendimiento máximo. La racha cuenta los plenos seguidos en ese juego.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.games.map((g) => (
          <Card key={g.game_key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{g.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{g.played} partida{g.played === 1 ? "" : "s"} · promedio {g.average} · mejor {g.best_score}</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums shrink-0 ${g.streak > 0 ? "text-amber-500" : "text-gray-600"}`} title="Racha de plenos actual">
                <Flame size={15} /> {g.streak}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="rounded-card border border-border py-1.5"><p className="text-lg font-bold tabular-nums">{g.plenos}</p><p className="text-[10px] uppercase tracking-wider text-gray-500">Plenos</p></div>
              <div className="rounded-card border border-border py-1.5"><p className="text-lg font-bold tabular-nums">{g.streak}</p><p className="text-[10px] uppercase tracking-wider text-gray-500">Racha</p></div>
              <div className="rounded-card border border-border py-1.5"><p className="text-lg font-bold tabular-nums">{g.best_streak}</p><p className="text-[10px] uppercase tracking-wider text-gray-500">Mejor racha</p></div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Tops() {
  const [game, setGame] = useState("");
  const [data, setData] = useState(undefined);
  useEffect(() => {
    api.get("/game-history/tops", { params: { game } }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [game]);

  if (data === undefined) return <Card><p className="text-sm text-gray-500 py-4 text-center">Cargando...</p></Card>;
  if (data === null) return <Card><p className="text-gray-400 text-center py-6">No se pudieron cargar los tops.</p></Card>;

  return (
    <>
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" role="group" aria-label="Filtrar por juego">
        {[{ key: "", label: "Todos" }, ...data.games].map((g) => (
          <button
            key={g.key}
            onClick={() => setGame(g.key)}
            aria-pressed={game === g.key}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${game === g.key ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}
          >
            {g.label}
          </button>
        ))}
      </div>
      {data.tops.length === 0 && <Empty text="Todavía no hay partidas para armar un top." />}
      <div className="space-y-2">
        {data.tops.map((g, i) => <GameRow key={`${g.game_key}-${g.played_at}-${i}`} g={g} rank={i + 1} />)}
      </div>
    </>
  );
}

export default function History() {
  const [tab, setTab] = useState("reciente");

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><Trophy size={22} className="text-accent" /> Historial de juegos</h1>
        <p className="text-gray-400 text-sm">
          Cada partida tiene una puntuación de 1 a 1000: cuenta la dificultad, la duración, el rendimiento y la racha de plenos. No suma al ranking.
        </p>
      </div>

      <div className="flex gap-2 mb-5" role="tablist" aria-label="Secciones del historial">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${tab === k ? "bg-white text-black border-white" : "border-white/25 text-gray-300 hover:border-white/60"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "reciente" && <Recent />}
      {tab === "historico" && <Historic />}
      {tab === "tops" && <Tops />}
    </Layout>
  );
}
