import { useEffect, useState } from "react";
import { ArrowLeftRight, Flag, Globe2, Cake, SkipForward, User } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import { ClubCrest } from "../components/PlayerFace.jsx";
import Autocomplete from "../futgames/Autocomplete.jsx";
import { GameHeader, Layout, ShareResult } from "../futgames/Shell.jsx";
import { loadGame, recordResult, saveGame } from "../futgames/storage.js";
import { reportResult } from "../futgames/report.js";
import { playSfx } from "../utils/sfx.js";

// Traspasos a ciegas: la línea de clubes de un jugador, sin nombre. 5 intentos;
// arranca con 2 clubes y cada fallo o salto suma uno más (y después, posición,
// nacionalidad y año de nacimiento). El jugador sale de la fecha, igual para todos.
const GAME = "traspasos";
const today = () => new Date().toISOString().slice(0, 10);
const MAX = 5;

// Qué pista llega con cada intento fallido (la 1ª es solo un club más).
const NEXT_HINT = ["otro club", "la posición", "la nacionalidad", "el año de nacimiento", null];

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
        <div className="space-y-4">
          <div className="hero-b rounded-3xl p-5 sm:p-7 overflow-hidden" style={{ "--hero-a": "var(--c-blue)", "--hero-b": "var(--c-emerald)" }}>
            <p className="relative t-eyebrow mb-3">La carrera, sin nombre</p>
            <ul className="relative space-y-0" aria-hidden="true">
              {[["Club de origen", "2011 – 2016", true], ["Primer salto", "2016 – 2019", true], ["???", "2019 – ???", false]].map(([c, y, open], i) => (
                <li key={c} className="flex items-center gap-3 py-2">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${open ? "bg-accent/25 border border-accent/60" : "border border-dashed border-border text-gray-500"}`}>{open ? i + 1 : "?"}</span>
                  <span className={`flex-1 text-sm ${open ? "text-gray-300" : "text-gray-500"}`}>{c}</span>
                  <span className="text-xs text-gray-500 tabular-nums">{y}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="space-y-4">
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex gap-2"><ArrowLeftRight size={16} className="text-accent shrink-0 mt-0.5" />Ves los clubes de un jugador, en orden y con años. Adiviná quién es.</li>
              <li className="flex gap-2"><Flag size={16} className="text-accent shrink-0 mt-0.5" />Tenés 5 intentos. Arrancás con 2 clubes; cada fallo o salto destapa uno más.</li>
              <li className="flex gap-2"><Globe2 size={16} className="text-accent shrink-0 mt-0.5" />Después llegan las pistas: posición, nacionalidad y año de nacimiento.</li>
            </ul>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={start} disabled={busy} className="btn btn-primary w-full">Empezar</button>
            <p className="text-xs text-gray-500 text-center">Un jugador por día, igual para todos.</p>
          </Card>
        </div>
      )}

      {state && puzzle && (
        <div className="space-y-4">
          <Card>
            <ol className="relative" aria-label="Clubes del jugador">
              {steps.map((s, i) => {
                const last = i === steps.length - 1 && (over || steps.length >= puzzle.total);
                return (
                  <li key={`${s.club}-${s.from}-${i}`} className="relative flex items-center gap-3 pb-4 last:pb-0">
                    {!last && <span className="absolute left-[19px] top-10 bottom-0 w-px bg-border" aria-hidden="true" />}
                    <span className="w-10 h-10 shrink-0 rounded-full bg-panel border border-border flex items-center justify-center">
                      <ClubCrest name={s.club} size={28} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium leading-tight truncate">{s.club}</span>
                      {s.tag && <span className="text-[11px] uppercase tracking-wide text-gray-500">{s.tag}</span>}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">{years(s)}</span>
                  </li>
                );
              })}
              {!over && steps.length < puzzle.total && Array.from({ length: Math.min(3, puzzle.total - steps.length) }).map((_, i) => (
                <li key={`hidden-${i}`} className="relative flex items-center gap-3 pt-4">
                  <span className="w-10 h-10 shrink-0 rounded-full border border-dashed border-border text-gray-600 flex items-center justify-center text-sm font-bold">?</span>
                  <span className="flex-1 text-sm text-gray-600">{i === 0 ? "Club oculto" : ""}</span>
                  {i === 2 && puzzle.total - steps.length > 3 && <span className="text-xs text-gray-600">+ {puzzle.total - steps.length - 3} más</span>}
                </li>
              ))}
            </ol>
            {!over && (puzzle.hints.position || puzzle.hints.nationality || puzzle.hints.born) && (
              <p className="flex flex-wrap gap-2 mt-5">
                {puzzle.hints.position && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-xs"><User size={12} />{puzzle.hints.position}</span>}
                {puzzle.hints.nationality && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-xs"><Globe2 size={12} />{puzzle.hints.nationality}</span>}
                {puzzle.hints.born && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-xs"><Cake size={12} />Nació en {puzzle.hints.born}</span>}
              </p>
            )}
            {!over && NEXT_HINT[attempts] && <p className="text-xs text-gray-500 mt-4 text-center">Si fallás, se destapa {NEXT_HINT[attempts]}.</p>}
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
