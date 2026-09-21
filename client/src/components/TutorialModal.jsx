import { Link } from "react-router-dom";

// Se muestra una sola vez por usuario (ver flag en localStorage, Dashboard.jsx).
// Una sola pregunta — «¿qué querés jugar hoy?» — en vez de elegir tres
// favoritos entre siete secciones sin contexto. La respuesta manda a
// la sección que mejor le calza y esa queda destacada arriba en el panel.
const OPTIONS = [
  { label: "Algo rápido", hint: "Trivia, Un Minuto, Fichado", to: "/trivia", favorites: ["/trivia", "/juegos"] },
  { label: "Contra amigos", hint: "Duelos, grupo y retos semanales", to: "/grupo", favorites: ["/grupo", "/trivia"] },
  { label: "Una carrera larga", hint: "Modo DT, Presidente, Cotrero", to: "/juegos", favorites: ["/juegos", "/vida-fut"] },
];

export default function TutorialModal({ onDone }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-panel border border-border rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-lg font-bold mb-1">¡Bienvenido a Futotal!</h2>
        <p className="text-sm text-gray-400 mb-5">¿Qué querés jugar hoy? Elegí y te llevamos.</p>

        <div className="space-y-2 mb-5">
          {OPTIONS.map((o, i) => (
            <Link
              key={o.label}
              to={o.to}
              onClick={() => onDone(o.favorites)}
              className={`btn h-auto py-3 w-full justify-between ${i === 0 ? "btn-primary" : "btn-secondary"}`}
            >
              <span>{o.label}</span>
              <span className="text-xs font-normal opacity-80">{o.hint}</span>
            </Link>
          ))}
        </div>

        <button onClick={() => onDone([])} className="text-xs text-gray-500 hover:text-white transition-colors">
          Saltear
        </button>
      </div>
    </div>
  );
}
