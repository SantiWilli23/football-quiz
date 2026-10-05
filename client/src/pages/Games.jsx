import { useState } from "react";
import { Link } from "react-router-dom";
import { Gamepad2, Search } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import Layout from "../components/Layout.jsx";
import MyCardsTeam from "../components/MyCardsTeam.jsx";
import { FAMILIES, FAMILY_ORDER, TIME_FILTERS, gamesByFamily, minutesOf } from "../data/gameCatalog.js";
import { playedToday, readVisits } from "../utils/visits.js";

function durationLabel(min) {
  return min >= 60 ? "larga" : `${min} min`;
}

// Clases de Tailwind escritas literales a propósito (no armadas con string
// interpolation) — el color de cada familia ya sale de --c-blue/--c-purple/
// --c-emerald/--c-amber/--c-red (uno por tema, ver tailwind.config.js), pero
// Tailwind necesita ver la clase completa en el código para generarla.
const FAMILY_STYLE = {
  emerald: { badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", dot: "bg-emerald-500", text: "text-emerald-500", glow: "group-hover:shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_8px_24px_-8px_rgba(16,185,129,0.35)]", bar: "from-emerald-500" },
  amber: { badge: "bg-amber-500/15 text-amber-500 border-amber-500/30", dot: "bg-amber-500", text: "text-amber-500", glow: "group-hover:shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_24px_-8px_rgba(245,158,11,0.35)]", bar: "from-amber-500" },
  red: { badge: "bg-red-500/15 text-red-500 border-red-500/30", dot: "bg-red-500", text: "text-red-500", glow: "group-hover:shadow-[0_0_0_1px_rgba(239,68,68,0.35),0_8px_24px_-8px_rgba(239,68,68,0.35)]", bar: "from-red-500" },
  blue: { badge: "bg-blue-500/15 text-blue-500 border-blue-500/30", dot: "bg-blue-500", text: "text-blue-500", glow: "group-hover:shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_8px_24px_-8px_rgba(59,130,246,0.35)]", bar: "from-blue-500" },
  purple: { badge: "bg-purple-500/15 text-purple-500 border-purple-500/30", dot: "bg-purple-500", text: "text-purple-500", glow: "group-hover:shadow-[0_0_0_1px_rgba(168,85,247,0.35),0_8px_24px_-8px_rgba(168,85,247,0.35)]", bar: "from-purple-500" },
};

function GameTile({ href, to, label, icon: Icon, description, style, minutes, visits }) {
  const today = to ? playedToday(to, visits) : false;
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${style.badge}`}>
        <Icon size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate">{label}</p>
          {today && <span className="w-1.5 h-1.5 rounded-full bg-good shrink-0" title="Jugado hoy" />}
        </div>
        <p className="text-xs text-gray-500 truncate" title={description}>{description}</p>
      </div>
      <span className="text-[11px] text-gray-500 shrink-0 tabular-nums">{durationLabel(minutes)}</span>
    </>
  );

  const className = "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-panel hover:border-white/20 hover:bg-white/5 transition-colors overflow-hidden";

  if (to) return <Link to={to} className={className}>{inner}</Link>;
  if (!href) return <div className={`${className} opacity-60 cursor-default`}>{inner}</div>;
  return <a href={href} className={className}>{inner}</a>;
}

export default function Games() {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState("todos");
  const [time, setTime] = useState("todos");
  const timeTest = TIME_FILTERS.find((t) => t.key === time).test;
  const q = query.trim().toLowerCase();
  const visits = readVisits();
  const matches = (g) => timeTest(minutesOf(g)) && (!q || `${g.label} ${g.description}`.toLowerCase().includes(q));
  const visibleKeys = FAMILY_ORDER.filter((k) => (only === "todos" || only === k) && gamesByFamily(k).some(matches));

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-3">
        <Gamepad2 size={20} className="text-accent shrink-0" />
        <h1 className="t-title">Juegos</h1>
      </div>

      <MyCardsTeam />

      <div className="mb-6 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-panel border border-border rounded-card px-3 py-2 min-w-0">
            <Search size={14} className="text-gray-500 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar un juego…"
              aria-label="Buscar un juego"
              className="flex-1 bg-transparent text-sm focus:outline-none min-w-0"
            />
          </div>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Duración"
            className="bg-panel border border-border rounded-card px-2 text-xs text-gray-300 focus:outline-none"
          >
            {TIME_FILTERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[["todos", "Todos"], ...FAMILY_ORDER.map((k) => [k, FAMILIES[k].label])].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setOnly(k)}
              className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
                only === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visibleKeys.length === 0 && (
        <EmptyState
          icon={Search}
          title="No hay juegos con ese nombre"
          hint="Probá con otra palabra o sacá algún filtro."
          actions={[{ label: "Ver todos", onClick: () => { setQuery(""); setOnly("todos"); setTime("todos"); } }]}
        />
      )}

      <div className="space-y-6">
        {FAMILY_ORDER.map((key) => {
          if (!visibleKeys.includes(key)) return null;
          const family = FAMILIES[key];
          const style = FAMILY_STYLE[family.tw];
          const games = gamesByFamily(key).filter(matches);
          if (games.length === 0) return null;

          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <h2 className={`text-sm font-semibold ${style.text}`}>{family.label}</h2>
                <span className="text-xs text-gray-600">{games.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {games.map((game) => (
                  <GameTile key={game.to || game.href || game.label} {...game} style={style} minutes={minutesOf(game)} visits={visits} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
