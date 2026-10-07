import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Gamepad2, Medal } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import MyCardsTeam from "../components/MyCardsTeam.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { DAILY_GAMES, DAILY_SECTION_FAMILIES, FAMILIES, FUTBOL12_GAMES, GAMES, gamesByFamily, minutesOf } from "../data/gameCatalog.js";
import { playedToday, readVisits } from "../utils/visits.js";

function durationLabel(min) {
  return min >= 60 ? "larga" : `${min} min`;
}

// Clases de Tailwind escritas literales a propósito (no armadas con string
// interpolation): Tailwind necesita ver la clase completa para generarla. El
// color de cada familia sale de los slots por tema (--c-emerald, --c-amber…).
const FAMILY_STYLE = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-500", ring: "border-emerald-500 bg-emerald-500/15 text-emerald-500", feat: "from-emerald-500/40 border-emerald-500/40" },
  amber: { dot: "bg-amber-500", text: "text-amber-500", ring: "border-amber-500 bg-amber-500/15 text-amber-500", feat: "from-amber-500/40 border-amber-500/40" },
  red: { dot: "bg-red-500", text: "text-red-500", ring: "border-red-500 bg-red-500/15 text-red-500", feat: "from-red-500/40 border-red-500/40" },
  blue: { dot: "bg-blue-500", text: "text-blue-500", ring: "border-blue-500 bg-blue-500/15 text-blue-500", feat: "from-blue-500/40 border-blue-500/40" },
  purple: { dot: "bg-purple-500", text: "text-purple-500", ring: "border-purple-500 bg-purple-500/15 text-purple-500", feat: "from-purple-500/40 border-purple-500/40" },
};

// Los que se ofrecen arriba, en el carrusel de destacados.
const FEATURED = ["/fulbodle", "/copa-semanal", "/un-minuto"];

function GameLink({ game, className, children }) {
  return game.to ? (
    <Link to={game.to} className={className}>{children}</Link>
  ) : (
    <a href={game.href} className={className}>{children}</a>
  );
}

function Featured({ visits }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const games = FEATURED.map((to) => GAMES.find((g) => g.to === to)).filter(Boolean);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild;
    if (!card) return;
    setIndex(Math.round(el.scrollLeft / (card.offsetWidth + 12)));
  }

  return (
    <div className="mb-6">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 [scrollbar-width:none]"
      >
        {games.map((game) => {
          const fam = FAMILIES[game.family];
          const style = FAMILY_STYLE[fam.tw];
          const Icon = game.icon;
          const today = playedToday(game.to, visits);
          return (
            <GameLink
              key={game.to}
              game={game}
              className={`snap-start shrink-0 basis-[85%] sm:basis-[46%] lg:basis-[32%] min-h-[150px] rounded-2xl border bg-gradient-to-br ${style.feat} to-panel p-4 flex flex-col justify-end gap-1.5 hover:opacity-90 transition-opacity relative`}
            >
              <Icon size={22} className={`absolute top-4 right-4 ${style.text}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${style.text}`}>
                {fam.label} · {durationLabel(minutesOf(game))}{today ? " · jugado hoy" : ""}
              </span>
              <span className="t-title leading-none">{game.label}</span>
              <span className="text-xs text-gray-400 leading-snug line-clamp-2">{game.description}</span>
            </GameLink>
          );
        })}
      </div>
      <div className="flex justify-center gap-1.5 mt-1" aria-hidden="true">
        {games.map((g, i) => (
          <span key={g.to} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-accent" : "w-1.5 bg-border"}`} />
        ))}
      </div>
    </div>
  );
}

function Circle({ game, style, visits, daily }) {
  const Icon = game.icon;
  const today = daily ? daily.done : game.to ? playedToday(game.to, visits) : false;
  return (
    <GameLink game={game} className="shrink-0 w-[76px] flex flex-col items-center gap-1.5 text-center group">
      <span className={`relative w-[62px] h-[62px] rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-105 ${style.ring}`}>
        <Icon size={25} />
        {today && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-good border-2 border-bg" title="Jugado hoy" />}
      </span>
      <span className="text-[11px] leading-tight text-gray-300 group-hover:text-white transition-colors">{game.label}</span>
      {daily && (
        <span className={`text-[10px] font-semibold tabular-nums ${daily.done ? "text-good" : "text-gray-600"}`}>
          {daily.points}/{daily.max} pts
        </span>
      )}
    </GameLink>
  );
}

function CircleRow({ games, visits, dailyByTo }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
      {games.map((game) => (
        <Circle
          key={game.to || game.href || game.label}
          game={game}
          style={FAMILY_STYLE[FAMILIES[game.family].tw]}
          visits={visits}
          daily={dailyByTo ? dailyByTo[game.to || game.href] : undefined}
        />
      ))}
    </div>
  );
}

function SubHeader({ dotClass, textClass, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      <h3 className={`text-sm font-semibold ${textClass}`}>{label}</h3>
      {count != null && <span className="text-xs text-gray-600">{count}</span>}
    </div>
  );
}

function SectionTitle({ children, hint }) {
  return (
    <div className="mb-4 border-b border-border pb-2">
      <h2 className="t-title text-lg">{children}</h2>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

// Clasificación de ESTA semana en cada juego diario, entre los miembros del
// grupo activo: el podio (1°, 2°, 3°) suma puntos al ranking semanal.
function WeeklyStandings({ groupId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!groupId) { setData(null); return; }
    api.get("/daily-games/weekly", { params: { groupId } }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [groupId]);

  if (!groupId || !data) return null;
  const podium = Object.values(data.podium || {});
  const playing = data.games.filter((g) => g.standings.length > 0);

  return (
    <details className="mt-3 rounded-card border border-border bg-panel/40 px-3 py-2">
      <summary className="flex items-center gap-2 text-sm cursor-pointer select-none list-none">
        <Medal size={15} className="text-accent shrink-0" />
        <span className="font-medium">Clasificación de la semana</span>
        <span className="text-xs text-gray-500 ml-auto">
          {data.myBonus > 0 ? `+${data.myBonus} pts por podios` : `podio: ${podium.map((p) => `+${p}`).join(" / ")}`}
        </span>
      </summary>
      <div className="mt-3 space-y-2.5">
        {playing.length === 0 && <p className="text-xs text-gray-500">Todavía nadie jugó un diario esta semana. El podio de cada juego suma al ranking del grupo.</p>}
        {playing.map((g) => (
          <div key={g.key} className="text-xs">
            <p className="text-gray-400 font-medium mb-0.5">{g.label}</p>
            <p className="text-gray-500 leading-relaxed">
              {g.standings.slice(0, 4).map((s, i) => (
                <span key={s.userId} className={s.me ? "text-white" : ""}>
                  {i > 0 && " · "}
                  {s.rank}° {s.username} {s.score}{s.bonus ? ` (+${s.bonus})` : ""}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function Games() {
  const visits = readVisits();
  const { activeGroupId } = useGroups();
  const [today, setToday] = useState(null);

  useEffect(() => {
    api.get("/daily-games/today").then((r) => setToday(r.data)).catch(() => setToday(null));
  }, []);

  const dailyByTo = {};
  (today?.games || []).forEach((g) => { dailyByTo[g.to] = { done: g.done, points: g.points, max: today.max }; });
  const doneCount = (today?.games || []).filter((g) => g.done && dailyByTo[g.to]).length;

  return (
    <Layout>
      <div className="mb-5 flex items-center gap-3">
        <Gamepad2 size={20} className="text-accent shrink-0" />
        <h1 className="t-title">Juegos</h1>
      </div>

      <Featured visits={visits} />

      <MyCardsTeam />

      <section className="mb-10">
        <SectionTitle hint="Una partida por día de cada juego suma al ranking, con el mismo tope de puntos para todos.">Juegos diarios</SectionTitle>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck size={15} className="text-accent" />
              <h3 className="text-sm font-semibold text-accent">Juego diario</h3>
              <span className="text-xs text-gray-600">
                {today ? `${doneCount}/${DAILY_GAMES.length} hoy · ${today.total}/${today.totalMax} pts` : DAILY_GAMES.length}
              </span>
            </div>
            <CircleRow games={DAILY_GAMES} visits={visits} dailyByTo={dailyByTo} />
            <WeeklyStandings groupId={activeGroupId} />
          </div>

          {DAILY_SECTION_FAMILIES.map((key) => {
            const games = gamesByFamily(key).filter((g) => !g.daily);
            const style = FAMILY_STYLE[FAMILIES[key].tw];
            return (
              <div key={key}>
                <SubHeader dotClass={style.dot} textClass={style.text} label={FAMILIES[key].label} count={games.length} />
                <CircleRow games={games} visits={visits} />
              </div>
            );
          })}
        </div>
      </section>

      {FUTBOL12_GAMES.length > 0 && (
        <section>
          <SectionTitle>Fútbol 12</SectionTitle>
          <CircleRow games={FUTBOL12_GAMES} visits={visits} />
        </section>
      )}
    </Layout>
  );
}
