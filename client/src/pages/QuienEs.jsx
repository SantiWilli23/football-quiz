import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, Search, Tv } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { reportResult } from "../futgames/report.js";
import ResultScreen from "../components/ResultScreen.jsx";
import { playSfx } from "../utils/sfx.js";

// "¿Quién es?" solo. Desde Fútbol 12 son partidas libres (infinitas, dan sobre y no suman puntos);
// desde "Juego diario" (?diario=1) es el jugador del día, igual para todos, una sola vez y con puntos.
// El modo En vivo (1 contra 1) vive aparte, dentro de ¿Quién sabe más de fútbol?.
const today = () => new Date().toISOString().slice(0, 10);
const DAILY_KEY = "quien_es_diario";

export default function QuienEs() {
  const fromDaily = useSearchParams()[0].get("diario") === "1";
  return (
    <Layout>
      <QuienEsSolo fromDaily={fromDaily} />
    </Layout>
  );
}

// "¿Quién es?" solo: aparece la carrera del jugador club por club y hay que
// adivinarlo con la menor cantidad de pistas. Cada pista extra resta 10 puntos.
function QuienEsSolo({ fromDaily }) {
  const [difficulty, setDifficulty] = useState("facil");
  const [dailyMsg, setDailyMsg] = useState("");
  // Diario ya jugado hoy: se muestra el resultado guardado y no se puede volver a jugar.
  const [dailyDone] = useState(() => {
    if (!fromDaily) return null;
    try { const s = JSON.parse(localStorage.getItem(DAILY_KEY) || "null"); return s && s.date === today() ? s : null; } catch { return null; }
  });
  const [game, setGame] = useState(null); // { token, total, clues: [] }
  const [names, setNames] = useState([]);
  const [query, setQuery] = useState("");
  const [wrong, setWrong] = useState([]);
  const [result, setResult] = useState(null); // { won, name, points }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/wordle/players", { params: { league: "global" } }).then((r) => setNames(r.data.players)).catch(() => {});
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get("/quien-es/new", { params: fromDaily ? { mode: "daily" } : { difficulty } });
      setGame({ token: data.token, total: data.total, clues: [data.first] });
      setWrong([]);
      setResult(null);
      setQuery("");
    } catch {
      setError("No se pudo armar la ronda. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function moreClue() {
    if (!game || game.clues.length >= game.total || busy) return;
    setBusy(true);
    try {
      const { data } = await api.get("/quien-es/clue", { params: { token: game.token, i: game.clues.length } });
      setGame((g) => ({ ...g, clues: [...g.clues, data.clue] }));
      playSfx("tick");
    } catch {
      setError("No se pudo pedir la pista.");
    } finally {
      setBusy(false);
    }
  }

  async function guess(name) {
    if (!game || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/quien-es/guess", { token: game.token, name, cluesShown: game.clues.length });
      if (data.correct) {
        playSfx("win");
        setResult({ won: true, name: data.name, points: data.points });
        finishGame(data.points, "Adivinado con " + game.clues.length + " pista" + (game.clues.length === 1 ? "" : "s") + ": " + data.name, data.name);
      } else {
        playSfx("bad");
        setWrong((w) => [...w, name]);
        setQuery("");
        if (game.clues.length < game.total) await moreClue();
      }
    } catch {
      setError("No se pudo comprobar la respuesta.");
    } finally {
      setBusy(false);
    }
  }

  async function giveUp() {
    const { data } = await api.post("/quien-es/reveal", { token: game.token });
    setResult({ won: false, name: data.name, points: 0 });
    finishGame(0, "Te rendiste: " + data.name, data.name);
  }

  // Manda el resultado al historial y al juego diario (solo suma puntos si se entró por el diario).
  function finishGame(points, detail, name) {
    if (fromDaily) { try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today(), points, name })); } catch { /* sin storage */ } }
    reportResult("quien_es", {
      fraction: points / 100,
      score: points,
      difficulty: fromDaily ? 2 : difficulty === "dificil" ? 4 : 2,
      detail,
      mode: fromDaily ? "daily" : "fun",
      level: fromDaily ? "normal" : difficulty === "dificil" ? "dificil" : "facil",
    }).then(setDailyMsg);
  }

  const suggestions = query.trim().length >= 2
    ? names.filter((n) => n.toLowerCase().includes(query.trim().toLowerCase()) && !wrong.includes(n)).slice(0, 6)
    : [];

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Tv size={22} className="text-accent shrink-0" />
        <div>
          <h1 className="t-title">¿Quién es?</h1>
          <p className="text-gray-400 text-sm">Te mostramos su carrera club por club. Adiviná quién es con la menor cantidad de pistas.</p>
        </div>
      </div>

      {fromDaily && dailyDone && !game && (
        <Card className="text-center py-8">
          <p className="text-sm text-gray-400 mb-1">Ya jugaste el diario de hoy. Era</p>
          <p className="text-2xl font-bold mb-2">{dailyDone.name}</p>
          <p className="text-sm text-gray-300">Sacaste {dailyDone.points} de 100. Mañana hay otro jugador.</p>
        </Card>
      )}

      {!game && !(fromDaily && dailyDone) && (
        <Card className="text-center py-8">
          <p className="text-sm text-gray-400 mb-4">
            Cada pista extra resta 10 puntos. Si fallás, se revela otra.
            {fromDaily ? " Juego diario: el mismo jugador para todos, una sola vez al día." : " Partida libre: las veces que quieras, da un sobre y no suma puntos al grupo."}
          </p>
          {!fromDaily && <div className="flex gap-2 justify-center mb-5">
            {[["facil", "Conocidos"], ["dificil", "Todos"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setDifficulty(k)}
                className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
                  difficulty === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>}
          <button onClick={start} disabled={busy} className="px-6 py-2.5 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90">
            Empezar
          </button>
        </Card>
      )}

      {game && !result && (
        <div className="space-y-4">
          <Card>
            <p className="t-eyebrow mb-3">Su carrera</p>
            {/* Línea de "escudos" (iniciales sobre un color derivado del nombre del
                club, no hay logos reales para esta base) que se destapa a medida
                que se piden pistas de club. */}
            <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1" role="img" aria-label="Carrera del jugador, club por club">
              {game.clues.filter((c) => c.kind === "club").map((c, i) => {
                const name = c.text.split(" · ")[0];
                const hue = [...name].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 360;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: `hsl(${hue} 45% 32%)` }}
                      title={c.text}
                    >
                      {name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-600">{c.text.split(" · ")[1] || ""}</span>
                  </div>
                );
              })}
              {game.clues[game.clues.length - 1]?.kind === "club" && game.clues.length < game.total && (
                <div className="w-10 h-10 rounded-lg border border-dashed border-border flex items-center justify-center text-gray-600 shrink-0">?</div>
              )}
            </div>
            <ol className="space-y-2">
              {game.clues.map((c, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-xs text-gray-500">{c.label}</span>
                  <span className={c.kind === "club" ? "font-medium" : "text-accent"}>{c.text}</span>
                </li>
              ))}
            </ol>
            <p className="t-meta mt-3">
              Pista {game.clues.length} de {game.total} · valen {Math.max(10, 100 - 10 * (game.clues.length - 1))} puntos
            </p>
          </Card>

          <Card>
            <div className="relative">
              <div className="flex items-center gap-2 bg-bg border border-border rounded-card px-3 py-2.5">
                <Search size={15} className="text-gray-500 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && suggestions.length === 1) guess(suggestions[0]); }}
                  placeholder="¿Quién es?…"
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  aria-label="Nombre del jugador"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-panel border border-border rounded-card overflow-hidden shadow-lg">
                  {suggestions.map((n) => (
                    <button key={n} onClick={() => guess(n)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 hover:text-accent transition-colors">
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {wrong.length > 0 && <p className="t-meta mt-3 line-through">No es: {wrong.join(", ")}</p>}
            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={moreClue}
                disabled={busy || game.clues.length >= game.total}
                className="px-4 py-2 rounded-card border border-border text-xs font-medium text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <Eye size={13} /> Otra pista (−10)
              </button>
              <button onClick={giveUp} className="px-4 py-2 rounded-card text-xs font-medium text-gray-500 hover:text-white">
                Me rindo
              </button>
            </div>
          </Card>
        </div>
      )}

      {result && (
        <>
          {result.won ? (
            <ResultScreen
              score={result.points}
              unit={`puntos · era ${result.name}`}
              onAgain={fromDaily ? undefined : start}
              highlight={dailyMsg || undefined}
              shareText={`⚽ Futotal · ¿Quién es?: adiviné a ${result.name} con ${game.clues.length} pista${game.clues.length === 1 ? "" : "s"} (${result.points} pts) — ¿podés vos?`}
            />
          ) : (
            <Card className="text-center py-8">
              <p className="text-sm text-gray-400 mb-1">Era</p>
              <p className="text-2xl font-bold mb-5">{result.name}</p>
              {dailyMsg && <p className="text-sm text-accent mb-3">{dailyMsg}</p>}
              {!fromDaily && <button onClick={start} className="px-6 py-2.5 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90">
                Jugar de nuevo
              </button>}
            </Card>
          )}
        </>
      )}
    </>
  );
}
