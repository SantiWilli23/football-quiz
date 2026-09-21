import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Lightbulb, Lock, User, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { playSfx } from "../utils/sfx.js";

const GLOBAL_TAB = { key: "global", label: "Todos" };
const MODES = [
  { key: "daily", label: "Diario", hint: "El mismo jugador secreto para todos hoy." },
  { key: "random", label: "Aleatorio", hint: "Un secreto nuevo cada partida, con dificultad a elección." },
];

function Cell({ label, children, tone }) {
  const toneClass =
    tone === "good" ? "bg-emerald/15 border-emerald/40 text-emerald"
    : tone === "bad" ? "bg-red-500/10 border-red-500/30 text-red-300"
    : "bg-panel border-border text-gray-300";
  return (
    <div className={`rounded-card border px-2 py-2 text-center ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
      <p className="text-xs font-semibold flex items-center justify-center gap-1 truncate">
        {tone === "good" && <span aria-label="coincide">✓</span>}
        {tone === "bad" && <span aria-label="no coincide">✗</span>}
        {children}
      </p>
    </div>
  );
}

// Barra de parecido: se pinta del gris al verde según qué tan cerca está el
// intento del secreto (mismo número que mostraba Fichado).
function SimilarityBar({ value }) {
  const hue = Math.round((value / 100) * 140);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-16 h-1.5 rounded-full bg-bg overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: `hsl(${hue} 65% 50%)` }} />
      </div>
      <span className="text-lg font-bold tabular-nums w-9 text-right" style={{ color: `hsl(${hue} 65% 55%)` }}>{value}</span>
    </div>
  );
}

function GuessRow({ g }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold truncate">{g.name}</p>
        <SimilarityBar value={g.similarity} />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        <Cell label="Nacionalidad" tone={g.nationality.match ? "good" : "bad"}>{g.nationality.value}</Cell>
        <Cell label="Posición" tone={g.position.match ? "good" : "bad"}>{g.position.value}</Cell>
        <Cell label="Club" tone={g.club.match ? "good" : "bad"}>{g.club.value || "?"}</Cell>
        <Cell label="Liga" tone={g.league.match ? "good" : "bad"}>{g.league.value}</Cell>
        <Cell label="Nacimiento" tone={g.birth_year.direction === "match" ? "good" : "bad"}>
          {g.birth_year.value}
          {g.birth_year.direction === "up" && <ArrowUp size={12} />}
          {g.birth_year.direction === "down" && <ArrowDown size={12} />}
        </Cell>
      </div>
    </div>
  );
}

// Una fila de cuadritos por intento (del primero al último): verde si
// coincide, rojo si no — nacionalidad, posición, club, liga y año.
function shareText(game) {
  const title = game.mode === "daily" ? "Fichado diario" : "Fichado";
  const result = game.status === "won" ? `${game.attemptsUsed}/${game.maxAttempts}` : `X/${game.maxAttempts}`;
  const sq = (ok) => (ok ? "🟩" : "🟥");
  const rows = [...game.guesses].reverse().map((g) =>
    [g.nationality.match, g.position.match, g.club.match, g.league.match, g.birth_year.direction === "match"].map(sq).join("")
  );
  return `${title} · ${result} · ${game.points} pts\n${rows.join("\n")}`;
}

export default function Wordle() {
  const { activeGroupId: groupId } = useGroups();
  const [meta, setMeta] = useState({ leagues: [], difficulties: [], maxAttempts: 8, hintCost: 3 });
  const [mode, setMode] = useState("daily");
  const [league, setLeague] = useState("global");
  const [difficulty, setDifficulty] = useState("normal");
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groupSave, setGroupSave] = useState(null);
  const [copied, setCopied] = useState(false);
  const submittedRef = useRef(new Set());
  // Modo contra reloj (opcional): el servidor mide el tiempo desde que se creó la
  // partida y da +20/+10/+5 pts si se gana en 1/2/3 minutos.
  const [timed, setTimed] = useState(() => {
    try { return localStorage.getItem("fq_fichado_timed") === "on"; } catch { return false; }
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timed) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timed]);
  function toggleTimed() {
    const next = !timed;
    setTimed(next);
    try { localStorage.setItem("fq_fichado_timed", next ? "on" : "off"); } catch { /* sin storage */ }
  }

  useEffect(() => {
    api.get("/wordle/leagues").then((r) => setMeta(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/wordle/players", { params: { league } }).then((r) => setPlayers(r.data.players)).catch(() => setPlayers([]));
  }, [league]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setGroupSave(null);
    api.get("/wordle/game", { params: { mode, league } })
      .then((r) => setGame(r.data.game))
      .catch(() => setError("No se pudo cargar el juego"))
      .finally(() => setLoading(false));
  }, [mode, league]);

  // El puntaje de cada partida terminada suma al reto semanal del grupo
  // (queda el mejor de la semana) — una sola vez por partida.
  const reportToGroup = useCallback(async (g) => {
    if (!groupId || submittedRef.current.has(g.id)) return;
    submittedRef.current.add(g.id);
    try {
      const { data } = await api.post("/challenges/submit", { gameKey: "fichado", groupId, score: g.points });
      setGroupSave({ improved: data.improved });
    } catch {
      setGroupSave(null);
    }
  }, [groupId]);

  function applyGame(next, wasPlaying) {
    setGame(next);
    if (wasPlaying && next.status !== "playing") reportToGroup(next);
  }

  const suggestions = query.trim().length >= 2 && game?.status === "playing"
    ? players
        .filter((p) => p.toLowerCase().includes(query.trim().toLowerCase()) && !game.guesses.some((g) => g.name === p))
        .slice(0, 8)
    : [];

  async function act(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.response?.data?.error || "Algo salió mal");
    } finally {
      setBusy(false);
    }
  }

  const guess = (name) => name && act(async () => {
    const { data } = await api.post("/wordle/guess", { gameId: game.id, name, timed });
    applyGame(data.game, true);
    playSfx(data.game.status === "won" ? "win" : data.game.status === "lost" ? "bad" : "tick");
    setQuery("");
  });
  const useHint = () => act(async () => {
    const { data } = await api.post("/wordle/hint", { gameId: game.id });
    applyGame(data.game, true);
  });
  const giveUp = () => act(async () => {
    const { data } = await api.post("/wordle/giveup", { gameId: game.id });
    applyGame(data.game, true);
  });
  const newGame = () => act(async () => {
    const { data } = await api.post("/wordle/new", { league, difficulty });
    setGroupSave(null);
    setGame(data.game);
  });

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareText(game));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* sin portapapeles */ }
  }

  const tabs = [GLOBAL_TAB, ...meta.leagues];
  const playing = game?.status === "playing";
  const attemptsLeft = game ? Math.max(0, game.maxAttempts - game.attemptsUsed) : 0;
  const canHint = playing && game.hintsUsed < 5 && attemptsLeft >= meta.hintCost;

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Fichado</h1>
      <p className="text-gray-400 text-sm mb-4">
        Adiviná al futbolista secreto en {meta.maxAttempts} intentos. Cada intento te marca en verde lo que coincide y te da un número de parecido de 0 a 100.
      </p>

      <div className="flex gap-1.5 mb-3">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2 rounded-card text-sm font-semibold border transition-colors ${
              mode === m.key ? "border-accent bg-accent text-bg" : "border-border text-gray-400 hover:text-white"
            }`}
          >
            {m.label}
          </button>
        ))}
        <span className="text-xs text-gray-500 self-center ml-2">{MODES.find((m) => m.key === mode).hint}</span>
      </div>

      <select
        value={league}
        onChange={(e) => setLeague(e.target.value)}
        aria-label="Liga"
        className="sm:hidden w-full mb-6 bg-panel border border-border rounded-card px-3 py-2.5 text-sm"
      >
        {tabs.map((l) => <option key={l.key} value={l.key}>Liga: {l.label}</option>)}
      </select>
      <div className="hidden sm:flex gap-1.5 flex-wrap mb-6">
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

      <div className="flex items-center gap-3 mb-4 text-xs text-gray-400 flex-wrap">
        <button
          onClick={toggleTimed}
          role="switch"
          aria-checked={timed}
          className={`px-3 py-1.5 rounded-card border transition-colors ${timed ? "border-accent/40 bg-accent/10 text-accent" : "border-border hover:text-white"}`}
        >
          {timed ? "Contra reloj: sí" : "Contra reloj: no"}
        </button>
        {timed && game?.status === "playing" && game.startedAt && (
          <span className="tabular-nums font-medium text-white">
            {(() => {
              const s = Math.max(0, Math.floor((now - Date.parse(String(game.startedAt).replace(" ", "T") + "Z")) / 1000));
              return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
            })()}
          </span>
        )}
        <span>{timed ? "Ganando en 1, 2 o 3 minutos sumás +20, +10 o +5." : "Activalo para sumar puntos extra por rapidez."}</span>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando...</p>}

      {!loading && mode === "random" && !game && (
        <Card className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Dificultad</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {meta.difficulties.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`rounded-card border px-3 py-2.5 text-left transition-colors ${
                  difficulty === d.id ? "border-accent bg-accent/10" : "border-border hover:border-white/30"
                }`}
              >
                <p className={`text-sm font-semibold ${difficulty === d.id ? "text-accent" : ""}`}>{d.label}</p>
                <p className="text-xs text-gray-500">
                  {d.id === "facil" ? "Solo cracks conocidos" : d.id === "normal" ? "Figuras y buen nivel" : "Cualquiera, hasta suplentes"} · ×{d.multiplier}
                </p>
              </button>
            ))}
          </div>
          <button onClick={newGame} disabled={busy} className="w-full py-2.5 rounded-card bg-accent text-bg font-semibold text-sm hover:opacity-90 disabled:opacity-50">
            Empezar partida
          </button>
        </Card>
      )}

      {!loading && game && (
        <div className="flex flex-col">
          <Card className="mb-6 order-2 lg:order-1 sticky bottom-20 lg:static z-10">
            <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
              <span className="uppercase tracking-wide">
                {game.mode === "daily" ? "Diario" : `Aleatorio · ${meta.difficulties.find((d) => d.id === game.difficulty)?.label || ""}`}
              </span>
              <span className="tabular-nums font-medium text-gray-300">
                Intento {Math.min(game.attemptsUsed, game.maxAttempts)} / {game.maxAttempts}
              </span>
            </div>

            {playing ? (
              <div>
                <div className="relative">
                  <div className="flex items-center gap-2 bg-bg border border-border rounded-card px-3 py-2.5">
                    <User size={16} className="text-gray-500 shrink-0" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && suggestions.length >= 1) guess(suggestions[0]); }}
                      placeholder="Nombre del jugador…"
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                      disabled={busy}
                    />
                  </div>
                  {suggestions.length > 0 && (
                    <div className="absolute z-10 bottom-full mb-1 lg:bottom-auto lg:top-full lg:mt-1 w-full bg-panel border border-border rounded-card overflow-hidden shadow-lg">
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

                <div className="flex items-center justify-between gap-3 mt-3">
                  <p className="text-xs text-gray-500 leading-snug">
                    {game.hints.length ? game.hints.join(" · ") : "Sin pistas usadas."}
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={useHint}
                      disabled={!canHint || busy}
                      className="flex items-center gap-1 text-xs font-medium border border-border rounded-full px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Lightbulb size={12} /> Pista (−{meta.hintCost})
                    </button>
                    <button
                      onClick={giveUp}
                      disabled={busy}
                      className="text-xs font-medium border border-border rounded-full px-3 py-1.5 text-gray-400 hover:border-red-400 hover:text-red-400 transition-colors"
                    >
                      Rendirme
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-3">
                {game.status === "won" ? <Check size={28} className="text-emerald mx-auto mb-2" /> : <Lock size={26} className="text-gray-500 mx-auto mb-2" />}
                <p className="font-semibold">
                  {game.status === "won" ? `¡Era ${game.secret.name}!` : `El jugador secreto era ${game.secret.name}`}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {game.secret.position} · {game.secret.nationality} · {game.secret.club || "sin club"}
                  {game.secret.league ? ` (${game.secret.league})` : ""} · nació en {game.secret.birth_year}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {game.status === "won"
                    ? `Lo adivinaste en ${game.attemptsUsed} de ${game.maxAttempts} intentos.`
                    : game.attemptsUsed < game.maxAttempts ? "Te rendiste." : "Se acabaron los intentos."}
                  {" "}{game.points > 0 ? `+${game.points} pts` : "Sin puntos esta vez."}
                </p>
                {groupId && groupSave && (
                  <p className="text-xs text-accent mt-1">
                    {groupSave.improved ? "Nueva mejor marca de la semana en el grupo" : "Guardado (no superó tu mejor marca de la semana)"}
                  </p>
                )}
                {!groupId && <p className="text-xs text-gray-600 mt-1">Unite a un grupo para que tus puntos cuenten en el ranking semanal.</p>}
                <div className="flex gap-2 justify-center mt-4">
                  <button onClick={copyShare} className="px-4 py-2 rounded-card border border-border text-sm text-gray-300 hover:text-white">
                    {copied ? "Copiado" : "Compartir"}
                  </button>
                  {game.mode === "random" ? (
                    <button onClick={newGame} disabled={busy} className="px-4 py-2 rounded-card bg-accent text-bg text-sm font-semibold hover:opacity-90">
                      Jugar de nuevo
                    </button>
                  ) : (
                    <p className="text-xs text-gray-600 self-center">Volvé mañana por el próximo, o probá el modo Aleatorio.</p>
                  )}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-400 mt-3 flex items-center gap-1.5"><X size={13} />{error}</p>}
          </Card>

          {game.guesses.length > 0 && (
            <div className="space-y-3 order-1 lg:order-2 mb-4 lg:mb-0">
              {game.guesses.map((g) => <GuessRow key={g.name} g={g} />)}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
