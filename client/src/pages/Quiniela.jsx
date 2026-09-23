import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, FlaskConical, Minus, Plus, Trophy, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";
import LeagueTabs from "../components/LeagueTabs.jsx";

function championPromptDismissedKey(league) {
  return `fq_quiniela_champion_prompt_${league}`;
}

function formatKickoff(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ScoreInput({ value, onChange, label }) {
  const set = (v) => onChange(Math.max(0, Math.min(20, v)));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => set(value - 1)}
          aria-label={`Restar gol a ${label}`}
          className="w-7 h-7 rounded-full border border-border text-gray-400 hover:text-white hover:border-white/30 flex items-center justify-center transition-colors"
        >
          <Minus size={13} />
        </button>
        <span className="w-6 text-center text-lg font-bold tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => set(value + 1)}
          aria-label={`Sumar gol a ${label}`}
          className="w-7 h-7 rounded-full border border-border text-gray-400 hover:text-white hover:border-white/30 flex items-center justify-center transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

export default function Quiniela() {
  const [leagues, setLeagues] = useState([]);
  const [league, setLeague] = useState(null);
  const [week, setWeek] = useState(null);
  const [mine, setMine] = useState([]);
  const [drafts, setDrafts] = useState({}); // fixtureId -> {home, away}
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [championPicks, setChampionPicks] = useState([]);
  const [showChampionPrompt, setShowChampionPrompt] = useState(false);

  useEffect(() => {
    api.get("/football/leagues").then(({ data }) => {
      setLeagues(data.leagues);
      if (data.leagues.length > 0) setLeague(data.leagues[0].key);
    });
    api.get("/quiniela/mine").then(({ data }) => setMine(data.predictions)).catch(() => setMine([]));
    api
      .get("/season-predictions/mine")
      .then(({ data }) => setChampionPicks(data.predictions))
      .catch(() => setChampionPicks([]));
  }, []);

  // La primera vez que alguien abre la quiniela de una liga sin haber
  // predicho el campeón de esa liga todavía, se lo ofrecemos — son dos
  // formas de predecir que van juntas (partido a partido vs. la temporada
  // entera) y es fácil no enterarse de que existe la segunda. Se puede
  // cerrar y no vuelve a insistir para esa liga.
  useEffect(() => {
    if (!league) return;
    const hasPick = championPicks.some((p) => p.league === league);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(championPromptDismissedKey(league)) === "1";
    } catch { /* noop */ }
    setShowChampionPrompt(!hasPick && !dismissed);
  }, [league, championPicks]);

  function dismissChampionPrompt() {
    try {
      localStorage.setItem(championPromptDismissedKey(league), "1");
    } catch { /* noop */ }
    setShowChampionPrompt(false);
  }

  const loadWeek = useCallback(async () => {
    if (!league) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/quiniela/week", { params: { league } });
      setWeek(data);
    } catch {
      setError("No se pudo cargar la semana");
      setWeek(null);
    } finally {
      setLoading(false);
    }
  }, [league]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  const myPredictionByFixture = new Map(mine.map((p) => [p.fixture_id, p]));

  function setDraft(fixtureId, side, value) {
    setDrafts((prev) => ({ ...prev, [fixtureId]: { ...(prev[fixtureId] || { home: 0, away: 0 }), [side]: value } }));
  }

  async function submit(fx) {
    const draft = drafts[fx.id] || { home: 0, away: 0 };
    setSaving(fx.id);
    setError("");
    try {
      await api.post("/quiniela/predict", {
        league,
        fixture_id: fx.id,
        fixture_date: fx.date.slice(0, 10),
        home_team: fx.home.name,
        away_team: fx.away.name,
        predicted_home: draft.home,
        predicted_away: draft.away,
      });
      const { data } = await api.get("/quiniela/mine");
      setMine(data.predictions);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la predicción");
    } finally {
      setSaving(null);
    }
  }

  const scoredMine = mine.filter((p) => p.scored);
  const totalPoints = scoredMine.reduce((s, p) => s + (p.points || 0), 0);

  return (
    <Layout>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Quiniela semanal</h1>
      <p className="text-gray-400 text-sm mb-6">
        Predecí el marcador exacto antes de que arranque cada partido — 5 puntos si le pegás justo, 2 si acertás quién gana o el empate.
      </p>

      {leagues.length > 0 && league && (
        <LeagueTabs leagues={leagues} active={league} onChange={setLeague} />
      )}

      {showChampionPrompt && (
        <Card className="mb-6 border-accent/30">
          <div className="flex items-start gap-3">
            <Trophy size={18} className="text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">¿Quién sale campeón esta temporada?</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Además de predecir partido a partido, podés apostar quién gana la liga entera — se juega una sola vez por temporada.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  to="/pronosticos"
                  className="text-xs font-medium px-3 py-2 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
                >
                  Predecir el campeón
                </Link>
                <button onClick={dismissChampionPrompt} className="text-xs text-gray-500 hover:text-white transition-colors">
                  Ahora no
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!loading && week?.demo && (
        <Card className="mb-6">
          <div className="flex items-start gap-3">
            <FlaskConical size={18} className="text-amber shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Modo práctica</p>
              <p className="text-xs text-gray-500 mt-1">
                El plan actual de la API de fútbol no deja consultar el calendario real de esta temporada, así que estos partidos son de una temporada de muestra (2023-24) — los resultados ya pasaron, pero tu predicción cuenta igual para practicar y sumar puntos.
              </p>
            </div>
          </div>
        </Card>
      )}

      {mine.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">Mis puntos de quiniela</h2>
            <span className="text-lg font-bold text-accent">{totalPoints} pts</span>
          </div>
          <p className="text-xs text-gray-500">{scoredMine.length} de {mine.length} predicciones ya con resultado</p>
        </Card>
      )}

      {loading && <div className="space-y-3"><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!loading && week?.blocked_by_plan && (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">No hay partidos disponibles por ahora</p>
              <p className="text-xs text-gray-500 mt-1">
                El plan actual de la API de fútbol no deja consultar el calendario de la semana para esta liga. En cuanto se habilite, la quiniela va a funcionar sola sin tocar nada más.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!loading && week && !week.blocked_by_plan && week.fixtures.length === 0 && (
        <p className="text-sm text-gray-500">No hay partidos programados para los próximos 7 días en esta liga.</p>
      )}

      {!loading && week && !week.blocked_by_plan && week.fixtures.length > 0 && (
        <div className="space-y-2">
          {week.fixtures.map((fx) => {
            const existing = myPredictionByFixture.get(fx.id);
            const draft = drafts[fx.id] || { home: existing?.predicted_home ?? 0, away: existing?.predicted_away ?? 0 };
            return (
              <Card key={fx.id}>
                <p className="text-xs text-gray-500 mb-3 text-center">{formatKickoff(fx.date)}</p>
                <div className="flex items-center justify-center gap-3 sm:gap-5">
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    {fx.home.logo && <img src={fx.home.logo} alt="" className="w-10 h-10 object-contain" loading="lazy" />}
                    <span className="text-xs text-center truncate max-w-full">{fx.home.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ScoreInput value={draft.home} onChange={(v) => setDraft(fx.id, "home", v)} label={fx.home.name} />
                    <span className="text-gray-600 self-start mt-1.5">:</span>
                    <ScoreInput value={draft.away} onChange={(v) => setDraft(fx.id, "away", v)} label={fx.away.name} />
                  </div>
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    {fx.away.logo && <img src={fx.away.logo} alt="" className="w-10 h-10 object-contain" loading="lazy" />}
                    <span className="text-xs text-center truncate max-w-full">{fx.away.name}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  {existing && (
                    <p className="text-xs text-gray-500">
                      Guardada: {existing.predicted_home}-{existing.predicted_away}
                    </p>
                  )}
                  <button
                    onClick={() => submit(fx)}
                    disabled={saving === fx.id}
                    className="ml-auto text-xs font-medium px-4 py-2 rounded-card bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 disabled:opacity-40 transition-colors"
                  >
                    {saving === fx.id ? "Guardando..." : existing ? "Actualizar" : "Predecir"}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {scoredMine.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Resultados</h2>
          <div className="space-y-2">
            {scoredMine.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-card border border-border bg-panel">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.home_team} {p.actual_home}-{p.actual_away} {p.away_team}</p>
                  <p className="text-xs text-gray-500">Predijiste {p.predicted_home}-{p.predicted_away}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 flex items-center gap-1 ${p.points === 5 ? "text-emerald" : p.points > 0 ? "text-accent" : "text-gray-500"}`}>
                  {p.points === 5 ? <Check size={14} /> : p.points > 0 ? <Minus size={14} /> : <X size={14} />}
                  +{p.points} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
