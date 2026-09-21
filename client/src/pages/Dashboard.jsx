import { useEffect, useState } from "react";
import {
  BarChart3, Flame, Gamepad2, Globe2, HelpCircle, Radio, Sparkles, Star, Swords, Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import TutorialModal from "../components/TutorialModal.jsx";
import ContinuePlaying, { findSavedGames } from "../components/ContinuePlaying.jsx";
import DailyChallenge from "../components/DailyChallenge.jsx";
import api from "../api.js";
import useAlerts from "../hooks/useAlerts.js";

const FAVORITES_KEY = "fq_favorite_sections";
const tutorialSeenKey = (userId) => `fq_tutorial_seen_${userId}`;

// "En vivo" y "Juegos" eran una sola sección ("Fútbol") que mezclaba datos
// reales con el catálogo de 23 juegos — ver client/src/pages/Football.jsx y
// Games.jsx, que ahora son pantallas separadas.
const SECTIONS = [
  {
    to: "/trivia",
    label: "Trivia",
    icon: HelpCircle,
    description: "Trivia diaria, preguntas especiales del grupo, duelos 1v1 y supervivencia en vivo.",
    color: "rgb(var(--c-red))",
  },
  {
    to: "/juegos",
    label: "Juegos",
    icon: Gamepad2,
    description: "Los 23 modos de Futotal, agrupados por cómo se juegan: solo, con amigos, contrarreloj...",
    color: "rgb(var(--c-emerald))",
  },
  {
    to: "/futbol",
    label: "En vivo",
    icon: Radio,
    description: "Resultados, tabla de posiciones y goleadores reales de las principales ligas.",
    color: "rgb(var(--c-blue))",
  },
  {
    to: "/grupo",
    label: "Grupos",
    icon: Users,
    description: "Competí con tus amigos, mirá el ranking del grupo y los campeones mensuales.",
    color: "rgb(var(--c-amber))",
  },
  {
    to: "/estadisticas",
    label: "Estadísticas",
    icon: BarChart3,
    description: "Resumen semanal, compatibilidad con el grupo y logros desbloqueados.",
    color: "rgb(var(--c-emerald))",
  },
  {
    to: "/ranking-global",
    label: "Ranking global",
    icon: Globe2,
    description: "Los 100 con más puntos de toda la app, sin importar el grupo.",
    color: "rgb(var(--c-amber))",
  },
  {
    to: "/vida-fut",
    label: "Vida FUT",
    icon: Sparkles,
    description: "Jugador en Cotrero, después 3 temporadas de DT y 3 de presidente — una carrera larga en tres etapas.",
    color: "rgb(var(--c-purple))",
  },
];

export default function Dashboard() {
  const { user, stats } = useAuth();
  const { groups, activeGroupId: groupId } = useGroups();
  const [groupDetail, setGroupDetail] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } catch { return []; }
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const alerts = useAlerts();
  const [savedGames] = useState(findSavedGames);

  useEffect(() => {
    if (!groupId) { setGroupDetail(null); return; }
    api.get(`/groups/${groupId}`)
      .then(({ data }) => setGroupDetail(data.group))
      .catch(() => setGroupDetail(null));
  }, [groupId]);

  useEffect(() => {
    if (!user) return;
    try {
      if (!localStorage.getItem(tutorialSeenKey(user.id))) setShowTutorial(true);
    } catch { /* localStorage no disponible: se omite el tutorial sin romper nada */ }
  }, [user]);

  function finishTutorial(picked) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(picked));
      if (user) localStorage.setItem(tutorialSeenKey(user.id), "1");
    } catch { /* noop */ }
    setFavorites(picked);
    setShowTutorial(false);
  }

  const sortedSections = [...SECTIONS].sort((a, b) => {
    const fa = favorites.includes(a.to) ? 0 : 1;
    const fb = favorites.includes(b.to) ? 0 : 1;
    return fa - fb;
  });

  const current = stats?.current_streak ?? 0;
  const best = stats?.best_streak ?? 0;
  const streakPct = best > 0 ? Math.min(100, Math.round((current / best) * 100)) : current > 0 ? 100 : 0;

  return (
    <Layout>
      {/* Saludo de una línea: sin explicar qué es Futotal. */}
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Hola{user?.username ? `, ${user.username}` : ""}
          <span className="ml-3 text-sm font-normal text-gray-500 capitalize">
            {new Date().toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </h1>
        <GroupSelector />
      </div>

      {/* Una sola franja: lo que te falta hoy, con un botón por cada cosa, y la
          racha al costado. Antes eran tarjetas sueltas de racha, trivia y duelos. */}
      <Card variant="feature" className="mb-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="t-eyebrow mb-3">Te falta hoy</p>
            {alerts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {alerts.map((a) => (
                  <Link key={a.key} to={a.to} className="btn btn-primary btn-sm">
                    <a.icon size={14} /> {a.short} ›
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No te falta nada por hoy: ya respondiste la trivia y no hay duelos esperándote.</p>
            )}
          </div>
          <div className="min-w-[150px]">
            <div className="flex items-center gap-2 mb-1.5">
              <Flame size={14} className={current > 0 ? "text-orange-400" : "text-gray-500"} />
              <span className="t-eyebrow">Racha</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {current}
              <span className="text-sm font-normal text-gray-500 ml-2">días</span>
            </p>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
              <div className="h-full bg-orange-400/70 transition-[width]" style={{ width: `${streakPct}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">Mejor racha: {best} días</p>
          </div>
        </div>
      </Card>

      <DailyChallenge standalone />

      <ContinuePlaying items={savedGames} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-x-14 gap-y-12">
        <div>
          <h2 className="text-xs font-medium text-gray-600 uppercase tracking-[0.2em] mb-4">
            Secciones
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden">
            {sortedSections.map(({ to, label, icon: Icon, description, color }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-start gap-4 px-5 py-5 bg-bg hover:bg-panel transition-colors"
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, color }}
                >
                  <Icon size={19} />
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-sm font-medium mb-1 group-hover:text-white transition-colors flex items-center gap-1.5">
                    {label}
                    {favorites.includes(to) && <Star size={11} className="text-accent" fill="currentColor" />}
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
            <p className="text-xs font-medium text-gray-500 uppercase tracking-[0.2em] mb-4">Mis stats</p>
            <div className="divide-y divide-white/5">
              <StatRow label="Puntos" value={stats?.total_points ?? 0} />
              <StatRow label="Aciertos" value={`${stats?.accuracy ?? 0}%`} accent />
              <StatRow label="Trivia" value={stats?.trivia_points ?? 0} />
              <StatRow label="Especial" value={stats?.mode_b_points ?? 0} />
            </div>
          </div>

          {groups.length > 0 && (
            <div className="pt-8 border-t border-white/5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-[0.2em] mb-4">Mi grupo</p>
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

      {showTutorial && <TutorialModal onDone={finishTutorial} />}
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
