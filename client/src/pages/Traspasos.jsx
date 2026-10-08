import { useEffect, useState } from "react";
import { ArrowLeftRight, SkipForward, User } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import Autocomplete from "../futgames/Autocomplete.jsx";
import { GameHeader, Layout, PreGame, ShareResult } from "../futgames/Shell.jsx";
import { loadGame, recordResult, saveGame } from "../futgames/storage.js";
import { reportResult } from "../futgames/report.js";
import { playSfx } from "../utils/sfx.js";

// Traspasos a ciegas: la línea de clubes de un jugador, sin nombre. 5 intentos;
// arranca con 2 clubes y cada fallo o salto suma uno más (y después, posición,
// nacionalidad y año de nacimiento). El jugador sale de la fecha, igual para todos.
const GAME = "traspasos";
const today = () => new Date().toISOString().slice(0, 10);
const MAX = 5;

const years = (s) => `${s.from}${s.to === null ? " – hoy" : s.to === s.from ? "" : ` – ${s.to}`}`;

export default function Traspasos() {
  const [state, setState] = useState(() => loadGame(GAME, today())); // { guesses, status }
  const [puzzle, setPuzzle] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [dailyMsg, setDailyMsg] = useState("");

  const over = state && state.status !== "playing";
  const attempts = state ? state.guesses.length : 0;

  async function fetchPuzzle(n) {
    const { data } = await api.get("/traspasos/puzzle", { params: { attempts: n } });
    setPuzzle(data);
  }

  // Cada intento fallido pide una pista más al servidor.
  useEffect(() => {
    if (!state) return;
    fetchPuzzle(over ? MAX - 1 : attempts).catch(() => setError("No se pudo cargar el juego."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.guesses.length, state?.status]);

  useEffect(() => {
    if (over && !reveal) api.get("/traspasos/reveal").then((r) => setReveal(r.data)).catch(() => {});
  }, [over, reveal]);

  // Al terminar (una sola vez): puntos/sobre del juego diario + Historial.
  useEffect(() => {
    if (!state || state.status === "playing" || state.reported) return;
    const next = { ...state, reported: true };
    setState(next);
    saveGame(GAME, today(), next);
    const won = state.status === "win";
    reportResult("traspasos", {
      // Acertar al 1º = 1; 2º = 0.8; 3º = 0.6; 4º = 0.4; 5º = 0.2; no acertar = 0.
      fraction: won ? (MAX + 1 - state.guesses.length) / MAX : 0,
      score: won ? MAX + 1 - state.guesses.length : 0,
      difficulty: 3,
      detail: won ? `Acertado en ${state.guesses.length}/${MAX}` : "No salió",
    }).then(setDailyMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  function persist(next) {
    setState(next);
    saveGame(GAME, today(), next);
    if (next.status !== "playing") recordResult(GAME, today(), { won: next.status === "win", bucket: next.status === "win" ? next.guesses.length : "X" });
  }

  function start() {
    setError("");
    persist({ guesses: [], status: "playing" });
  }

  function miss(guess) {
    const guesses = [...state.guesses, guess];
    persist({ ...state, guesses, status: guesses.length >= MAX ? "lose" : "playing" });
    playSfx("bad");
  }

  async function guess(name) {
    if (busy || over) return;
    setBusy(true);
    try {
      const { data } = await api.post("/traspasos/guess", { name });
      if (data.correct) {
        persist({ ...state, guesses: [...state.guesses, name], status: "win" });
        setMsg("");
        playSfx("win");
      } else {
        setMsg(`No es ${name}.`);
        miss(name);
      }
    } catch {
      setMsg("No se pudo comprobar.");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    setMsg("Salteaste: se destapa más.");
    miss(null);
  }

  const shareText = state && over
    ? `⚽ Futotal · Traspasos a ciegas ${today()}\n` +
      Array.from({ length: MAX }).map((_, i) => {
        if (i >= state.guesses.length) return "⬜";
        return state.status === "win" && i === state.guesses.length - 1 ? "🟩" : state.guesses[i] === null ? "⏭️" : "🟥";
      }).join("") +
      (state.status === "win" ? ` ${state.guesses.length}/${MAX}` : ` X/${MAX}`)
    : "";

  const steps = over && reveal ? reveal.career : puzzle?.steps || [];

  return (
    <Layout>
      <GameHeader game={GAME} title="Traspasos a ciegas" subtitle="Adiviná al jugador por sus clubes." icon={ArrowLeftRight} distLabel="intentos usados" />

      {!state && (
        <PreGame
          busy={busy}
          onStart={start}
          how={[
            "Ves la línea de clubes de un jugador, en orden, sin su nombre.",
            "Tenés 5 intentos. Arrancás con 2 clubes; cada fallo o salto suma uno más.",
            "Desde el 3º intento aparece la posición, después la nacionalidad y al final el año de nacimiento.",
          ]}
        >
          {error && <p className="text-sm text-red-400">{error}</p>}
        </PreGame>
      )}

      {state && puzzle && (
        <div className="space-y-4">
          <Card>
            <ol className="space-y-2" aria-label="Clubes del jugador">
              {steps.map((s, i) => (
                <li key={`${s.club}-${s.from}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <span className="font-medium">
                    {s.club}
                    {s.tag && <span className="ml-2 text-[11px] uppercase tracking-wide text-gray-500">{s.tag}</span>}
                  </span>
                  <span className="text-xs text-gray-500 tabular-nums shrink-0">{years(s)}</span>
                </li>
              ))}
              {!over && steps.length < puzzle.total && (
                <li className="text-xs text-gray-600 pt-1">+ {puzzle.total - steps.length} club{puzzle.total - steps.length === 1 ? "" : "es"} más sin mostrar</li>
              )}
            </ol>
            {!over && (puzzle.hints.position || puzzle.hints.nationality || puzzle.hints.born) && (
              <p className="flex flex-wrap gap-2 mt-4">
                {puzzle.hints.position && <span className="px-2.5 py-1 rounded-full border border-border text-xs"><User size={11} className="inline mr-1" />{puzzle.hints.position}</span>}
                {puzzle.hints.nationality && <span className="px-2.5 py-1 rounded-full border border-border text-xs">{puzzle.hints.nationality}</span>}
                {puzzle.hints.born && <span className="px-2.5 py-1 rounded-full border border-border text-xs">Nació en {puzzle.hints.born}</span>}
              </p>
            )}
            <div className="flex justify-center items-center gap-2 mt-4" aria-label={`Intentos: ${attempts} de ${MAX}`}>
              {Array.from({ length: MAX }).map((_, i) => {
                const used = i < attempts;
                const won = state.status === "win" && i === attempts - 1;
                return <span key={i} className={`w-3 h-3 rounded-full ${won ? "bg-emerald-500" : used ? "bg-red-500" : "bg-amber-400"}`} />;
              })}
            </div>
          </Card>

          {!over && (
            <Card>
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <Autocomplete options={puzzle.players} exclude={state.guesses.filter(Boolean)} onPick={guess} disabled={busy} placeholder="Escribí el jugador…" />
                </div>
                <button onClick={skip} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2.5 rounded-card border border-border text-xs text-gray-300 hover:text-white" title="Saltar (cuenta como intento)">
                  <SkipForward size={14} /> Saltar
                </button>
              </div>
              {msg && <p className="text-sm text-gray-300 mt-3" role="status">{msg}</p>}
              {state.guesses.some(Boolean) && <p className="text-xs text-gray-500 mt-2 line-through">{state.guesses.filter(Boolean).join(", ")}</p>}
            </Card>
          )}

          {over && (
            <Card className="text-center py-6 space-y-3">
              <p className="text-2xl font-bold">{state.status === "win" ? "¡Acertaste!" : "Sin intentos"}</p>
              <p className="text-gray-400 text-sm">Era <span className="text-white font-semibold">{reveal?.name || "…"}</span>{reveal ? ` · ${reveal.position} · ${reveal.nationality}` : ""}</p>
              {dailyMsg && <p className="text-sm text-accent">{dailyMsg}</p>}
              <ShareResult text={shareText} />
              <p className="text-xs text-gray-500">Mañana hay otro jugador.</p>
            </Card>
          )}
        </div>
      )}
      {state && !puzzle && error && <p className="text-sm text-red-400">{error}</p>}
    </Layout>
  );
}
