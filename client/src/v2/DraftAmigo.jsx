import { useEffect } from "react";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

// El 8a2 contra un amigo (dos en un teléfono o en línea) sigue siendo el juego de siempre: se abre
// en su página clásica hasta que se reescriba con el mismo servidor.
export default function DraftAmigo() {
  useEffect(() => { window.location.replace("/draft-europeo.html?legacy=1"); }, []);
  return <Layout><Card><p className="text-sm text-gray-400">Abriendo el 8a2 contra un amigo…</p></Card></Layout>;
}
