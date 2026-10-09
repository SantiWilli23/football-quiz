import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Equal, Flame, Wallet } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import PlayerFace, { ClubCrest } from "../components/PlayerFace.jsx";
import { GameHeader, Layout, ShareResult } from "../futgames/Shell.jsx";
import { loadGame, recordResult, saveGame } from "../futgames/storage.js";
import { reportResult } from "../futgames/report.js";
import { playSfx } from "../utils/sfx.js";

// ¿A quién me compro?: dos futbolistas, el valor de mercado del de la izquierda a la
// vista, y hay que decir si el de la derecha vale más, igual o menos. Fácil: más o menos.
// Difícil: más, igual o menos (es la dificultad del juego diario). 10 rondas.
const GAME = "a_quien_me_compro";
const today = () => new Date().toISOString().slice(0, 10);
const money = (v) => `€${v} M`;
const newSeed = () => Math.random().toString(36).slice(2, 10);

const MODES = {
  facil: { title: "Fácil", text: "¿El de la derecha vale más o menos que el de la izquierda?", buttons: 2 },
  dificil: { title: "Difícil", text: "Más, igual o menos: a veces valen exactamente lo mismo.", buttons: 3 },
};

const CHOICES = [
  { key: "mayor", label: "Vale más", icon: ArrowUp, tone: "tone-emerald" },
  { key: "igual", label: "Igual", icon: Equal, tone: "tone-amber" },
  { key: "menor", label: "Vale menos", icon: ArrowDown, tone: "tone-red" },
];

// El número sube de golpe a su valor: se siente como destapar una oferta.
function useCountUp(target, run) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!run || target == null) { setShown(0); return undefined; }
    let frame = 0;
    const steps = 14;
    const t = setInterval(() => {
      frame += 1;
      setShown(Math.round(target * Math.min(1, frame / steps)));
      if (frame >= steps) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
  }, [target, run]);
  return shown;
}

function PlayerPanel({ player, value, hidden, verdict, label, instant }) {
  const animated = useCountUp(value, !hidden && !instant);
  const counted = instant ? value : animated;
  const border = verdict === "ok" ? "border-emerald/60" : verdict === "bad" ? "border-red-500/60" : "border-border";
  return (
    <div className={`flex-1 min-w-0 rounded-3xl border ${border} bg-panel p-4 sm:p-5 text-center transition-colors`}>
      <p className="t-eyebrow mb-3">{label}</p>
      <PlayerFace name={player.name} size={88} className="mx-auto" />
      <p className="mt-3 font-semibold leading-tight text-base sm:text-lg break-words">{player.name}</p>
      <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-gray-400 min-h-[20px]">
        {player.club && <ClubCrest name={player.club} size={18} />}
        <span className="truncate">{player.club || "Sin club"}</span>
      </p>
      <p className="text-[11px] uppercase tracking-wider text-gray-500 mt-0.5">{player.position}</p>
      <div className="mt-4 rounded-2xl bg-bg/60 border border-border py-3">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">Valor de mercado</p>
        <p className={`text-2xl sm:text-3xl font-bold tabular-nums mt-0.5 ${hidden ? "text-gray-600" : verdict === "bad" ? "text-red-400" : "text-accent"}`}>
          {hidden ? "€ ? M" : money(counted)}
        </p>
      </div>
    </div>
  );
}

export default function AQuienMeCompro() {
  const [params] = useSearchParams();
  const fromDaily = params.get("diario") === "1";
  const [difficulty, setDifficulty] = useState(fromDaily ? "dificil" : "facil");
  const [phase, setPhase] = useState("intro"); // intro | playing | done
  const [game, setGame] = useState(null);
  const [answers, setAnswers] = useState([]); // { guess, correct, truth, rightValue, leftValue }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dailyMsg, setDailyMsg] = useState("");
  const reportedRef = useRef(false);

  const idx = answers.length;
  const total = game?.total || 10;
  const last = answers[answers.length - 1];
  const showingResult = phase === "playing" && game && last && last.round === idx - 1 && !last.advanced;
  const round = game ? game.rounds[showingResult ? idx - 1 : idx] : null;
  const correctCount = answers.filter((a) => a.correct).length;
  const streak = useMemo(() => { let n = 0; for (let i = answers.length - 1; i >= 0 && answers[i].correct; i--) n++; return n; }, [answers]);

  async function begin(diff = difficulty, seed = newSeed()) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get("/a-quien-me-compro/game", { params: fromDaily ? { mode: "daily" } : { difficulty: diff, seed } });
      setGame({ ...data, seed });
      return data;
    } catch {
      setError("No se pudo cargar la partida. Probá de nuevo.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Juego diario: si ya hay avance de hoy, se retoma (y no se puede rejugar).
  useEffect(() => {
    if (!fromDaily) return;
    const saved = loadGame(GAME, today());
    if (!saved) return;
    begin("dificil").then((data) => {
      if (!data) return;
      reportedRef.current = !!saved.reported;
      setAnswers(saved.answers.map((a) => ({ ...a, advanced: true })));
      setPhase(saved.answers.length >= data.total ? "done" : "playing");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    const data = await begin();
    if (!data) return;
    setAnswers([]);
    reportedRef.current = false;
    setDailyMsg("");
    setPhase("playing");
  }

  async function answer(guess) {
    if (busy || showingResult || !round) return;
    setBusy(true);
    try {
      const { data } = await api.post("/a-quien-me-compro/answer", fromDaily ? { mode: "daily", i: round.i, guess } : { difficulty: game.difficulty, seed: game.seed, i: round.i, guess });
      const entry = { round: round.i, guess, correct: data.correct, truth: data.truth, rightValue: data.rightValue, leftValue: data.leftValue };
      const next = [...answers, entry];
      setAnswers(next);
      playSfx(data.correct ? "ok" : "bad");
      if (fromDaily) saveGame(GAME, today(), { answers: next.map(({ advanced, ...a }) => a), reported: false });
    } catch {
      setError("No se pudo comprobar la respuesta.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const advanced = answers.map((a, i) => (i === answers.length - 1 ? { ...a, advanced: true } : a));
    setAnswers(advanced);
    if (advanced.length >= total) setPhase("done");
  }

  // Al terminar (una sola vez): puntos y sobre del juego diario + Historial.
  useEffect(() => {
    if (phase !== "done" || reportedRef.current) return;
    reportedRef.current = true;
    const hits = answers.filter((a) => a.correct).length;
    if (fromDaily) saveGame(GAME, today(), { answers: answers.map(({ advanced, ...a }) => a), reported: true });
    recordResult(GAME, today(), { won: hits >= 7, bucket: hits });
    reportResult("a_quien_me_compro", {
      fraction: hits / total,
      score: hits,
      difficulty: game?.difficulty === "dificil" ? 4 : 2,
      detail: `${hits}/${total} · ${game?.difficulty === "dificil" ? "difícil" : "fácil"}`,
      mode: fromDaily ? "daily" : "fun",
      level: game?.difficulty === "dificil" ? "dificil" : "facil",
    }).then(setDailyMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const shareText = phase === "done"
    ? `⚽ Futotal · ¿A quién me compro? ${today()} (${game?.difficulty === "dificil" ? "difícil" : "fácil"})\n` +
      answers.map((a) => (a.correct ? "🟩" : "🟥")).join("") + `\n${correctCount}/${total}`
    : "";

  const choices = CHOICES.filter((c) => (game?.difficulty || difficulty) === "dificil" || c.key !== "igual");

  return (
    <Layout focus={phase === "playing"}>
      <GameHeader game={GAME} title="¿A quién me compro?" subtitle="Adiviná quién vale más en el mercado." icon={Wallet} distLabel="aciertos" />

      {phase === "intro" && (
        <div className="space-y-4">
          <div className="hero-b rounded-3xl p-5 sm:p-7 overflow-hidden" style={{ "--hero-a": "var(--c-emerald)", "--hero-b": "var(--c-amber)" }}>
            <div className="relative flex items-center gap-3 sm:gap-5" aria-hidden="true">
              <div className="flex-1 rounded-2xl bg-bg/50 border border-border p-3 text-center">
                <span className="mx-auto mb-2 block w-12 h-12 rounded-full bg-black/25" />
                <p className="text-xs text-gray-400">Jugador A</p>
                <p className="text-xl font-bold text-accent mt-1">€ 80 M</p>
              </div>
              <span className="text-sm font-bold text-gray-400">VS</span>
              <div className="flex-1 rounded-2xl bg-bg/50 border border-dashed border-border p-3 text-center">
                <span className="mx-auto mb-2 block w-12 h-12 rounded-full bg-black/25" />
                <p className="text-xs text-gray-400">Jugador B</p>
                <p className="text-xl font-bold text-gray-600 mt-1">€ ? M</p>
              </div>
            </div>
            <p className="relative mt-5 text-lg font-semibold">Mirá lo que vale uno y apostá por el otro.</p>
            <p className="relative text-sm text-gray-300 mt-1">10 rondas con futbolistas en actividad. Acertá cuánto vale cada uno frente a su rival.</p>
          </div>

          <Card className="space-y-5">
            <div>
              <p className="t-eyebrow mb-2">{fromDaily ? "Dificultad del juego diario" : "Dificultad"}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(MODES).filter(([k]) => !fromDaily || k === "dificil").map(([k, m]) => (
                  <button
                    key={k}
                    onClick={() => setDifficulty(k)}
                    className={`text-left rounded-2xl border p-4 transition-colors ${difficulty === k ? "border-accent bg-accent/10" : "border-border hover:border-white/30"}`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-semibold">{m.title}</span>
                      <span className="text-xs text-gray-500">{m.buttons === 2 ? "más / menos" : "más / igual / menos"}</span>
                    </span>
                    <span className="block text-xs text-gray-400 mt-1">{m.text}</span>
                  </button>
                ))}
              </div>
            </div>
            <ul className="text-xs text-gray-400 space-y-1 list-disc pl-5">
              <li>Los valores son aproximados y en millones de euros.</li>
              <li>{fromDaily ? "Las 10 rondas de hoy son las mismas para todos." : "Cada partida trae rondas nuevas."}</li>
            </ul>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={start} disabled={busy} className="btn btn-primary w-full">Jugar</button>
          </Card>
        </div>
      )}

      {phase === "playing" && game && round && (
        <div className="space-y-4">
          <div>
            <div className="flex gap-1.5 mb-2" role="img" aria-label={`Ronda ${Math.min(idx + (showingResult ? 0 : 1), total)} de ${total}, ${correctCount} aciertos`}>
              {game.rounds.map((_, i) => (
                <span
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${i < answers.length ? (answers[i].correct ? "bg-good" : "bg-bad") : i === idx ? "bg-white" : "bg-white/10"}`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Ronda {Math.min(showingResult ? idx : idx + 1, total)} / {total}</span>
              <span className="inline-flex items-center gap-3">
                {streak >= 2 && <span className="inline-flex items-center gap-1 text-amber"><Flame size={14} />{streak} seguidas</span>}
                <span>{correctCount} aciertos</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
            <PlayerPanel player={round.left} value={round.left.value} hidden={false} instant label="Valor a la vista" />
            <div className="flex sm:flex-col items-center justify-center" aria-hidden="true">
              <span className="w-10 h-10 rounded-full border border-border bg-bg text-xs font-bold text-gray-400 flex items-center justify-center">VS</span>
            </div>
            <PlayerPanel
              player={round.right}
              value={showingResult ? last.rightValue : null}
              hidden={!showingResult}
              verdict={showingResult ? (last.correct ? "ok" : "bad") : null}
              label="¿Cuánto vale?"
            />
          </div>

          {!showingResult && (
            <div className={`grid gap-2 ${choices.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {choices.map(({ key, label, icon: Icon, tone }) => (
                <button
                  key={key}
                  onClick={() => answer(key)}
                  disabled={busy}
                  className={`${tone} flex flex-col items-center gap-1 rounded-2xl border border-tone bg-tone-soft py-3.5 px-2 text-sm font-semibold hover:brightness-110 transition disabled:opacity-60`}
                >
                  <Icon size={20} className="text-tone" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {showingResult && (
            <Card className="text-center space-y-3">
              <p className={`text-lg font-bold ${last.correct ? "text-emerald" : "text-red-400"}`}>
                {last.correct ? "¡Acertaste!" : "Fallaste"}
              </p>
              <p className="text-sm text-gray-400">
                {last.truth === "igual"
                  ? `Valen lo mismo: ${money(last.leftValue)}.`
                  : `${round.right.name} vale ${last.truth === "mayor" ? "más" : "menos"} que ${round.left.name}: ${money(last.rightValue)} contra ${money(last.leftValue)}.`}
              </p>
              <button onClick={next} className="btn btn-primary w-full" autoFocus>
                {idx >= total ? "Ver resultado" : "Siguiente"}
              </button>
            </Card>
          )}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>
      )}

      {phase === "done" && game && (
        <div className="space-y-4">
          <div className="hero-b rounded-3xl p-6 text-center" style={{ "--hero-a": "var(--c-emerald)", "--hero-b": "var(--c-amber)" }}>
            <p className="relative t-eyebrow">Tu resultado</p>
            <p className="text-5xl font-bold tabular-nums mt-1">{correctCount}<span className="text-2xl text-gray-400">/{total}</span></p>
            <p className="text-sm text-gray-300 mt-2">
              {correctCount >= 9 ? "Ojo de ojeador: sabés lo que vale cada uno." : correctCount >= 7 ? "Buen olfato para el mercado." : correctCount >= 4 ? "Vas aprendiendo cuánto vale el fútbol." : "El mercado te sorprendió esta vez."}
            </p>
            {dailyMsg && <p className="text-sm text-accent mt-3">{dailyMsg}</p>}
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <ShareResult text={shareText} />
              {!fromDaily && <button onClick={start} className="btn btn-primary">Jugar otra vez</button>}
            </div>
            {fromDaily && <p className="text-xs text-gray-500 mt-3">Mañana hay otras 10 rondas.</p>}
          </div>

          <Card>
            <p className="t-eyebrow mb-3">Ronda por ronda</p>
            <ol className="space-y-2">
              {game.rounds.map((r, i) => {
                const a = answers[i];
                if (!a) return null;
                return (
                  <li key={r.i} className="flex items-center gap-3 text-sm border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <span className={`w-6 h-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center ${a.correct ? "bg-emerald text-onaccent" : "bg-red-500 text-white"}`}>{a.correct ? "✓" : "✗"}</span>
                    <span className="flex-1 min-w-0 flex items-center gap-1.5">{r.left.club && <ClubCrest name={r.left.club} size={18} />}<span className="truncate">{r.left.name} <span className="text-gray-500">({money(a.leftValue)})</span></span></span>
                    <span className="text-gray-600 text-xs shrink-0">{a.truth === "igual" ? "=" : a.truth === "mayor" ? "<" : ">"}</span>
                    <span className="flex-1 min-w-0 flex items-center justify-end gap-1.5"><span className="truncate text-right">{r.right.name} <span className="text-gray-500">({money(a.rightValue)})</span></span>{r.right.club && <ClubCrest name={r.right.club} size={18} />}</span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      )}
    </Layout>
  );
}
