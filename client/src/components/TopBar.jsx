import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Rows3, Rows4, Search, Volume2, VolumeX } from "lucide-react";
import { GAMES } from "../data/gameCatalog.js";
import { readDensity, setDensity } from "../utils/density.js";
import { isSfxOn, setSfxOn, playSfx } from "../utils/sfx.js";

// Nombres de las pantallas que no son juegos (los juegos salen del catálogo).
const PAGE_NAMES = {
  "/panel": "Inicio", "/trivia": "Trivia", "/juegos": "Juegos", "/futbol": "En vivo", "/grupo": "Mi grupo",
  "/estadisticas": "Estadísticas", "/historial": "Historial", "/ranking-global": "Ranking global", "/perfil": "Mi perfil",
  "/vida-fut": "Vida FUT",
};

function crumbsFor(pathname) {
  const game = GAMES.find((g) => g.to && (pathname === g.to || pathname.startsWith(`${g.to}/`)));
  if (game) return [{ label: "Juegos", to: "/juegos" }, { label: game.label }];
  const key = Object.keys(PAGE_NAMES).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return [{ label: key ? PAGE_NAMES[key] : "Futotal" }];
}

// Barra fija de escritorio: migas de pan (dónde estás), buscador Ctrl K,
// densidad de las tarjetas y sonido. Antes cada cosa vivía en un lugar distinto.
export default function TopBar() {
  const { pathname } = useLocation();
  const crumbs = crumbsFor(pathname);
  const [density, setD] = useState(readDensity);
  const [sound, setSound] = useState(isSfxOn);

  const openSearch = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  const toggleDensity = () => {
    const next = density === "compacta" ? "comoda" : "compacta";
    setDensity(next);
    setD(next);
  };
  const toggleSound = () => {
    const next = !sound;
    setSfxOn(next);
    setSound(next);
    if (next) playSfx("tick");
  };

  const iconBtn = "p-2 rounded-card text-gray-400 hover:text-white hover:bg-white/5 transition-colors";

  return (
    <div className="hidden lg:flex sticky top-0 z-30 items-center gap-3 px-8 h-12 border-b border-border bg-bg/90 backdrop-blur">
      <nav aria-label="Migas de pan" className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
        {crumbs.map((c, i) => (
          <span key={c.label} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight size={13} className="text-gray-600 shrink-0" />}
            {c.to ? (
              <Link to={c.to} className="text-gray-500 hover:text-white transition-colors">{c.label}</Link>
            ) : (
              <span className="font-medium truncate">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <button
        onClick={openSearch}
        className="flex items-center gap-2 h-8 w-56 px-3 rounded-lg border border-border text-sm text-gray-500 hover:text-white hover:border-gray-500 transition-colors"
        aria-label="Buscar pantallas y juegos"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="text-xs border border-border rounded px-1.5 py-0.5">Ctrl K</kbd>
      </button>

      <button
        onClick={toggleDensity}
        className={iconBtn}
        aria-label={density === "compacta" ? "Cambiar a densidad cómoda" : "Cambiar a densidad compacta"}
        title={density === "compacta" ? "Densidad: compacta" : "Densidad: cómoda"}
      >
        {density === "compacta" ? <Rows4 size={17} /> : <Rows3 size={17} />}
      </button>
      <button
        onClick={toggleSound}
        className={iconBtn}
        aria-label={sound ? "Silenciar sonidos" : "Activar sonidos"}
        aria-pressed={sound}
        title={sound ? "Sonido activado" : "Sonido silenciado"}
      >
        {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
      </button>
    </div>
  );
}
