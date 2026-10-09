import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HelpCircle, Triangle } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import PlayerFace from "../components/PlayerFace.jsx";
import { GameHeader, Layout, ShareResult } from "../futgames/Shell.jsx";
import { loadGame, recordResult, saveGame } from "../futgames/storage.js";
import { reportResult } from "../futgames/report.js";
import { playSfx } from "../utils/sfx.js";

// Pirámide: 10 jugadores aparecen de a uno y hay que ubicarlos de mayor (1,
// arriba) a menor (10) según la estadística del día, sin saber quién viene.
// Después se puede reordenar (arrastrar o tocar dos casillas) y enviar.
// Juego diario (?diario=1): una sola estadística y los mismos jugadores para todos.
// Partida libre: cada partida tiene su propia estadística.
const GAME = "piramide";
const today = () => new Date().toISOString().slice(0, 10);
const ROWS = [[0], [1, 2], [3, 4, 5], [6, 7, 8, 9]];
const ROW_TONES = ["amber", "accent", "blue", "purple"];
const TIER_LABEL = { 1: "la fila de arriba (puesto 1)", 2: "la 2ª fila (puestos 2-3)", 3: "la 3ª fila (puestos 4-6)", 4: "la fila de abajo (puestos 7-10)" };

function PyramidIntro({ fromDaily, mode, setMode, busy, onStart, error }) {
  const rows = [1, 2, 3, 4];
  return (
    <div className="space-y-4">
      <div className="hero-b rounded-3xl p-5 sm:p-7 overflow-hidden" style={{ "--hero-a": "var(--c-amber)", "--hero-b": "var(--c-purple)" }}>
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="space-y-1.5 shrink-0 mx-auto sm:mx-0" aria-hidden="true">
            {rows.map((n, r) => (
              <div key={r} className="flex justify-center gap-1.5">
                {Array.from({ length: n }).map((_, i) => (
                  <span key={i} className={`w-8 h-8 rounded-lg border ${r === 0 ? "bg-amber/30 border-amber/60" : "bg-bg/40 border-border"}`} />
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold">10 jugadores, una estadística, un orden.</p>
            <p className="text-sm text-gray-300">Los jugadores aparecen de a uno y los ubicás de mayor (arriba) a menor (abajo) antes de ver al siguiente.</p>
          </div>
        </div>
      </div>

      <Card className="space-y-5">
        <ul className="text-sm text-gray-300 space-y-1.5 list-disc pl-5">
          <li>Podés reordenar cuando quieras: arrastrá o tocá dos casillas para intercambiarlas.</li>
          <li>Una ayuda por partida: te dice cuántos están bien ubicados (no cuáles).</li>
          <li>{fromDaily ? "La estadística y los jugadores de hoy son los mismos para todos." : "Cada partida tiene su propia estadística."}</li>
        </ul>
        {!fromDaily && (
          <div>
            <p className="t-eyebrow mb-2">Modo</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[["facil", "Fácil", "Te dice a qué fila va cada jugador."], ["normal", "Normal", "Sin pistas."]].map(([k, t, d]) => (
                <button key={k} onClick={() => setMode(k)} className={`text-left rounded-2xl border p-4 transition-colors ${mode === k ? "border-accent bg-accent/10" : "border-border hover:border-white/30"}`}>
                  <span className="font-semibold block">{t}</span>
                  <span className="text-xs text-gray-400">{d}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={onStart} disabled={busy} className="btn btn-primary w-full">Empezar</button>
      </Card>
    </div>
  );
}

export default function Piramide() {
  const [params] = useSearchParams();
  const fromDaily = params.get("diario") === "1";
  // El juego diario y las partidas libres se guardan por separado.
  const KEY = fromDaily ? GAME : `${GAME}-libre`;
  const [mode, setMode] = useState("normal");
  const [state, setState] = useState(() => loadGame(KEY, today()));
  // state: { mode, category, unit, players:[{id,name,detail,tier}], next, slots[10], selected, helpUsed, help, status, result }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(null);

  function persist(next) {
    setState(next);
    saveGame(KEY, today(), next);
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      const seed = fromDaily ? "" : Math.random().toString(36).slice(2, 10);
      const { data } = await api.get("/futgames/pyramid", { params: { mode: fromDaily ? "normal" : mode, seed } });
      persist({ seed, mode: fromDaily ? "normal" : mode, daily: fromDaily, category: data.category, unit: data.unit, players: data.players, next: 0, slots: Array(10).fill(null), selected: null, helpUsed: false, help: null, status: "playing", result: null });
    } catch {
      setError("No se pudo cargar la pirámide. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const byId = state ? Object.fromEntries(state.players.map((p) => [p.id, p])) : {};
  const current = state && state.next < state.players.length ? state.players[state.next] : null;
  const allPlaced = state && state.slots.every(Boolean);
  const playing = state?.status === "playing";

  // Al terminar (una sola vez): puntos/sobre del juego diario + Historial.
  const [dailyMsg, setDailyMsg] = useState("");
  useEffect(() => {
    if (!state || state.status === "playing" || state.reported) return;
    const next = { ...state, reported: true };
    setState(next);
    saveGame(KEY, today(), next);
    reportResult("piramide", {
      fraction: (state.result?.correct || 0) / 10,
      score: state.result?.correct || 0,
      difficulty: state.mode === "facil" ? 2 : 3,
      detail: `${state.result?.correct || 0}/10 · ${state.category}`,
      mode: fromDaily ? "daily" : "fun",
      level: state.mode === "facil" ? "facil" : "normal",
    }).then(setDailyMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  function move(from, to) {
    const slots = [...state.slots];
    [slots[from], slots[to]] = [slots[to], slots[from]];
    persist({ ...state, slots, selected: null });
  }

  function clickSlot(i) {
    if (!playing) return;
    const sel = state.selected;
    if (sel != null) {
      if (sel === i) return persist({ ...state, selected: null });
      return move(sel, i);
    }
    if (!state.slots[i] && current) {
      const slots = [...state.slots];
      slots[i] = current.id;
      playSfx("tick");
      return persist({ ...state, slots, next: state.next + 1 });
    }
    if (state.slots[i]) persist({ ...state, selected: i });
  }

  // Espiada (una sola vez por partida): si el jugador que viene va en la mitad de arriba o de abajo.
  async function usePeek() {
    if (state.peekUsed || !current) return;
    try {
      const { data } = await api.post("/futgames/pyramid/peek", { playerId: current.id, seed: state.seed });
      persist({ ...state, peekUsed: true, peekInfo: { id: current.id, half: data.half } });
    } catch {
      setError("No se pudo espiar.");
    }
  }

  async function useHelp() {
    if (state.helpUsed) return;
    try {
      const { data } = await api.post("/futgames/pyramid/help", { placement: state.slots, seed: state.seed });
      persist({ ...state, helpUsed: true, help: data.correct });
    } catch {
      setError("No se pudo pedir la ayuda.");
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const { data } = await api.post("/futgames/pyramid/submit", { placement: state.slots, seed: state.seed });
      const next = { ...state, status: "done", result: data, selected: null };
      persist(next);
      recordResult(GAME, today(), { won: data.correct === 10, bucket: data.correct });
      playSfx(data.correct >= 7 ? "win" : "bad");
    } catch {
      setError("No se pudo enviar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const shareText = state?.result
    ? `⚽ Futotal · Pirámide ${today()}\n` +
      ROWS.map((row) => row.map((i) => (state.result.slots[i].correct ? "🟩" : "🟥")).join("")).join("\n") +
      `\n${state.result.correct}/10`
    : "";

  return (
    <Layout>
      <GameHeader game={GAME} title="Pirámide" subtitle="Ordená 10 jugadores de mayor a menor." icon={Triangle} distLabel="aciertos" />

      {!state && <PyramidIntro fromDaily={fromDaily} mode={mode} setMode={setMode} busy={busy} onStart={start} error={error} />}

      {state && (
        <div className="space-y-4">
          <Card variant="feature" className="text-center">
            <p className="t-eyebrow">{state.daily ? "Estadística del día" : "Estadística de esta partida"}</p>
            <p className="text-lg font-bold">{state.category}</p>
          </Card>

          {playing && current && (
            <Card className="text-center">
              <p className="text-xs text-gray-400">Siguiente jugador ({state.next + 1}/10)</p>
              <PlayerFace name={current.name} size={72} className="mx-auto my-2" />
              <p className="text-xl font-bold">{current.name}</p>
              {current.detail && <p className="text-xs text-gray-400">{current.detail}</p>}
              {current.tier && <p className="text-xs text-accent mt-1">Va en {TIER_LABEL[current.tier]}</p>}
              {state.peekInfo?.id === current.id && <p className="text-xs text-amber mt-1">Espiada: va en la mitad de {state.peekInfo.half}.</p>}
              {playing && !current.tier && !state.peekUsed && (
                <button onClick={usePeek} className="mt-2 text-xs font-medium px-3 py-1 rounded-full border border-amber/40 text-amber bg-amber/10 hover:bg-amber/20 transition-colors">
                  Espiar este jugador (1 vez)
                </button>
              )}
              <p className="text-xs text-gray-500 mt-2">Tocá una casilla libre para ubicarlo.</p>
            </Card>
          )}

          <div className="hero-b rounded-3xl p-4 sm:p-6 space-y-2.5" style={{ "--hero-a": "var(--c-amber)", "--hero-b": "var(--c-purple)" }} aria-label="Pirámide">
            {ROWS.map((row, r) => (
              <div key={r} className={`tone-${ROW_TONES[r]} flex justify-center gap-2.5`}>
                {row.map((i) => {
                  const id = state.slots[i];
                  const p = id ? byId[id] : null;
                  const res = state.result?.slots[i];
                  const selected = state.selected === i;
                  return (
                    <button
                      key={i}
                      draggable={playing && !!id}
                      onDragStart={() => setDrag(i)}
                      onDragOver={(e) => playing && e.preventDefault()}
                      onDrop={() => { if (drag != null && drag !== i) move(drag, i); setDrag(null); }}
                      onClick={() => clickSlot(i)}
                      aria-label={p ? `Casilla ${i + 1}: ${p.name}` : `Casilla ${i + 1}: vacía`}
                      className={`w-[23%] max-w-[130px] min-h-[84px] rounded-2xl border p-1.5 flex flex-col items-center justify-center text-center transition-colors ${
                        res ? (res.correct ? "border-emerald-500/60 bg-emerald-500/15" : "border-red-500/60 bg-red-500/15")
                          : selected ? "border-accent bg-accent/20"
                          : p ? "border-tone bg-tone-soft hover:brightness-110"
                          : "border-dashed border-tone bg-bg/60"
                      }`}
                    >
                      <span className="text-[10px] text-gray-500 tabular-nums">{i + 1}</span>
                      {p && <PlayerFace name={p.name} size={30} className="my-0.5" />}
                      {p && <span className="text-[11px] font-semibold leading-tight line-clamp-2">{p.name}</span>}
                      {res && (
                        <span className="text-[10px] text-gray-300 tabular-nums">
                          {res.value} {res.correct ? "" : `· va ${res.first === res.last ? res.first : `${res.first}-${res.last}`}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {playing && (
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={useHelp}
                disabled={state.helpUsed}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card border border-border text-xs font-medium text-gray-300 hover:text-white disabled:opacity-50"
              >
                <HelpCircle size={14} /> {state.helpUsed ? `Ayuda: ${state.help} bien ubicados` : "Ayuda (1 vez)"}
              </button>
              <button
                onClick={submit}
                disabled={!allPlaced || busy}
                className="px-5 py-2 rounded-card bg-accent text-onaccent text-sm font-semibold hover:opacity-90 disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          )}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          {state.result && (
            <Card className="text-center py-6 space-y-3">
              <p className="text-2xl font-bold">{state.result.correct}/10 bien ubicados</p>
              <p className="text-xs text-gray-400">Valores en {state.unit}. En rojo, la casilla donde iba.</p>
              {dailyMsg && <p className="text-sm text-accent">{dailyMsg}</p>}
              <ShareResult text={shareText} />
              {state.daily ? (
                <p className="text-xs text-gray-500">Mañana hay una pirámide nueva.</p>
              ) : (
                <button onClick={() => { setDailyMsg(""); setError(""); setState(null); saveGame(KEY, today(), null); }} className="btn btn-primary">Otra partida</button>
              )}
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}
