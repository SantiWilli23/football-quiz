import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Radio, Table2, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import LeagueTabs from "../components/LeagueTabs.jsx";
import FixtureCard from "../components/FixtureCard.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import ScorersList from "../components/ScorersList.jsx";
import { CHALK } from "../theme.js";

const LIVE_REFRESH_MS = 60000;

const LIVE_TABS = [
  { key: "vivo", label: "En vivo", icon: Radio },
  { key: "hoy", label: "Partidos", icon: CalendarDays },
  { key: "tabla", label: "Tabla", icon: Table2 },
  { key: "goleadores", label: "Goleadores", icon: Trophy },
];

function addDays(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function NotConfigured() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium mb-1">Falta configurar los datos en vivo</p>
          <p className="text-sm text-gray-400">
            Esta sección necesita una clave de{" "}
            <a
              href="https://dashboard.api-football.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              api-football.com
            </a>{" "}
            (el plan gratis alcanza). Una vez configurada del lado del servidor, los resultados,
            tablas y goleadores aparecen acá solos.
          </p>
        </div>
      </div>
    </Card>
  );
}

function DemoBanner({ season }) {
  return (
    <div className="flex items-start gap-2.5 mb-4 px-3.5 py-2.5 rounded-card border border-amber-500/30 bg-amber-500/5">
      <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-200/90">
        Esto es de la temporada {season}, no la actual: el plan gratis de la API no llega a la de
        ahora. Se pasa a datos reales solos cuando se active un plan pago.
      </p>
    </div>
  );
}

function BlockedByPlan() {
  return (
    <div className="flex items-start gap-3">
      <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium mb-1">Esta vista necesita un plan pago</p>
        <p className="text-sm text-gray-400">
          El plan gratis de la API no deja consultar partidos por fecha fuera de una ventana muy
          chica alrededor de hoy. La pestaña "En vivo" sí funciona con datos reales.
        </p>
      </div>
    </div>
  );
}

// Solo los datos reales en vivo (resultados, tabla, goleadores) — el
// catálogo de juegos se mudó a /juegos, así esta pantalla hace un solo
// trabajo en vez de dos (antes había que pasar por encima de 23 juegos
// para ver un resultado, o al revés).
export default function Football() {
  const [leagues, setLeagues] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [ready, setReady] = useState(false);
  const [league, setLeague] = useState("chile");
  const [liveTab, setLiveTab] = useState("vivo");
  const [date, setDate] = useState(todayStr());

  const [live, setLive] = useState(null);
  const [liveAll, setLiveAll] = useState(null); // { [leagueKey]: fixtures[] } cuando league === "__all"
  const [fixtures, setFixtures] = useState(null);
  const [fixturesBlocked, setFixturesBlocked] = useState(false);
  const [standings, setStandings] = useState(null);
  const [standingsDemo, setStandingsDemo] = useState(null);
  const [scorers, setScorers] = useState(null);
  const [scorersDemo, setScorersDemo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/football/leagues")
      .then(({ data }) => {
        setConfigured(data.configured);
        setLeagues(data.leagues);
      })
      .catch(() => setConfigured(false))
      .finally(() => setReady(true));
  }, []);

  const load = useCallback(async () => {
    if (!ready || !configured) return;
    setLoading(true);
    setError("");
    try {
      if (liveTab === "vivo" && league === "__all") {
        const results = await Promise.all(
          leagues.map((l) => api.get(`/football/${l.key}/live`).then((r) => [l.key, r.data.fixtures]).catch(() => [l.key, []]))
        );
        setLiveAll(Object.fromEntries(results));
      } else if (liveTab === "vivo") {
        const { data } = await api.get(`/football/${league}/live`);
        setLive(data.fixtures);
      } else if (liveTab === "hoy") {
        const { data } = await api.get(`/football/${league}/fixtures`, { params: { date } });
        setFixtures(data.fixtures);
        setFixturesBlocked(data.blocked_by_plan);
      } else if (liveTab === "tabla") {
        const { data } = await api.get(`/football/${league}/standings`);
        setStandings(data.table);
        setStandingsDemo(data.demo ? data.demo_season : null);
      } else if (liveTab === "goleadores") {
        const { data } = await api.get(`/football/${league}/scorers`);
        setScorers(data.scorers);
        setScorersDemo(data.demo ? data.demo_season : null);
      }
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }, [ready, configured, league, liveTab, date, leagues]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (liveTab !== "vivo" || !configured) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [liveTab, configured, load]);

  const activeLeague = leagues.find((l) => l.key === league);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1">En vivo</h1>
        <p className="text-gray-400 text-sm">
          Resultados, tabla de posiciones y goleadores reales de las principales ligas.
        </p>
      </div>

      {!configured ? (
        <NotConfigured />
      ) : (
        <>
          <LeagueTabs leagues={leagues} active={league} onChange={setLeague} showAll={liveTab === "vivo"} />

          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {LIVE_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setLiveTab(key)}
                className={`px-3 py-1.5 rounded-card text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                  liveTab === key
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                    : "border-border text-gray-400 hover:text-white hover:border-white/30"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="font-semibold">{league === "__all" ? "Todas las ligas" : activeLeague?.name ?? "Cargando..."}</h2>
              {liveTab === "vivo" && (
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Radio size={11} style={{ color: CHALK.red }} className="animate-pulse" />
                  se actualiza solo
                </span>
              )}
              {liveTab === "hoy" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDate((d) => addDays(d, -1))}
                    aria-label="Día anterior"
                    className="p-1.5 rounded-card border border-border text-gray-400 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs text-gray-400 capitalize w-40 text-center">
                    {formatDate(date)}
                  </span>
                  <button
                    onClick={() => setDate((d) => addDays(d, 1))}
                    aria-label="Día siguiente"
                    className="p-1.5 rounded-card border border-border text-gray-400 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>

            {loading && <p className="text-sm text-gray-500">Cargando...</p>}
            {error && !loading && <p className="text-sm text-red-400">{error}</p>}

            {!loading && !error && liveTab === "vivo" && league === "__all" && (
              liveAll && Object.values(liveAll).some((f) => f.length > 0) ? (
                <div className="space-y-5">
                  {leagues.filter((l) => (liveAll[l.key] || []).length > 0).map((l) => (
                    <div key={l.key}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{l.name}</h3>
                      <div className="space-y-2">
                        {liveAll[l.key].map((f) => <FixtureCard key={f.id} fixture={f} />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay partidos en vivo en ninguna liga ahora mismo.</p>
              )
            )}

            {!loading && !error && liveTab === "vivo" && league !== "__all" && (
              live && live.length > 0 ? (
                <div className="space-y-2">
                  {live.map((f) => (
                    <FixtureCard key={f.id} fixture={f} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No hay partidos en vivo en esta liga ahora mismo.
                </p>
              )
            )}

            {!loading && !error && liveTab === "hoy" && (
              fixturesBlocked ? (
                <BlockedByPlan />
              ) : fixtures && fixtures.length > 0 ? (
                <div className="space-y-2">
                  {fixtures.map((f) => (
                    <FixtureCard key={f.id} fixture={f} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay partidos programados ese día.</p>
              )
            )}

            {!loading && !error && liveTab === "tabla" && standings && (
              <>
                {standingsDemo && <DemoBanner season={standingsDemo} />}
                <StandingsTable table={standings} />
              </>
            )}
            {!loading && !error && liveTab === "goleadores" && scorers && (
              <>
                {scorersDemo && <DemoBanner season={scorersDemo} />}
                <ScorersList scorers={scorers} />
              </>
            )}
          </Card>
        </>
      )}
    </Layout>
  );
}
