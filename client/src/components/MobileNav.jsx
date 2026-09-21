import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Search, Volume2, VolumeX, BarChart3, Flame, Gamepad2, History, Home, HelpCircle, LogOut, MoreHorizontal, Radio, User, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import AlertsBell from "./AlertsBell.jsx";
import { isSfxOn, setSfxOn } from "../utils/sfx.js";

// Cuatro accesos fijos y «Más» con el resto — antes eran cinco pestañas de
// 9 px con Trivia, En vivo, Estadísticas e Historial sin llegada directa.
const links = [
  { to: "/panel", label: "Inicio", icon: Home, end: true },
  { to: "/juegos", label: "Juegos", icon: Gamepad2 },
  { to: "/grupo", label: "Grupo", icon: Users },
  { to: "/perfil", label: "Yo", icon: User },
];

const moreLinks = [
  { to: "/trivia", label: "Trivia", icon: HelpCircle },
  { to: "/futbol", label: "En vivo", icon: Radio },
  { to: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { to: "/historial", label: "Historial", icon: History },
];

export default function MobileNav() {
  const { user, stats, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const [sound, setSound] = useState(isSfxOn);
  const openSearch = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  const toggleSound = () => { const n = !sound; setSfxOn(n); setSound(n); };

  // El cajón se cierra solo al cambiar de pantalla.
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border bg-panel/95 backdrop-blur">
        <div className="w-8 h-8 rounded-card bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm shrink-0">
          FT
        </div>
        <span className="font-semibold tracking-tight truncate">Futotal</span>

        <span className="ml-auto flex items-center gap-1 text-xs text-orange-400 shrink-0">
          <Flame size={13} />
          {stats?.current_streak ?? 0}
        </span>
        <button onClick={openSearch} aria-label="Buscar" className="p-1.5 text-gray-400"><Search size={17} /></button>
        <button onClick={toggleSound} aria-label={sound ? "Silenciar sonidos" : "Activar sonidos"} aria-pressed={sound} className="p-1.5 text-gray-400">
          {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
        <AlertsBell align="right" />
        <Avatar user={user} size={32} />
      </header>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-0 inset-x-0 rounded-t-xl border-t border-border bg-panel p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Más secciones"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="t-eyebrow">Más</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Cerrar" className="p-1 text-gray-400"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreLinks.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className="flex items-center gap-3 px-3 py-3 rounded-lg border border-border text-sm text-gray-300">
                  <Icon size={17} className="text-accent" /> {label}
                </NavLink>
              ))}
            </div>
            <button onClick={logout} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-border text-sm text-gray-400">
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-border bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2 px-0.5 text-xs font-medium leading-tight transition-colors ${
                isActive ? "text-accent" : "text-gray-500"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2 px-0.5 text-xs font-medium leading-tight transition-colors ${moreOpen ? "text-accent" : "text-gray-500"}`}
        >
          <MoreHorizontal size={20} />
          Más
        </button>
      </nav>
    </>
  );
}
