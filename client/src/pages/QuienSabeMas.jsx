import { Link } from "react-router-dom";
import { Brain, Link2, Radio, Zap, Swords } from "lucide-react";
import Layout from "../components/Layout.jsx";

// Antes Duelos, Mentiroso, Equipo-Jugador y ¿Quién es? eran 4 entradas
// sueltas en el catálogo de Juegos, todas variaciones de la misma pregunta
// ("¿quién sabe más de fútbol?"). Ahora son una sola entrada que lleva acá,
// y de acá se elige cuál de las cuatro se quiere jugar.
const MODES = [
  {
    to: "/duelos",
    label: "Duelos",
    icon: Swords,
    description: "Uno contra uno con las preguntas más difíciles del grupo.",
  },
  {
    href: "/mentiroso.html",
    label: "Mentiroso",
    icon: Zap,
    description: "Duelo 1 contra 1: ¿sabés más jugadores que el otro antes de que se te acaben?",
  },
  {
    to: "/equipo-jugador",
    label: "Equipo-Jugador",
    icon: Link2,
    description: "Cadena de conexiones futbolísticas: jugador → equipo → jugador. El que falla, queda eliminado.",
  },
  {
    to: "/quien-es-vivo",
    label: "¿Quién es? en vivo",
    icon: Radio,
    description: "Uno contra uno con las mismas pistas en tiempo real: gana quien adivine primero.",
  },
];

export default function QuienSabeMas() {
  return (
    <Layout>
      <div className="mb-8 flex items-center gap-3">
        <Brain size={22} className="text-accent shrink-0" />
        <div>
          <h1 className="t-title mb-1">¿Quién sabe más de fútbol?</h1>
          <p className="text-gray-400 text-sm">Elegí con qué modo querés medirte hoy.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODES.map(({ to, href, label, icon: Icon, description }) => {
          const inner = (
            <>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border bg-amber-500/15 text-amber-500 border-amber-500/30">
                <Icon size={21} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm mb-0.5">{label}</p>
                <p className="text-xs text-gray-500 leading-snug">{description}</p>
              </div>
            </>
          );
          const className = "flex items-center gap-4 px-4 py-4 rounded-2xl border border-border bg-panel hover:border-white/20 hover:bg-white/5 transition-colors";
          return to ? (
            <Link key={label} to={to} className={className}>{inner}</Link>
          ) : (
            <a key={label} href={href} className={className}>{inner}</a>
          );
        })}
      </div>
    </Layout>
  );
}
