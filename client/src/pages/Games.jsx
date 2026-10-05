import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import Layout from "../components/Layout.jsx";
import MyCardsTeam from "../components/MyCardsTeam.jsx";
import { FAMILIES, FAMILY_ORDER, GAMES, gamesByFamily, minutesOf } from "../data/gameCatalog.js";
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

function Circle({ game, style, visits }) {
  const Icon = game.icon;
  const today = game.to ? playedToday(game.to, visits) : false;
  return (
    <GameLink game={game} className="shrink-0 w-[72px] flex flex-col items-center gap-1.5 text-center group">
      <span className={`relative w-[62px] h-[62px] rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-105 ${style.ring}`}>
        <Icon size={25} />
        {today && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-good border-2 border-bg" title="Jugado hoy" />}
      </span>
      <span className="text-[11px] leading-tight text-gray-300 group-hover:text-white transition-colors">{game.label}</span>
    </GameLink>
  );
}

export default function Games() {
  const visits = readVisits();

  return (
    <Layout>
      <div className="mb-5 flex items-center gap-3">
        <Gamepad2 size={20} className="text-accent shrink-0" />
        <h1 className="t-title">Juegos</h1>
      </div>

      <Featured visits={visits} />

      <MyCardsTeam />

      <div className="space-y-6">
        {FAMILY_ORDER.map((key) => {
          const games = gamesByFamily(key);
          if (games.length === 0) return null;
          const style = FAMILY_STYLE[FAMILIES[key].tw];
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <h2 className={`text-sm font-semibold ${style.text}`}>{FAMILIES[key].label}</h2>
                <span className="text-xs text-gray-600">{games.length}</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
                {games.map((game) => (
                  <Circle key={game.to || game.href || game.label} game={game} style={style} visits={visits} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
