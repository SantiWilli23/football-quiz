import { useEffect, useState } from "react";
import { AlertTriangle, Crown, TrendingDown } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import LeagueTabs from "../components/LeagueTabs.jsx";

export default function SeasonPredictions() {
  const [leagues, setLeagues] = useState([]);
  const [league, setLeague] = useState(null);
  const [table, setTable] = useState(null);
  const [demo, setDemo] = useState(false);
  const [mine, setMine] = useState([]);
  const [championId, setChampionId] = useState("");
  const [relegatedIds, setRelegatedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/football/leagues").then(({ data }) => {
      const opts = data.leagues.filter((l) => l.key !== "chile");
      setLeagues(opts);
      if (opts.length > 0) setLeague(opts[0].key);
    });
    api.get("/season-predictions/mine").then(({ data }) => setMine(data.predictions)).catch(() => setMine([]));
  }, []);

  useEffect(() => {
    if (!league) return;
    setLoading(true);
    setChampionId("");
    setRelegatedIds([]);
    api
      .get(`/season-predictions/${league}/table`)
      .then(({ data }) => {
        setTable(data.table);
        setDemo(data.demo);
      })
      .catch(() => setTable(null))
      .finally(() => setLoading(false));
  }, [league]);

  const existing = mine.find((p) => p.league === league);

  function toggleRelegated(id) {
    setRelegatedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  async function submit() {
    if (!championId || relegatedIds.length !== 3) return;
    setSaving(true);
    setError("");
    try {
      const championTeam = table.find((t) => t.id === championId);
      const relegated = relegatedIds.map((id) => ({ id, name: table.find((t) => t.id === id)?.name }));
      await api.post(`/season-predictions/${league}/predict`, {
        championTeamId: championId,
        championTeamName: championTeam?.name,
        relegated,
      });
      const { data } = await api.get("/season-predictions/mine");
      setMine(data.predictions);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la predicción");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Campeón y descenso</h1>
      <p className="text-gray-400 text-sm mb-6">
        Predecí quién sale campeón y qué 3 equipos bajan esta temporada. Se resuelve solo cuando casi no
        queden partidos: 20 puntos por el campeón, 7 por cada equipo que sí descendió.
      </p>

      {leagues.length > 0 && league && <LeagueTabs leagues={leagues} active={league} onChange={setLeague} />}

      {loading && <p className="text-sm text-gray-500 mt-4">Cargando tabla...</p>}
      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

      {!loading && demo && (
        <Card className="mt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber shrink-0 mt-0.5" />
            <p className="text-sm text-gray-400">
              El plan actual de la API de fútbol no deja ver la tabla real de esta temporada — se muestra una de
              muestra, y por eso no se puede predecir todavía. En cuanto se habilite, funciona solo.
            </p>
          </div>
        </Card>
      )}

      {!loading && existing?.scored === 1 && (
        <Card className="mt-4">
          <h2 className="font-semibold mb-2">Ya se resolvió esta temporada</h2>
          <p className="text-sm text-gray-400">
            Predijiste campeón: <span className="text-white">{existing.champion_team_name}</span>
            {existing.actual_champion_team_id === existing.champion_team_id ? (
              <span className="text-emerald"> ✓ acertaste</span>
            ) : (
              <span className="text-red-400"> ✗ no acertaste</span>
            )}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Descenso predicho: {JSON.parse(existing.relegated_team_names || "[]").join(", ")}
          </p>
          <p className="text-lg font-bold text-accent mt-3">{existing.points} pts</p>
        </Card>
      )}

      {!loading && !demo && table && existing?.scored !== 1 && (
        <Card className="mt-4">
          {existing && (
            <p className="text-xs text-gray-500 mb-3">
              Ya tenés una predicción guardada para esta liga — mandar de nuevo la reemplaza.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-accent font-semibold mb-2">
                <Crown size={14} /> Campeón (elegí 1)
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {table.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setChampionId(t.id)}
                    className={`w-full text-left px-3 py-2 rounded-card border text-sm transition-colors ${
                      championId === t.id
                        ? "border-accent bg-accent/10 text-accent font-semibold"
                        : "border-border text-gray-300 hover:border-accent/40"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-red-400 font-semibold mb-2">
                <TrendingDown size={14} /> Descienden (elegí 3) — {relegatedIds.length}/3
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {table.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleRelegated(t.id)}
                    disabled={t.id === championId}
                    className={`w-full text-left px-3 py-2 rounded-card border text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      relegatedIds.includes(t.id)
                        ? "border-red-500/50 bg-red-500/10 text-red-400 font-semibold"
                        : "border-border text-gray-300 hover:border-red-500/30"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={submit}
            disabled={!championId || relegatedIds.length !== 3 || saving}
            className="btn btn-primary mt-5 w-full transition"
          >
            {saving ? "Guardando..." : existing ? "Actualizar predicción" : "Guardar predicción"}
          </button>
        </Card>
      )}
    </Layout>
  );
}
