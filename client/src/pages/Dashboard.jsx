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
import api from "../api.js";

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
    color: "#f0907e",
  },
  {
    to: "/juegos",
    label: "Juegos",
    icon: Gamepad2,
    description: "Los 23 modos de Futotal, agrupados por cómo se juegan: solo, con amigos, contrarreloj...",
    color: "#3b9dd6",
  },
  {
    to: "/futbol",
    label: "En vivo",
    icon: Radio,
    description: "Resultados, tabla de posiciones y goleadores reales de las principales ligas.",
    color: "#4fb3e8",
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
  {
    to: "/ranking-global",
    label: "Ranking global",
    icon: Globe2,
    description: "Los 100 con más puntos de toda la app, sin importar el grupo.",
    color: "#8b5cf6",
  },
  {
    to: "/vida-fut",
    label: "Vida FUT",
    icon: Sparkles,
    description: "Jugador en Cotrero, después 3 temporadas de DT y 3 de presidente — una carrera larga en tres etapas.",
    color: "#f0a93e",
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
  const [pendingTrivia, setPendingTrivia] = useState(0);
  const [pendingDuels, setPendingDuels] = useState(0);

  useEffect(() => {
    if (!groupId) { setGroupDetail(null); return; }
    api.get(`/groups/${groupId}`)
      .then(({ data }) => setGroupDetail(data.group))
      .catch(() => setGroupDetail(null));
  }, [groupId]);

  // "Qué te falta hoy" — antes el inicio repetía en tarjetas lo que ya está
  // en el menú; esto contesta una pregunta distinta, que no está en ningún
  // otro lado: trivia sin responder hoy y duelos esperando tu turno.
  useEffect(() => {
    api.get("/questions/today")
      .then(({ data }) => setPendingTrivia((data.questions || []).filter((q) => !q.answered).length))
      .catch(() => setPendingTrivia(0));
  }, []);

  useEffect(() => {
    if (!groupId) { setPendingDuels(0); return; }
    api.get("/duels", { params: { groupId } })
      .then(({ data }) => {
        const waiting = (data.duels || []).filter((d) => d.status === "esperando" && d.my_turn).length;
        setPendingDuels(waiting);
      })
      .catch(() => setPendingDuels(0));
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

  const pending = [
    pendingTrivia > 0 && {
      key: "trivia",
      to: "/trivia",
      label: `Trivia del día · ${pendingTrivia} pregunta${pendingTrivia === 1 ? "" : "s"} sin responder`,
      icon: HelpCircle,
      tw: "red",
    },
    pendingDuels > 0 && {
      key: "duelos",
      to: "/duelos",
      label: `${pendingDuels} duelo${pendingDuels === 1 ? "" : "s"} esperando tu turno`,
      icon: Swords,
      tw: "amber",
    },
  ].filter(Boolean);

  return (
    <Layout>
      {/* Header */}
      <div className="mb-10 flex items-start justify-between gap-4 flex-wrap">
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

      {/* Racha + pendientes del día — lo único que se pierde si no entrás,
          antes relegado a una columna lateral chica. */}
      <Card variant="feature" className="mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Flame size={14} className={current > 0 ? "text-orange-400" : "text-gray-500"} />
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.2em]">Racha</span>
            </div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {current}
              <span className="text-sm font-normal text-gray-500 ml-2">días</span>
            </p>
          </div>
          <div className="flex-1 min-w-[160px] max-w-xs">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-orange-400/70 transition-[width]" style={{ width: `${streakPct}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Mejor racha: {best} días</p>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="mt-5 pt-5 border-t border-white/10 space-y-0">
            {pending.map((item) => (
              <Card key={item.key} variant="row">
                <Link to={item.to} className="flex items-center gap-3 group">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-${item.tw}-500/15 text-${item.tw}-500`}>
                    <item.icon size={14} />
                  </span>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                    {item.label}
                  </span>
                </Link>
              </Card>
            ))}
          </div>
        )}

        {pending.length === 0 && (
          <p className="text-xs text-gray-500 mt-5 pt-5 border-t border-white/10">
            No te falta nada por hoy — ya respondiste la trivia y no hay duelos esperándote.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-x-14 gap-y-12">
        <div>
          <h2 className="text-[11px] font-medium text-gray-600 uppercase tracking-[0.2em] mb-4">
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
                  style={{ background: `${color}22`, border: `1px solid ${color}44`, color }}
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

      {showTutorial && <TutorialModal sections={SECTIONS} onDone={finishTutorial} />}
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
