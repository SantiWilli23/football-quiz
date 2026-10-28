import { useContext, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import MobileNav from "./MobileNav.jsx";
import TopBar from "./TopBar.jsx";
import HelpButton from "./HelpButton.jsx";
import PlenoStreak from "./PlenoStreak.jsx";
import { markVisit } from "../utils/visits.js";
import { ShellContext } from "../v2/ShellContext.js";
import useFutotal2 from "../v2/useFutotal2.js";
import Shell from "../v2/Shell.jsx";

// `focus` = modo enfoque: durante una partida se esconden el menú y la barra
// y queda solo el juego y un botón «Salir». Los juegos lo prenden mientras
// se está jugando.
export default function Layout({ children, focus = false, exitTo = "/juegos", wide = false, hub = false }) {
  const { pathname } = useLocation();
  const shell = useContext(ShellContext);
  const { on: v2 } = useFutotal2();

  useEffect(() => { markVisit(pathname); }, [pathname]);

  if (focus) {
    return (
      <div className="min-h-screen bg-bg text-white page-fade">
        <div className="flex justify-end items-center gap-2 px-4 pt-3 sm:px-6">
          <HelpButton inline />
          <Link to={exitTo} className="btn btn-secondary btn-sm">
            <X size={14} /> Salir
          </Link>
        </div>
        <main className={`px-4 py-3 pb-10 sm:px-6 lg:px-8 mx-auto ${wide ? "max-w-7xl" : "max-w-3xl"}`}>{children}</main>
      </div>
    );
  }

  // Futotal 2.0: la carcasa del prototipo (una columna, marca arriba y cinco pestañas abajo).
  if (v2) {
    return (
      <Shell chips={shell?.chips} wide={wide} hub={hub}>
        <PlenoStreak />
        {children}
      </Shell>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg text-white">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileNav />
        <TopBar />
        {/* pb-24 deja lugar para la barra de navegación fija del teléfono. */}
        <main className={`flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8 ${wide ? "" : "max-w-[1400px]"} page-fade`}>
          <PlenoStreak />
          {shell?.chips}
          {children}
        </main>
      </div>
    </div>
  );
}
