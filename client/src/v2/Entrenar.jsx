import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { playSfx } from "../utils/sfx.js";
import { Quien, MasMenos, Penal } from "./Partido.jsx";

const LABEL = { chile: "Chile", europa: "Europa", leyendas: "Leyendas", actualidad: "Actualidad", mercado: "Mercado", velocidad: "Velocidad" };
const FEEDBACK_MS = 1000;

// Entrenamiento de 2 minutos sobre tu área más floja: 6 preguntas, sin puntos. Se corrige acá.
export default function Entrenar() {
  const { area } = useParams();
  const [items, setItems] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [left, setLeft] = useState(1);
  const [error, setError] = useState("");
  const [run, setRun] = useState(0);
  const lock = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    setItems(null); setIdx(0); setAnswers([]); lock.current = false;
    api.get("/me/train", { params: { area } }).then((r) => setItems(r.data.items)).catch((e) => setError(e.response?.data?.error || "No se pudo armar el entrenamiento."));
  }, [area, run]);

  const item = items?.[idx];
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
    if (!showing || !items) return undefined;
    const t = setTimeout(() => { lock.current = false; setIdx((i) => i + 1); }, FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [showing, items]);

  if (error) return <Layout exitTo="/perfil"><p className="text-sm text-red-400">{error}</p></Layout>;
  if (!items) return <Layout exitTo="/perfil"><p className="text-sm text-gray-500">Armando tu entrenamiento…</p></Layout>;

  if (idx >= items.length) {
    const hits = answers.filter((a) => a.ok).length;
    return (
      <Layout exitTo="/perfil">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <Card variant="feature">
            <p className="t-eyebrow">Entrenamiento · {LABEL[area]}</p>
            <p className="mt-1 text-5xl font-extrabold tabular-nums">{hits}<span className="text-2xl text-gray-400">/{items.length}</span></p>
            <p className="mt-2 text-sm text-gray-400">{hits >= 5 ? "Muy bien. Esta área viene firme." : hits >= 3 ? "Vas mejorando. Repetí mañana." : "Costó. Otra ronda ayuda."} No suma puntos: es para practicar.</p>
          </Card>
          <div className="flex gap-2">
            <button onClick={() => setRun((r) => r + 1)} className="btn btn-secondary flex-1">Otra ronda</button>
            <Link to="/perfil" className="btn btn-primary flex-1">Volver a Yo</Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout focus exitTo="/perfil">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="font-semibold text-accent">Entrenamiento · {LABEL[area]}</span>
          <span className="tabular-nums">{Math.min(idx + 1, items.length)} / {items.length}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="timer" aria-label="Tiempo para responder">
          <div className={`h-full rounded-full ${left < 0.25 ? "bg-bad" : "bg-accent"}`} style={{ width: `${(showing ? 0 : left) * 100}%` }} />
        </div>
        {item.kind === "quien" && <Quien item={item} showing={showing} last={last} onPick={submit} />}
        {item.kind === "mas_menos" && <MasMenos item={item} showing={showing} last={last} onPick={submit} />}
        {item.kind === "penal" && <Penal item={item} showing={showing} last={last} onPick={submit} />}
      </div>
    </Layout>
  );
}
