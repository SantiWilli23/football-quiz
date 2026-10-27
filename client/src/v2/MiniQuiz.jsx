import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "../components/Layout.jsx";
import { playSfx } from "../utils/sfx.js";
import { Quien, MasMenos, Penal } from "./Partido.jsx";
import Mano from "./Mano.jsx";

const FEEDBACK_MS = 1000;

// Mini partido corregido en el teléfono (sin puntos): lo usan la práctica de la portada y los
// entrenamientos del ADN. Las preguntas llegan con su respuesta. `onFinish` recibe los aciertos.
export default function MiniQuiz({ title, items, exitTo, onFinish, hint = null }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [left, setLeft] = useState(1);
  const lock = useRef(false);
  const startedAt = useRef(0);
  const finished = useRef(false);

  const item = items[idx];
  const showing = answers.length > idx;
  const last = answers[idx];

  const submit = useCallback((choice) => {
    if (lock.current || !item) return;
    lock.current = true;
    const ok = choice !== null && choice === item.answer;
    playSfx(ok ? "ok" : "bad");
    setAnswers((a) => [...a, { ok, correct: item.answer, answer: choice, rightValue: item.rightValue ?? null }]);
  }, [item]);

  useEffect(() => {
    if (!item || showing) return undefined;
    startedAt.current = performance.now();
    setLeft(1);
    let raf;
    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      setLeft(Math.max(0, 1 - elapsed / item.limitMs));
      if (elapsed >= item.limitMs) { submit(null); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idx, item, showing, submit]);

  useEffect(() => {
    if (!showing) return undefined;
    const t = setTimeout(() => { lock.current = false; setIdx((i) => i + 1); }, FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [showing]);

  useEffect(() => {
    if (idx >= items.length && !finished.current) {
      finished.current = true;
      onFinish(answers.filter((a) => a.ok).length, answers);
    }
  }, [idx, items.length, answers, onFinish]);

  if (!item) return null;

  const body = (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="font-semibold text-accent">{title}</span>
        <span className="tabular-nums">{Math.min(idx + 1, items.length)} / {items.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="timer" aria-label="Tiempo para responder">
        <div className={`h-full rounded-full ${left < 0.25 ? "bg-bad" : "bg-accent"}`} style={{ width: `${(showing ? 0 : left) * 100}%` }} />
      </div>
      {item.kind === "quien" && <Quien item={item} showing={showing} last={last} onPick={submit} />}
      {item.kind === "mas_menos" && <MasMenos item={item} showing={showing} last={last} onPick={submit} />}
      {item.kind === "penal" && <Penal item={item} showing={showing} last={last} onPick={submit} />}
    </div>
  );

  return (
    <Layout focus exitTo={exitTo}>
      {hint && idx === 0 ? <Mano id={hint.id} text={hint.text}>{body}</Mano> : body}
    </Layout>
  );
}
