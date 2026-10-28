import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Flame, Gamepad2, Home, Layers, Shield, User } from "lucide-react";
import api from "../api.js";
import AlertsBell from "../components/AlertsBell.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Carcasa de Futotal 2.0, igual que el teléfono del prototipo: arriba la marca, la racha y la
// campana; al medio una sola columna; abajo Hoy · Jugar · Club · Cartas · Yo. En computador es
// la misma columna, centrada.
const TABS = [
  { to: "/hoy", label: "Hoy", icon: Home, end: true },
  { to: "/juegos", label: "Jugar", icon: Gamepad2, also: ["/jugar"] },
  { to: "/club", label: "Club", icon: Shield },
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

export default function Shell({ children, chips, wide = false }) {
  return (
    <div className="p-app">
      <div className={`p-col ${wide ? "wide" : ""}`}>
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
