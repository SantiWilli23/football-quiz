import Sidebar from "./Sidebar.jsx";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex bg-bg text-white">
      <Sidebar />
      <main className="flex-1 px-8 py-8 max-w-[1400px]">{children}</main>
    </div>
  );
}
