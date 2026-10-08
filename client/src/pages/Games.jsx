import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Gamepad2, Medal } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import MyCardsTeam from "../components/MyCardsTeam.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { CON_AMIGOS_GAMES, JUEGOS_SEMANALES, FAMILIES, FUTBOL12_GAMES, GAMES } from "../data/gameCatalog.js";
import { playedToday, readVisits } from "../utils/visits.js";

// Clases de Tailwind escritas literales a propósito (no armadas con string
// interpolation): Tailwind necesita ver la clase completa para generarla. El
// color de cada familia sale de los slots por tema (--c-emerald, --c-amber…).
const FAMILY_STYLE = {
  emerald: { tone: "tone-emerald", dot: "bg-emerald-500", text: "text-emerald-500", ring: "border-emerald-500 bg-emerald-500/15 text-emerald-500", feat: "from-emerald-500/40 border-emerald-500/40" },
  amber: { tone: "tone-amber", dot: "bg-amber-500", text: "text-amber-500", ring: "border-amber-500 bg-amber-500/15 text-amber-500", feat: "from-amber-500/40 border-amber-500/40" },
  red: { tone: "tone-red", dot: "bg-red-500", text: "text-red-500", ring: "border-red-500 bg-red-500/15 text-red-500", feat: "from-red-500/40 border-red-500/40" },
  blue: { tone: "tone-blue", dot: "bg-blue-500", text: "text-blue-500", ring: "border-blue-500 bg-blue-500/15 text-blue-500", feat: "from-blue-500/40 border-blue-500/40" },
  purple: { tone: "tone-purple", dot: "bg-purple-500", text: "text-purple-500", ring: "border-purple-500 bg-purple-500/15 text-purple-500", feat: "from-purple-500/40 border-purple-500/40" },
};

function GameLink({ game, className, children }) {
  return game.to ? (
    <Link to={game.to} className={className}>{children}</Link>
  ) : (
    <a href={game.href} className={className}>{children}</a>
  );
}

// La casilla grande: el juego diario de hoy. Rota solo (lo decide el servidor,
// así que todos juegan el mismo). El puntaje 0-20 es solo de referencia: ordena al
// grupo ese día y el podio suma 5 / 3 / 1 puntos.
function DailyFeatured({ today, visits }) {
  if (!today) return null;
  const daily = today.game;
  const base = GAMES.find((g) => (g.to || g.href) === daily.to);
  if (!base) return null;
  // Fichado como juego diario es otra cosa que la partida libre: un solo jugador.
  // Entrando por el juego diario, cada juego muestra solo su versión diaria (?diario=1).
  const game = base.to ? { ...base, to: `${base.to}?diario=1` } : { ...base, href: `${base.href}?diario=1` };
  const fam = FAMILIES[game.family];
  const style = FAMILY_STYLE[fam.tw];
  const Icon = game.icon;
  return (
    <GameLink
      game={game}
      className={`block min-h-[170px] rounded-2xl border bg-gradient-to-br ${style.feat} to-panel p-5 hover:opacity-90 transition-opacity relative mb-2`}
    >
      <Icon size={26} className={`absolute top-5 right-5 ${style.text}`} />
      <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${style.text}`}>
        <CalendarCheck size={13} /> Juego diario · puntaje de {today.max} y sobre · podio del día: 5 / 3 / 1 pts
      </span>
      <span className="t-title block text-2xl leading-tight mt-2">{game.label}</span>
      <span className="text-sm text-gray-400 leading-snug block mt-1.5 max-w-xl">{game.description}</span>
      <span className={`inline-block mt-3 text-xs font-semibold tabular-nums ${daily.done ? "text-good" : "text-gray-500"}`}>
        {daily.done ? `Hecho hoy · puntaje ${daily.points}/${today.max} y sobre` : "Todavía no lo jugaste hoy"}
      </span>
    </GameLink>
  );
}

function Circle({ game, style, visits }) {
  const Icon = game.icon;
  const played = game.to ? playedToday(game.to, visits) : false;
  return (
    <GameLink game={game} className="shrink-0 w-[76px] flex flex-col items-center gap-1.5 text-center group">
      <span className={`relative w-[62px] h-[62px] rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-105 ${style.ring}`}>
        <Icon size={25} />
        {played && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-good border-2 border-bg" title="Jugado hoy" />}
      </span>
      <span className="text-[11px] leading-tight text-gray-300 group-hover:text-white transition-colors">{game.label}</span>
    </GameLink>
  );
}

function CircleRow({ games, visits }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
      {games.map((game) => (
        <Circle key={game.to || game.href || game.label} game={game} style={FAMILY_STYLE[FAMILIES[game.family].tw]} visits={visits} />
      ))}
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

// Clasificación de ESTA semana entre los miembros del grupo activo: la suma de
// los juegos diarios de la semana. El podio gana puntos y sobres de cartas.
function WeeklyStandings({ groupId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!groupId) { setData(null); return; }
    api.get("/daily-games/weekly", { params: { groupId } }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [groupId]);

  if (!groupId || !data) return null;
  const podium = Object.values(data.podium || {});

  return (
    <details className="mt-3 rounded-card border border-border bg-panel/40 px-3 py-2">
      <summary className="flex items-center gap-2 text-sm cursor-pointer select-none list-none">
        <Medal size={15} className="text-accent shrink-0" />
        <span className="font-medium">Clasificación de la semana</span>
        <span className="text-xs text-gray-500 ml-auto">
          {data.myPack ? `Tu premio: sobre ${data.myPack}` : `podio: sobre ${podium.join(" / ")}`}
        </span>
      </summary>
      <div className="mt-3 text-xs">
        {data.standings.length === 0 ? (
          <p className="text-gray-500">Todavía nadie sumó en el juego diario esta semana. Al terminar la semana, el 1° del grupo gana un sobre top, el 2° uno bueno y el 3° uno normal.</p>
        ) : (
          <p className="text-gray-500 leading-relaxed">
            {data.standings.slice(0, 5).map((s, i) => (
              <span key={s.userId} className={s.me ? "text-white" : ""}>
                {i > 0 && " · "}
                {s.rank}° {s.username} {s.score}{s.pack ? ` (sobre ${s.pack})` : ""}
              </span>
            ))}
          </p>
        )}
      </div>
    </details>
  );
}

// Activar los juegos semanales en el grupo: solo quien lo creó. Sin esto no dan puntos.
function WeeklyGamesToggle() {
  const { activeGroup, reloadGroups } = useGroups();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!activeGroup) return <p className="text-xs text-gray-500 mb-3">Unite a un grupo para que estos juegos den puntos.</p>;
  const on = !!activeGroup.weekly_games_enabled;
  const isOwner = activeGroup.created_by === user?.id;

  async function toggle() {
    setBusy(true);
    try {
      await api.post(`/groups/${activeGroup.id}/weekly-games/toggle`, { enable: !on });
      await reloadGroups();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-card border border-border bg-panel/40 px-3 py-2 text-xs">
      <span className={`w-2 h-2 rounded-full shrink-0 ${on ? "bg-good" : "bg-gray-600"}`} />
      <span className="flex-1 text-gray-400">
        {on ? `Activados en ${activeGroup.name}: los puntos se reparten los domingos.` : `Desactivados en ${activeGroup.name}: no dan puntos.`}
        {!isOwner && " Solo quien creó el grupo puede cambiarlo."}
      </span>
      {isOwner && (
        <button onClick={toggle} disabled={busy} className="px-3 py-1.5 rounded-card border border-accent/40 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50">
          {on ? "Desactivar" : "Activar"}
        </button>
      )}
    </div>
  );
}

export default function Games() {
  const visits = readVisits();
  const { activeGroupId } = useGroups();
  const [today, setToday] = useState(null);

  useEffect(() => {
    api.get("/daily-games/today").then((r) => setToday(r.data)).catch(() => setToday(null));
  }, []);

  return (
    <Layout>
      <div className="mb-5 flex items-center gap-3">
        <Gamepad2 size={20} className="text-accent shrink-0" />
        <h1 className="t-title">Juegos</h1>
      </div>

      <DailyFeatured today={today} visits={visits} />
      <WeeklyStandings groupId={activeGroupId} />

      <div className="mt-6">
        <MyCardsTeam />
      </div>

      {CON_AMIGOS_GAMES.length > 0 && (
        <section className="mb-10">
          <SectionTitle hint={FAMILIES.grupo.subtitle}>Con amigos</SectionTitle>
          <CircleRow games={CON_AMIGOS_GAMES} visits={visits} />
        </section>
      )}

      {JUEGOS_SEMANALES.length > 0 && (
        <section className="mb-10">
          <SectionTitle hint="Sus puntos se reparten los domingos y solo cuentan en los grupos que los activaron.">Juegos semanales</SectionTitle>
          <WeeklyGamesToggle />
          <CircleRow games={JUEGOS_SEMANALES} visits={visits} />
        </section>
      )}

      {FUTBOL12_GAMES.length > 0 && (
        <section>
          <SectionTitle hint="Partidas libres: dan un sobre normal por jugar (uno por juego y día).">Fútbol 12</SectionTitle>
          {["solo", "reloj", "pronostico", "carrera"].map((k) => {
            const list = FUTBOL12_GAMES.filter((g) => g.family === k);
            if (list.length === 0) return null;
            const st = FAMILY_STYLE[FAMILIES[k].tw];
            return (
              <div key={k} className={`${st.tone} mb-6`}>
                <p className="flex items-center gap-2 text-sm font-semibold text-tone mb-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-tone" />
                  {FAMILIES[k].label}
                  <span className="text-xs font-normal text-gray-500">· {FAMILIES[k].subtitle}</span>
                </p>
                <CircleRow games={list} visits={visits} />
              </div>
            );
          })}
        </section>
      )}
    </Layout>
  );
}
