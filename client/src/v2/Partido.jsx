import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Goal, Shield, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import PlayerFace, { ClubCrest } from "../components/PlayerFace.jsx";
import { playSfx } from "../utils/sfx.js";
import { track } from "./analytics.js";
import { useClubs } from "./useClubs.js";

// Partido del día: tres partes de ~1 minuto, igual para todos. El servidor tiene las
// respuestas y calcula el marcador; esta pantalla solo muestra y manda lo que tocaste.
// En «archivo» (partidos pasados) se corrige acá mismo y no suma puntos ni sobre.
const PARTS = [
  { n: 1, label: "1T", title: "¿Quién es?", hint: "Adiviná al jugador por su carrera." },
  { n: 2, label: "2T", title: "Más o menos", hint: "¿El de la derecha vale más o menos?" },
  { n: 3, label: "3T", title: "Penales", hint: "Acertás, es gol. Fallás, te atajan." },
];
const FEEDBACK_MS = 1100;
// Mismo reparto que el servidor (33 + 33 + 34; 80% por acertar y 20% por rapidez). Solo
// se usa en la práctica de partidos pasados, donde se corrige acá mismo.
const WEIGHTS = [33, 33, 34];
const COUNTS = [6, 8, 3];
function localPoints(item, ok, ms) {
  if (!ok) return 0;
  const speed = Math.max(0, Math.min(1, 1 - ms / item.limitMs));
  return (WEIGHTS[item.part - 1] / COUNTS[item.part - 1]) * (0.8 + 0.2 * speed);
}
const money = (v) => `€${v} M`;

export default function Partido() {
  const { date: practiceDate } = useParams();
  const practice = !!practiceDate;
  const navigate = useNavigate();
  const { main } = useClubs();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("loading"); // loading | intro | part | item | feedback | finishing | done
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // { ok, correct, points, rightValue, answer }
  const [left, setLeft] = useState(1);
  const [result, setResult] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [clubStats, setClubStats] = useState(null);
  const lock = useRef(false);
  const startedAt = useRef(0);

  const items = data?.items || [];
  const item = items[idx];

  useEffect(() => {
    let alive = true;
    const url = practice ? `/daily/archive/${practiceDate}` : "/daily/today";
    api.get(url).then(({ data: d }) => {
      if (!alive) return;
      setData(d);
      if (practice) { setPhase("intro"); return; }
      if (d.result) {
        setAnswers(d.answered);
        setResult({ parts: d.result.parts, total: d.result.total, already: true });
        setPhase("done");
      } else if (d.answered.length) {
        setAnswers(d.answered);
        setIdx(d.answered.length);
        setPhase("part");
      } else {
        setPhase("intro");
      }
    }).catch((e) => alive && setError(e.response?.data?.error || "No se pudo cargar el partido."));
    return () => { alive = false; };
  }, [practice, practiceDate]);

  const finish = useCallback(async () => {
    setPhase("finishing");
    if (practice) {
      const total = Math.round(answers.reduce((n, a) => n + (a.points || 0), 0));
      setResult({ total, practice: true });
      setPhase("done");
      return;
    }
    try {
      const { data: r } = await api.post("/daily/finish");
      setResult(r);
      playSfx("win");
      track("partido_terminado", { total: r.total });
    } catch (e) {
      setError(e.response?.data?.error || "No se pudo cerrar el partido.");
    }
    setPhase("done");
  }, [answers, practice]);

  const next = useCallback((count) => {
    lock.current = false;
    if (count >= items.length) { finish(); return; }
    const sameTail = items[count].part === items[count - 1]?.part;
    setIdx(count);
    setPhase(sameTail ? "item" : "part");
  }, [finish, items]);

  const submit = useCallback(async (choice) => {
    if (lock.current || !item) return;
    lock.current = true;
    const ms = Math.round(performance.now() - startedAt.current);
    let entry;
    if (practice) {
      const ok = choice !== null && choice === item.answer;
      entry = { ok, correct: item.answer, points: localPoints(item, ok, ms), rightValue: item.rightValue ?? null, answer: choice };
    } else {
      try {
        const { data: r } = await api.post("/daily/answer", { idx, answer: choice, ms });
        entry = { ok: r.ok, correct: r.correct, points: r.points, rightValue: r.rightValue, answer: choice };
      } catch (e) {
        lock.current = false;
        setError(e.response?.data?.error || "No se pudo enviar la respuesta.");
        return;
      }
    }
    playSfx(entry.ok ? "ok" : "bad");
    setAnswers((a) => [...a, entry]);
    setPhase("feedback");
    if (!practice && main) {
      api.get("/daily/ghost", { params: { groupId: main.id, idx } }).then((r) => setGhost(r.data.ghost)).catch(() => setGhost(null));
    }
  }, [idx, item, main, practice]);

  // Cronómetro de cada pregunta: sin respuesta a tiempo cuenta como fallada.
  useEffect(() => {
    if (phase !== "item" || !item) return undefined;
    startedAt.current = performance.now();
    setLeft(1);
    setGhost(null);
    let raf;
    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      setLeft(Math.max(0, 1 - elapsed / item.limitMs));
      if (elapsed >= item.limitMs) { submit(null); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pasar a la siguiente pregunta solo (o con un toque).
  useEffect(() => {
    if (phase !== "feedback") return undefined;
    const t = setTimeout(() => next(answers.length), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [phase, answers.length, next]);

  // Después de jugar: cómo respondió el club.
  useEffect(() => {
    if (phase !== "done" || practice || !main) return;
    api.get("/daily/club-stats", { params: { groupId: main.id } }).then((r) => setClubStats(r.data.questions)).catch(() => setClubStats(null));
  }, [phase, practice, main]);

  const part = PARTS[(item?.part || 1) - 1];
  const hits = answers.filter((a) => a.ok).length;

  if (error && phase === "loading") {
    return <Layout exitTo="/hoy"><p className="text-red-400 text-sm">{error}</p></Layout>;
  }
  if (phase === "loading") return <Layout exitTo="/hoy"><p className="text-gray-500 text-sm">Cargando el partido…</p></Layout>;

  if (phase === "intro") {
    return (
      <Layout exitTo="/hoy">
        <div className="max-w-md mx-auto space-y-5">
          <div>
            <p className="t-eyebrow">{practice ? `Partido del ${practiceDate} · práctica` : "Partido del día"}</p>
            <h1 className="t-title">Tres partes, un minuto cada una</h1>
            <p className="text-sm text-gray-400 mt-1">
              {practice ? "Es un partido pasado: lo jugás para practicar y no suma puntos ni sobre." : "Es el mismo para todos y solo se juega una vez. El 80% de cada pregunta es por acertar y el 20% por la rapidez."}
            </p>
          </div>
          <ol className="space-y-2">
            {PARTS.map((p) => (
              <li key={p.n} className="flex items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-3">
                <span className="w-9 h-9 shrink-0 rounded-full bg-accent/15 text-accent text-sm font-bold flex items-center justify-center">{p.label}</span>
                <span className="min-w-0"><span className="block font-semibold">{p.title}</span><span className="block text-xs text-gray-400">{p.hint}</span></span>
              </li>
            ))}
          </ol>
          <button className="btn btn-primary w-full" onClick={() => { track("partido_inicio", { practice }); setPhase("part"); }}>Pitazo inicial</button>
        </div>
      </Layout>
    );
  }

  if (phase === "part") {
    const p = PARTS[(items[idx]?.part || 1) - 1];
    return (
      <Layout focus exitTo="/hoy">
        <div className="max-w-md mx-auto text-center pt-10 space-y-3 celebrate-pop" key={p.n}>
          <p className="text-6xl font-extrabold text-accent tabular-nums">{p.label}</p>
          <h2 className="text-2xl font-bold">{p.title}</h2>
          <p className="text-sm text-gray-400">{p.hint}</p>
          <button className="btn btn-primary mt-4" autoFocus onClick={() => setPhase("item")}>Vamos</button>
        </div>
      </Layout>
    );
  }

  if (phase === "done" || phase === "finishing") {
    return (
      <Layout exitTo="/hoy">
        <Resultado result={result} practice={practice} items={items} answers={answers} clubStats={clubStats} main={main} finishing={phase === "finishing"} date={practiceDate} onBack={() => navigate("/hoy")} />
      </Layout>
    );
  }

  const last = answers[answers.length - 1];
  const showing = phase === "feedback" && last;
  const progress = idx + (showing ? 1 : 0);

  return (
    <Layout focus exitTo="/hoy">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="font-semibold text-accent">{part.label} · {part.title}</span>
          <span className="tabular-nums">{progress} / {items.length}</span>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {items.map((it, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < answers.length ? (answers[i].ok ? "bg-good" : "bg-bad") : i === idx ? "bg-white" : "bg-white/10"}`} />
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden" role="timer" aria-label="Tiempo para responder">
          <div className={`h-full rounded-full ${left < 0.25 ? "bg-bad" : "bg-accent"}`} style={{ width: `${(showing ? 0 : left) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Tú <b className="text-white tabular-nums">{hits}</b></span>
          {ghost && <span className="text-gray-500 text-xs">{ghost.username}: {ghost.ok ? "acertó" : "falló"} en {(ghost.ms / 1000).toFixed(1)} s</span>}
        </div>

        {item.kind === "quien" && <Quien item={item} showing={showing} last={last} onPick={submit} />}
        {item.kind === "mas_menos" && <MasMenos item={item} showing={showing} last={last} onPick={submit} />}
        {item.kind === "penal" && <Penal item={item} showing={showing} last={last} onPick={submit} />}

        {showing && (
          <button className="btn btn-secondary w-full" onClick={() => next(answers.length)}>Siguiente</button>
        )}
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </div>
    </Layout>
  );
}

function optionTone(i, showing, last, item) {
  if (!showing) return "border-border bg-panel hover:border-accent/60";
  if (i === last.correct) return "border-good bg-good/15";
  if (i === last.answer) return "border-bad bg-bad/15";
  return "border-border bg-panel opacity-60";
}

function Options({ item, showing, last, onPick }) {
  return (
    <div className="grid gap-2">
      {item.options.map((o, i) => (
        <button
          key={i}
          disabled={showing}
          onClick={() => onPick(i)}
          className={`min-h-[48px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${optionTone(i, showing, last, item)}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Quien({ item, showing, last, onPick }) {
  return (
    <div className="space-y-3">
      <p className="t-eyebrow">¿Quién es? · {item.position}</p>
      <div className="flex flex-wrap gap-2">
        {item.clues.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel pl-1.5 pr-3 py-1 text-xs">
            <ClubCrest name={c.club} size={20} />
            <span className="font-medium">{c.club}</span>
            <span className="text-gray-500 tabular-nums">{c.from}{c.to ? `–${c.to}` : "–hoy"}</span>
          </span>
        ))}
      </div>
      <Options item={item} showing={showing} last={last} onPick={onPick} />
    </div>
  );
}

function MasMenos({ item, showing, last, onPick }) {
  const side = (p, value, hidden, tone) => (
    <div className="flex-1 min-w-0 rounded-3xl border border-border bg-panel p-3 text-center">
      <PlayerFace name={p.name} size={64} className="mx-auto" />
      <p className="mt-2 font-semibold text-sm leading-tight break-words">{p.name}</p>
      <p className="text-[11px] text-gray-500 truncate">{p.club}</p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${hidden ? "text-gray-600" : tone}`}>{hidden ? "€ ? M" : money(value)}</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        {side(item.left, item.left.value, false, "text-accent")}
        {side(item.right, last?.rightValue, !showing, last?.ok ? "text-good" : "text-bad")}
      </div>
      <Options item={item} showing={showing} last={last} onPick={onPick} />
    </div>
  );
}

function Penal({ item, showing, last, onPick }) {
  return (
    <div className="space-y-3">
      <div className="relative rounded-3xl border border-border bg-panel p-4 text-center overflow-hidden">
        <div className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full ${showing ? (last.ok ? "bg-good/20 text-good" : "bg-bad/20 text-bad") : "bg-accent/15 text-accent"}`}>
          {showing ? (last.ok ? <Goal size={28} /> : <Shield size={28} />) : <Goal size={28} />}
        </div>
        <p className="text-xs uppercase tracking-wide text-gray-500">{showing ? (last.ok ? "¡Gol!" : "¡Atajado!") : "Penal"}</p>
        <p className="mt-1 font-semibold leading-snug">{item.question}</p>
      </div>
      <Options item={item} showing={showing} last={last} onPick={onPick} />
    </div>
  );
}

function useCountUp(target, run) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return undefined;
    let frame = 0;
    const steps = 30;
    const t = setInterval(() => {
      frame += 1;
      setN(Math.round(target * Math.min(1, frame / steps)));
      if (frame >= steps) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [target, run]);
  return n;
}

function Resultado({ result, practice, items, answers, clubStats, main, finishing, date, onBack }) {
  const total = result?.total ?? 0;
  const shown = useCountUp(total, !finishing && !!result);
  const [copied, setCopied] = useState(false);
  const squares = useMemo(() => answers.map((a) => (a.ok ? "🟩" : "🟥")).join(""), [answers]);
  const clubPoints = result?.club?.credited || [];
  const would = result?.club?.wouldHave ?? 0;

  if (finishing || !result) return <p className="text-gray-500 text-sm">Sumando tu marcador…</p>;

  const share = `⚽ Futotal · Partido ${practice ? date : "del día"}\n${squares}\n${total}/100`;
  async function copy() {
    try { await navigator.clipboard.writeText(share); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin portapapeles */ }
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/15 to-transparent p-6 text-center celebrate-pop">
        <p className="t-eyebrow">{practice ? "Práctica" : result.already ? "Tu marcador de hoy" : "Final del partido"}</p>
        <p className="text-7xl font-extrabold tabular-nums mt-1">{shown}<span className="text-2xl text-gray-400">/100</span></p>
        {result.parts && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {PARTS.map((p, i) => (
              <div key={p.n} className="rounded-xl bg-bg/50 border border-border py-2">
                <p className="text-xs text-gray-500">{p.label}</p>
                <p className="font-bold tabular-nums">{result.parts[i]}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-lg tracking-widest" aria-label={`${answers.filter((a) => a.ok).length} aciertos de ${answers.length}`}>{squares}</p>
      </div>

      {!practice && (
        <div className="rounded-2xl border border-border bg-panel p-4 text-sm space-y-1.5">
          {clubPoints.length > 0
            ? <p><b className="text-accent">+{clubPoints.reduce((n, c) => Math.max(n, c.points), 0)} pts</b> para tu club{clubPoints.length > 1 ? "es" : ""}. Ya figuran en la tabla.</p>
            : <p className="text-gray-300">{result.already ? "Tus puntos ya están en la tabla del club." : would > 0 ? `Habrías sumado ${would} pts, pero ningún club tiene la temporada iniciada todavía.` : "Todavía no estás en un club con la temporada iniciada."}</p>}
          {result.pack && <p className="text-gray-400">Ganaste un sobre {result.pack === "top" ? "top" : result.pack === "bueno" ? "bueno" : "normal"}. Lo abrís en Cartas.</p>}
        </div>
      )}
      {practice && <p className="text-sm text-gray-400 text-center">Los partidos pasados no suman puntos ni sobres.</p>}

      {!practice && clubStats && clubStats.length > 0 && (
        <div className="rounded-2xl border border-border bg-panel p-4">
          <p className="t-eyebrow mb-3">Así respondió {main?.name || "tu club"}</p>
          <div className="space-y-1.5">
            {clubStats.map((q) => {
              const mine = answers[q.idx];
              return (
                <div key={q.idx} className="flex items-center gap-2 text-xs">
                  <span className={`w-4 text-center ${mine?.ok ? "text-good" : "text-bad"}`}>{mine?.ok ? <Check size={12} /> : <X size={12} />}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-accent/70" style={{ width: `${q.pct}%` }} /></div>
                  <span className="w-9 text-right tabular-nums text-gray-400">{q.pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={copy} className="btn btn-secondary flex-1">{copied ? "Copiado" : "Compartir"}</button>
        <button onClick={onBack} className="btn btn-primary flex-1">Volver a Hoy</button>
      </div>
      {!practice && <Link to="/hoy/archivo" className="block text-center text-xs text-gray-500 hover:text-white">Jugar partidos pasados</Link>}
    </div>
  );
}
