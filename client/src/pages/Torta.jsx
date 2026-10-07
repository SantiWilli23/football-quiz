import { useEffect, useState } from "react";
import { PieChart, Shirt, SkipForward } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import Autocomplete from "../futgames/Autocomplete.jsx";
import { GameHeader, Layout, OptionRow, PreGame, ShareResult } from "../futgames/Shell.jsx";
import { loadGame, recordResult, saveGame } from "../futgames/storage.js";
import { reportResult } from "../futgames/report.js";
import { playSfx } from "../utils/sfx.js";

// Torta de plantel: una torta con las nacionalidades de los jugadores (de la
// base de Futotal) que vistieron la camiseta de un club. Hay que adivinar el
// club en 3 intentos; cada fallo o salto destapa más porciones (30/60/100%).
const GAME = "torta";
const today = () => new Date().toISOString().slice(0, 10);
const MAX = 3;

const R_OUT = 120;
const R_IN = 62;

function arcPath(a0, a1) {
  const p = (r, a) => [150 + r * Math.sin(a), 150 - r * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(R_OUT, a0);
  const [x1, y1] = p(R_OUT, a1);
  const [x2, y2] = p(R_IN, a1);
  const [x3, y3] = p(R_IN, a0);
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3}Z`;
}

const HUES = [152, 38, 205, 0, 275, 95, 330, 180, 60, 20, 240, 125];

function Donut({ countries, visible, centerTop, centerBottom, onHover, hover }) {
  const total = countries.reduce((n, c) => n + c.count, 0);
  let acc = 0;
  const slices = countries.map((c, i) => {
    const a0 = (acc / total) * 2 * Math.PI;
    acc += c.count;
    const a1 = (acc / total) * 2 * Math.PI - (countries.length > 1 ? 0.012 : 0);
    return { ...c, i, a0, a1, mid: (a0 + a1) / 2 };
  });
  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[320px] mx-auto block" role="img" aria-label="Torta de nacionalidades del plantel">
      {slices.map((s) => {
        const shown = visible.has(s.i);
        const full = countries.length === 1;
        return (
          <g key={s.country} onMouseEnter={() => shown && onHover(s.i)} onMouseLeave={() => onHover(null)} onClick={() => shown && onHover(s.i)} style={{ cursor: shown ? "pointer" : "default" }}>
            {full ? (
              <circle cx="150" cy="150" r={(R_OUT + R_IN) / 2} fill="none" strokeWidth={R_OUT - R_IN} stroke={shown ? `hsl(${HUES[0]} 45% 38%)` : "rgba(128,128,128,0.18)"} />
            ) : (
              <path
                d={arcPath(s.a0, s.a1)}
                fill={shown ? `hsl(${HUES[s.i % HUES.length]} 45% ${hover === s.i ? 48 : 36}%)` : "rgba(128,128,128,0.18)"}
                stroke={shown ? "none" : "rgba(128,128,128,0.35)"}
                strokeDasharray={shown ? undefined : "3 3"}
              />
            )}
            {shown && s.a1 - s.a0 > 0.09 && (
              <text x={150 + 91 * Math.sin(s.mid)} y={150 - 91 * Math.cos(s.mid)} textAnchor="middle" dominantBaseline="central" fontSize={s.a1 - s.a0 > 0.5 ? 22 : s.a1 - s.a0 > 0.25 ? 15 : 9}>
                {s.flag}
              </text>
            )}
          </g>
        );
      })}
      <text x="150" y="138" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">{centerTop}</text>
      <text x="150" y="160" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">{centerBottom}</text>
      {hover != null && (
        <text x="150" y="182" textAnchor="middle" fontSize="11" fill="currentColor">
          {countries[hover].flag} {countries[hover].count} jug.
        </text>
      )}
    </svg>
  );
}

export default function Torta() {
  const [mode, setMode] = useState("clockwise");
  const [data, setData] = useState(null);
  const [state, setState] = useState(() => loadGame(GAME, today())); // { mode, step, guesses, status }
  const [reveal, setReveal] = useState(null);
  const [hover, setHover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const over = state && state.status !== "playing";

  // Al terminar (una sola vez): puntos/sobre del juego diario + Historial.
  const [dailyMsg, setDailyMsg] = useState("");
  useEffect(() => {
    if (!state || state.status === "playing" || state.reported) return;
    const next = { ...state, reported: true };
    setState(next);
    saveGame(GAME, today(), next);
    reportResult("torta", {
      // Acertar en el 1º intento = 1; en el 2º = 2/3; en el 3º = 1/3; no acertar = 0.
      fraction: state.status === "win" ? (MAX + 1 - state.guesses.length) / MAX : 0,
      score: state.status === "win" ? MAX + 1 - state.guesses.length : 0,
      difficulty: state.mode === "random" ? 3 : 2,
      detail: state.status === "win" ? `Acertado en ${state.guesses.length}/${MAX}` : "No salió",
    }).then(setDailyMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  async function fetchPuzzle() {
    const { data: d } = await api.get("/futgames/squad");
    setData(d);
    return d;
  }

  useEffect(() => {
    if (state) fetchPuzzle().catch(() => setError("No se pudo cargar el juego."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (over && !reveal) api.get("/futgames/squad/reveal").then((r) => setReveal(r.data)).catch(() => {});
  }, [over, reveal]);

  function persist(next) {
    setState(next);
    saveGame(GAME, today(), next);
    if (next.status !== "playing") recordResult(GAME, today(), { won: next.status === "win", bucket: next.status === "win" ? next.guesses.length : "X" });
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      await fetchPuzzle();
      persist({ mode, step: 0, guesses: [], status: "playing" });
    } catch {
      setError("No se pudo cargar el juego. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function miss(guess) {
    const guesses = [...state.guesses, guess];
    const lost = guesses.length >= MAX;
    persist({ ...state, guesses, step: Math.min(MAX - 1, state.step + 1), status: lost ? "lose" : "playing" });
    playSfx("bad");
  }

  async function guess(club) {
    if (busy || over) return;
    setBusy(true);
    try {
      const { data: r } = await api.post("/futgames/squad/guess", { club });
      if (r.correct) {
        persist({ ...state, guesses: [...state.guesses, club], status: "win" });
        setMsg("");
        playSfx("win");
      } else {
        setMsg(`No es ${club}.`);
        miss(club);
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

  const visible = data && state
    ? new Set(over ? data.countries.map((_, i) => i) : data.reveal[state.mode][state.step])
    : new Set();

  const shareText = state && over
    ? `⚽ Futotal · Torta de plantel ${today()}\n` +
      Array.from({ length: MAX }).map((_, i) => {
        const g = state.guesses[i];
        if (i >= state.guesses.length) return "⬜";
        return state.status === "win" && i === state.guesses.length - 1 ? "🟩" : g === null ? "⏭️" : "🟥";
      }).join("") +
      (state.status === "win" ? ` ${state.guesses.length}/${MAX}` : " X/3")
    : "";

  const hovered = hover != null && data ? data.countries[hover] : null;
  const hoveredPlayers = hovered && reveal ? reveal.countries.find((c) => c.country === hovered.country)?.players : null;

  return (
    <Layout>
      <GameHeader game={GAME} title="Torta de plantel" subtitle="Adiviná el club por las nacionalidades." icon={PieChart} distLabel="intentos usados" />

      {!state && (
        <PreGame
          busy={busy}
          onStart={start}
          how={[
            "La torta muestra las nacionalidades de los jugadores de nuestra base que pasaron por un club (su historia, no una sola temporada).",
            "Cada porción es un país; el tamaño es la cantidad de jugadores.",
            "Tenés 3 intentos. Al principio ves ~30% de la torta; cada fallo o salto destapa más (60% y 100%).",
          ]}
        >
          <OptionRow label="Cómo se destapa" value={mode} onChange={setMode} options={[["clockwise", "De mayor a menor"], ["random", "Al azar"]]} />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </PreGame>
      )}

      {state && data && (
        <div className="space-y-4">
          <Card>
            <Donut
              countries={data.countries}
              visible={visible}
              hover={hover}
              onHover={setHover}
              centerTop={over ? (reveal?.club || "…") : "¿Qué club?"}
              centerBottom={`${data.total} jugadores`}
            />
            <div className="flex justify-center items-center gap-2 mt-3" aria-label={`Intentos: ${state.guesses.length} de ${MAX}`}>
              {Array.from({ length: MAX }).map((_, i) => {
                const used = i < state.guesses.length;
                const won = state.status === "win" && i === state.guesses.length - 1;
                return <span key={i} className={`w-3 h-3 rounded-full ${won ? "bg-emerald-500" : used ? "bg-red-500" : "bg-amber-400"}`} />;
              })}
            </div>
            <p className="text-xs text-gray-500 text-center mt-2 min-h-[2.5em]">
              {hovered
                ? `${hovered.flag} ${hovered.country}: ${hovered.count} jugador${hovered.count === 1 ? "" : "es"}${hoveredPlayers ? ` — ${hoveredPlayers.join(", ")}` : ""}`
                : over ? "Tocá una porción para ver quiénes son." : "Tocá una porción para ver cuántos jugadores tiene."}
            </p>
          </Card>

          {!over && (
            <Card>
              <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <Autocomplete options={data.clubs} exclude={state.guesses.filter(Boolean)} onPick={guess} disabled={busy} placeholder="Escribí el club…" />
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
              <Shirt size={22} className="mx-auto text-accent" />
              <p className="text-2xl font-bold">{state.status === "win" ? "¡Acertaste!" : "Sin intentos"}</p>
              <p className="text-gray-400 text-sm">Era <span className="text-white font-semibold">{reveal?.club || "…"}</span></p>
              {dailyMsg && <p className="text-sm text-accent">{dailyMsg}</p>}
              <ShareResult text={shareText} />
              <p className="text-xs text-gray-500">Mañana hay otro club.</p>
            </Card>
          )}
        </div>
      )}
      {state && !data && error && <p className="text-sm text-red-400">{error}</p>}
    </Layout>
  );
}
