import { useState } from "react";
import { Link } from "react-router-dom";
import { Gamepad2, Search } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import Layout from "../components/Layout.jsx";
import { FAMILIES, FAMILY_ORDER, TIME_FILTERS, gamesByFamily, minutesOf } from "../data/gameCatalog.js";

// Clases de Tailwind escritas literales a propósito (no armadas con string
// interpolation) — el color de cada familia ya sale de --c-blue/--c-purple/
// --c-emerald/--c-amber/--c-red (uno por tema, ver tailwind.config.js), pero
// Tailwind necesita ver la clase completa en el código para generarla.
const FAMILY_STYLE = {
  emerald: { badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", dot: "bg-emerald-500", text: "text-emerald-500" },
  amber: { badge: "bg-amber-500/15 text-amber-500 border-amber-500/30", dot: "bg-amber-500", text: "text-amber-500" },
  red: { badge: "bg-red-500/15 text-red-500 border-red-500/30", dot: "bg-red-500", text: "text-red-500" },
  blue: { badge: "bg-blue-500/15 text-blue-500 border-blue-500/30", dot: "bg-blue-500", text: "text-blue-500" },
  purple: { badge: "bg-purple-500/15 text-purple-500 border-purple-500/30", dot: "bg-purple-500", text: "text-purple-500" },
};

function GameTile({ href, to, label, icon: Icon, description, available, style }) {
  const inner = (
    <>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${style.badge}`}>
        <Icon size={21} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-sm">{label}</p>
          {!available && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-600/50 text-gray-400 border border-gray-600/50">
              Próximamente
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 leading-snug">{description}</p>
      </div>
    </>
  );

  const className = "flex items-center gap-4 px-4 py-4 rounded-2xl border border-border bg-panel hover:border-white/20 hover:bg-white/5 transition-colors";

  if (to) return <Link to={to} className={className}>{inner}</Link>;
  if (!href) return <div className="flex items-center gap-4 px-4 py-4 rounded-2xl border border-border bg-panel opacity-60 cursor-default">{inner}</div>;
  return <a href={href} className={className}>{inner}</a>;
}

export default function Games() {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState("todos");
  const [time, setTime] = useState("todos");
  const timeTest = TIME_FILTERS.find((t) => t.key === time).test;
  const q = query.trim().toLowerCase();
  const matches = (g) => timeTest(minutesOf(g)) && (!q || `${g.label} ${g.description}`.toLowerCase().includes(q));
  const visibleKeys = FAMILY_ORDER.filter((k) => (only === "todos" || only === k) && gamesByFamily(k).some(matches));

  return (
    <Layout>
      <div className="mb-8 flex items-center gap-3">
        <Gamepad2 size={22} className="text-accent shrink-0" />
        <div>
          <h1 className="t-title mb-1">Juegos</h1>
          <p className="text-gray-400 text-sm">Agrupados por cómo se juegan, no por cuándo se agregaron.</p>
        </div>
      </div>

      <div className="mb-8 space-y-3">
        <div className="flex items-center gap-2 bg-panel border border-border rounded-card px-3 py-2.5">
          <Search size={15} className="text-gray-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar un juego…"
            aria-label="Buscar un juego"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TIME_FILTERS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTime(t.key)}
              className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
                time === t.key ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white hover:border-white/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[["todos", "Todos"], ...FAMILY_ORDER.map((k) => [k, FAMILIES[k].label])].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setOnly(k)}
              className={`px-3 py-1.5 rounded-card text-xs font-medium border transition-colors ${
                only === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white hover:border-white/30"
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

      <div className="space-y-10">
        {FAMILY_ORDER.map((key) => {
          if (!visibleKeys.includes(key)) return null;
          const family = FAMILIES[key];
          const style = FAMILY_STYLE[family.tw];
          const games = gamesByFamily(key).filter(matches);
          if (games.length === 0) return null;

          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <h2 className={`font-semibold ${style.text}`}>{family.label}</h2>
                <span className="text-xs text-gray-600">· {games.length}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{family.subtitle}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {games.map((game) => (
                  <GameTile key={game.to || game.href || game.label} {...game} style={style} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
