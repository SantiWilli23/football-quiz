import { useCallback, useEffect, useState } from "react";
import { BarChart3, Crown, Flame, HelpCircle, Newspaper, Swords, Star, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import api from "../api.js";

const INTERNAL_GAMES = [
  {
    to: "/trivia",
    label: "Trivia",
    icon: HelpCircle,
    description: "Respondé las preguntas del día: trivia normal + preguntas especiales del grupo.",
    color: "#3b9dd6",
  },
  {
    to: "/futbol",
    label: "Fútbol",
    icon: Newspaper,
    description: "Resultados en vivo, tabla de posiciones, goleadores y juegos de fútbol.",
    color: "#3fae9a",
  },
  {
    to: "/grupo",
    label: "Grupos",
    icon: Users,
    description: "Competí con tus amigos, mirá el ranking del grupo y los campeones mensuales.",
    color: "#d9a441",
  },
  {
    to: "/duelos",
    label: "Duelos",
    icon: Swords,
    description: "Desafiá a alguien del grupo uno contra uno con las preguntas más difíciles.",
    color: "#f0907e",
  },
  {
    to: "/estadisticas",
    label: "Estadísticas",
    icon: BarChart3,
    description: "Resumen semanal, compatibilidad con el grupo y logros desbloqueados.",
    color: "#a78bfa",
  },
];

const EXTERNAL_GAMES = [
  {
    href: "/draft-europeo.html",
    label: "Draft Europeo 8a2",
    icon: Star,
    description: "Armá tu XI con jugadores de 138 planteles históricos de la Champions League.",
    color: "#d9a441",
    badge: null,
  },
  {
    href: "/cotrero.html",
    label: "Cotrero",
    icon: Crown,
    description: "De potrero a leyenda: simulá toda la carrera de un jugador, temporada a temporada.",
    color: "#3fae9a",
    badge: null,
  },
  {
    href: null,
    label: "Adivina el Jugador",
    icon: Zap,
    description: "¿Podés adivinar quién es el jugador con pistas mínimas?",
    color: "#a8a9ac",
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
      <div className="mb-8 pb-6 border-b border-border flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold text-accent uppercase tracking-[0.15em] mb-2">Panel</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
            Hola{user?.username ? `, ${user.username}` : ""} <span className="inline-block">👋</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-xl leading-relaxed">
            Futotal es tu plataforma de fútbol con amigos: trivia diaria, duelos 1v1, estadísticas
            del grupo y simuladores de carrera. Elegí por dónde empezar.
          </p>
        </div>
        <GroupSelector />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div>
          {/* Secciones principales */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-3.5 rounded-full bg-accent" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Secciones
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {INTERNAL_GAMES.map(({ to, label, icon: Icon, description, color }) => (
              <Link
                key={to}
                to={to}
                className="group relative flex items-start gap-3.5 px-4 py-4 rounded-card border border-border bg-panel hover:border-white/15 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 transition-all"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div
                  className="w-11 h-11 rounded-card flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: `${color}1a`, border: `1px solid ${color}40` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold mb-0.5 group-hover:text-white transition-colors">
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 leading-snug">{description}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Juegos externos */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-3.5 rounded-full bg-emerald" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Juegos
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXTERNAL_GAMES.map(({ href, label, icon: Icon, description, color, badge }) => {
              const inner = (
                <>
                  <div
                    className="w-11 h-11 rounded-card flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                    style={{ background: `${color}1a`, border: `1px solid ${color}40` }}
                  >
                    <Icon size={20} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold">{label}</p>
                      {badge && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-600/50 text-gray-400 border border-gray-600/50">
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-snug">{description}</p>
                  </div>
                </>
              );

              if (!href) {
                return (
                  <div
                    key={label}
                    className="flex items-start gap-3.5 px-4 py-4 rounded-card border border-border bg-panel opacity-50 cursor-default"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    {inner}
                  </div>
                );
              }

              return (
                <a
                  key={href}
                  href={href}
                  className="group relative flex items-start gap-3.5 px-4 py-4 rounded-card border border-border bg-panel hover:border-white/15 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 transition-all"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  {inner}
                </a>
              );
            })}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-orange-400" />
                <span className="text-sm font-medium text-gray-300">Racha</span>
              </div>
              {current > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-400/10 text-orange-400 border border-orange-400/30">
                  Activa
                </span>
              )}
            </div>
            <p className="text-4xl font-bold tracking-tight tabular-nums">
              {current}
              <span className="text-sm font-medium text-gray-500 ml-1.5">días</span>
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-400 transition-[width]"
                style={{ width: `${streakPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">Mejor racha: {best} días</p>
          </Card>

          <Card>
            <p className="text-sm font-medium text-gray-300 mb-3">Mis stats</p>
            <div className="space-y-2.5">
              <StatRow label="Puntos" value={stats?.total_points ?? 0} />
              <StatRow label="Aciertos" value={`${stats?.accuracy ?? 0}%`} />
              <StatRow label="Trivia" value={stats?.trivia_points ?? 0} />
              <StatRow label="Especial" value={stats?.mode_b_points ?? 0} accent="text-purple-400" />
            </div>
          </Card>

          {groups.length > 0 && (
            <Card>
              <p className="text-sm font-medium text-gray-300 mb-3">Mi grupo</p>
              {groupDetail ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-card flex items-center justify-center shrink-0 bg-accent/15 border border-accent/30 text-accent font-bold text-sm">
                    {groupDetail.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-accent truncate">{groupDetail.name}</p>
                    {groupDetail.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{groupDetail.description}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {groups.slice(0, 3).map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate">{g.name}</span>
                      <span className="text-gray-500 text-xs shrink-0">{g.member_count} miembros</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatRow({ label, value, accent = "text-white" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`font-semibold tabular-nums ${accent}`}>{value}</span>
    </div>
  );
}
