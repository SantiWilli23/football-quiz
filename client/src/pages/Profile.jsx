import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Avatar, { PROFILE_BANNERS } from "../components/Avatar.jsx";
import AvatarEditor from "../components/AvatarEditor.jsx";
import ProfileEditor from "../components/ProfileEditor.jsx";
import { badgeFor, teamById } from "../carrera/data/teams.js";
import PushToggle from "../components/PushToggle.jsx";
import AccountSettings from "../components/AccountSettings.jsx";
import ThemeSettings from "../components/ThemeSettings.jsx";
import Vitrina from "../components/Vitrina.jsx";
import PlayerCard from "../components/PlayerCard.jsx";

export default function Profile() {
  const { user, stats, refreshMe } = useAuth();
  const { activeGroupId, activeGroup } = useGroups();
  const [editingProfile, setEditingProfile] = useState(false);
  const [position, setPosition] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [compareId, setCompareId] = useState("");
  const [tab, setTab] = useState("resumen");

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

  const favTeam = user.profile?.favTeam ? teamById(user.profile.favTeam) : null;

  const items = [
    { label: "Puntos totales", value: stats.total_points, tone: "accent" },
    { label: "% de aciertos", value: `${stats.accuracy}%`, tone: "blue" },
    { label: "Racha actual", value: `${stats.current_streak} días`, tone: "amber" },
    { label: "Mejor racha", value: `${stats.best_streak} días`, tone: "purple" },
    { label: "Puntos de trivia", value: stats.trivia_points ?? 0, tone: "emerald" },
    { label: "Modo especial", value: stats.mode_b_points ?? 0, tone: "pink" },
  ];
  const TABS = [["resumen", "Resumen"], ["vitrina", "Vitrina"], ["ajustes", "Ajustes"]];

  return (
    <Layout>
      <div className="hero-b rounded-3xl p-6 sm:p-8 mb-6" style={{ "--hero-a": "var(--c-pink)", "--hero-b": "var(--c-pink)" }}>
        <div className="flex items-center gap-5 flex-wrap">
          <span className="rounded-full ring-4 ring-panel inline-flex">
            <Avatar user={user} size={96} />
          </span>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{user.username}</h1>
            <p className="text-sm text-gray-300 mt-1">
              {user.profile?.bio || `Miembro desde ${new Date(user.created_at).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`}
            </p>
            {activeGroup && <p className="text-sm text-gray-400 mt-1">{position ? `#${position} en ${activeGroup.name}` : activeGroup.name}</p>}
          </div>
          {favTeam && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              {badgeFor(favTeam.id) && <img src={badgeFor(favTeam.id)} alt="" className="w-9 h-9 object-contain" />}
              <span>{favTeam.name}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6 flex-wrap" role="tablist">
          {TABS.map(([k, label], i) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${tab === k ? "bg-white text-black border-white" : "border-white/25 text-gray-300 hover:border-white/60"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "resumen" && (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] items-start mb-6">
            <PlayerCard user={user} stats={stats} activeGroup={activeGroup} position={position} />
            <div className="rounded-2xl border border-border bg-panel p-5 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6">
                {items.map((item) => (
                  <div key={item.label} className={`strip-cell tone-${item.tone}`}>
                    <p className="text-xs uppercase tracking-wider text-gray-500">{item.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums text-tone mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "vitrina" && <div className="mb-6"><Vitrina /></div>}

      {tab === "ajustes" && (
        <>
          <Card className="mb-6">
            <div className="flex items-center gap-4">
              <Avatar user={user} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{user?.username}</p>
                {user?.email && <p className="text-xs text-gray-400 truncate">{user.email}</p>}
              </div>
              <button onClick={() => setEditingProfile((v) => !v)} aria-expanded={editingProfile} className="btn btn-secondary btn-sm shrink-0">
                {editingProfile ? "Cerrar" : "Editar perfil"}
              </button>
            </div>
          </Card>
          {editingProfile && (
            <>
              <div className="mb-6"><AvatarEditor user={user} onSaved={refreshMe} /></div>
              <div className="mb-6"><ProfileEditor user={user} onSaved={refreshMe} /></div>
            </>
          )}
          <div className="mb-6"><ThemeSettings /></div>
          <div className="mb-6"><PushToggle /></div>
          <div className="mb-6"><AccountSettings user={user} onUpdated={refreshMe} /></div>
        </>
      )}

      {tab === "resumen" && others.length > 0 && me && (
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
