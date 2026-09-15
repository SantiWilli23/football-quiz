import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, User, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

const GLOBAL_TAB = { key: "global", label: "Todos" };

function Cell({ label, children, tone }) {
  const toneClass =
    tone === "good" ? "bg-emerald/15 border-emerald/40 text-emerald"
    : tone === "bad" ? "bg-red-500/10 border-red-500/30 text-red-300"
    : "bg-panel border-border text-gray-300";
  return (
    <div className={`rounded-card border px-2.5 py-2 text-center ${toneClass}`}>
      <p className="text-[9px] uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
      <p className="text-xs font-semibold flex items-center justify-center gap-1 truncate">{children}</p>
    </div>
  );
}

function GuessRow({ g }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold truncate">{g.name}</p>
      <div className="grid grid-cols-4 gap-1.5">
        <Cell label="Nacionalidad" tone={g.nationality.match ? "good" : "bad"}>{g.nationality.value}</Cell>
        <Cell label="Posición" tone={g.position.match ? "good" : "bad"}>{g.position.value}</Cell>
        <Cell label="Club actual" tone={g.club.match ? "good" : "bad"}>{g.club.value || "?"}</Cell>
        <Cell label="Nacimiento" tone={g.birth_year.direction === "match" ? "good" : "bad"}>
          {g.birth_year.value}
          {g.birth_year.direction === "up" && <ArrowUp size={12} />}
          {g.birth_year.direction === "down" && <ArrowDown size={12} />}
        </Cell>
      </div>
    </div>
  );
}

export default function Wordle() {
  const [leagues, setLeagues] = useState([]);
  const [league, setLeague] = useState("global");
  const [players, setPlayers] = useState([]);
  const [today, setToday] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get("/wordle/leagues").then((r) => setLeagues(r.data.leagues)).catch(() => setLeagues([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/wordle/players", { params: { league } }).then((r) => setPlayers(r.data.players)),
      api.get("/wordle/today", { params: { league } }).then((r) => setToday(r.data)),
    ])
      .catch(() => setError("No se pudo cargar Fulbodle"))
      .finally(() => setLoading(false));
  }, [league]);

  const suggestions = query.trim().length >= 2
    ? players.filter((p) => p.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  async function guess(name) {
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/wordle/guess", { name, league });
      setToday((prev) => ({
        ...prev,
        attempts: data.attempt,
        solved: data.solved,
        points: data.points ?? prev.points,
        secret_name: data.secret_name ?? prev.secret_name,
        guesses: [data.feedback, ...prev.guesses],
      }));
      setQuery("");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo mandar el intento");
    } finally {
      setBusy(false);
    }
  }

  const tabs = [GLOBAL_TAB, ...leagues];

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Fulbodle</h1>
      <p className="text-gray-400 text-sm mb-4">Un jugador real secreto por día — adivinalo con la menor cantidad de intentos.</p>

      <div className="flex gap-1.5 flex-wrap mb-6">
        {tabs.map((l) => (
          <button
            key={l.key}
            onClick={() => setLeague(l.key)}
            className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
              league === l.key
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-gray-400 hover:text-white hover:border-white/30"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando...</p>}

      {!loading && today && (
        <>
          <Card className="mb-6">
            {today.solved ? (
              <div className="text-center py-4">
                <Check size={28} className="text-emerald mx-auto mb-2" />
                <p className="font-semibold">¡Era {today.secret_name}!</p>
                <p className="text-sm text-gray-400 mt-1">
                  Lo adivinaste en {today.attempts} intento{today.attempts === 1 ? "" : "s"} · +{today.points} pts
                </p>
                <p className="text-xs text-gray-600 mt-2">Volvé mañana por el próximo.</p>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <div className="flex items-center gap-2 bg-bg border border-border rounded-card px-3 py-2.5">
                    <User size={16} className="text-gray-500 shrink-0" />
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && suggestions.length === 1) guess(suggestions[0]); }}
                      placeholder="Nombre del jugador…"
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                      disabled={busy}
                    />
                  </div>
                  {suggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-panel border border-border rounded-card overflow-hidden shadow-lg">
                      {suggestions.map((name) => (
                        <button
                          key={name}
                          onClick={() => guess(name)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 hover:text-accent transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {today.attempts > 0 ? `Van ${today.attempts} intento${today.attempts === 1 ? "" : "s"}.` : "Escribí un nombre y elegilo de la lista."}
                </p>
              </div>
            )}
            {error && (
              <p className="text-sm text-red-400 mt-3 flex items-center gap-1.5"><X size={13} />{error}</p>
            )}
          </Card>

          {today.guesses.length > 0 && (
            <div className="space-y-3">
              {today.guesses.map((g, i) => (
                <GuessRow key={i} g={g} />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
