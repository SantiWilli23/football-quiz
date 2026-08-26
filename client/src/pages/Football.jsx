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

const TABS = [
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

// Se muestra cuando el servidor todavía no tiene la API key configurada. La
// app funciona igual para todo lo demás; sólo esta sección queda a la espera.
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
            (el plan gratis alcanza). Una vez que esté configurada del lado del servidor, los
            resultados, tablas y goleadores aparecen acá solos.
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function Football() {
  const [leagues, setLeagues] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [ready, setReady] = useState(false);
  const [league, setLeague] = useState("chile");
  const [tab, setTab] = useState("vivo");
  const [date, setDate] = useState(todayStr());

  const [live, setLive] = useState(null);
  const [fixtures, setFixtures] = useState(null);
  const [standings, setStandings] = useState(null);
  const [scorers, setScorers] = useState(null);
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
      if (tab === "vivo") {
        const { data } = await api.get(`/football/${league}/live`);
        setLive(data.fixtures);
      } else if (tab === "hoy") {
        const { data } = await api.get(`/football/${league}/fixtures`, { params: { date } });
        setFixtures(data.fixtures);
      } else if (tab === "tabla") {
        const { data } = await api.get(`/football/${league}/standings`);
        setStandings(data.table);
      } else if (tab === "goleadores") {
        const { data } = await api.get(`/football/${league}/scorers`);
        setScorers(data.scorers);
      }
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }, [ready, configured, league, tab, date]);

  useEffect(() => {
    load();
  }, [load]);

  // Sólo la pestaña "en vivo" se refresca sola: es la única cuyo dato cambia
  // mientras la estás mirando.
  useEffect(() => {
    if (tab !== "vivo" || !configured) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [tab, configured, load]);

  const activeLeague = leagues.find((l) => l.key === league);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1">Fútbol</h1>
        <p className="text-gray-400 text-sm max-w-2xl">
          Resultados en vivo, alineaciones, tabla de posiciones y goleadores de las cinco grandes
          ligas europeas y la Primera División de Chile.
        </p>
      </div>

      {!configured ? (
        <NotConfigured />
      ) : (
        <>
          <LeagueTabs leagues={leagues} active={league} onChange={setLeague} />

          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 rounded-card text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                  tab === key
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
              <h2 className="font-semibold">{activeLeague?.name ?? "Cargando..."}</h2>
              {tab === "vivo" && (
                <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  <Radio size={11} style={{ color: CHALK.red }} className="animate-pulse" />
                  se actualiza solo
                </span>
              )}
              {tab === "hoy" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDate((d) => addDays(d, -1))}
                    aria-label="Día anterior"
                    className="p-1.5 rounded-card border border-border text-gray-400 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs text-gray-400 capitalize w-40 text-center">{formatDate(date)}</span>
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

            {!loading && !error && tab === "vivo" && (
              live && live.length > 0 ? (
                <div className="space-y-2">
                  {live.map((f) => (
                    <FixtureCard key={f.id} fixture={f} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay partidos en vivo en esta liga ahora mismo.</p>
              )
            )}

            {!loading && !error && tab === "hoy" && (
              fixtures && fixtures.length > 0 ? (
                <div className="space-y-2">
                  {fixtures.map((f) => (
                    <FixtureCard key={f.id} fixture={f} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay partidos programados ese día.</p>
              )
            )}

            {!loading && !error && tab === "tabla" && standings && <StandingsTable table={standings} />}
            {!loading && !error && tab === "goleadores" && scorers && <ScorersList scorers={scorers} />}
          </Card>
        </>
      )}
    </Layout>
  );
}
