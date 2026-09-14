import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Avatar from "../components/Avatar.jsx";
import AvatarEditor from "../components/AvatarEditor.jsx";
import PushToggle from "../components/PushToggle.jsx";
import AccountSettings from "../components/AccountSettings.jsx";
import ThemeSettings from "../components/ThemeSettings.jsx";
import PlayerCard from "../components/PlayerCard.jsx";

export default function Profile() {
  const { user, stats, refreshMe } = useAuth();
  const { activeGroupId, activeGroup } = useGroups();
  const [position, setPosition] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [compareId, setCompareId] = useState("");

  useEffect(() => {
    const loadGroup = async () => {
      if (!activeGroupId) {
        setPosition(null);
        setRanking([]);
        return;
      }
      try {
        const { data } = await api.get(`/groups/${activeGroupId}`);
        const mine = data.ranking.find((r) => r.id === user?.id);
        setPosition(mine ? mine.position : null);
        setRanking(data.ranking || []);
      } catch {
        setPosition(null);
        setRanking([]);
      }
    };
    if (user) loadGroup();
  }, [user, activeGroupId]);

  const me = ranking.find((r) => r.id === user?.id);
  const rival = ranking.find((r) => r.id === Number(compareId));
  const others = ranking.filter((r) => r.id !== user?.id);

  if (!user || !stats) return null;

  const items = [
    { label: "Puntos totales", value: stats.total_points },
    { label: "Puntos de trivia", value: stats.trivia_points ?? 0 },
    { label: "Puntos del modo especial", value: stats.mode_b_points ?? 0 },
    { label: "% de aciertos", value: `${stats.accuracy}%` },
    { label: "Respondidas", value: stats.answered },
    { label: "Racha actual", value: `${stats.current_streak} días` },
    { label: "Mejor racha", value: `${stats.best_streak} días` },
    {
      label: activeGroup ? `Posición en ${activeGroup.name}` : "Posición en grupo",
      value: position ? `#${position}` : "—",
    },
  ];

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">Mi perfil</h1>

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} />
          <div>
            <p className="text-lg font-semibold">{user.username}</p>
            <p className="text-sm text-gray-400">{user.email}</p>
            <p className="text-xs text-gray-600 mt-1">
              Miembro desde{" "}
              {new Date(user.created_at).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-6">
        <PlayerCard user={user} stats={stats} activeGroup={activeGroup} position={position} />
      </div>

      <div className="mb-6">
        <AvatarEditor user={user} onSaved={refreshMe} />
      </div>

      <div className="mb-6">
        <ThemeSettings />
      </div>

      <div className="mb-6">
        <PushToggle />
      </div>

      <div className="mb-6">
        <AccountSettings user={user} onUpdated={refreshMe} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card key={item.label}>
            <p className="text-xs text-gray-500 mb-2">{item.label}</p>
            <p className="text-2xl font-bold">{item.value}</p>
          </Card>
        ))}
      </div>

      {others.length > 0 && me && (
        <Card className="mt-6">
          <h2 className="font-semibold mb-3">Comparar perfiles</h2>
          <select
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
            className="w-full sm:w-auto bg-bg border border-border rounded-card px-3 py-2 text-sm mb-4 focus:outline-none focus:border-accent"
          >
            <option value="">Elegí a alguien del grupo...</option>
            {others.map((r) => (
              <option key={r.id} value={r.id}>{r.username}</option>
            ))}
          </select>

          {rival && (
            <div className="space-y-2.5">
              {[
                ["points", "Puntos totales"],
                ["trivia_points", "Puntos de trivia"],
                ["duel_points", "Puntos de duelos"],
                ["accuracy", "% de aciertos", "%"],
                ["answered", "Respondidas"],
              ].map(([key, label, suffix = ""]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className={`font-bold w-16 text-center ${(me[key] || 0) > (rival[key] || 0) ? "text-accent" : ""}`}>
                    {me[key] ?? 0}{suffix}
                  </span>
                  <span className="text-gray-500 text-xs flex-1 text-center">{label}</span>
                  <span className={`font-bold w-16 text-center ${(rival[key] || 0) > (me[key] || 0) ? "text-accent" : ""}`}>
                    {rival[key] ?? 0}{suffix}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </Layout>
  );
}
