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

  return (
    <Layout>
      {/* Hero de marca */}
      <div className="rounded-card border border-border bg-panel px-6 py-10 sm:py-14 mb-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-card bg-gradient-to-br from-accent-light to-emerald-500 flex items-center justify-center text-black font-extrabold text-xl">
            FT
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-accent-light via-accent to-emerald-500 bg-clip-text text-transparent">
            FUTOTAL
          </h1>
          <p className="text-gray-400 max-w-sm text-sm">
            La trivia de fútbol que desafía a los que lo saben todo
          </p>
        </div>

        <div className="flex flex-col items-center gap-5 mt-8">
          <div className="w-16 h-px bg-border" />
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Trivia diaria
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Duelos
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-4 py-2 text-xs font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Grupos
            </span>
          </div>
          <Link
            to="/trivia"
            className="rounded-full bg-gradient-to-r from-accent to-accent-light px-8 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
          >
            Jugar ahora
          </Link>
        </div>

        <p className="text-[11px] text-gray-600 tracking-wide mt-8">COTRERO · DRAFT EUROPEO 8A2 · TRIVIA</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              Hola{user?.username ? `, ${user.username}` : ""} 👋
            </h1>
            <p className="text-gray-400 text-sm max-w-xl leading-relaxed">
              Futotal es tu plataforma de fútbol con amigos: trivia diaria, duelos 1v1, estadísticas
              del grupo y simuladores de carrera. Elegí por dónde empezar.
            </p>
          </div>

          {/* Secciones principales */}
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Secciones
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {INTERNAL_GAMES.map(({ to, label, icon: Icon, description, color }) => (
              <Link
                key={to}
                to={to}
                className="flex items-start gap-3.5 px-4 py-4 rounded-card border border-border bg-panel hover:border-white/20 hover:bg-white/5 transition-colors group"
              >
                <div
                  className="w-9 h-9 rounded-card flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-0.5 group-hover:text-white transition-colors">
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 leading-snug">{description}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Juegos externos */}
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Juegos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXTERNAL_GAMES.map(({ href, label, icon: Icon, description, color, badge }) => {
              const inner = (
                <>
                  <div
                    className="w-9 h-9 rounded-card flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                  >
                    <Icon size={18} style={{ color }} />
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
                    className="flex items-start gap-3.5 px-4 py-4 rounded-card border border-border bg-panel opacity-60 cursor-default"
                  >
                    {inner}
                  </div>
                );
              }

              return (
                <a
                  key={href}
                  href={href}
                  className="flex items-start gap-3.5 px-4 py-4 rounded-card border border-border bg-panel hover:border-white/20 hover:bg-white/5 transition-colors group"
                >
                  {inner}
                </a>
              );
            })}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-5">
          <GroupSelector />

          <Card>
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Flame size={16} />
              <span className="text-sm font-medium">Racha</span>
            </div>
            <p className="text-3xl font-bold">{stats?.current_streak ?? 0} días</p>
            <p className="text-xs text-gray-500 mt-1">Mejor: {stats?.best_streak ?? 0} días</p>
          </Card>

          <Card>
            <p className="text-sm font-medium mb-3">Mis stats</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">Puntos</p>
                <p className="font-semibold text-lg">{stats?.total_points ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Aciertos</p>
                <p className="font-semibold text-lg">{stats?.accuracy ?? 0}%</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Trivia</p>
                <p className="font-semibold text-lg">{stats?.trivia_points ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Especial</p>
                <p className="font-semibold text-lg text-purple-400">{stats?.mode_b_points ?? 0}</p>
              </div>
            </div>
          </Card>

          {groups.length > 0 && (
            <Card>
              <p className="text-sm font-medium mb-3">Mi grupo</p>
              {groupDetail ? (
                <div>
                  <p className="font-semibold text-accent">{groupDetail.name}</p>
                  {groupDetail.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{groupDetail.description}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.slice(0, 3).map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{g.name}</span>
                      <span className="text-gray-500 text-xs shrink-0 ml-2">{g.member_count} miembros</span>
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
