import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getLiveAccess, dtLiveWsUrl } from "./api.js";

const SPEED_OPTIONS = [
  { value: 0.2, label: "0.2x — muy lento" },
  { value: 0.5, label: "0.5x — lento" },
  { value: 1, label: "1x — normal" },
  { value: 2, label: "2x — rápido" },
];

export default function LiveMatch() {
  const { code, fixtureId } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("connecting"); // connecting | waiting | live | final | error
  const [error, setError] = useState(null);
  const [you, setYou] = useState(null); // "home" | "away"
  const [teams, setTeams] = useState(null);
  const [connected, setConnected] = useState([]);
  const [speed, setSpeed] = useState(1);
  const [events, setEvents] = useState([]);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [finalScore, setFinalScore] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        await getLiveAccess(code, fixtureId);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || "No se pudo acceder a este partido");
          setPhase("error");
        }
        return;
      }
      if (cancelled) return;

      const ws = new WebSocket(dtLiveWsUrl(fixtureId));
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg || typeof msg.type !== "string") return;

        if (msg.type === "joined") {
          setYou(msg.you);
          setTeams({ home: msg.homeTeamName, away: msg.awayTeamName, homeUser: msg.homeUsername, awayUser: msg.awayUsername });
          setSpeed(msg.speed);
          setPhase(msg.started ? "live" : "waiting");
        } else if (msg.type === "presence") {
          setConnected(msg.connected);
        } else if (msg.type === "speed") {
          setSpeed(msg.speed);
        } else if (msg.type === "kickoff") {
          setPhase("live");
          setSpeed(msg.speed);
        } else if (msg.type === "event") {
          setEvents((prev) => [...prev, msg.event]);
          if (msg.event.team === "home") setScore((s) => ({ ...s, home: s.home + 1 }));
          else if (msg.event.team === "away") setScore((s) => ({ ...s, away: s.away + 1 }));
        } else if (msg.type === "final") {
          setFinalScore({ home: msg.homeGoals, away: msg.awayGoals });
          setPhase("final");
        } else if (msg.type === "error") {
          setError(msg.message);
          setPhase("error");
        }
      };
      ws.onerror = () => { if (!cancelled) { setError("Error de conexión"); setPhase("error"); } };
    }

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [code, fixtureId]);

  function sendSpeed(value) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_speed", speed: value }));
    }
  }

  const bothConnected = teams && connected.length >= 2;

  return (
    <div className="min-h-screen bg-bg text-white p-4">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Partido en vivo</h1>
          <Link to={`/dt-liga/${code}`} className="text-xs text-gray-500 hover:text-white">← Volver a la liga</Link>
        </div>

        {phase === "connecting" && <p className="text-sm text-gray-500 text-center py-10">Conectando…</p>}

        {phase === "error" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {teams && (
          <div className="bg-panel border border-border rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-4 mb-1">
              <span className={`font-semibold ${you === "home" ? "text-accent" : ""}`}>{teams.home}</span>
              <span className="text-3xl font-bold tabular-nums">{score.home} - {score.away}</span>
              <span className={`font-semibold ${you === "away" ? "text-accent" : ""}`}>{teams.away}</span>
            </div>
            <p className="text-xs text-gray-500">{teams.homeUser} vs {teams.awayUser}</p>
          </div>
        )}

        {phase === "waiting" && (
          <div className="bg-panel border border-border rounded-2xl p-5 space-y-4">
            <p className="text-sm text-gray-400 text-center">
              {bothConnected ? "Los dos están conectados — arranca en un momento…" : "Esperando a que se conecte el otro DT…"}
            </p>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Velocidad del partido</p>
              <div className="grid grid-cols-2 gap-2">
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => sendSpeed(opt.value)}
                    className={`px-3 py-2 rounded-2xl border text-sm transition-colors ${
                      speed === opt.value ? "border-accent bg-accent/10 text-accent" : "border-border text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">Cualquiera de los dos puede cambiarla antes de que arranque.</p>
            </div>
          </div>
        )}

        {(phase === "live" || phase === "final") && (
          <div className="bg-panel border border-border rounded-2xl p-4 max-h-96 overflow-y-auto space-y-2">
            {events.length === 0 && <p className="text-sm text-gray-500 text-center py-4">El partido está por arrancar…</p>}
            {events.map((e, i) => (
              <p key={i} className="text-sm">
                <span className="text-gray-500">Min {e.min}'</span> — {e.text}
              </p>
            ))}
          </div>
        )}

        {phase === "final" && (
          <div className="space-y-3">
            <div className="bg-emerald/10 border border-emerald/30 rounded-2xl px-4 py-3 text-center text-emerald font-semibold">
              Final: {finalScore.home} - {finalScore.away}
            </div>
            <button
              onClick={() => navigate(`/dt-liga/${code}`)}
              className="w-full bg-accent text-black font-semibold py-3 rounded-2xl hover:brightness-110 transition"
            >
              Volver a la liga
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
