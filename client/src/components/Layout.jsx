import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import MobileNav from "./MobileNav.jsx";
import { markVisit } from "../utils/visits.js";

// `focus` = modo enfoque: durante una partida se esconden el menú y la barra
// y queda solo el juego y un botón «Salir». Los juegos lo prenden mientras
// se está jugando.
export default function Layout({ children, focus = false, exitTo = "/juegos" }) {
  const { pathname } = useLocation();

  useEffect(() => { markVisit(pathname); }, [pathname]);

  if (focus) {
    return (
      <div className="min-h-screen bg-bg text-white page-fade">
        <div className="flex justify-end px-4 pt-3 sm:px-6">
          <Link to={exitTo} className="btn btn-secondary btn-sm">
            <X size={14} /> Salir
          </Link>
        </div>
        <main className="px-4 py-3 pb-10 sm:px-6 lg:px-8 max-w-3xl mx-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg text-white">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileNav />
        {/* pb-24 deja lugar para la barra de navegación fija del teléfono. */}
        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8 max-w-[1400px] page-fade">
          {children}
        </main>
      </div>
    </div>
  );
}
