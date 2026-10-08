import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Flag, Grid3x3, Heart, Timer } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import PlayerFace from "../components/PlayerFace.jsx";
import Autocomplete from "../futgames/Autocomplete.jsx";
import { GameHeader, Layout, ShareResult } from "../futgames/Shell.jsx";
import { loadGame, recordResult, saveGame } from "../futgames/storage.js";
import { reportResult } from "../futgames/report.js";
import { playSfx } from "../utils/sfx.js";

// Bingo futbolero (antes Tateti): tablero 3x3 con clubes/selecciones en filas y columnas;
// hay que llenar cada casilla con un jugador que cumpla las dos cosas. El
// reto es el mismo para todos en el día (lo arma el server según la fecha).
const GAME = "tateti";
const today = () => new Date().toISOString().slice(0, 10);
const COL_TONES = ["accent", "blue", "purple"];
const ROW_TONES = ["amber", "pink", "cyan"];
const TIMERS = [["0", "Sin tiempo"], ["90", "90 s"], ["60", "60 s"], ["40", "40 s"]];
const MODES = {
  facil: { title: "Fácil", text: "Sin límite de errores. Ideal para calentar.", hearts: 0 },
  medio: { title: "Medio", text: "Clubes menos conocidos y 3 errores como máximo.", hearts: 3 },
};

// Pantalla previa: un tablero de muestra, los tres pasos y la elección de dificultad.
function BingoIntro({ fromDaily, mode, setMode, timer, setTimer, busy, onStart, error }) {
  const demo = [1, 0, 1, 0, 1, 0, 1, 0, 0];
  return (
    <div className="space-y-4">
      <div className="hero-b rounded-3xl p-5 sm:p-7 overflow-hidden" style={{ "--hero-a": "var(--c-accent)", "--hero-b": "var(--c-purple)" }}>
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="grid grid-cols-3 gap-1.5 w-32 shrink-0 mx-auto sm:mx-0" aria-hidden="true">
            {demo.map((on, i) => (
              <span key={i} className={`aspect-square rounded-lg border ${on ? "bg-accent/30 border-accent/60" : "bg-bg/40 border-border"}`} />
            ))}
          </div>
          <ol className="space-y-3 text-sm text-gray-300">
            <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-accent text-onaccent text-xs font-bold flex items-center justify-center">1</span>Cada casilla cruza una fila (club o selección) con una columna (club).</li>
            <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-accent text-onaccent text-xs font-bold flex items-center justify-center">2</span>Escribí un futbolista que cumpla las dos cosas: si encaja en varias casillas, elegís dónde va.</li>
            <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-accent text-onaccent text-xs font-bold flex items-center justify-center">3</span>Llená las 9 casillas. Cada jugador se usa una sola vez.</li>
          </ol>
        </div>
      </div>

      <Card className="space-y-5">
        <div>
          <p className="t-eyebrow mb-2">{fromDaily ? "Dificultad del juego diario" : "Dificultad"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(MODES).filter(([k]) => !fromDaily || k === "medio").map(([k, m]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`text-left rounded-2xl border p-4 transition-colors ${mode === k ? "border-accent bg-accent/10" : "border-border hover:border-white/30"}`}
              >
                <span className="flex items-center justify-between">
                  <span className="font-semibold">{m.title}</span>
                  <span className="inline-flex gap-0.5" aria-hidden="true">
                    {m.hearts ? Array.from({ length: m.hearts }).map((_, i) => <Heart key={i} size={13} className="text-red-500 fill-red-500" />) : <span className="text-xs text-gray-500">sin límite</span>}
                  </span>
                </span>
                <span className="block text-xs text-gray-400 mt-1">{m.text}</span>
              </button>
            ))}
          </div>
        </div>
        {!fromDaily && (
          <div>
            <p className="t-eyebrow mb-2">Tiempo</p>
            <div className="flex gap-1.5 flex-wrap">
              {TIMERS.map(([k, l]) => (
                <button key={k} onClick={() => setTimer(k)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${timer === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={onStart} disabled={busy} className="btn btn-primary w-full">Empezar</button>
        <p className="text-xs text-gray-500 text-center">Un tablero por día, igual para todos.</p>
      </Card>
    </div>
  );
}

function CritLabel({ c }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-1 p-1 min-h-[64px]">
      {c.logo ? (
        <img src={c.logo} alt="" className="w-9 h-9 object-contain" loading="lazy" />
      ) : (
        <span className="text-2xl leading-none" aria-hidden="true">{c.flag || c.icon || "🛡️"}</span>
      )}
      <span className="text-[11px] font-semibold leading-tight break-words">{c.label || c.name}</span>
    </div>
  );
}

export default function Bingo() {
  const [params] = useSearchParams();
  const fromDaily = params.get("diario") === "1";
  // El juego diario y la partida libre se guardan por separado.
  const KEY = fromDaily ? GAME : `${GAME}-libre`;
  const [saved, setSaved] = useState(() => loadGame(KEY, today()));
  const [mode, setMode] = useState(saved?.mode || (fromDaily ? "medio" : "facil"));
  const [timer, setTimer] = useState(saved?.timer || "0");
  const [grid, setGrid] = useState(null);
  const [state, setState] = useState(saved); // { mode, timer, cells, errors, status, left }
  const [msg, setMsg] = useState("");
  const [choices, setChoices] = useState(null); // { name, cells }
  const [answers, setAnswers] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tick = useRef(null);

  const playing = state && state.status === "playing";
  const over = state && state.status !== "playing";

  // Al terminar (una sola vez): puntos/sobre del juego diario + Historial.
  const [dailyMsg, setDailyMsg] = useState("");
  useEffect(() => {
    if (!state || state.status === "playing" || state.reported) return;
    const next = { ...state, reported: true };
    setState(next);
    saveGame(KEY, today(), next);
    reportResult("tateti", {
      fraction: state.cells.filter(Boolean).length / 9,
      score: state.cells.filter(Boolean).length,
      difficulty: state.mode === "medio" ? 4 : 2,
      detail: `${state.cells.filter(Boolean).length}/9 casillas · ${state.mode === "medio" ? "medio" : "fácil"}`,
    }).then(setDailyMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  // Si hay partida guardada de hoy, cargar su tablero directamente.
  useEffect(() => {
    if (saved) load(saved.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (over && !answers) api.get("/futgames/grid/reveal", { params: { mode: state.mode } }).then((r) => setAnswers(r.data.answers)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  function persist(next) {
    setState(next);
    saveGame(KEY, today(), next);
    if (next.status !== "playing") {
      const score = next.cells.filter(Boolean).length;
      recordResult(GAME, today(), { won: next.status === "win", bucket: score });
    }
  }

  // Cuenta regresiva (se guarda lo que queda para retomar al recargar).
  useEffect(() => {
    clearInterval(tick.current);
    if (!playing || !state.left) return;
    tick.current = setInterval(() => {
      setState((s) => {
        if (!s || s.status !== "playing") return s;
        const left = s.left - 1;
        const next = left <= 0 ? { ...s, left: 0, status: "time" } : { ...s, left };
        saveGame(KEY, today(), next);
        if (next.status === "time") {
          recordResult(GAME, today(), { won: false, bucket: next.cells.filter(Boolean).length });
          playSfx("bad");
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick.current);
  }, [playing, state?.left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(m) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get("/futgames/grid", { params: { mode: m } });
      setGrid(data);
      return data;
    } catch {
      setError("No se pudo cargar el tablero. Probá de nuevo.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const data = await load(mode);
    if (!data) return;
    const secs = fromDaily ? 0 : Number(timer);
    const next = { mode, timer, cells: Array(9).fill(null), errors: 0, status: "playing", left: secs || null, maxErrors: data.maxErrors };
    setSaved(next);
    persist(next);
  }

  function place(name, cell) {
    const cells = [...state.cells];
    cells[cell] = name;
    setChoices(null);
    setMsg(`${name} quedó en la casilla elegida.`);
    playSfx("ok");
    const full = cells.every(Boolean);
    persist({ ...state, cells, status: full ? "win" : "playing" });
    if (full) playSfx("win");
  }

  async function guess(name) {
    if (!playing || busy) return;
    setBusy(true);
    setChoices(null);
    try {
      const filled = state.cells.map((c, i) => (c ? i : null)).filter((i) => i != null);
      const { data } = await api.post("/futgames/grid/place", { mode: state.mode, name, filled });
      if (data.cells.length === 0) {
        playSfx("bad");
        if (state.maxErrors) {
          const errors = state.errors + 1;
          const lost = errors >= state.maxErrors;
          setMsg(lost ? `No hay lugar para ${name}. Se terminaron los intentos.` : `No hay lugar para ${name}.`);
          persist({ ...state, errors, status: lost ? "lose" : "playing" });
        } else {
          setMsg(`No hay lugar para ${name}.`);
        }
      } else if (data.cells.length === 1) {
        place(name, data.cells[0]);
      } else {
        setMsg(`${name} encaja en varias casillas: tocá la que prefieras.`);
        setChoices({ name, cells: data.cells });
      }
    } catch {
      setMsg("No se pudo comprobar el jugador.");
    } finally {
      setBusy(false);
    }
  }

  function giveUp() {
    if (!window.confirm || window.confirm("¿Terminar la partida y ver las respuestas?")) {
      persist({ ...state, status: "giveup" });
    }
  }

  const score = state ? state.cells.filter(Boolean).length : 0;
  const shareText = state
    ? `⚽ Futotal · Bingo ${today()} (${state.mode === "medio" ? "medio" : "fácil"})\n` +
      [0, 1, 2].map((r) => [0, 1, 2].map((c) => (state.cells[r * 3 + c] ? "🟩" : "⬜")).join("")).join("\n") +
      `\n${score}/9`
    : "";

  return (
    <Layout>
      <GameHeader game={GAME} title="Bingo" subtitle="Un jugador que cumpla la fila y la columna." icon={Grid3x3} distLabel="casillas llenas" />

      {!state && (
        <BingoIntro fromDaily={fromDaily} mode={mode} setMode={setMode} timer={timer} setTimer={setTimer} busy={busy} onStart={start} error={error} />
      )}

      {state && grid && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">{state.mode === "medio" ? "Medio" : "Fácil"}</span>
            {state.maxErrors && (
              <span className="inline-flex items-center gap-1" aria-label={`Errores: ${state.errors} de ${state.maxErrors}`}>
                {Array.from({ length: state.maxErrors }).map((_, i) => (
                  <Heart key={i} size={15} className={i < state.maxErrors - state.errors ? "text-red-500 fill-red-500" : "text-gray-600"} />
                ))}
              </span>
            )}
            {state.left != null && (
              <span className={`inline-flex items-center gap-1 tabular-nums ${state.left <= 10 ? "text-red-400" : "text-gray-300"}`}>
                <Timer size={14} /> {state.left}s
              </span>
            )}
            <span className="ml-auto text-gray-400 tabular-nums">{score}/9</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 max-w-md mx-auto">
            <div />
            {grid.cols.map((c, ci) => <div key={c.name} className={`tone-${COL_TONES[ci]} tile-b rounded-xl p-1`}><CritLabel c={c} /></div>)}
            {grid.rows.map((r, ri) => (
              <div key={r.name} className="contents">
                <div className={`tone-${ROW_TONES[ri]} tile-b rounded-xl p-1`}><CritLabel c={r} /></div>
                {grid.cols.map((c, ci) => {
                  const i = ri * 3 + ci;
                  const name = state.cells[i];
                  const selectable = choices?.cells.includes(i);
                  const hint = over && !name && answers?.[i];
                  return (
                    <button
                      key={i}
                      disabled={!selectable}
                      onClick={() => selectable && place(choices.name, i)}
                      aria-label={name ? `${r.name} y ${c.name}: ${name}` : `${r.name} y ${c.name}: vacía`}
                      className={`tone-${COL_TONES[ci]} aspect-square rounded-xl border flex flex-col items-center justify-center p-1 text-center transition-colors ${
                        name ? "tile-b text-white"
                          : selectable ? "border-accent bg-accent/15 animate-pulse cursor-pointer"
                          : "border-border bg-panel"
                      }`}
                    >
                      {name ? (
                        <>
                          <PlayerFace name={name} size={34} className="mb-1 text-white" />
                          <span className="text-[10px] leading-tight font-medium line-clamp-2">{name}</span>
                        </>
                      ) : hint ? (
                        <span className="text-[9px] leading-tight text-gray-400 line-clamp-4">{hint.slice(0, 3).join(", ")}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {playing && (
            <Card>
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <Autocomplete
                    options={grid.players}
                    exclude={state.cells.filter(Boolean)}
                    onPick={guess}
                    disabled={busy}
                    placeholder="Escribí el futbolista…"
                  />
                </div>
                <button onClick={giveUp} className="p-2.5 rounded-card border border-border text-gray-400 hover:text-white" aria-label="Rendirse" title="Rendirse">
                  <Flag size={16} />
                </button>
              </div>
              {msg && <p className="text-sm text-gray-300 mt-3" role="status">{msg}</p>}
            </Card>
          )}

          {over && (
            <Card className="text-center py-6 space-y-3">
              <p className="text-2xl font-bold">{state.status === "win" ? "¡Tablero completo!" : state.status === "time" ? "Se acabó el tiempo" : state.status === "lose" ? "Sin errores restantes" : "Partida terminada"}</p>
              <p className="text-gray-400 text-sm">{score}/9 casillas · {answers ? "En las vacías ves respuestas posibles." : ""}</p>
              {dailyMsg && <p className="text-sm text-accent">{dailyMsg}</p>}
              <ShareResult text={shareText} />
              <p className="text-xs text-gray-500">Mañana hay un tablero nuevo.</p>
            </Card>
          )}
        </div>
      )}
      {state && !grid && error && <p className="text-sm text-red-400">{error}</p>}
    </Layout>
  );
}
