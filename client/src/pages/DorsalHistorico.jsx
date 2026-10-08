import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Timer, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import useRoomRelay from "../hooks/useRoomRelay.js";
import { useAuth } from "../context/AuthContext.jsx";
import { reportOnlineWin } from "../utils/onlineWin.js";
import { playSfx } from "../utils/sfx.js";

// Dorsal histórico, online y "quién dice más": se da un club y un número (fáciles,
// los más conocidos) y cada jugador tiene 60 segundos para nombrar a los que usaron
// esa camiseta. Gana quien nombre más; el ganador suma 3 puntos por rival vencido.
const GAME = "dorsal";
const SECONDS = 60;
const myId = () => {
  try {
    let id = sessionStorage.getItem("dorsal_player_id");
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("dorsal_player_id", id); }
    return id;
  } catch { return Math.random().toString(36).slice(2, 10); }
};

export default function DorsalHistorico() {
  const { user } = useAuth();
  const { status, roomCode, role, error, lastMessage, createRoom, joinRoom, send, leave } = useRoomRelay(GAME);
  const [joinCode, setJoinCode] = useState("");
  const [phase, setPhase] = useState("menu"); // menu | waiting | playing | waitscores | over
  const [players, setPlayers] = useState([]); // [{id, username}]
  const [prompt, setPrompt] = useState(null); // { id, club, number, total }
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const [mine, setMine] = useState([]); // nombres válidos que dije
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [scores, setScores] = useState({}); // id -> { username, names }
  const [answers, setAnswers] = useState(null);
  const startedRef = useRef(null);
  const sentRef = useRef(false);
  const reportedRef = useRef(false);
  const me = useMemo(() => ({ id: myId(), username: user?.username || "Vos" }), [user]);
  const isHost = role === "host";

  // Al entrar a la sala: anunciarse (el host lleva la lista y la reparte).
  useEffect(() => {
    if (status !== "in-room") return;
    setPhase("waiting");
    if (isHost) setPlayers([me]);
    send({ type: "intro", ...me });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "relay") return;
    const m = lastMessage.payload;
    if (!m || typeof m.type !== "string") return;
    if (m.type === "intro" && isHost) {
      const next = players.some((p) => p.id === m.id) ? players : [...players, { id: m.id, username: m.username }];
      setPlayers(next);
      send({ type: "roster", players: next });
    } else if (m.type === "roster" && !isHost) {
      setPlayers(m.players);
    } else if (m.type === "start") {
      beginRound(m.prompt);
    } else if (m.type === "score") {
      setScores((prev) => ({ ...prev, [m.id]: { username: m.username, names: m.names } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  function beginRound(p) {
    sentRef.current = false;
    reportedRef.current = false;
    startedRef.current = Date.now();
    setPrompt(p);
    setMine([]);
    setText("");
    setFeedback("");
    setScores({});
    setAnswers(null);
    setTimeLeft(SECONDS);
    setPhase("playing");
  }

  async function hostStart() {
    if (!isHost || players.length < 2) return;
    const { data } = await api.get("/dorsal/prompts");
    const p = data.prompts[Math.floor(Math.random() * data.prompts.length)];
    send({ type: "start", prompt: p });
    beginRound(p);
  }

  // Reloj local: todos corren el suyo desde que reciben "start".
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const t = setInterval(() => setTimeLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing" || timeLeft > 0 || sentRef.current) return;
    sentRef.current = true;
    setScores((prev) => ({ ...prev, [me.id]: { username: me.username, names: mine } }));
    send({ type: "score", ...me, names: mine });
    setPhase("waitscores");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase]);

  // Cuando llegaron todos los puntajes (o pasaron 8 s), se cierra la ronda.
  useEffect(() => {
    if (phase !== "waitscores") return undefined;
    if (players.length > 0 && Object.keys(scores).length >= players.length) { setPhase("over"); return undefined; }
    const t = setTimeout(() => setPhase("over"), 8000);
    return () => clearTimeout(t);
  }, [phase, scores, players.length]);

  const ranking = useMemo(
    () => Object.entries(scores).map(([id, s]) => ({ id, username: s.username, count: s.names.length })).sort((a, b) => b.count - a.count),
    [scores],
  );

  useEffect(() => {
    if (phase !== "over" || !prompt) return;
    api.get("/dorsal/answers", { params: { promptId: prompt.id } }).then((r) => setAnswers(r.data.players)).catch(() => {});
    const top = ranking[0];
    const tied = ranking.length > 1 && ranking[1].count === top?.count;
    if (top && top.count > 0 && !tied && top.id === me.id && !reportedRef.current) {
      reportedRef.current = true;
      reportOnlineWin("dorsal_historico", ranking.length - 1, `${roomCode}-${prompt.id}-${startedRef.current}`);
      playSfx("win");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function submit(e) {
    e.preventDefault();
    const typed = text.trim();
    if (!typed || phase !== "playing") return;
    setText("");
    try {
      const { data } = await api.post("/dorsal/check", { promptId: prompt.id, name: typed });
      if (!data.valid) { setFeedback(`"${typed}" no usó ese dorsal`); playSfx("bad"); return; }
      if (mine.includes(data.name)) { setFeedback(`Ya dijiste a ${data.name}`); return; }
      setMine((m) => [...m, data.name]);
      setFeedback(`¡${data.name}!`);
      playSfx("ok");
    } catch {
      setFeedback("No se pudo comprobar");
    }
  }

  const winner = ranking[0] && ranking[0].count > 0 && !(ranking[1] && ranking[1].count === ranking[0].count) ? ranking[0] : null;

  return (
    <Layout focus={phase === "playing"}>
      <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2"><Hash size={22} className="text-accent" /> Dorsal histórico</h1>
      <p className="text-gray-400 text-sm mb-4">
        Online, de a dos o más: te damos un club y un número, y tenés {SECONDS} segundos para nombrar a todos los que usaron esa camiseta. Gana quien diga más (3 puntos por cada rival vencido).
      </p>

      {phase === "menu" && (
        <Card className="space-y-4">
          <button onClick={() => createRoom(8)} className="btn btn-primary w-full">Crear sala</button>
          <div className="flex gap-2">
            <input
              id="dorsal-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Código de sala"
              maxLength={8}
              className="flex-1 bg-bg border border-border rounded-card px-3 py-2.5 text-sm uppercase tracking-widest focus:outline-none focus:border-accent"
            />
            <button onClick={() => joinCode && joinRoom(joinCode)} className="px-5 py-2.5 rounded-card border border-border text-sm font-medium text-gray-300 hover:text-white">Unirme</button>
          </div>
          {status === "connecting" && <p className="text-xs text-gray-500">Conectando…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </Card>
      )}

      {phase === "waiting" && (
        <Card className="space-y-3 text-center">
          <p className="text-xs text-gray-500">Código de sala</p>
          <p className="text-3xl font-bold tracking-widest">{roomCode}</p>
          <p className="text-sm text-gray-400">{players.length} en la sala: {players.map((p) => p.username).join(", ") || "…"}</p>
          {isHost ? (
            <button onClick={hostStart} disabled={players.length < 2} className="btn btn-primary">{players.length < 2 ? "Esperando a más jugadores…" : "Empezar"}</button>
          ) : (
            <p className="text-sm text-gray-500">Esperando que el anfitrión empiece.</p>
          )}
        </Card>
      )}

      {(phase === "playing" || phase === "waitscores") && prompt && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-2xl font-bold tabular-nums flex items-center gap-1.5 ${timeLeft <= 10 ? "text-red-400" : ""}`}><Timer size={20} />{timeLeft}s</span>
            <span className="text-sm text-gray-400">{mine.length} nombres</span>
          </div>
          <div className="text-center py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">¿Quiénes usaron el</p>
            <p className="text-4xl font-bold">N° {prompt.number}</p>
            <p className="text-lg text-gray-300">del {prompt.club}?</p>
          </div>
          {phase === "playing" ? (
            <form onSubmit={submit} className="flex gap-2">
              <input
                id="dorsal-answer"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                autoComplete="off"
                placeholder="Escribí un nombre y Enter"
                className="flex-1 bg-bg border border-border rounded-card px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
              <button type="submit" className="btn btn-primary">Decir</button>
            </form>
          ) : (
            <p className="text-sm text-gray-400 text-center">Se acabó el tiempo. Esperando a los demás…</p>
          )}
          {feedback && <p className="text-sm text-gray-300 text-center" role="status">{feedback}</p>}
          {mine.length > 0 && <p className="text-xs text-gray-500">{mine.join(" · ")}</p>}
        </Card>
      )}

      {phase === "over" && (
        <Card className="space-y-4">
          <div className="text-center">
            <Trophy size={26} className="mx-auto text-accent mb-1" />
            <p className="text-xl font-bold">{winner ? (winner.id === me.id ? "¡Ganaste!" : `Ganó ${winner.username}`) : "Empate"}</p>
            <p className="text-xs text-gray-500">N° {prompt?.number} del {prompt?.club}</p>
          </div>
          <ol className="space-y-1.5">
            {ranking.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between text-sm border-b border-border/60 pb-1.5 last:border-0">
                <span>{i + 1}. {r.username}{r.id === me.id ? " (vos)" : ""}</span>
                <span className="font-semibold tabular-nums">{r.count}</span>
              </li>
            ))}
          </ol>
          {answers && <p className="text-xs text-gray-500">Lo usaron: {answers.join(", ")}.</p>}
          <div className="flex gap-2 justify-center">
            {isHost && <button onClick={hostStart} className="btn btn-primary">Otra ronda</button>}
            <button onClick={() => { leave(); setPhase("menu"); setPlayers([]); }} className="px-4 py-2 rounded-card border border-border text-sm text-gray-300 hover:text-white">Salir</button>
          </div>
        </Card>
      )}
    </Layout>
  );
}
