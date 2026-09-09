import { useEffect, useState } from "react";
import { BarChart3, Flame, HelpCircle, Newspaper, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import api from "../api.js";

// El inicio muestra solo las secciones generales — cada una agrupa sus
// propios modos adentro (Trivia: trivia diaria, duelos, supervivencia;
// Fútbol: resultados en vivo + subapartado de juegos).
const SECTIONS = [
  {
    to: "/trivia",
    label: "Trivia",
    icon: HelpCircle,
    description: "Trivia diaria, preguntas especiales del grupo, duelos 1v1 y supervivencia en vivo.",
    color: "#f0907e",
  },
  {
    to: "/futbol",
    label: "Fútbol",
    icon: Newspaper,
    description: "Resultados en vivo, tabla de posiciones, goleadores y todos los juegos de fútbol.",
    color: "#3b9dd6",
  },
  {
    to: "/grupo",
    label: "Grupos",
    icon: Users,
    description: "Competí con tus amigos, mirá el ranking del grupo y los campeones mensuales.",
    color: "#d9a441",
  },
  {
    to: "/estadisticas",
    label: "Estadísticas",
    icon: BarChart3,
    description: "Resumen semanal, compatibilidad con el grupo y logros desbloqueados.",
    color: "#3fae9a",
  },
];

export default function Dashboard() {
  const { user, stats } = useAuth();
  const { groups, activeGroupId: groupId } = useGroups();
  const [groupDetail, setGroupDetail] = useState(null);

  useEffect(() => {
    if (!groupId) { setGroupDetail(null); return; }
    api.get(`/groups/${groupId}`)
      .then(({ data }) => setGroupDetail(data.group))
      .catch(() => setGroupDetail(null));
  }, [groupId]);

  const current = stats?.current_streak ?? 0;
  const best = stats?.best_streak ?? 0;
  const streakPct = best > 0 ? Math.min(100, Math.round((current / best) * 100)) : current > 0 ? 100 : 0;

  return (
    <Layout>
      {/* Header */}
      <div className="mb-12 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-medium text-accent/90 uppercase tracking-[0.2em] mb-3">Panel</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
            Hola{user?.username ? `, ${user.username}` : ""}
          </h1>
          <p className="text-gray-500 text-sm max-w-lg leading-relaxed">
            Futotal es tu plataforma de fútbol con amigos: trivia diaria, duelos 1v1, estadísticas
            del grupo y simuladores de carrera.
          </p>
        </div>
        <GroupSelector />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-x-14 gap-y-12">
        <div>
          <h2 className="text-[11px] font-medium text-gray-600 uppercase tracking-[0.2em] mb-4">
            Secciones
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden">
            {SECTIONS.map(({ to, label, icon: Icon, description, color }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-start gap-4 px-5 py-5 bg-bg hover:bg-panel transition-colors"
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}22`, border: `1px solid ${color}44`, color }}
                >
                  <Icon size={19} />
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-sm font-medium mb-1 group-hover:text-white transition-colors">
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flame size={14} className={current > 0 ? "text-orange-400" : "text-gray-600"} />
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-[0.2em]">Racha</span>
            </div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {current}
              <span className="text-sm font-normal text-gray-500 ml-2">días</span>
            </p>
            <div className="mt-4 h-px bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-400/70 transition-[width]"
                style={{ width: `${streakPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">Mejor: {best} días</p>
          </div>

          <div className="pt-8 border-t border-white/5">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-[0.2em] mb-4">Mis stats</p>
            <div className="divide-y divide-white/5">
              <StatRow label="Puntos" value={stats?.total_points ?? 0} />
              <StatRow label="Aciertos" value={`${stats?.accuracy ?? 0}%`} accent />
              <StatRow label="Trivia" value={stats?.trivia_points ?? 0} />
              <StatRow label="Especial" value={stats?.mode_b_points ?? 0} />
            </div>
          </div>

          {groups.length > 0 && (
            <div className="pt-8 border-t border-white/5">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-[0.2em] mb-4">Mi grupo</p>
              {groupDetail ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-accent/15 text-accent font-semibold text-sm">
                    {groupDetail.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{groupDetail.name}</p>
                    {groupDetail.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{groupDetail.description}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.slice(0, 3).map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate">{g.name}</span>
                      <span className="text-gray-600 text-xs shrink-0">{g.member_count} miembros</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between text-sm py-2.5 first:pt-0 last:pb-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`font-medium tabular-nums ${accent ? "text-accent" : ""}`}>{value}</span>
    </div>
  );
}
