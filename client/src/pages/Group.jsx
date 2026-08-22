import { useEffect, useState } from "react";
import { Copy, Crown, Plus, Users } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

export default function Group() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const loadGroups = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/groups");
      setGroups(data.groups);
      if (data.groups.length > 0) {
        selectGroup(data.groups[0].id);
      } else {
        setActiveGroup(null);
        setRanking([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const selectGroup = async (id) => {
    const { data } = await api.get(`/groups/${id}`);
    setActiveGroup(data.group);
    setRanking(data.ranking);
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await loadGroups();
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
      await loadGroups();
      selectGroup(data.group.id);
    } catch (err) {
      setJoinError(err.response?.data?.error || "No se pudo unir al grupo");
    } finally {
      setJoinLoading(false);
    }
  };

  const copyCode = () => {
    if (!activeGroup) return;
    navigator.clipboard.writeText(activeGroup.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Layout>
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
            className="px-4 py-2 rounded-card text-sm font-medium bg-accent hover:bg-accent-dark text-black flex items-center gap-1.5 transition-colors"
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
              className="bg-accent hover:bg-accent-dark disabled:opacity-50 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
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
              className="bg-accent hover:bg-accent-dark disabled:opacity-50 text-black font-semibold rounded-card px-5 py-2.5 text-sm transition-colors"
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
                  activeGroup?.id === g.id
                    ? "border-accent/40 bg-accent/10"
                    : "border-border bg-panel hover:border-white/30"
                }`}
              >
                <p className="text-sm font-medium truncate">{g.name}</p>
                <p className="text-xs text-gray-500">{g.member_count} miembros</p>
              </button>
            ))}
          </div>

          {activeGroup && (
            <Card>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">{activeGroup.name}</h2>
                  {activeGroup.description && (
                    <p className="text-sm text-gray-400 mt-0.5">{activeGroup.description}</p>
                  )}
                </div>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-card border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors shrink-0"
                >
                  <Copy size={14} />
                  {copied ? "Copiado" : activeGroup.invite_code}
                </button>
              </div>

              <div className="space-y-2">
                {ranking.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-4 px-4 py-3 rounded-card border ${
                      r.id === user?.id ? "border-accent/40 bg-accent/5" : "border-border"
                    }`}
                  >
                    <div className="w-6 text-center text-sm font-semibold text-gray-400 flex items-center justify-center gap-1">
                      {r.position === 1 ? <Crown size={16} className="text-accent" /> : r.position}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-xs font-semibold shrink-0">
                      {r.avatar || r.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.username}</p>
                      <p className="text-xs text-gray-500">
                        {r.answered} respondidas · {r.accuracy}% aciertos
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-sm">{r.points} pts</p>
                      <p className="text-[11px] text-gray-600">
                        {r.trivia_points} trivia · {r.mode_b_points} especial
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}
