import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, HelpCircle, Users, History, BarChart3, Gamepad2, Radio, User, LogOut, Flame, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import AlertsBell from "./AlertsBell.jsx";

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

const COLLAPSED_KEY = "fq_sidebar_collapsed";

function NavGroup({ items, collapsed }) {
  return (
    <>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={collapsed ? label : undefined}
          aria-label={collapsed ? label : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 py-2.5 rounded-card text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : "px-3"} ${
              isActive
                ? "bg-accent/15 text-accent border border-accent/30"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`
          }
        >
          <Icon size={18} />
          {!collapsed && label}
        </NavLink>
      ))}
    </>
  );
}

export default function Sidebar() {
  const { user, stats, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1"); } catch { /* sin storage */ }
      return !c;
    });
  };

  return (
    <aside className={`hidden lg:flex ${collapsed ? "w-[72px] px-2" : "w-64 px-4"} shrink-0 h-screen sticky top-0 flex-col border-r border-border bg-panel py-6 transition-[width] duration-150`}>
      <div className={`flex items-center mb-8 ${collapsed ? "flex-col gap-3" : "gap-2 px-2"}`}>
        <div className="w-9 h-9 rounded-card bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-bold shrink-0">
          FT
        </div>
        {!collapsed && <span className="font-semibold text-lg tracking-tight flex-1">Futotal</span>}
        <AlertsBell />
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        <NavGroup items={links} collapsed={collapsed} />

        {!collapsed && (
          <p className="px-3 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
            Vos
          </p>
        )}
        {collapsed && <div className="my-2 border-t border-border" />}
        <NavGroup items={accountLinks} collapsed={collapsed} />
      </nav>

      <div className="border-t border-border pt-4 mt-4">
        <div className={`flex items-center mb-3 ${collapsed ? "justify-center" : "gap-3 px-2"}`}>
          <Avatar user={user} size={36} />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <Flame size={12} />
                {stats?.current_streak ?? 0} días
              </div>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className={`w-full flex items-center gap-2 py-2 rounded-card text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors ${collapsed ? "justify-center" : "px-3"}`}
        >
          <LogOut size={16} />
          {!collapsed && "Cerrar sesión"}
        </button>
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expandir el menú" : "Plegar el menú a íconos"}
          title={collapsed ? "Expandir el menú" : "Plegar el menú"}
          className={`w-full flex items-center gap-2 py-2 mt-1 rounded-card text-sm text-gray-500 hover:text-white hover:bg-white/5 transition-colors ${collapsed ? "justify-center" : "px-3"}`}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} />Plegar menú</>}
        </button>
      </div>
    </aside>
  );
}
