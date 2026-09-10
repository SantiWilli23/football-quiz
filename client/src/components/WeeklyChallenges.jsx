import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Un solo lugar para ver cómo va cada uno en los "retos" — la versión
// semanal de cada juego, más la trivia diaria. 100/50/30/10 puntos para
// los primeros cuatro puestos; el resto no suma nada acá.
const GAMES = [
  { key: "trivia", label: "Trivia del día", endpoint: "trivia-leaderboard" },
  { key: "draft_europeo", label: "Draft Europeo · Bayern 2020", endpoint: "leaderboard" },
  { key: "cotrero", label: "Cotrero · Reto semanal", endpoint: "leaderboard" },
  { key: "fichado", label: "Fichado · Menos intentos gana", endpoint: "leaderboard" },
  { key: "equipo_jugador", label: "Equipo-Jugador · Más rondas 4v4", endpoint: "leaderboard" },
];

const MEDALS = ["🥇", "🥈", "🥉", "4°"];

export default function WeeklyChallenges({ groupId }) {
  const { user } = useAuth();
  const [activeKey, setActiveKey] = useState(GAMES[0].key);
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(false);

  const activeGame = GAMES.find((g) => g.key === activeKey);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    setEntries(null);
    const url = activeGame.endpoint === "trivia-leaderboard"
      ? "/challenges/trivia-leaderboard"
      : "/challenges/leaderboard";
    const params = activeGame.endpoint === "trivia-leaderboard"
      ? { groupId }
      : { groupId, gameKey: activeKey };
    api
      .get(url, { params })
      .then(({ data }) => setEntries(data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [groupId, activeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={15} className="text-accent" />
        <h3 className="font-semibold">Retos — ranking del grupo</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Versión semanal de cada juego (y la trivia diaria): 100 puntos para el 1°, 50 para el 2°, 30 para el 3° y 10 para el 4°.
      </p>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {GAMES.map((g) => (
          <button
            key={g.key}
            onClick={() => setActiveKey(g.key)}
            className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
              activeKey === g.key
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-gray-400 hover:text-white hover:border-white/30"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500 py-3">Cargando...</p>}

      {!loading && entries && entries.length === 0 && (
        <p className="text-sm text-gray-500 py-3">Todavía nadie del grupo jugó este reto.</p>
      )}

      {!loading && entries && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.user_id}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-card border ${
                e.user_id === user?.id ? "border-accent/40 bg-accent/5" : "border-border"
              }`}
            >
              <div className="w-8 text-center text-sm font-semibold text-gray-400 flex items-center justify-center gap-1 shrink-0">
                {e.rank === 1 ? <Crown size={15} className="text-accent" /> : (MEDALS[e.rank - 1] || `${e.rank}°`)}
              </div>
              <p className="text-sm font-medium flex-1 min-w-0 truncate">{e.username}</p>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{e.score}</p>
                {e.points > 0 && <p className="text-[11px] text-accent">+{e.points} pts</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
