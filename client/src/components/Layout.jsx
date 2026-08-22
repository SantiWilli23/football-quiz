import Sidebar from "./Sidebar.jsx";
import MobileNav from "./MobileNav.jsx";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex bg-bg text-white">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileNav />
        {/* pb-24 deja lugar para la barra de navegación fija del teléfono. */}
        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8 max-w-[1400px]">
          {children}
        </main>
      </div>
    </div>
  );
}
