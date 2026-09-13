import { useEffect, useRef, useState } from "react";
import { Check, Copy, Crown, Skull, Trophy, Users } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import useRoomRelay from "../hooks/useRoomRelay.js";

const GAME = "survival";
const ROUND_SECONDS = 12;
const DIFFICULTIES = [
  ["dificil", "Difícil"],
  ["ultra", "Ultra difícil"],
  ["demonio", "Demonio"],
];

function myId() {
  let id = sessionStorage.getItem("fq_survival_id");
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("fq_survival_id", id);
  }
  return id;
}

export default function Survival() {
  const { user } = useAuth();
  const { status, roomCode, role, error, lastMessage, createRoom, joinRoom, send, leave } = useRoomRelay(GAME);

  const [joinCode, setJoinCode] = useState("");
  const [difficulty, setDifficulty] = useState("dificil");
  const [rounds, setRounds] = useState(8);
  const [copied, setCopied] = useState(false);

  // Estado del juego, compartido por host y jugadores (el host es la autoridad).
  const [players, setPlayers] = useState([]); // [{id, username, alive}]
  const [phase, setPhase] = useState("lobby"); // lobby | waiting | question | reveal | gameover
  const [questions, setQuestions] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [reveal, setReveal] = useState(null); // { correct, results }
  const [winner, setWinner] = useState(null);

  const answersRef = useRef({}); // { [round]: { [playerId]: answer } }
  const timerRef = useRef(null);
  const roundTimeoutRef = useRef(null);
  const me = { id: myId(), username: user?.username || "Vos" };

  const isHost = role === "host";

  // ---- Anunciarse al entrar a la sala ----
  useEffect(() => {
    if (status !== "in-room") return;
    setPhase("waiting");
    if (isHost) setPlayers([{ ...me, alive: true }]);
    send({ type: "intro", id: me.id, username: me.username });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ---- Procesar mensajes entrantes ----
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "relay") return;
    const msg = lastMessage.payload;
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "intro" && isHost) {
      setPlayers((prev) => (prev.some((p) => p.id === msg.id) ? prev : [...prev, { id: msg.id, username: msg.username, alive: true }]));
      // Le mandamos el roster actualizado a todos para que lo vean en la sala de espera.
      send({ type: "roster", players: [...players, { id: msg.id, username: msg.username, alive: true }] });
    } else if (msg.type === "roster" && !isHost) {
      setPlayers(msg.players);
    } else if (msg.type === "question" && !isHost) {
      setPhase("question");
      setRoundIndex(msg.round);
      setCurrentQuestion(msg.question);
      setSelected(null);
      setReveal(null);
      setTimeLeft(ROUND_SECONDS);
    } else if (msg.type === "answer" && isHost) {
      answersRef.current[msg.round] = answersRef.current[msg.round] || {};
      answersRef.current[msg.round][msg.id] = msg.answer;
    } else if (msg.type === "reveal" && !isHost) {
      setPhase("reveal");
      setReveal(msg);
      setPlayers((prev) => prev.map((p) => (msg.eliminated.includes(p.id) ? { ...p, alive: false } : p)));
    } else if (msg.type === "gameover") {
      setPhase("gameover");
      setWinner(msg.winner);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  // ---- Timer local durante la pregunta (todos lo corren, pero solo el host resuelve) ----
  useEffect(() => {
    if (phase !== "question") return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, roundIndex]);

  useEffect(() => {
    if (phase === "question" && timeLeft === 0 && isHost) resolveRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase]);

  async function handleCreate() {
    createRoom(16);
  }

  function handleJoin() {
    if (joinCode.trim().length < 4) return;
    joinRoom(joinCode.trim().toUpperCase());
  }

  async function handleStart() {
    if (!isHost || players.length < 2) return;
    const { data } = await api.get("/duels/random-set", { params: { difficulty, count: rounds } });
    if (!data.questions?.length) return;
    setQuestions(data.questions);
    answersRef.current = {};
    setPlayers((prev) => prev.map((p) => ({ ...p, alive: true })));
    startRound(0, data.questions, players.map((p) => ({ ...p, alive: true })));
  }

  function startRound(index, qList, alivePlayers) {
    const q = qList[index];
    if (!q) return;
    const publicQ = { id: q.id, text: q.question, options: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d } };
    setRoundIndex(index);
    setCurrentQuestion(publicQ);
    setSelected(null);
    setReveal(null);
    setPhase("question");
    setTimeLeft(ROUND_SECONDS);
    send({ type: "question", round: index, total: qList.length, question: publicQ });
  }

  function resolveRound() {
    clearTimeout(roundTimeoutRef.current);
    const q = questions[roundIndex];
    if (!q) return;
    const roundAnswers = answersRef.current[roundIndex] || {};
    const alive = players.filter((p) => p.alive);
    const eliminated = [];
    const results = {};
    alive.forEach((p) => {
      const given = p.id === me.id ? selected : roundAnswers[p.id];
      const correct = given === q.correct_answer;
      results[p.id] = !!correct;
      if (!correct) eliminated.push(p.id);
    });

    // Si todos fallan, no se elimina a nadie esa ronda (evita quedarse sin nadie por una pregunta injusta).
    const willEliminate = eliminated.length < alive.length ? eliminated : [];
    const survivors = players.map((p) => (willEliminate.includes(p.id) ? { ...p, alive: false } : p));

    send({ type: "reveal", round: roundIndex, correct: q.correct_answer, results, eliminated: willEliminate });
    setPhase("reveal");
    setReveal({ correct: q.correct_answer, results, eliminated: willEliminate });
    setPlayers(survivors);

    const stillAlive = survivors.filter((p) => p.alive);
    const isLastRound = roundIndex >= questions.length - 1;

    roundTimeoutRef.current = setTimeout(() => {
      if (stillAlive.length <= 1 || isLastRound) {
        const win = stillAlive[0] || survivors.sort((a, b) => b.alive - a.alive)[0];
        send({ type: "gameover", winner: win });
        setPhase("gameover");
        setWinner(win);
      } else {
        startRound(roundIndex + 1, questions, survivors);
      }
    }, 3200);
  }

  function handleAnswer(key) {
    if (selected || reveal) return;
    setSelected(key);
    send({ type: "answer", round: roundIndex, id: me.id, answer: key });
  }

  function handleCopy() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleLeave() {
    leave();
    setPhase("lobby");
    setPlayers([]);
    setQuestions([]);
    setWinner(null);
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-1">Supervivencia</h1>
      <p className="text-gray-400 text-sm mb-6">Todos responden la misma pregunta a la vez. El que falla, queda afuera. Gana el último en pie.</p>

      {phase === "lobby" && status !== "in-room" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h2 className="font-semibold mb-3">Crear sala</h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Dificultad</label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setDifficulty(id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded border ${
                        difficulty === id ? "bg-blue-500/20 border-blue-500 text-blue-400" : "border-gray-600 text-gray-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Rondas máximas</label>
                <input
                  type="number" min={4} max={20} value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-24 bg-bg border border-border rounded-card px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="w-full bg-accent hover:bg-accent-dark transition-colors text-onaccent font-semibold rounded-card py-2.5 text-sm"
            >
              Crear sala
            </button>
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Unirse a una sala</h2>
            <p className="text-xs text-gray-500 mb-3">Pedile el código a quien creó la sala.</p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                maxLength={8}
                className="flex-1 bg-bg border border-border rounded-card px-3 py-2.5 text-sm tracking-widest uppercase"
              />
              <button
                onClick={handleJoin}
                disabled={joinCode.trim().length < 4}
                className="px-5 bg-accent hover:bg-accent-dark disabled:opacity-40 transition-colors text-onaccent font-semibold rounded-card text-sm"
              >
                Unirse
              </button>
            </div>
            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          </Card>
        </div>
      )}

      {status === "connecting" && <Card><p className="text-sm text-gray-500">Conectando…</p></Card>}

      {status === "in-room" && phase === "waiting" && (
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <p className="text-xs text-gray-500 mb-1">Código de sala</p>
              <p className="text-3xl font-bold tracking-widest">{roomCode}</p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 rounded-card text-sm border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar código"}
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-gray-400" />
            <p className="text-sm font-medium">{players.length} en la sala</p>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {players.map((p) => (
              <span key={p.id} className="text-xs px-3 py-1.5 rounded-full border border-border bg-bg">
                {p.username}{p.id === me.id ? " (vos)" : ""}
              </span>
            ))}
          </div>

          {isHost ? (
            <button
              onClick={handleStart}
              disabled={players.length < 2}
              className="w-full bg-accent hover:bg-accent-dark disabled:opacity-40 transition-colors text-onaccent font-semibold rounded-card py-3 text-sm"
            >
              {players.length < 2 ? "Esperando a más jugadores…" : "Empezar"}
            </button>
          ) : (
            <p className="text-sm text-gray-500 text-center">Esperando a que el anfitrión empiece la partida…</p>
          )}
          <button onClick={handleLeave} className="w-full mt-3 text-xs text-gray-500 hover:text-gray-300">Salir de la sala</button>
        </Card>
      )}

      {(phase === "question" || phase === "reveal") && currentQuestion && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-gray-400">
              Ronda {roundIndex + 1} · {players.filter((p) => p.alive).length} en pie
            </span>
            {phase === "question" && (
              <span className={`text-sm font-semibold tabular-nums ${timeLeft <= 4 ? "text-red-400" : "text-gray-400"}`}>{timeLeft}s</span>
            )}
          </div>

          <h2 className="text-lg font-semibold mb-5">{currentQuestion.text}</h2>

          <div className="space-y-2.5">
            {Object.entries(currentQuestion.options).map(([key, text]) => {
              const isSelected = selected === key;
              const isCorrect = reveal && key === reveal.correct;
              const isWrong = reveal && isSelected && !isCorrect;
              let cls = "border-border bg-bg";
              if (reveal) {
                if (isCorrect) cls = "border-accent bg-accent/10";
                else if (isWrong) cls = "border-red-500 bg-red-500/10";
                else cls = "border-border bg-bg opacity-60";
              } else if (isSelected) cls = "border-accent bg-accent/10";

              return (
                <button
                  key={key}
                  disabled={!!selected || !!reveal}
                  onClick={() => handleAnswer(key)}
                  className={`w-full text-left px-4 py-3 rounded-card border transition-colors text-sm ${cls}`}
                >
                  {text}
                </button>
              );
            })}
          </div>

          {reveal && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {players.map((p) => (
                <span
                  key={p.id}
                  className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                    p.alive ? "border-emerald/40 text-emerald bg-emerald/10" : "border-red-500/30 text-red-400 bg-red-500/5 opacity-60 line-through"
                  }`}
                >
                  {!p.alive && <Skull size={11} />}
                  {p.username}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {phase === "gameover" && (
        <Card>
          <div className="text-center py-8">
            <Trophy size={40} className="mx-auto text-amber mb-4" />
            <p className="text-xl font-bold mb-1">
              {winner ? `${winner.username} gana la partida` : "Partida terminada"}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {winner?.id === me.id ? "¡Sos el último en pie! 🏆" : "Mejor suerte la próxima."}
            </p>
            <button
              onClick={handleLeave}
              className="bg-accent hover:bg-accent-dark transition-colors text-onaccent font-semibold rounded-card px-6 py-2.5 text-sm"
            >
              Volver al lobby
            </button>
          </div>
        </Card>
      )}
    </Layout>
  );
}
