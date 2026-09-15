import { NavLink } from "react-router-dom";
import { Home, HelpCircle, Users, History, BarChart3, Gamepad2, Radio, User, LogOut, Flame } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

// El menú contesta "¿a qué PARTE de la app voy?", no "¿a qué juego?" — antes
// mezclaba 8 secciones con 3 juegos sueltos sin acceso desde ningún otro
// lado (y un "Adivina el Jugador — Pronto" que no llevaba a ninguna parte).
// Los juegos ahora entran todos por /juegos; "En vivo" y "Juegos" separan
// lo que antes vivía junto en una sola pantalla de Fútbol.
const links = [
  { to: "/panel", label: "Inicio", icon: Home, end: true },
  { to: "/trivia", label: "Trivia", icon: HelpCircle },
  { to: "/juegos", label: "Juegos", icon: Gamepad2 },
  { to: "/futbol", label: "En vivo", icon: Radio },
  { to: "/grupo", label: "Mi grupo", icon: Users },
];

const accountLinks = [
  { to: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { to: "/historial", label: "Historial", icon: History },
  { to: "/perfil", label: "Mi perfil", icon: User },
];

function NavGroup({ items }) {
  return (
    <>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-card text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent/15 text-accent border border-accent/30"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </>
  );
}

export default function Sidebar() {
  const { user, stats, logout } = useAuth();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 flex-col border-r border-border bg-panel px-4 py-6">
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-9 h-9 rounded-card bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold">
          FT
        </div>
        <span className="font-semibold text-lg tracking-tight">Futotal</span>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        <NavGroup items={links} />

        <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600">
          Vos
        </p>
        <NavGroup items={accountLinks} />
      </nav>

      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <Avatar user={user} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <div className="flex items-center gap-1 text-xs text-orange-400">
              <Flame size={12} />
              {stats?.current_streak ?? 0} días
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-card text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
