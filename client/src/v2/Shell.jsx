import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Flame, Gamepad2, Home, Layers, Radio, Shield, User } from "lucide-react";
import api from "../api.js";
import AlertsBell from "../components/AlertsBell.jsx";
import Avatar from "../components/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Carcasa de Futotal 2.0. En teléfono, igual que el prototipo: arriba la marca, la racha y la
// campana; al medio una sola columna; abajo Hoy · Jugar · Club · Cartas · Yo. En computador
// (data-device="desktop"), una barra lateral con lo mismo y el contenido ancho, en dos columnas
// donde la pantalla lo aprovecha. Las dos barras se dibujan y el CSS muestra la que corresponde.
const TABS = [
  { to: "/hoy", label: "Hoy", icon: Home, end: true },
  { to: "/juegos", label: "Jugar", icon: Gamepad2, also: ["/jugar"] },
  { to: "/club", label: "Club", icon: Shield },
  { to: "/futbol", label: "En vivo", icon: Radio },
  { to: "/cartas", label: "Cartas", icon: Layers },
  { to: "/perfil", label: "Yo", icon: User },
];

let streakCache = null;
export function useStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(streakCache);
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    api.get("/clubs/me/streak").then((r) => { streakCache = r.data; if (alive) setStreak(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [user]);
  return streak;
}

export function Wordmark({ className = "p-logo" }) {
  return <span className={className}>FUTO<span>TAL</span></span>;
}

export function TopBar() {
  const streak = useStreak();
  return (
    <header className="p-top">
      <Link to="/hoy" aria-label="Futotal, ir a Hoy"><Wordmark /></Link>
      <span className="p-grow" />
      <span className="p-pill" title={streak?.protectorAvailable ? "Racha · protector disponible esta semana" : "Racha"}>
        <Flame size={16} />{streak?.streak ?? 0}
      </span>
      <AlertsBell align="right" buttonClassName="p-roundb" />
    </header>
  );
}

export function TabBar() {
  return (
    <nav className="p-tabs" aria-label="Secciones">
      {TABS.map(({ to, label, icon: Icon, end, also }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => (isActive || also?.some((p) => window.location.pathname.startsWith(p)) ? "on" : "")}
        >
          <Icon size={22} />{label}
        </NavLink>
      ))}
    </nav>
  );
}

// Barra lateral del modo computador: marca, racha y avisos arriba; secciones; tú abajo.
export function SideBar() {
  const streak = useStreak();
  const { user } = useAuth();
  return (
    <aside className="p-side" aria-label="Secciones">
      <Link to="/hoy" className="p-side-logo" aria-label="Futotal, ir a Hoy"><Wordmark /></Link>
      <div className="flex items-center gap-2 px-3 mb-4">
        <span className="p-pill" title={streak?.protectorAvailable ? "Racha · protector disponible esta semana" : "Racha"}>
          <Flame size={16} />{streak?.streak ?? 0}<span className="p-side-txt"> {streak?.streak === 1 ? "día" : "días"}</span>
        </span>
        <span className="p-grow" />
        <AlertsBell align="left" buttonClassName="p-roundb" />
      </div>
      <nav className="flex flex-col gap-1">
        {TABS.map(({ to, label, icon: Icon, end, also }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `p-side-link ${isActive || also?.some((p) => window.location.pathname.startsWith(p)) ? "on" : ""}`}>
            <Icon size={20} />{label}
          </NavLink>
        ))}
      </nav>
      <span className="p-grow" />
      {user && (
        <Link to="/perfil" className="p-side-me">
          <Avatar user={user} size={34} />
          <span className="min-w-0"><b className="block truncate">{user.username}</b><small className="p-muted">Tu perfil y ajustes</small></span>
        </Link>
      )}
    </aside>
  );
}

// Pantallas con su propio diseño a pantalla completa (Modo DT, DT Online, Equipo-Jugador): en
// computador se les suma la barra lateral para no perder la navegación; en teléfono no cambia nada.
export function WithSide({ children }) {
  return (
    <>
      <SideBar />
      <div className="p-withside">{children}</div>
    </>
  );
}

// `hub`: las cinco pantallas principales usan todo el ancho; los juegos, un ancho de lectura.
export default function Shell({ children, chips, wide = false, hub = false }) {
  return (
    <div className="p-app">
      <SideBar />
      <div className={`p-col ${wide ? "wide" : ""} ${hub ? "hub" : ""}`}>
        <TopBar />
        <main className="p-main page-fade">
          {chips}
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
