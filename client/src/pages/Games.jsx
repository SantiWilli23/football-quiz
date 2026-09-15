import { Link } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { FAMILIES, FAMILY_ORDER, gamesByFamily } from "../data/gameCatalog.js";

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
  return (
    <Layout>
      <div className="mb-8 flex items-center gap-3">
        <Gamepad2 size={22} className="text-accent shrink-0" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-1">Juegos</h1>
          <p className="text-gray-400 text-sm">Agrupados por cómo se juegan, no por cuándo se agregaron.</p>
        </div>
      </div>

      <div className="space-y-10">
        {FAMILY_ORDER.map((key) => {
          const family = FAMILIES[key];
          const style = FAMILY_STYLE[family.tw];
          const games = gamesByFamily(key);
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
