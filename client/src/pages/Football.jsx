import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarSearch, Radio, Sun, Table2, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import LeagueTabs from "../components/LeagueTabs.jsx";
import FixtureCard from "../components/FixtureCard.jsx";
import StandingsTable from "../components/StandingsTable.jsx";
import ScorersList from "../components/ScorersList.jsx";
import MonthCalendar from "../components/MonthCalendar.jsx";
import TeamModal from "../components/TeamModal.jsx";
import { CHALK } from "../theme.js";

const REFRESH_MS = 60000;
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
    return <div className="space-y-2">{sortFixtures(byLeague[keys[0]]).map((f) => <FixtureCard key={f.id} fixture={f} />)}</div>;
  }
  return (
    <div className="space-y-5">
      {keys.map((k) => (
        <div key={k}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{leagues.find((l) => l.key === k)?.name}</h3>
          <div className="space-y-2">{sortFixtures(byLeague[k]).map((f) => <FixtureCard key={f.id} fixture={f} />)}</div>
        </div>
      ))}
    </div>
  );
}

// Resultados, tabla de posiciones y goleadores reales de las principales ligas.
export default function Football() {
  const [leagues, setLeagues] = useState([]);
  const [ready, setReady] = useState(false);
  const [league, setLeague] = useState("chile");
  const [tab, setTab] = useState("hoy");
  const [pickedDate, setPickedDate] = useState(null); // día elegido en el calendario (null = próximos días)
  const [calOpen, setCalOpen] = useState(false);
  const [team, setTeam] = useState(null);

  const [todayData, setTodayData] = useState(null); // { [leagueKey]: fixtures[] }
  const [upcoming, setUpcoming] = useState(null); // [{ date, byLeague }]
  const [dayData, setDayData] = useState(null); // { [leagueKey]: fixtures[] }
  const [standings, setStandings] = useState(null);
  const [scorers, setScorers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const calRef = useRef(null);

  const today = todayStr();
  const grouped = league === "__all";
  const activeKeys = useCallback(() => (grouped ? leagues.map((l) => l.key) : [league]), [grouped, leagues, league]);

  useEffect(() => {
    api.get("/football/leagues")
      .then(({ data }) => setLeagues(data.leagues))
      .catch(() => setError("No se pudieron cargar las ligas"))
      .finally(() => setReady(true));
  }, []);

  // "Todas" solo sirve para partidos; tabla y goleadores son de una liga.
  useEffect(() => {
    if ((tab === "tabla" || tab === "goleadores") && league === "__all") setLeague("chile");
  }, [tab, league]);

  const load = useCallback(async () => {
    if (!ready || leagues.length === 0) return;
    if (league === "__all" && (tab === "tabla" || tab === "goleadores")) return; // el efecto de arriba ya lo pasa a una liga
    setLoading(true);
    setError("");
    try {
      const keys = activeKeys();
      if (tab === "hoy") {
        const res = await Promise.all(keys.map((k) => api.get(`/football/${k}/fixtures`, { params: { date: today } }).then((r) => [k, r.data.fixtures]).catch(() => [k, []])));
        setTodayData(Object.fromEntries(res));
      } else if (tab === "partidos" && pickedDate) {
        const res = await Promise.all(keys.map((k) => api.get(`/football/${k}/fixtures`, { params: { date: pickedDate } }).then((r) => [k, r.data.fixtures]).catch(() => [k, []])));
        setDayData(Object.fromEntries(res));
      } else if (tab === "partidos") {
        const from = addDays(today, 1);
        const res = await Promise.all(keys.map((k) => api.get(`/football/${k}/upcoming`, { params: { from, days: 2 } }).then((r) => [k, r.data.days]).catch(() => [k, []])));
        const byDate = {};
        for (const [k, days] of res) for (const d of days) (byDate[d.date] ||= {})[k] = d.fixtures;
        setUpcoming([from, addDays(from, 1)].map((date) => ({ date, byLeague: byDate[date] || {} })));
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
  const showAll = tab === "hoy" || tab === "partidos";
  const anyLive = tab === "hoy" && todayData && Object.values(todayData).some((l) => l.some((f) => LIVE.has(f.status)));

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-1">En vivo</h1>
        <p className="text-gray-400 text-sm">Los partidos de hoy, los próximos días, la tabla y los goleadores de las principales ligas.</p>
      </div>

      <LeagueTabs leagues={leagues} active={league} onChange={setLeague} showAll={showAll} />

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
          <FixtureList byLeague={todayData} leagues={leagues} grouped={grouped} empty={grouped ? "Hoy no hay partidos en ninguna liga." : "Hoy no hay partidos en esta liga."} />
        )}

        {!loading && !error && tab === "partidos" && pickedDate && dayData && (
          <>
            <p className="text-sm font-medium mb-3">{formatDate(pickedDate)}</p>
            <FixtureList byLeague={dayData} leagues={leagues} grouped={grouped} empty="No hay partidos programados ese día." />
          </>
        )}

        {!loading && !error && tab === "partidos" && !pickedDate && upcoming && (
          <div className="space-y-6">
            {upcoming.map(({ date, byLeague }) => (
              <div key={date}>
                <p className="text-sm font-medium mb-3">{formatDate(date)}</p>
                <FixtureList byLeague={byLeague} leagues={leagues} grouped={grouped} empty="No hay partidos programados ese día." />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && tab === "tabla" && standings && (
          <>
            <p className="text-xs text-gray-500 mb-3">Tocá un equipo para ver su ficha: liga pasada, plantilla, lesiones y títulos.</p>
            <StandingsTable table={standings} onTeamClick={setTeam} />
          </>
        )}
        {!loading && !error && tab === "goleadores" && scorers && <ScorersList scorers={scorers} />}
      </Card>

      {team && <TeamModal league={league} team={team} onClose={() => setTeam(null)} />}
    </Layout>
  );
}
