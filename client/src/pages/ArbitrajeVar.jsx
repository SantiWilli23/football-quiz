import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Gavel, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import ResultScreen from "../components/ResultScreen.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import PlayDiagram from "../components/PlayDiagram.jsx";
import { useGroups } from "../context/GroupContext.jsx";

const TOTAL_SITUATIONS = 10;
const SECONDS_PER_SITUATION = 18;

export default function ArbitrajeVar() {
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
  const [timed, setTimed] = useState(true); // con reloj suma al ranking semanal
  const [photoFailed, setPhotoFailed] = useState(false);
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
      setSituation(data.situation);
      situationRef.current = data.situation;
      setPhotoFailed(false);
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
    fetchSituation([]);
  }

  const decide = useCallback(async (idx) => {
    const current = situationRef.current;
    if (!current || feedback) return;
    clearInterval(timerRef.current);
    try {
      const { data } = await api.post("/arbitraje-var/decide", { situationId: current.id, decisionIdx: idx });
      setFeedback({ correct: data.correct, correctIdx: data.correctIdx, pickedIdx: idx, why: data.why });
      setCorrectCount((c) => {
        const next = data.correct ? c + 1 : c;
        const nextSeen = [...seenRef.current, current.id];
        seenRef.current = nextSeen;
        setSeenIds(nextSeen);
        setTimeout(() => {
          setRound((r) => {
            const nextRound = r + 1;
            if (nextRound >= TOTAL_SITUATIONS) finish(next);
            else fetchSituation(nextSeen);
            return nextRound;
          });
        }, 4500);
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

  return (
    <Layout focus={phase === "playing"}>
      <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
        <Gavel size={22} className="text-accent" />
        Arbitraje / VAR
      </h1>
      <p className="text-gray-400 text-sm mb-4">
        {TOTAL_SITUATIONS} jugadas. Tu decisión contra la del VAR, con reloj de {SECONDS_PER_SITUATION} segundos por jugada (que suma al ranking semanal) o sin tiempo, para practicar tranquilo.
      </p>

      <GroupSelector />

      {phase === "idle" && (
        <Card className="mt-4 text-center py-10">
          <Gavel size={32} className="mx-auto text-accent mb-3" />
          <p className="text-sm text-gray-400 mb-5">
            Se te describe la jugada. Elegí la decisión correcta antes de que se acabe el reloj.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => start(true)}
              className="px-6 py-2.5 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Con tiempo ({SECONDS_PER_SITUATION}s)
            </button>
            <button
              onClick={() => start(false)}
              className="px-6 py-2.5 rounded-card border border-border text-sm text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              Sin tiempo (práctica)
            </button>
          </div>
        </Card>
      )}

      {phase === "playing" && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-2xl font-bold tabular-nums ${timed && secondsLeft <= 3 ? "text-red-400" : ""}`}>
              {timed ? `${secondsLeft}s` : "Sin tiempo"}
            </span>
            <span className="text-sm text-gray-400">
              Jugada {Math.min(round + 1, TOTAL_SITUATIONS)}/{TOTAL_SITUATIONS} · {correctCount} correctas
            </span>
          </div>

          {loading && !situation && <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>}

          {situation && (
            <Card>
              {situation.photo && !photoFailed ? (
                <figure className="mb-4 -mx-6 -mt-6 card-bleed">
                  <img
                    src={`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(situation.photo)}?width=800`}
                    alt="Foto real de una jugada parecida"
                    loading="eager"
                    referrerPolicy="no-referrer"
                    onError={() => setPhotoFailed(true)}
                    className="w-full h-48 sm:h-64 object-cover rounded-t-2xl"
                  />
                  <figcaption className="text-xs text-gray-600 mt-1 px-6">Foto de referencia: Wikimedia Commons</figcaption>
                </figure>
              ) : (
                <PlayDiagram type={situation.diagram} />
              )}
              <p className="font-medium mb-4">{situation.text}</p>
              <div className="grid grid-cols-2 gap-2">
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
                      className={`text-left px-3 py-2.5 rounded-card border text-sm transition-colors disabled:cursor-default ${cls}`}
                    >
                      {opt}
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
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {phase === "done" && (
        <ResultScreen
          score={`${correctCount}/${TOTAL_SITUATIONS}`}
          unit="decisiones correctas"
          groupId={timed ? groupId : null}
          saveState={saveState}
          highlight={timed ? undefined : "Sin reloj es práctica: no cuenta para el ranking semanal."}
          onAgain={() => setPhase("idle")}
          shareText={`⚽ Futotal · Arbitraje / VAR: ${correctCount}/${TOTAL_SITUATIONS} — ¿me ganás?`}
        />
      )}
    </Layout>
  );
}
