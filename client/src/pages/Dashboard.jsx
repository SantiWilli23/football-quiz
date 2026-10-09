import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import TutorialModal from "../components/TutorialModal.jsx";
import ContinuePlaying, { findSavedGames } from "../components/ContinuePlaying.jsx";
import DailyChallenge from "../components/DailyChallenge.jsx";
import WeeklyRankingHero from "../components/WeeklyRankingHero.jsx";
import Crest from "../components/Crest.jsx";
import SeasonBanner from "../components/SeasonBanner.jsx";
import FavClubCard from "../components/FavClubCard.jsx";
import api from "../api.js";
import useAlerts from "../hooks/useAlerts.js";

const FAVORITES_KEY = "fq_favorite_sections";
const tutorialSeenKey = (userId) => `fq_tutorial_seen_${userId}`;

export default function Dashboard() {
  const { user, stats } = useAuth();
  const { groups, activeGroupId: groupId } = useGroups();
  const [groupDetail, setGroupDetail] = useState(null);
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
    setShowTutorial(false);
  }

  const current = stats?.current_streak ?? 0;
  const best = stats?.best_streak ?? 0;
  const streakPct = best > 0 ? Math.min(100, Math.round((current / best) * 100)) : current > 0 ? 100 : 0;

  return (
    <Layout>
      <SeasonBanner />

      {/* Pizarra del día: reemplaza el saludo suelto + la franja de "Te falta
          hoy" de antes por un solo panel, con el mismo trato visual que la
          pizarra técnica de un vestuario — quién sos, qué día es, qué falta
          jugar hoy y cómo viene la racha, todo en un solo golpe de vista. */}
      <div className="hero-b mb-8 rounded-3xl overflow-hidden" style={{ "--hero-a": "var(--c-accent)", "--hero-b": "var(--c-purple)" }}>
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
            <p className="t-eyebrow flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_currentColor] text-accent" />
              Pizarra del día · {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <GroupSelector />
          </div>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
                Hola{user?.username ? `, ${user.username}` : ""}
              </h1>
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
            <div className="min-w-[150px] flex items-center gap-4">
              <span
                className="tone-amber relative w-24 h-24 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `conic-gradient(rgb(var(--tone)) ${streakPct}%, rgb(var(--c-border)) 0)`, boxShadow: "0 0 24px -8px rgb(var(--tone))" }}
                role="img"
                aria-label={`Racha de ${current} días, mejor ${best}`}
              >
                <span className="absolute inset-2 rounded-full bg-panel" />
                <span className="relative text-center leading-none">
                  <span className="flex items-center justify-center gap-1 text-3xl font-extrabold tabular-nums"><Flame size={16} className={current > 0 ? "text-tone" : "text-gray-500"} />{current}</span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">días</span>
                </span>
              </span>
              <div>
                <span className="t-eyebrow">Racha</span>
                <p className="text-xs text-gray-500 mt-1">Mejor racha: {best} días</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* El centro de la app: el ranking semanal del grupo, primero que
          nada — es lo que genera la competitividad constante entre amigos. */}
      <FavClubCard />

      <WeeklyRankingHero groupId={groupId} />

      <DailyChallenge standalone />

      <ContinuePlaying items={savedGames} />

      <div className="mb-8 rounded-2xl border border-border bg-panel p-5 sm:p-6">
        <p className="t-eyebrow mb-4">Mis stats</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5">
          <StatCell tone="accent" label="Puntos" value={stats?.total_points ?? 0} />
          <StatCell tone="blue" label="Aciertos" value={`${stats?.accuracy ?? 0}%`} />
          <StatCell tone="purple" label="Trivia" value={stats?.trivia_points ?? 0} />
          <StatCell tone="pink" label="Especial" value={stats?.mode_b_points ?? 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-14 gap-y-8">
          {groups.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-[0.2em] mb-4">Mi grupo</p>
              {groupDetail ? (
                <div className="flex items-center gap-3">
                  <Crest group={groupDetail} size={36} />
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

      {showTutorial && <TutorialModal onDone={finishTutorial} />}
    </Layout>
  );
}

function StatCell({ label, value, tone }) {
  return (
    <div className={`strip-cell tone-${tone}`}>
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-tone mt-1">{value}</p>
    </div>
  );
}
