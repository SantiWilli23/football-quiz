import { useEffect, useState } from "react";
import { Crown, Globe2 } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Avatar from "../components/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function GlobalRanking() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState(null);
  const [myPosition, setMyPosition] = useState(null);

  useEffect(() => {
    api
      .get("/stats/global-ranking")
      .then(({ data }) => {
        setRanking(data.ranking);
        setMyPosition(data.myPosition);
      })
      .catch(() => setRanking([]));
  }, []);

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-1">
        <Globe2 size={20} className="text-accent" />
        <h1 className="text-xl sm:text-2xl font-bold">Ranking global</h1>
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Los 100 usuarios con más puntos de toda la app, sin importar el grupo. Se suman los mismos puntos que ves en tu perfil (trivia + modo especial).
      </p>

      {myPosition && (
        <Card className="mb-4">
          <p className="text-sm">
            Estás <span className="font-semibold text-accent">#{myPosition}</span> entre todos los jugadores.
          </p>
        </Card>
      )}

      {ranking === null && <p className="text-sm text-gray-500">Cargando...</p>}

      {ranking && ranking.length === 0 && (
        <Card>
          <p className="text-sm text-gray-500">Todavía nadie sumó puntos.</p>
        </Card>
      )}

      {ranking && ranking.length > 0 && (
        <div className="space-y-2">
          {ranking.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-card border ${
                r.id === user?.id ? "border-accent/40 bg-accent/5" : "border-border"
              }`}
            >
              <div className="w-8 text-center text-sm font-semibold text-gray-400 flex items-center justify-center gap-1 shrink-0">
                {r.position === 1 ? <Crown size={15} className="text-accent" /> : (MEDALS[r.position - 1] || `${r.position}°`)}
              </div>
              <Avatar user={r} size={32} />
              <p className="text-sm font-medium flex-1 min-w-0 truncate">{r.username}</p>
              <p className="text-sm font-semibold shrink-0">{r.total_points} pts</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
