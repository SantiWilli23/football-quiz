import { Link } from "react-router-dom";
import { ArrowLeft, FlaskConical } from "lucide-react";
import Layout from "../components/Layout.jsx";

const ITEMS = [
  { to: "/otro/alquimia", icon: FlaskConical, titulo: "Alquimia de fútbol", texto: "Junta elementos y descubre cosas nuevas" },
];

// «Otro»: página aparte (desde Ajustes) para extras que no son parte de los juegos de siempre.
export default function Otro() {
  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/perfil" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-3"><ArrowLeft size={16} /> Ajustes</Link>
        <h1 className="text-xl font-bold mb-4">Otro</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {ITEMS.map(({ to, icon: Icon, titulo, texto }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-card border border-border p-4 hover:border-accent">
              <Icon size={22} className="text-accent shrink-0" />
              <span className="min-w-0"><b className="block">{titulo}</b><span className="text-xs text-gray-400">{texto}</span></span>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
