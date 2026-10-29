import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

// Partidos pasados: se juegan para practicar, sin puntos ni sobre.
export default function Archivo() {
  const [days, setDays] = useState(null);
  useEffect(() => {
    api.get("/daily/archive").then((r) => setDays(r.data.days)).catch(() => setDays([]));
  }, []);

  return (
    <Layout>
      <div className="max-w-md mx-auto space-y-4 desk:max-w-none">
        <div>
          <p className="t-eyebrow flex items-center gap-1.5"><CalendarDays size={13} /> Archivo</p>
          <h1 className="t-title">Partidos pasados</h1>
          <p className="text-sm text-gray-400">Sirven para practicar: no suman puntos ni sobres.</p>
        </div>
        <Card>
          {days === null && <p className="text-sm text-gray-500">Cargando…</p>}
          {days && days.length === 0 && <p className="text-sm text-gray-500">Todavía no hay partidos pasados.</p>}
          {/* En computador, una cuadrícula de tarjetas en vez de la lista. */}
          <ul className="divide-y divide-border desk:divide-y-0 desk:grid desk:grid-cols-3 desk:gap-2">
            {(days || []).map((d) => (
              <li key={d.date} className="flex items-center justify-between py-2.5 text-sm desk:rounded-xl desk:border desk:border-border desk:px-3">
                <span className="tabular-nums">{d.date}</span>
                <span className="flex items-center gap-3">
                  {d.played && <span className="text-xs text-gray-500">Lo jugaste</span>}
                  <Link to={`/partido/${d.date}`} className="btn btn-secondary btn-sm">Practicar</Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Layout>
  );
}
