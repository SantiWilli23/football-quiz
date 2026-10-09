import { useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, Search, Trophy } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import useRoomRelay from "../hooks/useRoomRelay.js";
import { useAuth } from "../context/AuthContext.jsx";
import { reportOnlineWin } from "../utils/onlineWin.js";
import { playSfx } from "../utils/sfx.js";

// ¿Quién es? en vivo, versión Preguntas (1 contra 1). El anfitrión elige la dificultad y cada uno
// elige en secreto un jugador de esa dificultad (el servidor valida que sea de la misma). Después se
// turnan: o hacen una pregunta de sí o no ("¿es mediocampista?", "¿juega en la Premier League?",
// "¿es español?") o arriesgan un nombre. Las respuestas las da el servidor con el jugador secreto
// de quien recibe la pregunta, así nadie puede mentir. Gana quien adivina primero.
const GAME = "quien_es_preguntas";
const MAX_QUESTIONS = 20;
const BORN_OPTIONS = [1980, 1985, 1990, 1995, 2000, 2003];
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const myId = () => {
  try {
    let id = sessionStorage.getItem("qep_player_id");
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("qep_player_id", id); }
    return id;
  } catch { return Math.random().toString(36).slice(2, 10); }
};

function Autocomplete({ options, placeholder, onPick, exclude = [] }) {
  const [text, setText] = useState("");
  const list = useMemo(() => {
    const q = norm(text);
    if (q.length < 1) return [];
    return options.filter((o) => norm(o).includes(q) && !exclude.includes(o)).slice(0, 6);
  }, [text, options, exclude]);
  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-bg border border-border rounded-card px-3 py-2">
        <Search size={14} className="text-gray-500 shrink-0" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm focus:outline-none" aria-label={placeholder} />
      </div>
      {list.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-panel border border-border rounded-card overflow-hidden shadow-lg">
          {list.map((o) => (
            <li key={o}><button type="button" onClick={() => { onPick(o); setText(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 hover:text-accent">{o}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function QuienEsPreguntasBody() {
  const { user } = useAuth();
  const { status, roomCode, role, error, lastMessage, createRoom, joinRoom, send, leave } = useRoomRelay(GAME);
  const me = useMemo(() => ({ id: myId(), name: user?.username || "Vos" }), [user]);
  const isHost = role === "host";
  const [meta, setMeta] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [difficulty, setDifficulty] = useState("medio");
  const [phase, setPhase] = useState("menu"); // menu | lobby | pick | playing | over
  const [rival, setRival] = useState(null); // { id, name }
  const [cfgDifficulty, setCfgDifficulty] = useState("medio");
  const [secret, setSecret] = useState(null); // { token, name }
  const [rivalReady, setRivalReady] = useState(false);
  const [pickMsg, setPickMsg] = useState("");
  const [turn, setTurn] = useState(null); // id de quien juega
  const [log, setLog] = useState([]); // { by: "me" | "rival", label, answer }
  const [asked, setAsked] = useState(0);
  const [result, setResult] = useState(null); // { winner: id, name }
  const [cat, setCat] = useState("position");
  const [busy, setBusy] = useState(false);
  const secretRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { phase, secret, turn };

  useEffect(() => { api.get("/quien-es/preguntas/meta").then((r) => setMeta(r.data)).catch(() => {}); }, []);

  // Al entrar a la sala: anunciarse. El anfitrión manda la dificultad apenas llega el rival.
  useEffect(() => {
    if (status !== "in-room") return;
    setPhase("lobby");
    send({ t: "hello", id: me.id, name: me.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "relay") return;
    const m = lastMessage.payload;
    if (!m || typeof m.t !== "string") return;
    onMessage(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  async function onMessage(m) {
    if (m.t === "hello" && m.id !== me.id) {
      setRival({ id: m.id, name: m.name });
      send({ t: "hello", id: me.id, name: me.name });
      if (isHost) send({ t: "cfg", difficulty });
    } else if (m.t === "cfg") {
      setCfgDifficulty(m.difficulty);
      setPhase((p) => (p === "lobby" ? "pick" : p));
    } else if (m.t === "ready") {
      setRivalReady(true);
    } else if (m.t === "turn") {
      setTurn(m.who);
      setPhase("playing");
    } else if (m.t === "ask" && m.from !== me.id) {
      // Me preguntan: el servidor responde con mi jugador secreto.
      try {
        const { data } = await api.post("/quien-es/preguntas/answer", { token: secretRef.current?.token, q: m.q });
        send({ t: "answer", to: m.from, q: m.q, answer: data.answer });
        setLog((l) => [...l, { by: "rival", label: m.q.label, answer: data.answer }]);
        setTurn(me.id);
      } catch { /* si falla, el rival puede volver a preguntar */ }
    } else if (m.t === "answer" && m.to === me.id) {
      setLog((l) => [...l, { by: "me", label: m.q.label, answer: m.answer }]);
      setTurn(rival?.id ?? null);
      playSfx(m.answer ? "ok" : "tap");
    } else if (m.t === "guess" && m.from !== me.id) {
      try {
        const { data } = await api.post("/quien-es/preguntas/check", { token: secretRef.current?.token, name: m.name });
        if (data.correct) {
          send({ t: "over", winner: m.from, name: secretRef.current?.name, by: m.from });
          finishGame(m.from, secretRef.current?.name);
        } else {
          send({ t: "wrong", to: m.from, name: m.name });
          setLog((l) => [...l, { by: "rival", label: `Arriesgó: ${m.name}`, answer: false, guess: true }]);
          setTurn(me.id);
        }
      } catch { /* sin respuesta: el rival reintenta */ }
    } else if (m.t === "wrong" && m.to === me.id) {
      setLog((l) => [...l, { by: "me", label: `Arriesgaste: ${m.name}`, answer: false, guess: true }]);
      setTurn(rival?.id ?? null);
      playSfx("bad");
    } else if (m.t === "over") {
      finishGame(m.winner, m.name);
    }
  }

  function finishGame(winnerId, name) {
    if (stateRef.current.phase === "over") return;
    setResult({ winner: winnerId, name });
    setPhase("over");
    if (winnerId === me.id) { playSfx("win"); reportOnlineWin(GAME, 1, `${roomCode}-${Date.now()}`); } else playSfx("bad");
  }

  // Elegir mi jugador secreto: el servidor valida que sea de la dificultad de la sala.
  async function chooseSecret(name) {
    setBusy(true);
    setPickMsg("");
    try {
      const { data } = await api.post("/quien-es/preguntas/secret", { name, difficulty: cfgDifficulty });
      if (!data.ok) { setPickMsg(data.error); playSfx("bad"); return; }
      secretRef.current = { token: data.token, name };
      setSecret({ token: data.token, name });
      send({ t: "ready", id: me.id });
    } catch (err) {
      setPickMsg(err.response?.data?.error || "No se pudo validar el jugador.");
    } finally {
      setBusy(false);
    }
  }

  // Cuando los dos están listos, el anfitrión sortea quién arranca.
  useEffect(() => {
    if (phase !== "pick" || !isHost || !secret || !rivalReady) return;
    const who = Math.random() < 0.5 ? me.id : rival?.id;
    send({ t: "turn", who });
    setTurn(who);
    setPhase("playing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secret, rivalReady]);

  function exit() {
    leave();
    setPhase("menu"); setRival(null); setSecret(null); secretRef.current = null; setRivalReady(false);
    setLog([]); setAsked(0); setResult(null); setTurn(null); setPickMsg("");
  }

  const myTurn = phase === "playing" && turn === me.id;
  function ask(q) {
    if (!myTurn || asked >= MAX_QUESTIONS) return;
    setAsked((n) => n + 1);
    setTurn(null); // espero la respuesta
    send({ t: "ask", from: me.id, q });
  }
  function guess(name) {
    if (!myTurn) return;
    setTurn(null);
    send({ t: "guess", from: me.id, name });
  }

  const questions = meta && (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {[["position", "Posición"], ["nation", "Nacionalidad"], ["league", "Liga actual"], ["club", "Club"], ["born", "Edad"], ["flag", "Otras"]].map(([k, label]) => (
          <button key={k} onClick={() => setCat(k)} aria-pressed={cat === k} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${cat === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}>{label}</button>
        ))}
      </div>
      {cat === "position" && (
        <div className="flex gap-2 flex-wrap">
          {meta.positions.map((p) => <button key={p} disabled={!myTurn} onClick={() => ask({ type: "position", value: p, label: `¿Es ${p.toLowerCase()}?` })} className="btn btn-secondary btn-sm disabled:opacity-40">¿Es {p.toLowerCase()}?</button>)}
        </div>
      )}
      {cat === "nation" && (
        <Autocomplete options={meta.countries} placeholder="¿Es de qué país? Escribí un país" onPick={(c) => myTurn && ask({ type: "nation", value: c, label: `¿Es de ${c}?` })} />
      )}
      {cat === "league" && (
        <div className="flex gap-2 flex-wrap">
          {meta.leagues.map((l) => <button key={l.id} disabled={!myTurn} onClick={() => ask({ type: "league", value: l.id, label: `¿Juega en ${l.id === "otra" ? "otra liga (no es de las cuatro grandes)" : l.label}?` })} className="btn btn-secondary btn-sm disabled:opacity-40">{l.label}</button>)}
        </div>
      )}
      {cat === "club" && (
        <Autocomplete options={meta.clubs} placeholder="¿Jugó alguna vez en…? Escribí un club" onPick={(c) => myTurn && ask({ type: "club", value: c, label: `¿Jugó alguna vez en ${c}?` })} />
      )}
      {cat === "born" && (
        <div className="flex gap-2 flex-wrap">
          {BORN_OPTIONS.map((y) => <button key={y} disabled={!myTurn} onClick={() => ask({ type: "born", value: y, label: `¿Nació en ${y} o después?` })} className="btn btn-secondary btn-sm disabled:opacity-40">¿Nació en {y} o después?</button>)}
        </div>
      )}
      {cat === "flag" && (
        <div className="flex gap-2 flex-wrap">
          {[["retired", "¿Está retirado o sin club?"], ["champions", "¿Ganó la Champions?"], ["balon", "¿Ganó el Balón de Oro?"]].map(([v, label]) => (
            <button key={v} disabled={!myTurn} onClick={() => ask({ type: "flag", value: v, label })} className="btn btn-secondary btn-sm disabled:opacity-40">{label}</button>
          ))}
        </div>
      )}
    </div>
  );

  // ---------------------------------- pantallas ----------------------------------
  if (phase === "menu" || status === "idle" || status === "connecting" || status === "error") {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="t-title flex items-center gap-2"><HelpCircle size={22} className="text-accent" /> ¿Quién es? · Preguntas</h1>
          <p className="text-gray-400 text-sm mt-1">Uno contra uno. Cada uno elige un jugador de la misma dificultad y se turnan haciéndose preguntas de sí o no. Gana quien adivina primero.</p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Card className="space-y-4">
          <div>
            <p className="t-eyebrow mb-2">Dificultad de los jugadores</p>
            <div className="flex gap-2 flex-wrap">
              {(meta?.tiers || [{ id: "facil", label: "Fácil (los más conocidos)" }, { id: "medio", label: "Medio" }, { id: "dificil", label: "Difícil (los menos conocidos)" }]).map((t) => (
                <button key={t.id} onClick={() => setDifficulty(t.id)} aria-pressed={difficulty === t.id} className={`px-3 py-2 rounded-card text-sm border ${difficulty === t.id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}>{t.label}</button>
              ))}
            </div>
          </div>
          <button onClick={() => createRoom(2)} className="btn btn-primary w-full">Crear sala</button>
          <div className="flex gap-2">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Código de sala" maxLength={8} aria-label="Código de sala" className="flex-1 bg-bg border border-border rounded-card px-3 py-2 text-sm uppercase tracking-widest focus:outline-none focus:border-accent" />
            <button onClick={() => joinCode && joinRoom(joinCode)} className="btn btn-secondary">Unirme</button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <Card className="text-center py-8 space-y-2">
        <p className="text-sm text-gray-400">Código de sala</p>
        <p className="text-4xl font-bold tracking-[0.3em]">{roomCode}</p>
        <p className="text-sm text-gray-400">{rival ? `${rival.name} se unió.` : isHost ? "Pasale el código a tu rival." : "Esperando al anfitrión…"}</p>
        <button onClick={exit} className="text-xs text-gray-500 hover:text-white">Salir</button>
      </Card>
    );
  }

  if (phase === "pick") {
    return (
      <Card className="space-y-4">
        <div>
          <p className="t-eyebrow mb-1">Elegí tu jugador secreto</p>
          <p className="text-sm text-gray-400">Dificultad de la sala: <b className="text-white">{(meta?.tiers.find((t) => t.id === cfgDifficulty) || {}).label || cfgDifficulty}</b>. El servidor revisa que el que elijas sea de esa dificultad; si no lo es, tenés que cambiarlo.</p>
        </div>
        {secret ? (
          <p className="text-sm text-accent">Tu jugador secreto: <b>{secret.name}</b>. {rivalReady ? "Tu rival también eligió: arranca el partido." : `Esperando a ${rival?.name || "tu rival"}…`}</p>
        ) : (
          <>
            {meta && <Autocomplete options={meta.names} placeholder="Buscá un jugador" onPick={chooseSecret} />}
            {busy && <p className="text-xs text-gray-500">Revisando…</p>}
          </>
        )}
        {pickMsg && <p className="text-sm text-red-400" role="alert">{pickMsg}</p>}
      </Card>
    );
  }

  const iWon = result?.winner === me.id;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-400">Vos vs <b className="text-white">{rival?.name || "rival"}</b> · preguntas {asked}/{MAX_QUESTIONS}</span>
        {phase === "playing" && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${myTurn ? "border-accent text-accent" : "border-border text-gray-400"}`}>{myTurn ? "Tu turno" : `Turno de ${rival?.name || "tu rival"}…`}</span>
        )}
      </div>

      {phase === "over" && result && (
        <Card className="text-center py-8">
          <Trophy size={28} className="mx-auto text-accent mb-2" />
          <p className="text-xl font-bold">{iWon ? "¡Ganaste!" : `Ganó ${rival?.name}`}</p>
          <p className="text-sm text-gray-400 mt-1">{iWon ? "Adivinaste" : "Tu jugador era"} <b className="text-white">{result.name}</b>{iWon ? " (el de tu rival)" : ""}.</p>
          <button onClick={exit} className="btn btn-primary mt-4">Salir</button>
        </Card>
      )}

      {phase === "playing" && (
        <>
          <Card className="space-y-3">
            <p className="t-eyebrow">{myTurn ? "Hacé una pregunta" : "Esperá tu turno"}</p>
            {questions}
            {asked >= MAX_QUESTIONS && <p className="text-xs text-amber-400">Ya hiciste las {MAX_QUESTIONS} preguntas: solo te queda arriesgar un nombre.</p>}
          </Card>
          <Card className="space-y-2">
            <p className="t-eyebrow">O arriesgá un nombre (si fallás perdés el turno)</p>
            {meta && (myTurn ? <Autocomplete options={meta.names} placeholder="¿Quién es? Elegí un jugador" onPick={guess} /> : <p className="text-sm text-gray-500">Disponible en tu turno.</p>)}
          </Card>
        </>
      )}

      <Card>
        <p className="t-eyebrow mb-2">Preguntas y respuestas</p>
        {log.length === 0 ? <p className="text-sm text-gray-500">Todavía no hay preguntas.</p> : (
          <ul className="space-y-1.5 text-sm">
            {log.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase w-12 shrink-0 ${e.by === "me" ? "text-accent" : "text-gray-500"}`}>{e.by === "me" ? "Vos" : rival?.name?.slice(0, 7) || "Rival"}</span>
                <span className="flex-1">{e.label}</span>
                <span className={`font-bold ${e.answer ? "text-emerald-400" : "text-red-400"}`}>{e.guess ? "✗" : e.answer ? "Sí" : "No"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {phase === "playing" && <button onClick={exit} className="text-xs text-gray-500 hover:text-white">Abandonar la partida</button>}
    </div>
  );
}
