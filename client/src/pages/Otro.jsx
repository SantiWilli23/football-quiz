import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Layout from "../components/Layout.jsx";

// «Otro»: página aparte (desde Ajustes) para extras que no son parte de los juegos de siempre.
export default function Otro() {
  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/perfil" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-3"><ArrowLeft size={16} /> Ajustes</Link>
        <h1 className="text-xl font-bold mb-4">Otro</h1>
        <p className="text-sm text-gray-400">Todavía no hay nada aquí. La Alquimia ahora está en Juegos.</p>
      </div>
    </Layout>
  );
}
