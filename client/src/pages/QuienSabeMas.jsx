import { Link } from "react-router-dom";
import { Brain, Gavel, Hash, Link2, Radio, Skull, Zap, Swords } from "lucide-react";
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
    to: "/quien-es",
    label: "¿Quién es?",
    icon: Radio,
    description: "Su carrera club por club, con años: adivinalo solo con las menos pistas, o en vivo 1 contra 1 con las mismas pistas para los dos.",
  },
  {
    to: "/var-votacion",
    label: "Votación del VAR",
    icon: Gavel,
    description: "Una jugada polémica por día: votá qué cobrarías y mirá cómo votó el grupo antes de ver el fallo real.",
  },
  {
    to: "/dorsal-historico",
    label: "Dorsal histórico",
    icon: Hash,
    description: "Online, quién dice más: un club y un número, 60 segundos para nombrar a todos los que lo usaron.",
  },
  {
    to: "/subasta",
    label: "Subasta · Draft",
    icon: Gavel,
    description: "Con 2, 4 u 8 amigos: 1000 M cada uno para armar su once pujando por jugadores en silueta negra. Al final, una copa con los equipos armados.",
  },
  {
    to: "/supervivencia",
    label: "Supervivencia",
    icon: Skull,
    description: "Trivia sin margen de error: una vida, a ver hasta dónde llegás.",
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
