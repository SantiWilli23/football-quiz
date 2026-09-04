import { useEffect, useState } from "react";
import { BarChart3, Crown, Flame, HelpCircle, Newspaper, Swords, Star, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import api from "../api.js";

const INTERNAL_GAMES = [
  {
    to: "/trivia",
    label: "Trivia",
    icon: HelpCircle,
    description: "Respondé las preguntas del día: trivia normal + preguntas especiales del grupo.",
  },
  {
    to: "/futbol",
    label: "Fútbol",
    icon: Newspaper,
    description: "Resultados en vivo, tabla de posiciones, goleadores y juegos de fútbol.",
  },
  {
    to: "/grupo",
    label: "Grupos",
    icon: Users,
    description: "Competí con tus amigos, mirá el ranking del grupo y los campeones mensuales.",
  },
  {
    to: "/duelos",
    label: "Duelos",
    icon: Swords,
    description: "Desafiá a alguien del grupo uno contra uno con las preguntas más difíciles.",
  },
  {
    to: "/estadisticas",
    label: "Estadísticas",
    icon: BarChart3,
    description: "Resumen semanal, compatibilidad con el grupo y logros desbloqueados.",
  },
];

const EXTERNAL_GAMES = [
  {
    href: "/draft-europeo.html",
    label: "Draft Europeo 8a2",
    icon: Star,
    description: "Armá tu XI con jugadores de 138 planteles históricos de la Champions League.",
    badge: null,
  },
  {
    href: "/cotrero.html",
    label: "Cotrero",
    icon: Crown,
    description: "De potrero a leyenda: simulá toda la carrera de un jugador, temporada a temporada.",
    badge: null,
  },
  {
    href: null,
    label: "Adivina el Jugador",
    icon: Zap,
    description: "¿Podés adivinar quién es el jugador con pistas mínimas?",
    badge: "Próximamente",
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
          {/* Secciones principales */}
          <h2 className="text-[11px] font-medium text-gray-600 uppercase tracking-[0.2em] mb-4">
            Secciones
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5 rounded-card overflow-hidden mb-12">
            {INTERNAL_GAMES.map(({ to, label, icon: Icon, description }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-start gap-4 px-5 py-5 bg-bg hover:bg-panel transition-colors"
              >
                <div className="w-10 h-10 rounded-card flex items-center justify-center shrink-0 bg-white/5 text-gray-400 group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                  <Icon size={18} />
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

          {/* Juegos externos */}
          <h2 className="text-[11px] font-medium text-gray-600 uppercase tracking-[0.2em] mb-4">
            Juegos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5 rounded-card overflow-hidden">
            {EXTERNAL_GAMES.map(({ href, label, icon: Icon, description, badge }) => {
              const inner = (
                <>
                  <div className="w-10 h-10 rounded-card flex items-center justify-center shrink-0 bg-white/5 text-gray-400 group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium group-hover:text-white transition-colors">{label}</p>
                      {badge && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-gray-500 border border-white/10">
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
                  </div>
                </>
              );

              if (!href) {
                return (
                  <div key={label} className="flex items-start gap-4 px-5 py-5 bg-bg opacity-40 cursor-default">
                    {inner}
                  </div>
                );
              }

              return (
                <a
                  key={href}
                  href={href}
                  className="group flex items-start gap-4 px-5 py-5 bg-bg hover:bg-panel transition-colors"
                >
                  {inner}
                </a>
              );
            })}
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
            <div className="space-y-3">
              <StatRow label="Puntos" value={stats?.total_points ?? 0} />
              <StatRow label="Aciertos" value={`${stats?.accuracy ?? 0}%`} />
              <StatRow label="Trivia" value={stats?.trivia_points ?? 0} />
              <StatRow label="Especial" value={stats?.mode_b_points ?? 0} />
            </div>
          </div>

          {groups.length > 0 && (
            <div className="pt-8 border-t border-white/5">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-[0.2em] mb-4">Mi grupo</p>
              {groupDetail ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-card flex items-center justify-center shrink-0 bg-accent/15 text-accent font-semibold text-sm">
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

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
