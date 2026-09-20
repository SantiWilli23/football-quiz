import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, Copy, Crown, Flame, Link2, LogOut, MessageSquareText, Plus, Shield, Swords, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Avatar from "../components/Avatar.jsx";
import QuestionBank from "../components/QuestionBank.jsx";
import WeeklyChallenges from "../components/WeeklyChallenges.jsx";
import FlashPoll from "../components/FlashPoll.jsx";
import AnniversaryBanner from "../components/AnniversaryBanner.jsx";
import WeeklyRecap from "../components/WeeklyRecap.jsx";
import GroupCup from "../components/GroupCup.jsx";
import DuelBets from "../components/DuelBets.jsx";

const currentMonth = new Date().toISOString().slice(0, 7);

function monthLabel(month) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

export default function Group() {
  const { user } = useAuth();
  const { groups, activeGroupId, selectGroup, loading, reloadGroups } = useGroups();
  const [detail, setDetail] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [seasonRanking, setSeasonRanking] = useState([]);
  const [champions, setChampions] = useState([]);
  const [scope, setScope] = useState("mes");
  const [rival, setRival] = useState(null);
  const [myRivalId, setMyRivalId] = useState(null);
  const [rivalBusy, setRivalBusy] = useState(false);
  const [streak, setStreak] = useState(null);
  const [tab, setTab] = useState("ranking");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  // La lista de grupos y cuál está activo viven en el contexto (compartido con
  // el resto de la app); acá sólo se pide el detalle y el ranking del activo.
  useEffect(() => {
    if (!activeGroupId) {
      setDetail(null);
      setRanking([]);
      return;
    }
    api
      .get(`/groups/${activeGroupId}`)
      .then(({ data }) => {
        setDetail(data.group);
        setRanking(data.ranking);
        setRival(data.rival);
        setMyRivalId(data.my_rival_id);
      })
      .catch(() => {
        setDetail(null);
        setRanking([]);
        setRival(null);
        setMyRivalId(null);
      });

    const params = { groupId: activeGroupId };
    api
      .get("/stats/season", { params })
      .then(({ data }) => setSeasonRanking(data.ranking))
      .catch(() => setSeasonRanking([]));
    api
      .get("/stats/champions", { params })
      .then(({ data }) => setChampions(data.champions))
      .catch(() => setChampions([]));
    api
      .get("/stats/group-streak", { params })
      .then(({ data }) => setStreak(data))
      .catch(() => setStreak(null));
  }, [activeGroupId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!newName.trim()) {
      setCreateError("El nombre es requerido");
      return;
    }
    setCreateLoading(true);
    try {
      await api.post("/groups", { name: newName.trim(), description: newDescription.trim() });
      setNewName("");
      setNewDescription("");
      setShowCreate(false);
      await reloadGroups();
    } catch (err) {
      setCreateError(err.response?.data?.error || "No se pudo crear el grupo");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError("");
    if (!joinCode.trim()) {
      setJoinError("Ingresá un código");
      return;
    }
    setJoinLoading(true);
    try {
      const { data } = await api.post("/groups/join", { invite_code: joinCode.trim() });
      setJoinCode("");
      setShowJoin(false);
      await reloadGroups();
      selectGroup(data.group.id);
    } catch (err) {
      setJoinError(err.response?.data?.error || "No se pudo unir al grupo");
    } finally {
      setJoinLoading(false);
    }
  };

  // El ranking del mes esconde a los que todavía no jugaron; el histórico
  // muestra a todo el grupo, como venía siendo.
  const shownRanking =
    scope === "mes" ? seasonRanking.filter((r) => r.points > 0 || r.answered > 0) : ranking;

  const handleLeave = async () => {
    setLeaving(true);
    setLeaveError("");
    try {
      await api.post(`/groups/${activeGroupId}/leave`);
      setConfirmLeave(false);
      // El contexto vuelve a pedir la lista y cae al primer grupo que quede
      // (o a ninguno), así que el resto de la app queda consistente sola.
      await reloadGroups();
    } catch (err) {
      setLeaveError(err.response?.data?.error || "No se pudo salir del grupo");
    } finally {
      setLeaving(false);
    }
  };

  const toggleRival = async (targetId) => {
    if (rivalBusy) return;
    const nextId = myRivalId === targetId ? null : targetId;
    setRivalBusy(true);
    try {
      await api.put(`/groups/${activeGroupId}/rival`, { rival_id: nextId });
      const { data } = await api.get(`/groups/${activeGroupId}`);
      setRanking(data.ranking);
      setRival(data.rival);
      setMyRivalId(data.my_rival_id);
    } catch {
      // Si falla, el estado local ya reflejaba lo de antes — no hace falta revertir nada.
    } finally {
      setRivalBusy(false);
    }
  };

  const copyCode = () => {
    if (!detail) return;
    navigator.clipboard.writeText(detail.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyInviteLink = () => {
    if (!detail) return;
    navigator.clipboard.writeText(`${window.location.origin}/invitacion/${detail.invite_code}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  return (
    <Layout>
      {activeGroupId && <AnniversaryBanner groupId={activeGroupId} />}
      {activeGroupId && <WeeklyRecap groupId={activeGroupId} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Mi grupo</h1>
          <p className="text-gray-400 text-sm">Competí con tus amigos y mirá el ranking</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowJoin((v) => !v)}
            className="px-4 py-2 rounded-card text-sm font-medium border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors"
          >
            Unirme a un grupo
          </button>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2 rounded-card text-sm font-medium bg-accent hover:bg-accent-dark text-onaccent flex items-center gap-1.5 transition-colors"
          >
            <Plus size={16} />
            Crear grupo
          </button>
        </div>
      </div>

      {showCreate && (
        <Card className="mb-6">
          <h3 className="font-semibold mb-4">Crear nuevo grupo</h3>
          <form onSubmit={handleCreate} className="space-y-3 max-w-md">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del grupo"
              className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            />
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
            />
            {createError && <p className="text-sm text-red-400">{createError}</p>}
            <button
              type="submit"
              disabled={createLoading}
              className="bg-accent hover:bg-accent-dark disabled:opacity-50 text-onaccent font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
            >
              {createLoading ? "Creando..." : "Crear grupo"}
            </button>
          </form>
        </Card>
      )}

      {showJoin && (
        <Card className="mb-6">
          <h3 className="font-semibold mb-4">Unirme con código</h3>
          <form onSubmit={handleJoin} className="flex gap-3 max-w-md">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="FUTBOL-XXXX"
              className="flex-1 bg-bg border border-border rounded-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent uppercase"
            />
            <button
              type="submit"
              disabled={joinLoading}
              className="bg-accent hover:bg-accent-dark disabled:opacity-50 text-onaccent font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
            >
              {joinLoading ? "Uniendo..." : "Unirme"}
            </button>
          </form>
          {joinError && <p className="text-sm text-red-400 mt-2">{joinError}</p>}
        </Card>
      )}

      {!loading && groups.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <Users className="mx-auto text-gray-600 mb-3" size={32} />
            <p className="text-gray-400 mb-1">Todavía no formás parte de ningún grupo</p>
            <p className="text-sm text-gray-600">Creá uno nuevo o unite con un código de invitación</p>
          </div>
        </Card>
      )}

      {groups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          <div className="space-y-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => selectGroup(g.id)}
                className={`w-full text-left px-4 py-3 rounded-card border transition-colors ${
                  activeGroupId === g.id
                    ? "border-accent/40 bg-accent/10"
                    : "border-border bg-panel hover:border-white/30"
                }`}
              >
                <p className="text-sm font-medium truncate">{g.name}</p>
                <p className="text-xs text-gray-500">{g.member_count} miembros</p>
              </button>
            ))}
          </div>

          {detail && (
            <Card>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">{detail.name}</h2>
                  {detail.description && (
                    <p className="text-sm text-gray-400 mt-0.5">{detail.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-card border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <Copy size={14} />
                    {copied ? "Copiado" : detail.invite_code}
                  </button>
                  <button
                    onClick={copyInviteLink}
                    title="Copiar link de invitación (con preview del grupo, sin necesidad de tipear el código)"
                    className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-card border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
                  >
                    <Link2 size={14} />
                    {linkCopied ? "Copiado" : "Link"}
                  </button>
                </div>
              </div>

              {/* Salir es difícil de deshacer (hace falta el código para
                  volver), y si sos el último el grupo se borra: por eso pide
                  confirmación en vez de irse de una. */}
              <div className="mb-5">
                {!confirmLeave ? (
                  <button
                    onClick={() => setConfirmLeave(true)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <LogOut size={13} />
                    Salir de este grupo
                  </button>
                ) : (
                  <div className="rounded-card border border-red-500/40 bg-red-500/5 px-4 py-3">
                    <p className="text-sm mb-1">
                      ¿Seguro que querés salir de {detail.name}?
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      {ranking.length <= 1
                        ? "Sos el único miembro, así que el grupo se va a borrar con todo su historial."
                        : "Para volver vas a necesitar el código de invitación. Tus respuestas anteriores quedan en el historial del grupo."}
                    </p>
                    {leaveError && <p className="text-sm text-red-400 mb-2">{leaveError}</p>}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleLeave}
                        disabled={leaving}
                        className="px-4 py-2 rounded-card text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white transition-colors"
                      >
                        {leaving ? "Saliendo..." : "Sí, salir"}
                      </button>
                      <button
                        onClick={() => setConfirmLeave(false)}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {streak && streak.streak > 0 && (
                <div className="mb-5 rounded-card border border-amber-500/30 bg-amber-500/5 px-4 py-3.5 flex items-center gap-3">
                  <Flame size={22} className="text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      Racha grupal: {streak.streak} día{streak.streak === 1 ? "" : "s"} seguido{streak.streak === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {streak.today_complete
                        ? "Todos jugaron hoy — sigue viva."
                        : streak.missing_today?.length > 0
                          ? `Faltan hoy: ${streak.missing_today.join(", ")}`
                          : "Todavía nadie jugó hoy."}
                    </p>
                  </div>
                </div>
              )}

              {rival && (
                <div className="mb-5 rounded-card border border-red-500/30 bg-red-500/5 px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-semibold text-red-400 mb-3">
                    <Swords size={13} />
                    <span>Tu rival</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-center flex-1">
                      <Avatar user={user} size={36} className="mx-auto mb-1.5" />
                      <p className="text-sm font-semibold">{rival.my_points} pts</p>
                    </div>
                    <span className="text-xs text-gray-500 font-medium shrink-0">vs</span>
                    <div className="text-center flex-1">
                      <Avatar user={rival} size={36} className="mx-auto mb-1.5" />
                      <p className="text-sm font-medium truncate">{rival.username}</p>
                      <p className="text-sm font-semibold">{rival.rival_points} pts</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-3">
                    Duelos entre ustedes: {rival.duels.won} ganados · {rival.duels.drawn} empatados · {rival.duels.lost} perdidos
                  </p>
                </div>
              )}

              {/* Antes esto era un solo scroll de 8 bloques con el mismo peso
                  — ranking, Copa, apuestas, encuesta, retos y banco de
                  preguntas, todos apilados. Tres pestañas para que no
                  compitan entre sí: lo que se mira todos los días
                  (Ranking), los modos estructurados con el grupo (Jugar
                  juntos) y lo más liviano/social (Actividad). */}
              <div className="flex items-center gap-2 mb-5 border-b border-border">
                {[
                  { key: "ranking", label: "Ranking", icon: BarChart3 },
                  { key: "jugar", label: "Jugar juntos", icon: Trophy },
                  { key: "actividad", label: "Actividad", icon: MessageSquareText },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      tab === key ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-white"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              {tab === "ranking" && (
              <>
              {/* La temporada del mes es la que se mira día a día: el histórico
                  lo gana siempre el que arrancó primero. */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => setScope("mes")}
                  className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                    scope === "mes"
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border text-gray-400 hover:text-white hover:border-white/30"
                  }`}
                >
                  <CalendarDays size={13} />
                  {monthLabel(currentMonth)}
                </button>
                <button
                  onClick={() => setScope("historico")}
                  className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
                    scope === "historico"
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border text-gray-400 hover:text-white hover:border-white/30"
                  }`}
                >
                  Histórico
                </button>
              </div>

              <div className="space-y-2">
                {shownRanking.length === 0 && (
                  <EmptyState
                    icon={Trophy}
                    title={`Nadie sumó puntos ${scope === "mes" ? "este mes" : "todavía"}`}
                    hint="Respondé la trivia de hoy y abrís el ranking del grupo."
                    actions={[{ label: "Jugar trivia", to: "/trivia" }]}
                  />
                )}
                {shownRanking.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-4 px-4 py-3 rounded-card border ${
                      r.id === user?.id ? "border-accent/40 bg-accent/5" : "border-border"
                    }`}
                  >
                    <div className="w-6 text-center text-sm font-semibold text-gray-400 flex items-center justify-center gap-1">
                      {r.position === 1 ? <Crown size={16} className="text-accent" /> : r.position}
                    </div>
                    <Avatar user={r} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.username}</p>
                      <p className="text-xs text-gray-500">
                        {r.answered} respondidas · {r.accuracy}% aciertos
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-sm">{r.points} pts</p>
                      <p className="text-[11px] text-gray-600">
                        {r.trivia_points} trivia · {r.mode_b_points} especial{r.duel_points ? ` · ${r.duel_points} duelos` : ""}{r.wordle_points ? ` · ${r.wordle_points} fulbodle` : ""}{r.quiniela_points ? ` · ${r.quiniela_points} quiniela` : ""}{r.bet_points ? ` · ${r.bet_points > 0 ? "+" : ""}${r.bet_points} apuestas` : ""}{r.season_prediction_points ? ` · ${r.season_prediction_points} pronósticos` : ""}
                      </p>
                    </div>
                    {r.id !== user?.id && (
                      <button
                        onClick={() => toggleRival(r.id)}
                        disabled={rivalBusy}
                        title={myRivalId === r.id ? "Quitar como rival" : "Marcar como rival"}
                        className={`shrink-0 p-2 rounded-card border transition-colors disabled:opacity-40 ${
                          myRivalId === r.id
                            ? "border-red-500/50 bg-red-500/10 text-red-400"
                            : "border-border text-gray-500 hover:text-red-400 hover:border-red-500/30"
                        }`}
                      >
                        <Swords size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {champions.length > 0 && (
                <div className="mt-6 pt-5 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={15} className="text-amber-400" />
                    <h3 className="text-sm font-semibold">Campeones de meses anteriores</h3>
                  </div>
                  <div className="space-y-1.5">
                    {champions.map((c) => (
                      <div key={c.month} className="flex items-center gap-3 text-sm">
                        <span className="text-xs text-gray-500 w-24 shrink-0 capitalize">
                          {monthLabel(c.month)}
                        </span>
                        <Avatar user={c} size={24} />
                        <span className="flex-1 min-w-0 truncate">
                          {c.username}
                          {c.tied && <span className="text-gray-500 text-xs"> (empatado)</span>}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">{c.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "jugar" && activeGroupId && (
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/dt-liga"
              className="flex items-center gap-3 px-4 py-3.5 rounded-card border border-border bg-panel hover:border-accent/40 transition-colors"
            >
              <Shield size={18} className="text-[#d97a41] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Crear Liga Online DT</p>
                <p className="text-xs text-gray-500">Invitá al grupo, cada uno elige un club real y compiten toda una temporada.</p>
              </div>
            </Link>
            <Link
              to="/equipo-jugador"
              className="flex items-center gap-3 px-4 py-3.5 rounded-card border border-border bg-panel hover:border-accent/40 transition-colors"
            >
              <Link2 size={18} className="text-[#5ba3d9] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Desafío grupal: Equipo-Jugador</p>
                <p className="text-xs text-gray-500">Sala online de 6 u 8: cadena de fútbol con eliminación hasta que quede uno solo.</p>
              </div>
            </Link>
          </div>
          <GroupCup groupId={activeGroupId} />
          <DuelBets groupId={activeGroupId} />
          <WeeklyChallenges groupId={activeGroupId} />
        </div>
      )}

      {tab === "actividad" && activeGroupId && (
        <div className="mt-6 space-y-5">
          <FlashPoll groupId={activeGroupId} />
          <QuestionBank groupId={activeGroupId} />
        </div>
      )}
    </Layout>
  );
}
