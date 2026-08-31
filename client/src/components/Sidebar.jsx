import { NavLink } from "react-router-dom";
import { Home, HelpCircle, Users, History, BarChart3, Swords, Newspaper, User, LogOut, Flame, Star, Crown, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

const links = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/trivia", label: "Trivia", icon: HelpCircle },
  { to: "/futbol", label: "Fútbol", icon: Newspaper },
  { to: "/grupo", label: "Mi grupo", icon: Users },
  { to: "/duelos", label: "Duelos", icon: Swords },
  { to: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { to: "/historial", label: "Historial", icon: History },
  { to: "/perfil", label: "Mi perfil", icon: User },
];

const externalLinks = [
  { href: "/draft-europeo.html", label: "Draft Europeo 8a2", icon: Star },
  { href: "/cotrero.html", label: "Cotrero", icon: Crown },
  { href: null, label: "Adivina el Jugador", icon: Zap, soon: true },
];

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
        {links.map(({ to, label, icon: Icon, end }) => (
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
        {externalLinks.map(({ href, label, icon: Icon, soon }) =>
          href ? (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-card text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            >
              <Icon size={18} />
              {label}
            </a>
          ) : (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-card text-sm font-medium text-gray-600 border border-transparent cursor-default"
            >
              <Icon size={18} />
              <span>{label}</span>
              {soon && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/60 text-gray-500 border border-gray-600/40">
                  Pronto
                </span>
              )}
            </div>
          )
        )}
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
