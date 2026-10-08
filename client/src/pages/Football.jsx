import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarSearch, Radio, Sun, Table2, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import LeagueTabs from "../components/LeagueTabs.jsx";
import FixtureCard from "../components/FixtureCard.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import LeadersBoard from "../components/LeadersBoard.jsx";
import PlayerModal from "../components/PlayerModal.jsx";
import MonthCalendar from "../components/MonthCalendar.jsx";
import TeamModal from "../components/TeamModal.jsx";
import { CHALK } from "../theme.js";

const REFRESH_MS = 60000;
const NEXT_COUNT = 5;
const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);

const TABS = [
  { key: "hoy", label: "Hoy", icon: Sun },
  { key: "partidos", label: "Partidos", icon: CalendarDays },
  { key: "tabla", label: "Tabla", icon: Table2 },
  { key: "goleadores", label: "Goleadores", icon: Trophy },
];

// Fechas en hora local de quien mira (no UTC): "hoy" tiene que ser el día de su calendario.
const pad = (n) => String(n).padStart(2, "0");
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => localIso(new Date());
const addDays = (dateStr, delta) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localIso(new Date(y, m - 1, d + delta));
};
const formatDate = (dateStr, opts = { weekday: "long", day: "numeric", month: "long" }) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("es-ES", opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Los que están jugando primero, después por hora de inicio.
const sortFixtures = (list) =>
  [...list].sort((a, b) => (LIVE.has(b.status) ? 1 : 0) - (LIVE.has(a.status) ? 1 : 0) || new Date(a.date) - new Date(b.date));

// Partidos agrupados por liga (cuando se mira "Todas") o en una sola lista.
function FixtureList({ byLeague, leagues, grouped, empty }) {
  const keys = leagues.map((l) => l.key).filter((k) => (byLeague[k] || []).length > 0);
  if (keys.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  if (!grouped) {
    return <div className="space-y-2">{sortFixtures(byLeague[keys[0]]).map((f) => <FixtureCard key={f.id} fixture={f} league={keys[0]} />)}</div>;
  }
  return (
    <div className="space-y-5">
      {keys.map((k) => (
        <div key={k}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{leagues.find((l) => l.key === k)?.name}</h3>
          <div className="space-y-2">{sortFixtures(byLeague[k]).map((f) => <FixtureCard key={f.id} fixture={f} league={k} />)}</div>
        </div>
      ))}
    </div>
  );
}

// Resultados, tabla de posiciones y goleadores reales de las principales ligas.
export default function Football() {
  const [leagues, setLeagues] = useState([]);
  const [ready, setReady] = useState(false);
  const [league, setLeague] = useState("chile"); // solo para Tabla y Goleadores
  const [tab, setTab] = useState("hoy");
  const [pickedDate, setPickedDate] = useState(null); // día elegido en el calendario (null = próximos días)
  const [calOpen, setCalOpen] = useState(false);
  const [team, setTeam] = useState(null);
  const [player, setPlayer] = useState(null);
  const [nextMatch, setNextMatch] = useState(null); // próximo partido cuando hoy no hay ninguno

  const [todayData, setTodayData] = useState(null); // { [leagueKey]: fixtures[] }
  const [upcoming, setUpcoming] = useState(null); // próximos 5 partidos de cualquier liga
  const [dayData, setDayData] = useState(null); // { [leagueKey]: fixtures[] }
  const [standings, setStandings] = useState(null);
  const [leaders, setLeaders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const calRef = useRef(null);

  const today = todayStr();
  const showAll = tab === "hoy" || tab === "partidos"; // Hoy y Partidos siempre muestran todas las ligas
  const grouped = showAll;
  const activeKeys = useCallback(() => (grouped ? leagues.map((l) => l.key) : [league]), [grouped, leagues, league]);

  useEffect(() => {
    api.get("/football/leagues")
      .then(({ data }) => setLeagues(data.leagues))
      .catch(() => setError("No se pudieron cargar las ligas"))
      .finally(() => setReady(true));
  }, []);

  const load = useCallback(async () => {
    if (!ready || leagues.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const keys = activeKeys();
      if (tab === "hoy") {
        const res = await Promise.all(keys.map((k) => api.get(`/football/${k}/fixtures`, { params: { date: today } }).then((r) => [k, r.data.fixtures]).catch(() => [k, []])));
        const byLeague = Object.fromEntries(res);
        setTodayData(byLeague);
        setNextMatch(null);
        if (Object.values(byLeague).every((l) => l.length === 0)) {
          const ups = await Promise.all(keys.map((k) => api.get(`/football/${k}/upcoming`, { params: { from: addDays(today, 1), days: 7 } }).then((r) => r.data.days.flatMap((d) => d.fixtures.map((f) => ({ ...f, leagueKey: k })))).catch(() => [])));
          const all = ups.flat().filter((f) => f.status === "NS").sort((x, y) => new Date(x.date) - new Date(y.date));
          setNextMatch(all[0] || false);
        }
      } else if (tab === "partidos" && pickedDate) {
        const res = await Promise.all(keys.map((k) => api.get(`/football/${k}/fixtures`, { params: { date: pickedDate } }).then((r) => [k, r.data.fixtures]).catch(() => [k, []])));
        setDayData(Object.fromEntries(res));
      } else if (tab === "partidos") {
        const res = await Promise.all(keys.map((k) => api.get(`/football/${k}/upcoming`, { params: { from: today, days: 7 } }).then((r) => r.data.days.flatMap((day) => day.fixtures.map((f) => ({ ...f, leagueKey: k })))).catch(() => [])));
        const now = Date.now();
        setUpcoming(res.flat().filter((f) => f.status === "NS" && new Date(f.date).getTime() > now).sort((x, y) => new Date(x.date) - new Date(y.date)).slice(0, NEXT_COUNT));
      } else if (tab === "tabla") {
        const { data } = await api.get(`/football/${league}/standings`);
        setStandings(data.table);
      } else if (tab === "goleadores") {
        const { data } = await api.get(`/football/${league}/leaders`);
        setLeaders(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }, [ready, leagues, activeKeys, tab, today, pickedDate, league]);

  useEffect(() => { load(); }, [load]);

  // Hoy se actualiza solo (marcadores y minutos).
  useEffect(() => {
    if (tab !== "hoy") return undefined;
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [tab, load]);

  // El calendario se cierra al tocar afuera.
  useEffect(() => {
    if (!calOpen) return undefined;
    const onDown = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setCalOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [calOpen]);

  const activeLeague = leagues.find((l) => l.key === league);
  const anyLive = tab === "hoy" && todayData && Object.values(todayData).some((l) => l.some((f) => LIVE.has(f.status)));

  if (team) {
    return (
      <Layout wide>
        <TeamModal league={league} team={team} onClose={() => setTeam(null)} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1">En vivo</h1>
        <p className="text-gray-400 text-sm">Los partidos de hoy, los próximos partidos de todas las ligas, la tabla y los líderes de cada liga.</p>
      </div>

      {!showAll && <LeagueTabs leagues={leagues} active={league} onChange={setLeague} showAll={false} />}

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-card text-sm font-medium border transition-colors flex items-center gap-1.5 ${
              tab === key ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-border text-gray-400 hover:text-white hover:border-white/30"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-semibold">{grouped ? "Todas las ligas" : activeLeague?.name ?? "Cargando..."}</h2>

          {tab === "hoy" && (
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              {anyLive && <Radio size={11} style={{ color: CHALK.red }} className="animate-pulse" />}
              <span>{formatDate(today)}</span> · se actualiza solo
            </span>
          )}

          {tab === "partidos" && (
            <div className="relative flex items-center gap-2" ref={calRef}>
              {pickedDate && (
                <button onClick={() => { setPickedDate(null); setCalOpen(false); }} className="text-xs text-gray-400 hover:text-white underline underline-offset-4">
                  Ver próximos días
                </button>
              )}
              <button
                onClick={() => setCalOpen((o) => !o)}
                aria-expanded={calOpen}
                className="px-3 py-1.5 rounded-card text-xs font-medium border border-border text-gray-300 hover:text-white hover:border-white/30 transition-colors flex items-center gap-1.5"
              >
                <CalendarSearch size={14} />
                {pickedDate ? formatDate(pickedDate, { day: "numeric", month: "short" }) : "Elegir día"}
              </button>
              {calOpen && (
                <div className="absolute right-0 top-full mt-2 z-20 bg-panel border border-border rounded-2xl p-4 shadow-lg">
                  <MonthCalendar value={pickedDate || addDays(today, 1)} today={today} onPick={(d) => { setPickedDate(d); setCalOpen(false); }} />
                </div>
              )}
            </div>
          )}
        </div>

        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        {error && !loading && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && tab === "hoy" && todayData && (
          <>
            <FixtureList byLeague={todayData} leagues={leagues} grouped={grouped} empty="Hoy no hay partidos en ninguna liga." />
            {nextMatch && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">El próximo partido es {formatDate(localIso(new Date(nextMatch.date)), { weekday: "long", day: "numeric", month: "long" })} a las {new Date(nextMatch.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {leagues.find((l) => l.key === nextMatch.leagueKey)?.name}</p>
                <FixtureCard fixture={nextMatch} />
              </div>
            )}
            {nextMatch === false && <p className="text-xs text-gray-500 mt-2">Tampoco hay partidos programados en los próximos 7 días.</p>}
          </>
        )}

        {!loading && !error && tab === "partidos" && pickedDate && dayData && (
          <>
            <p className="text-sm font-medium mb-3">{formatDate(pickedDate)}</p>
            <FixtureList byLeague={dayData} leagues={leagues} grouped={grouped} empty="No hay partidos programados ese día." />
          </>
        )}

        {!loading && !error && tab === "partidos" && !pickedDate && upcoming && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Los próximos {NEXT_COUNT} partidos de cualquier liga.</p>
            {upcoming.length === 0 && <p className="text-sm text-gray-500">No hay partidos programados en los próximos 7 días.</p>}
            {upcoming.map((fx) => (
              <div key={fx.id}>
                <p className="text-xs text-gray-500 mb-1">
                  {formatDate(localIso(new Date(fx.date)), { weekday: "short", day: "numeric", month: "short" })} · {new Date(fx.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {leagues.find((l) => l.key === fx.leagueKey)?.name}
                </p>
                <FixtureCard fixture={fx} />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && tab === "tabla" && standings && (
          <>
            <p className="text-xs text-gray-500 mb-3">Tocá un equipo para ver su página: liga pasada, resultados, plantilla, lesiones y títulos.</p>
            <StandingsTable table={standings} onTeamClick={setTeam} />
          </>
        )}
        {!loading && !error && tab === "goleadores" && leaders && (
          <>
            <p className="text-xs text-gray-500 mb-4">Tocá un jugador para ver su carrera: clubes, temporadas y datos.</p>
            <LeadersBoard data={leaders} onPick={(p) => setPlayer(p)} />
          </>
        )}
      </Card>

      {player && <PlayerModal playerId={player.id} fallback={player} onClose={() => setPlayer(null)} />}
    </Layout>
  );
}
