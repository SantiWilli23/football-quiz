import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Search } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { playSfx } from "../utils/sfx.js";

// ¿Quién es? en vivo, 1 contra 1: los dos ven las mismas pistas al mismo tiempo
// (la sala va por el relay genérico de /ws) y gana quien adivine primero. El
// anfitrión maneja el reloj: una pista nueva cada 12 segundos. Hay reacciones
// rápidas con emojis mientras juegan.
const GAME = "quien_es_vivo";
const CLUE_EVERY = 12;
const EMOJIS = ["😂", "😱", "🔥", "👏", "🤔"];

export default function QuienEsVivo() {
  const { user } = useAuth();
  const [phase, setPhase] = useState("menu"); // menu | waiting | playing | over
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [clues, setClues] = useState([]);
  const [names, setNames] = useState([]);
  const [query, setQuery] = useState("");
  const [feed, setFeed] = useState([]);
  const [result, setResult] = useState(null);
  const [nextIn, setNextIn] = useState(CLUE_EVERY);
  const wsRef = useRef(null);
  const gameRef = useRef({ token: null, total: 0, isHost: false, shown: 0, over: false });

  useEffect(() => {
    api.get("/wordle/players", { params: { league: "global" } }).then((r) => setNames(r.data.players)).catch(() => {});
    return () => { try { wsRef.current?.close(); } catch { /* ya cerrado */ } };
  }, []);

  const send = (payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "relay", payload }));
  };
  const say = (text) => setFeed((f) => [text, ...f].slice(0, 6));

  const finish = useCallback((r) => {
    gameRef.current.over = true;
    setResult(r);
    setPhase("over");
    playSfx(r.by === user?.username ? "win" : "bad");
  }, [user]);

  const revealNext = useCallback(async () => {
    const g = gameRef.current;
    if (!g.isHost || g.over) return;
    if (g.shown >= g.total) {
      const { data } = await api.post("/quien-es/reveal", { token: g.token });
      send({ t: "end", name: data.name });
      finish({ name: data.name, by: null });
      return;
    }
    const { data } = await api.get("/quien-es/clue", { params: { token: g.token, i: g.shown } });
    g.shown += 1;
    setClues((c) => [...c, data.clue]);
    send({ t: "clue", clue: data.clue, shown: g.shown });
    setNextIn(CLUE_EVERY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  // Reloj del anfitrión.
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const id = setInterval(() => {
      setNextIn((n) => {
        if (n <= 1) { revealNext().catch(() => {}); return CLUE_EVERY; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, revealNext]);

  function onMessage(p) {
    const g = gameRef.current;
    if (p.t === "start") {
      Object.assign(g, { token: p.token, total: p.total, shown: 1, over: false });
      setClues([p.first]); setFeed([]); setResult(null); setPhase("playing");
    } else if (p.t === "clue") { g.shown = p.shown; setClues((c) => [...c, p.clue]); setNextIn(CLUE_EVERY); }
    else if (p.t === "wrong") say(`${p.by} probó con ${p.name} ✗`);
    else if (p.t === "react") say(`${p.by}: ${p.emoji}`);
    else if (p.t === "won") finish({ name: p.name, by: p.by, points: p.points });
    else if (p.t === "end") finish({ name: p.name, by: null });
  }

  function connect(first) {
    setError("");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify(first));
    ws.onmessage = async (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === "created") { setCode(m.room); setPhase("waiting"); gameRef.current.isHost = true; }
      else if (m.type === "joined") { gameRef.current.isHost = false; setCode(m.room); setPhase("waiting"); }
      else if (m.type === "opponent-joined" && gameRef.current.isHost) {
        const { data } = await api.get("/quien-es/new", { params: { difficulty: "facil" } });
        Object.assign(gameRef.current, { token: data.token, total: data.total, shown: 1, over: false });
        setClues([data.first]); setFeed([]); setResult(null); setPhase("playing");
        send({ t: "start", token: data.token, total: data.total, first: data.first });
      } else if (m.type === "relay") onMessage(m.payload);
      else if (m.type === "opponent-left") { say("Tu rival se fue"); if (!gameRef.current.over) setError("Tu rival se desconectó."); }
      else if (m.type === "error") setError(m.message || "Error de conexión");
    };
    ws.onclose = () => { if (!gameRef.current.over && phase === "playing") setError("Se cortó la conexión."); };
  }

  async function guess(name) {
    const g = gameRef.current;
    if (g.over) return;
    setQuery("");
    const { data } = await api.post("/quien-es/guess", { token: g.token, name, cluesShown: g.shown });
    if (data.correct) {
      send({ t: "won", name: data.name, by: user.username, points: data.points });
      finish({ name: data.name, by: user.username, points: data.points });
    } else {
      send({ t: "wrong", name, by: user.username });
      say(`Probaste ${name} ✗`);
      playSfx("bad");
    }
  }

  const suggestions = query.trim().length >= 2 ? names.filter((n) => n.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : [];

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-3">
        <Radio size={22} className="text-accent shrink-0" />
        <div>
          <h1 className="t-title">¿Quién es? en vivo</h1>
          <p className="text-gray-400 text-sm">Uno contra uno: las mismas pistas para los dos, una nueva cada {CLUE_EVERY} segundos. Gana quien lo adivine primero.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {phase === "menu" && (
        <Card className="space-y-4">
          <button onClick={() => connect({ type: "create", game: GAME, maxPlayers: 2 })} className="w-full px-5 py-3 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90">
            Crear sala
          </button>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Código de sala"
              maxLength={6}
              className="flex-1 bg-bg border border-border rounded-card px-3 py-2 text-sm uppercase tracking-widest"
              aria-label="Código de sala"
            />
            <button onClick={() => joinCode && connect({ type: "join", game: GAME, room: joinCode })} className="px-5 py-2 rounded-card border border-border text-sm font-medium text-gray-300 hover:text-white">
              Unirme
            </button>
          </div>
        </Card>
      )}

      {phase === "waiting" && (
        <Card className="text-center py-8">
          <p className="text-sm text-gray-400 mb-2">{gameRef.current.isHost ? "Pasale este código a tu rival" : "Esperando que el anfitrión empiece…"}</p>
          <p className="text-4xl font-bold tracking-[0.3em]">{code}</p>
        </Card>
      )}

      {(phase === "playing" || phase === "over") && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="t-eyebrow">Su carrera</p>
              {phase === "playing" && <span className="text-xs tabular-nums text-gray-400">Próxima pista en {nextIn}s</span>}
            </div>
            <ol className="space-y-2">
              {clues.map((c, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-xs text-gray-500">{c.label}</span>
                  <span className={c.kind === "club" ? "font-medium" : "text-accent"}>{c.text}</span>
                </li>
              ))}
            </ol>
          </Card>

          {phase === "playing" && (
            <Card>
              <div className="relative">
                <div className="flex items-center gap-2 bg-bg border border-border rounded-card px-3 py-2.5">
                  <Search size={15} className="text-gray-500 shrink-0" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="¿Quién es?…" className="flex-1 bg-transparent text-sm focus:outline-none" aria-label="Nombre del jugador" />
                </div>
                {suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-panel border border-border rounded-card overflow-hidden shadow-lg">
                    {suggestions.map((n) => (
                      <button key={n} onClick={() => guess(n)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 hover:text-accent transition-colors">{n}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => { send({ t: "react", emoji: e, by: user.username }); say(`Vos: ${e}`); }} className="text-xl px-2 py-1 rounded-card border border-border hover:bg-white/5" aria-label={`Reaccionar ${e}`}>{e}</button>
                ))}
              </div>
            </Card>
          )}

          {feed.length > 0 && <Card><ul className="space-y-1 text-xs text-gray-400">{feed.map((f, i) => <li key={i}>{f}</li>)}</ul></Card>}

          {phase === "over" && result && (
            <Card className="text-center py-8">
              <p className="text-sm text-gray-400 mb-1">{result.by ? (result.by === user.username ? "¡Ganaste!" : `Ganó ${result.by}`) : "Nadie lo adivinó"}</p>
              <p className="text-2xl font-bold mb-4">Era {result.name}</p>
              <button onClick={() => { try { wsRef.current?.close(); } catch { /* ya cerrado */ } setPhase("menu"); setCode(""); }} className="px-6 py-2.5 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90">
                Volver
              </button>
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}
