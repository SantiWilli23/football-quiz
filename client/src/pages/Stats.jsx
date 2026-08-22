import { useCallback, useEffect, useState } from "react";
import { Award, Crown, Download, Heart, Sparkles, TrendingUp, Trophy } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import { useGroups } from "../context/GroupContext.jsx";

const KIND_LABELS = {
  quien_es_mas: "¿Quién es más?",
  que_prefieres: "¿Qué prefieres?",
  personalidad: "Personalidad",
  grupal: "Pregunta del grupo",
};

function formatLocalDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function SectionTitle({ icon: Icon, children, hint }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="text-gray-400" />
      <h2 className="font-semibold">{children}</h2>
      {hint && <span className="text-xs text-gray-600 ml-auto">{hint}</span>}
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || ""}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Stats() {
  const { user } = useAuth();
  const { groups, activeGroupId: groupId, loading: groupsLoading } = useGroups();
  const [modeB, setModeB] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [compatibility, setCompatibility] = useState([]);
  const [achievements, setAchievements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadAll = useCallback(async () => {
    if (!groupId) {
      if (!groupsLoading) setLoading(false);
      return;
    }
    setLoading(true);
    const params = { groupId };
    const settle = (promise, fallback) => promise.then((r) => r.data).catch(() => fallback);
    const [modeBData, weeklyData, compatData, achData] = await Promise.all([
      settle(api.get("/stats/mode-b", { params }), null),
      settle(api.get("/stats/weekly", { params }), null),
      settle(api.get("/stats/compatibility", { params }), { compatibility: [] }),
      settle(api.get("/stats/achievements", { params }), null),
    ]);
    setModeB(modeBData);
    setWeekly(weeklyData);
    setCompatibility(compatData.compatibility);
    setAchievements(achData);
    setLoading(false);
  }, [groupId, groupsLoading]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get("/stats/export", { params: { groupId }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `football-quiz-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (!loading && groups.length === 0) {
    return (
      <Layout>
        <h1 className="text-2xl font-bold mb-1">Estadísticas</h1>
        <p className="text-gray-400 text-sm mb-6">Cómo viene la temporada del grupo</p>
        <Card>
          <p className="text-gray-400 text-center py-6">
            Unite a un grupo para ver estadísticas y logros.
          </p>
        </Card>
      </Layout>
    );
  }

  const summary = weekly?.summary;

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Estadísticas</h1>
          <p className="text-gray-400 text-sm">Cómo viene la temporada del grupo</p>
        </div>
        <div className="flex items-center gap-3">
          <GroupSelector />
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            <Download size={15} />
            {exporting ? "Generando..." : "Exportar CSV"}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando...</p>}

      {!loading && (
        <div className="space-y-6">
          <Card>
            <SectionTitle
              icon={TrendingUp}
              hint={
                weekly?.days > 0 ? `${formatLocalDate(weekly.from)} – ${formatLocalDate(weekly.to)}` : null
              }
            >
              Resumen de la semana
            </SectionTitle>

            {!summary ? (
              <p className="text-sm text-gray-500">
                Todavía no hay días cerrados. El resumen aparece cuando pasa el primer día de votación.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                  <Stat
                    label="Más puntos"
                    value={summary.top_scorer?.username ?? "—"}
                    sub={summary.top_scorer ? `${summary.top_scorer.points} pts` : null}
                    accent="text-accent"
                  />
                  <Stat
                    label="Más votado"
                    value={summary.most_voted?.username ?? "—"}
                    sub={summary.most_voted ? `${summary.most_voted.votes} votos` : null}
                  />
                  <Stat label="Participación" value={`${summary.participation}%`} sub={`${summary.answers_total} respuestas`} />
                  <Stat label="Días jugados" value={weekly.days} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {summary.most_divisive && (
                    <div className="rounded-card border border-border bg-bg px-4 py-3">
                      <p className="text-xs text-gray-500 mb-1">
                        La más peleada · {KIND_LABELS[summary.most_divisive.kind]}
                      </p>
                      <p className="text-sm mb-1">{summary.most_divisive.prompt}</p>
                      <p className="text-xs text-gray-600">
                        La opción más votada sacó apenas {summary.most_divisive.share}%
                      </p>
                    </div>
                  )}
                  {summary.most_unanimous && (
                    <div className="rounded-card border border-border bg-bg px-4 py-3">
                      <p className="text-xs text-gray-500 mb-1">
                        En la que todos coincidieron · {KIND_LABELS[summary.most_unanimous.kind]}
                      </p>
                      <p className="text-sm mb-1">{summary.most_unanimous.prompt}</p>
                      <p className="text-xs text-gray-600">
                        {summary.most_unanimous.share}% votó lo mismo
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <SectionTitle icon={Trophy}>Ranking del modo especial</SectionTitle>
              {!modeB || modeB.leaderboard.every((r) => r.points === 0) ? (
                <p className="text-sm text-gray-500">
                  Todavía nadie sumó puntos. Se otorgan cuando cierra el día: 5 pts por responder y 15 por
                  acertar lo que vota la mayoría.
                </p>
              ) : (
                <div className="space-y-2">
                  {modeB.leaderboard.map((r) => (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-card border ${
                        r.id === user?.id ? "border-accent/40 bg-accent/5" : "border-border"
                      }`}
                    >
                      <div className="w-5 text-center text-sm font-semibold text-gray-400">
                        {r.position === 1 ? <Crown size={15} className="text-accent mx-auto" /> : r.position}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-semibold shrink-0">
                        {r.avatar || r.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.username}</p>
                        <p className="text-xs text-gray-500">
                          {r.correct_predictions}/{r.predictions} predicciones
                          {r.predictions > 0 && ` · ${r.prediction_accuracy}%`}
                        </p>
                      </div>
                      <p className="font-semibold text-sm shrink-0">{r.points} pts</p>
                    </div>
                  ))}
                </div>
              )}

              {modeB && modeB.most_voted.some((m) => m.votes > 0) && (
                <>
                  <p className="text-xs text-gray-500 mt-6 mb-2">
                    A quién más vota el grupo en “¿Quién es más?”
                  </p>
                  <div className="space-y-1.5">
                    {modeB.most_voted
                      .filter((m) => m.votes > 0)
                      .map((m) => {
                        const max = Math.max(...modeB.most_voted.map((x) => x.votes), 1);
                        return (
                          <div key={m.id} className="flex items-center gap-3">
                            <span className="text-xs w-20 truncate text-gray-400">{m.username}</span>
                            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className="h-full bg-blue-500/60 rounded-full"
                                style={{ width: `${(m.votes / max) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-6 text-right">{m.votes}</span>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </Card>

            <Card>
              <SectionTitle icon={Heart} hint="según el modo especial">
                Con quién coincidís
              </SectionTitle>
              {compatibility.length === 0 ? (
                <p className="text-sm text-gray-500">Sos el único miembro del grupo por ahora.</p>
              ) : (
                <div className="space-y-3">
                  {compatibility.map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-xs font-semibold shrink-0">
                        {c.avatar || c.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm truncate">{c.username}</span>
                          <span className="text-sm font-semibold shrink-0">
                            {c.agreement === null ? "—" : `${c.agreement}%`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-accent/60 rounded-full"
                            style={{ width: `${c.agreement ?? 0}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-600 mt-1">
                          {c.shared === 0
                            ? "Todavía no respondieron las mismas preguntas"
                            : `${c.same} de ${c.shared} respuestas iguales`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <SectionTitle
              icon={Award}
              hint={achievements ? `${achievements.unlocked_count} de ${achievements.total}` : null}
            >
              Logros
            </SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {achievements?.achievements.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-card border px-4 py-3.5 ${
                    a.unlocked ? "border-accent/40 bg-accent/5" : "border-border bg-bg"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xl ${a.unlocked ? "" : "grayscale opacity-40"}`}>{a.emoji}</span>
                    <span
                      className={`text-sm font-semibold ${a.unlocked ? "text-accent" : "text-gray-400"}`}
                    >
                      {a.title}
                    </span>
                    {a.unlocked && <Sparkles size={12} className="text-accent ml-auto" />}
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2 leading-snug">{a.description}</p>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full ${a.unlocked ? "bg-accent" : "bg-gray-600"}`}
                      style={{ width: `${a.progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-600">
                    {Math.min(a.current, a.target)} / {a.target}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
}
