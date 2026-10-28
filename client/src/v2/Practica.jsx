import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import MiniQuiz from "./MiniQuiz.jsx";

// Partido de práctica de la portada: 6 preguntas, sin registro, sin puntos. Al final
// «Sacaste X. Guárdalo.» lleva al registro corto.
export default function Practica() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [score, setScore] = useState(null);

  useEffect(() => {
    api.get("/public/practice").then((r) => setItems(r.data.items)).catch(() => setError("No se pudo cargar la práctica. Prueba de nuevo en un rato."));
  }, []);
  const onFinish = useCallback((hits) => setScore(hits), []);

  if (error) return <Layout focus exitTo="/"><p className="text-sm text-red-400">{error}</p></Layout>;
  if (!items) return <Layout focus exitTo="/"><p className="text-sm text-gray-500">Armando el partido…</p></Layout>;

  if (score !== null) {
    const total = items.length;
    return (
      <Layout focus exitTo="/">
        <div className="mx-auto max-w-md space-y-4 pt-6 text-center">
          <Card variant="feature">
            <p className="t-eyebrow">Fin de la práctica</p>
            <p className="mt-1 text-6xl font-extrabold tabular-nums">{score}<span className="text-2xl text-gray-400">/{total}</span></p>
            <p className="mt-2 text-lg font-semibold">Sacaste {score}. Guárdalo.</p>
            <p className="mt-1 text-sm text-gray-400">Crea tu cuenta en un minuto y juega el partido del día con tu grupo.</p>
          </Card>
          <Link to={`/registro?practica=${score}`} className="btn btn-primary w-full">Guardar y crear mi cuenta</Link>
          <Link to="/login" className="block text-xs text-gray-500 hover:text-white">Ya tengo cuenta</Link>
        </div>
      </Layout>
    );
  }

  return <MiniQuiz title="Partido de práctica" items={items} exitTo="/" onFinish={onFinish} hint={{ id: "practica", text: "Toca tu respuesta" }} />;
}
