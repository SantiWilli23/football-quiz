import { useState } from "react";
import { Link } from "react-router-dom";

// Se muestra una sola vez por usuario (ver flag en localStorage, Dashboard.jsx).
// Pasos: qué es un grupo → qué hay en cada sección → «¿qué querés jugar hoy?»,
// cuya respuesta manda a la sección que mejor le calza y la deja destacada
// arriba en el panel. Después, cada pantalla tiene su botón «?» con la ayuda.
const STEPS = [
  {
    title: "¡Bienvenido a Futotal!",
    body: "Trivia y juegos de fútbol para jugar con tus amigos. Te mostramos en un minuto cómo funciona todo.",
  },
  {
    title: "Primero, los grupos",
    body: "Un grupo es tu pandilla. Todo lo que jugás suma puntos a un ranking semanal que se reinicia cada lunes.",
    points: [
      "Creás un grupo o entrás con un código de invitación.",
      "Los juegos suman un puntaje semanal según esfuerzo y tiempo.",
      "Hay Copa semanal, retos por juego y, con 10 o más miembros, una Liga del grupo opcional con dos divisiones.",
    ],
  },
  {
    title: "Qué hay en cada sección",
    points: [
      "Inicio: tu pizarra del día.",
      "Trivia: la diaria y las especiales.",
      "Juegos: todo el catálogo — solo, con amigos, contrarreloj y carreras largas.",
      "En vivo: partidos y tablas reales.",
      "Mi grupo: ranking, retos, copa y liga de tus amigos.",
      "Perfil: avatar, vitrina de logros y ajustes.",
      "Cada pantalla tiene un botón «?» con las reglas.",
    ],
  },
];

const OPTIONS = [
  { label: "Algo rápido", hint: "Trivia, Un Minuto, Fichado", to: "/trivia", favorites: ["/trivia", "/juegos"] },
  { label: "Contra amigos", hint: "Duelos, grupo y retos semanales", to: "/grupo", favorites: ["/grupo", "/trivia"] },
  { label: "Una carrera larga", hint: "Modo DT, Presidente, Cotrero", to: "/juegos", favorites: ["/juegos", "/vida-fut"] },
];

export default function TutorialModal({ onDone }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length;
  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-panel border border-border rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {!last ? (
          <>
            <h2 className="text-lg font-bold mb-2">{s.title}</h2>
            {s.body && <p className="text-sm text-gray-400 mb-4">{s.body}</p>}
            {s.points && (
              <ul className="space-y-2 text-sm text-gray-300 mb-5">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2"><span className="text-accent shrink-0">•</span><span>{p}</span></li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between">
              <button onClick={() => onDone([])} className="text-xs text-gray-500 hover:text-white transition-colors">Saltear</button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 tabular-nums">{step + 1}/{STEPS.length + 1}</span>
                {step > 0 && <button onClick={() => setStep(step - 1)} className="btn btn-secondary btn-sm">Atrás</button>}
                <button onClick={() => setStep(step + 1)} className="btn btn-primary btn-sm">Siguiente</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-1">¿Qué querés jugar hoy?</h2>
            <p className="text-sm text-gray-400 mb-5">Elegí y te llevamos.</p>
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
            <div className="flex items-center justify-between">
              <button onClick={() => onDone([])} className="text-xs text-gray-500 hover:text-white transition-colors">Saltear</button>
              <button onClick={() => setStep(step - 1)} className="btn btn-secondary btn-sm">Atrás</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
