import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Gavel, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import ResultScreen from "../components/ResultScreen.jsx";
import { logGame } from "../utils/logGame.js";
import GroupSelector from "../components/GroupSelector.jsx";
import VarClip from "../components/VarClip.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { submitDaily, dailyMessage } from "../utils/dailyGames.js";

const MAX_ROUNDS = 10; // tope; si hay menos jugadas en el banco, se juegan todas
const SECONDS_PER_SITUATION = 30; // hay que mirar el clip (y quizás en cámara lenta) antes de decidir

export default function ArbitrajeVar() {
  // Entrando por el juego diario (?diario=1) solo está la partida con tiempo.
  const fromDaily = useSearchParams()[0].get("diario") === "1";
  const advanceRef = useRef(null); // pasa a la siguiente jugada cuando el jugador toca «Siguiente»
  const { activeGroupId: groupId } = useGroups();
  const [phase, setPhase] = useState("idle"); // idle | playing | done
  const [situation, setSituation] = useState(null);
  const [seenIds, setSeenIds] = useState([]);
  const [round, setRound] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState(null); // { correct, correctIdx, pickedIdx }
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_SITUATION);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [dailyMsg, setDailyMsg] = useState("");
  const [dailyToday, setDailyToday] = useState(false); // hoy este es el juego diario y todavía no se jugó
  const [timed, setTimed] = useState(true); // con reloj suma al ranking semanal
  const [totalRounds, setTotalRounds] = useState(MAX_ROUNDS);
  const totalRef = useRef(MAX_ROUNDS);
  const timerRef = useRef(null);
  const situationRef = useRef(null);
  const seenRef = useRef([]);
  const decideRef = useRef(null);
  const timedRef = useRef(true);

  const fetchSituation = useCallback(async (exclude) => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data } = await api.get("/arbitraje-var/situation", { params: { exclude: exclude.join(",") } });
      const n = Math.min(MAX_ROUNDS, data.total ?? MAX_ROUNDS);
      totalRef.current = n;
      setTotalRounds(n);
      setSituation(data.situation);
      situationRef.current = data.situation;
      setSecondsLeft(SECONDS_PER_SITUATION);
    } catch {
      setSituation(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const finish = useCallback(async (finalCorrect) => {
    clearInterval(timerRef.current);
    setPhase("done");
    logGame("arbitraje_var", timedRef.current ? 4 : 2, finalCorrect / Math.max(1, totalRef.current), finalCorrect + "/" + totalRef.current + " decisiones" + (timedRef.current ? " · con reloj" : " · práctica"));
    // Juego diario: la primera partida CON TIEMPO del día te da un puntaje de hasta 20 (de referencia) y un sobre de cartas; el podio del día del grupo suma 5 / 3 / 1 puntos.
    if (timedRef.current) {
      submitDaily("arbitraje_var", Math.min(1, finalCorrect / Math.max(1, totalRef.current)), finalCorrect).then((r) => setDailyMsg(dailyMessage(r)));
    }
    if (!groupId || !timedRef.current) return;
    setSaveState("saving");
    try {
      const { data } = await api.post("/challenges/submit", {
        gameKey: "arbitraje_var",
        groupId,
        score: finalCorrect,
      });
      setSaveState({ improved: data.improved });
    } catch {
      setSaveState(null);
    }
  }, [groupId]);

  function start(withTimer) {
    setTimed(withTimer);
    timedRef.current = withTimer;
    setPhase("playing");
    setCorrectCount(0);
    setRound(0);
    setSeenIds([]);
    seenRef.current = [];
    setSaveState(null);
    setDailyMsg("");
    fetchSituation([]);
  }

  const decide = useCallback(async (idx) => {
    const current = situationRef.current;
    if (!current || feedback) return;
    clearInterval(timerRef.current);
    try {
      const { data } = await api.post("/arbitraje-var/decide", { situationId: current.id, decisionIdx: idx });
      setFeedback({ correct: data.correct, correctIdx: data.correctIdx, pickedIdx: idx, why: data.why });
      // Última jugada con reloj: «doble o nada». Acertar vale +2 y fallar resta 1.
      const finalRound = timedRef.current && seenRef.current.length + 1 >= totalRef.current;
      setCorrectCount((c) => {
        const next = finalRound ? Math.max(0, c + (data.correct ? 2 : -1)) : data.correct ? c + 1 : c;
        const nextSeen = [...seenRef.current, current.id];
        seenRef.current = nextSeen;
        setSeenIds(nextSeen);
        advanceRef.current = () => {
          setRound((r) => {
            const nextRound = r + 1;
            if (nextRound >= totalRef.current) finish(next);
            else fetchSituation(nextSeen);
            return nextRound;
          });
        };
        return next;
      });
    } catch {
      // fallo de red puntual: dejamos que el reloj siga y el jugador reintente
    }
  }, [feedback, fetchSituation, finish]);

  useEffect(() => { decideRef.current = decide; }, [decide]);

  useEffect(() => {
    if (phase !== "playing" || !situation || feedback || !timed) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          decideRef.current(-1); // tiempo agotado: cuenta como decisión incorrecta
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situation, phase, timed]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // Si hoy es el juego diario, la partida es SIEMPRE con tiempo (así da puntos).
  useEffect(() => {
    api.get("/daily-games/today").then((r) => setDailyToday(r.data?.game?.key === "arbitraje_var" && !r.data.game.done)).catch(() => {});
  }, [phase]);

  return (
    <Layout focus={phase === "playing"}>
      <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
        <Gavel size={22} className="text-accent" />
        Arbitraje / VAR
      </h1>
      <p className="text-gray-400 text-sm mb-4">
        Jugadas polémicas reales de LaLiga. Tu decisión contra la del VAR, con reloj de {SECONDS_PER_SITUATION} segundos por jugada (que suma al ranking semanal) o sin tiempo, para practicar tranquilo.
      </p>

      <GroupSelector />

      {phase === "idle" && (
        <Card className="mt-4 text-center py-10">
          <Gavel size={32} className="mx-auto text-accent mb-3" />
          <p className="text-sm text-gray-400 mb-5">
            Jugadas polémicas reales revisadas por el VAR, en video y sin sonido. Pausalas o pasalas en cámara lenta y decidí qué cobrarías.
          </p>
          {dailyToday ? (
            <p className="text-xs text-amber-500 mb-5 -mt-2">Hoy es el juego diario: se juega con tiempo y suma puntos. Una sola vez al día.</p>
          ) : (
            <p className="text-xs text-gray-500 mb-5 -mt-2">Juego diario: la primera partida con tiempo del día da un sobre de cartas (mejor cuanto mejor te va).</p>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => start(true)}
              className="btn btn-primary"
            >
              Con tiempo ({SECONDS_PER_SITUATION}s)
            </button>
            {!dailyToday && !fromDaily && <button
              onClick={() => start(false)}
              className="px-6 py-2.5 rounded-card border border-border text-sm text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              Sin tiempo (práctica)
            </button>}
          </div>
        </Card>
      )}

      {phase === "playing" && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            {timed ? (
              <span
                className={`relative w-20 h-20 rounded-full flex items-center justify-center shrink-0 ${secondsLeft <= 3 ? "tone-red" : secondsLeft <= 10 ? "tone-amber" : "tone-emerald"}`}
                style={{ background: `conic-gradient(rgb(var(--tone)) ${(secondsLeft / SECONDS_PER_SITUATION) * 100}%, rgb(var(--c-border)) 0)`, boxShadow: "0 0 22px -6px rgb(var(--tone))" }}
              >
                <span className="absolute inset-[7px] rounded-full bg-bg" />
                <span className="relative text-2xl font-bold tabular-nums text-tone">{secondsLeft}</span>
              </span>
            ) : (
              <span className="text-2xl font-bold">Sin tiempo</span>
            )}
            <span className="text-sm text-gray-400 text-right">
              Jugada {Math.min(round + 1, totalRounds)}/{totalRounds} · {correctCount} correctas
            </span>
          </div>

          {timed && round + 1 >= totalRounds && !feedback && (
            <p className="rounded-2xl border border-amber/40 bg-amber/10 text-amber text-sm font-semibold px-4 py-2.5">
              Última jugada: doble o nada. Acertar suma 2 y fallar resta 1.
            </p>
          )}
          {loading && !situation && <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>}

          {situation && (
            <Card>
              {situation.video && <VarClip video={situation.video} />}
              <p className="font-medium mb-4">{situation.text}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {situation.options.map((opt, idx) => {
                  const isPicked = feedback?.pickedIdx === idx;
                  const isCorrectOpt = feedback && feedback.correctIdx === idx;
                  let cls = "border-border hover:border-accent/40 hover:bg-accent/5";
                  if (feedback) {
                    if (isCorrectOpt) cls = "border-accent bg-accent/10";
                    else if (isPicked) cls = "border-red-500/50 bg-red-500/10";
                    else cls = "border-border opacity-60";
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => decide(idx)}
                      disabled={!!feedback}
                      className={`${["tone-accent", "tone-blue", "tone-purple", "tone-pink", "tone-amber"][idx % 5]} text-left px-3 py-2.5 rounded-2xl border text-sm transition-colors disabled:cursor-default flex items-center gap-2.5 ${cls}`}
                    >
                      <span className="w-7 h-7 shrink-0 rounded-full bg-tone text-onaccent flex items-center justify-center text-xs font-bold">{"ABCDE"[idx]}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              {feedback && (
                <div className="mt-3">
                  <p className={`text-sm font-medium flex items-center gap-1.5 ${feedback.correct ? "text-emerald" : "text-red-400"}`}>
                    {feedback.correct ? <Check size={15} /> : <X size={15} />}
                    {feedback.correct ? "¡Decisión correcta!" : `El VAR dice: ${situation.options[feedback.correctIdx]}`}
                  </p>
                  {feedback.why && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{feedback.why}</p>}
                  <button
                    onClick={() => { const go = advanceRef.current; advanceRef.current = null; go?.(); }}
                    className="btn btn-primary w-full mt-4"
                    autoFocus
                  >
                    {round + 1 >= totalRounds ? "Ver resultado" : "¿Siguiente?"}
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {phase === "done" && (
        <ResultScreen
          score={`${correctCount}/${totalRounds}`}
          unit="decisiones correctas"
          groupId={timed ? groupId : null}
          saveState={saveState}
          highlight={timed ? dailyMsg || undefined : "Sin reloj es práctica: no cuenta para el ranking semanal ni para el juego diario."}
          onAgain={() => setPhase("idle")}
          shareText={`⚽ Futotal · Arbitraje / VAR: ${correctCount}/${totalRounds} — ¿me ganás?`}
        />
      )}
    </Layout>
  );
}
