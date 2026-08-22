import { NavLink } from "react-router-dom";
import { BarChart3, Flame, History, Home, LogOut, User, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

// En el teléfono el sidebar de 256px no entra: se reemplaza por una barra
// arriba con la identidad y una barra de navegación abajo, al alcance del pulgar.
const links = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/grupo", label: "Grupo", icon: Users },
  { to: "/historial", label: "Preguntas", icon: History },
  { to: "/estadisticas", label: "Stats", icon: BarChart3 },
  { to: "/perfil", label: "Perfil", icon: User },
];

export default function MobileNav() {
  const { user, stats, logout } = useAuth();

  return (
    <>
      <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border bg-panel/95 backdrop-blur">
        <div className="w-8 h-8 rounded-card bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm shrink-0">
          FQ
        </div>
        <span className="font-semibold tracking-tight truncate">Football Quiz</span>

        <span className="ml-auto flex items-center gap-1 text-xs text-orange-400 shrink-0">
          <Flame size={13} />
          {stats?.current_streak ?? 0}
        </span>
        <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-xs font-semibold shrink-0">
          {user?.avatar || "?"}
        </div>
        <button
          onClick={logout}
          aria-label="Cerrar sesión"
          className="p-1.5 text-gray-500 hover:text-white transition-colors shrink-0"
        >
          <LogOut size={17} />
        </button>
      </header>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-border bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-gray-500"
              }`
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
