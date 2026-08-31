import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crown,
  Gamepad2,
  Radio,
  Star,
  Table2,
  Trophy,
  Zap,
} from "lucide-react";
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

const GAMES = [
  {
    href: "/draft-europeo.html",
    label: "Draft Europeo 8a2",
    icon: Star,
    description: "Armá tu XI con jugadores de 138 planteles históricos de la Champions League.",
    color: "#d9a441",
    available: true,
  },
  {
    href: "/cotrero.html",
    label: "Cotrero",
    icon: Crown,
    description: "De potrero a leyenda: simulá toda la carrera de un jugador, temporada a temporada.",
    color: "#3fae9a",
    available: true,
  },
  {
    href: null,
    label: "Adivina el Jugador",
    icon: Zap,
    description: "¿Podés adivinar quién es el jugador con pistas mínimas? Próximamente.",
    color: "#a8a9ac",
    available: false,
  },
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

function GamesSection() {
  return (
    <div className="space-y-3">
      {GAMES.map(({ href, label, icon: Icon, description, color, available }) => {
        const inner = (
          <>
            <div
              className="w-10 h-10 rounded-card flex items-center justify-center shrink-0"
              style={{ background: `${color}22`, border: `1px solid ${color}44` }}
            >
              <Icon size={20} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold">{label}</p>
                {!available && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-600/50 text-gray-400 border border-gray-600/50">
                    Próximamente
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-snug">{description}</p>
            </div>
          </>
        );

        if (!href) {
          return (
            <div
              key={label}
              className="flex items-center gap-4 px-4 py-4 rounded-card border border-border bg-panel opacity-60 cursor-default"
            >
              {inner}
            </div>
          );
        }

        return (
          <a
            key={href}
            href={href}
            className="flex items-center gap-4 px-4 py-4 rounded-card border border-border bg-panel hover:border-white/20 hover:bg-white/5 transition-colors"
          >
            {inner}
          </a>
        );
      })}
    </div>
  );
}

export default function Football() {
  const [section, setSection] = useState("juegos");
  const [leagues, setLeagues] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [ready, setReady] = useState(false);
  const [league, setLeague] = useState("chile");
  const [liveTab, setLiveTab] = useState("vivo");
  const [date, setDate] = useState(todayStr());

  const [live, setLive] = useState(null);
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
    if (!ready || !configured || section !== "vivo") return;
    setLoading(true);
    setError("");
    try {
      if (liveTab === "vivo") {
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
  }, [ready, configured, league, liveTab, date, section]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (liveTab !== "vivo" || !configured || section !== "vivo") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [liveTab, configured, load, section]);

  const activeLeague = leagues.find((l) => l.key === league);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1">Fútbol</h1>
        <p className="text-gray-400 text-sm">
          Juegos de fútbol y resultados en vivo de las principales ligas.
        </p>
      </div>

      {/* Selector de sección principal */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSection("juegos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium border transition-colors ${
            section === "juegos"
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border text-gray-400 hover:text-white hover:border-white/30"
          }`}
        >
          <Gamepad2 size={15} />
          Juegos
        </button>
        <button
          onClick={() => setSection("vivo")}
          className={`flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium border transition-colors ${
            section === "vivo"
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border text-gray-400 hover:text-white hover:border-white/30"
          }`}
        >
          <Radio size={15} />
          FT en Vivo
        </button>
      </div>

      {section === "juegos" && <GamesSection />}

      {section === "vivo" && (
        <>
          {!configured ? (
            <NotConfigured />
          ) : (
            <>
              <LeagueTabs leagues={leagues} active={league} onChange={setLeague} />

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
                  <h2 className="font-semibold">{activeLeague?.name ?? "Cargando..."}</h2>
                  {liveTab === "vivo" && (
                    <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
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

                {!loading && !error && liveTab === "vivo" && (
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
        </>
      )}
    </Layout>
  );
}
