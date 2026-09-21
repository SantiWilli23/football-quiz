import { useEffect, useState } from "react";
import { Crown, Globe2, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Avatar from "../components/Avatar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import Podium from "../components/Podium.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function GlobalRanking() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState(null);
  const [myPosition, setMyPosition] = useState(null);
  const [period, setPeriod] = useState("all"); // week | month | all

  useEffect(() => {
    setRanking(null);
    api
      .get("/stats/global-ranking", { params: { period } })
      .then(({ data }) => {
        setRanking(data.ranking);
        setMyPosition(data.myPosition);
      })
      .catch(() => setRanking([]));
  }, [period]);

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-1">
        <Globe2 size={20} className="text-accent" />
        <h1 className="t-title">Ranking global</h1>
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Los 100 usuarios con más puntos de toda la app, sin importar el grupo. Se suman los mismos puntos que ves en tu perfil (trivia + modo especial).
      </p>

      <div className="flex gap-1.5 mb-5" role="group" aria-label="Período">
        {[["week", "Esta semana"], ["month", "Este mes"], ["all", "Histórico"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            aria-pressed={period === k}
            className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
              period === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white hover:border-white/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {myPosition && (
        <Card className="mb-4">
          <p className="text-sm">
            Estás <span className="font-semibold text-accent">#{myPosition}</span> entre todos los jugadores.
          </p>
        </Card>
      )}

      {ranking === null && <Card><SkeletonRows rows={8} /></Card>}

      {ranking && ranking.length === 0 && (
        <Card>
          <EmptyState
            icon={Trophy}
            title="La tabla está en cero"
            hint="Respondé la trivia de hoy y abrís el ranking."
            actions={[{ label: "Jugar trivia", to: "/trivia" }, { label: "Invitar amigos", to: "/grupo", ghost: true }]}
          />
        </Card>
      )}

      {ranking && ranking.length > 0 && (
        <>
        <Podium entries={ranking.slice(0, 3).map((r) => ({ ...r, value: r.total_points }))} meId={user?.id} />
        <div>
          {ranking.slice(ranking.length >= 3 ? 3 : 0).map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-2 py-2.5 border-b border-border last:border-0 ${
                r.id === user?.id ? "bg-accent/5" : ""
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
        </>
      )}
    </Layout>
  );
}
