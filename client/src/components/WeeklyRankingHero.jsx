import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api.js";
import Card from "./Card.jsx";
import Avatar from "./Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// El centro de la app: el ranking semanal del grupo, arriba de todo lo demás
// en el Dashboard. Usa el mismo dato que ya calculaba WeeklyRecap (que
// solo mostraba "tu" resumen) pero acá se ve la tabla completa, porque el
// objetivo es que compitan entre todos, no que cada uno mire solo su número.
const TOP_SHOWN = 5;

export default function WeeklyRankingHero({ groupId }) {
  const { user } = useAuth();
  const [recap, setRecap] = useState(undefined);

  useEffect(() => {
    if (!groupId) { setRecap(null); return; }
    setRecap(undefined);
    api.get("/stats/weekly-recap", { params: { groupId } })
      .then(({ data }) => setRecap(data))
      .catch(() => setRecap(null));
  }, [groupId]);

  if (!groupId) {
    return (
      <Card variant="feature" className="mb-8 text-center py-10">
        <Trophy size={26} className="mx-auto text-accent mb-2" />
        <p className="font-semibold mb-1">Todavía no tenés un grupo</p>
        <p className="text-sm text-gray-400 mb-4">El ranking semanal se juega entre tu grupo de amigos — sumá o creá uno para empezar a competir.</p>
        <Link to="/grupo" className="btn btn-primary btn-sm inline-flex">Ir a Grupos ›</Link>
      </Card>
    );
  }

  if (recap === undefined) {
    return <Card variant="feature" className="mb-8 h-48 animate-pulse" />;
  }
  if (recap === null || recap.ranking.length === 0) {
    return null;
  }

  const top = recap.ranking.slice(0, TOP_SHOWN);
  const iAmShown = top.some((r) => r.id === user?.id);

  return (
    <Card variant="feature" className="mb-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-accent" />
          <h2 className="font-semibold">Ranking semanal del grupo</h2>
        </div>
        <Link to="/liga-grupo" className="text-xs text-gray-500 hover:text-white transition-colors">Ver liga completa ›</Link>
      </div>

      <div className="space-y-1">
        {top.map((r) => (
          <div
            key={r.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-card ${r.id === user?.id ? "bg-accent/10 border border-accent/30" : ""}`}
          >
            <span className={`w-5 text-sm font-semibold tabular-nums text-center ${r.position === 1 ? "text-amber-500" : "text-gray-500"}`}>
              {r.position === 1 ? <Crown size={14} className="inline" /> : r.position}
            </span>
            <Avatar user={r} size={26} />
            <span className="text-sm flex-1 truncate">{r.username}</span>
            <span className="text-sm font-semibold tabular-nums">{r.points} pts</span>
          </div>
        ))}
        {!iAmShown && recap.me && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-card bg-accent/10 border border-accent/30 mt-2">
            <span className="w-5 text-sm font-semibold tabular-nums text-center text-gray-500">{recap.myPosition}</span>
            <Avatar user={recap.me} size={26} />
            <span className="text-sm flex-1 truncate">Vos</span>
            <span className="text-sm font-semibold tabular-nums">{recap.me.points} pts</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Semana del {recap.weekStart} al {recap.weekEnd} · se reinicia cada lunes
      </p>
    </Card>
  );
}
