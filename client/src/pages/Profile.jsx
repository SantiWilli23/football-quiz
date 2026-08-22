import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

export default function Profile() {
  const { user, stats } = useAuth();
  const { activeGroupId, activeGroup } = useGroups();
  const [position, setPosition] = useState(null);

  useEffect(() => {
    const loadPosition = async () => {
      if (!activeGroupId) {
        setPosition(null);
        return;
      }
      try {
        const { data } = await api.get(`/groups/${activeGroupId}`);
        const mine = data.ranking.find((r) => r.id === user?.id);
        setPosition(mine ? mine.position : null);
      } catch {
        setPosition(null);
      }
    };
    if (user) loadPosition();
  }, [user, activeGroupId]);

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
          <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-2xl font-semibold">
            {user.avatar}
          </div>
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card key={item.label}>
            <p className="text-xs text-gray-500 mb-2">{item.label}</p>
            <p className="text-2xl font-bold">{item.value}</p>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
