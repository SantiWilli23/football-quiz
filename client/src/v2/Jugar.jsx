import { Link } from "react-router-dom";
import { Brain, Building2, Crown, Gavel, Grid3x3, Shield, ShieldCheck, Star, Swords, Timer, Users, Wallet, Target, Play } from "lucide-react";
import Layout from "../components/Layout.jsx";

// Jugar (Futotal 2.0): los juegos en tres filas. Cada entrada reúne a los juegos
// parecidos de antes (`variants`); entrar a uno abre su mejor versión y desde ahí se
// llega a las demás, así no se pierde ninguno mientras se terminan de fusionar.
const SECTIONS = [
  {
    key: "arcade", title: "Arcade", text: "Partidas cortas, solo, en cualquier momento.",
    games: [
      { to: "/fulbodle", label: "¿Quién es?", icon: Target, text: "Adiviná al futbolista por colores, carrera o traspasos.", variants: [["Fichado", "/fulbodle"], ["Traspasos a ciegas", "/traspasos"], ["¿Quién es? por carrera", "/quien-es"]] },
      { to: "/escudos", label: "¿Qué club?", icon: ShieldCheck, text: "Un escudo borroso o una torta de nacionalidades.", variants: [["Escudos a ciegas", "/escudos"], ["Torta de plantel", "/torta"]] },
      { to: "/a-quien-me-compro", label: "Más o menos", icon: Wallet, text: "¿Quién vale más? Ordená o comparate con tu rival.", variants: [["¿A quién me compro?", "/a-quien-me-compro"], ["Pirámide", "/piramide"]] },
      { to: "/un-minuto", label: "Trivia", icon: Timer, text: "Preguntas contra el reloj, o hasta que falles.", variants: [["Un Minuto", "/un-minuto"], ["Supervivencia", "/supervivencia"]] },
      { to: "/arbitraje-var", label: "VAR", icon: Gavel, text: "Mirá la jugada y decidí como árbitro.", variants: [["Arbitraje / VAR", "/arbitraje-var"], ["Votación del VAR", "/var-votacion"]] },
      { to: "/bingo", label: "Bingo", icon: Grid3x3, text: "Completá el tablero con jugadores que pasaron por el club.", variants: [] },
    ],
  },
  {
    key: "amigos", title: "Con amigos", text: "Para jugar contra gente de tu club.",
    games: [
      { to: "/versus", label: "Versus", icon: Swords, text: "Una ruleta elige el modo: Duelos, Equipo-Jugador, ¿Quién es? en vivo…", variants: [["Duelos", "/duelos"], ["Equipo-Jugador", "/equipo-jugador"], ["¿Quién es? en vivo", "/quien-es-vivo"], ["Dorsal histórico", "/dorsal-historico"]] },
      { to: "/copa-8a2", label: "Draft", icon: Star, text: "Armá tu once por rondas, solo o en copa.", variants: [["8a2 (solo)", "/draft-europeo.html"], ["Copa 8a2", "/copa-8a2"], ["Subasta", "/subasta"]] },
      { to: "/dt-liga", label: "DT Online", icon: Users, text: "Una liga de verdad con tus amigos, temporada a temporada.", variants: [] },
    ],
  },
  {
    key: "carrera", title: "Carrera", text: "Partidas largas, a tu ritmo.",
    games: [
      { to: "/carrera-dt", label: "Modo DT", icon: Shield, text: "Dirigí un club: tácticas, fichajes y partidos.", variants: [] },
      { to: "/presidente", label: "Presidente", icon: Building2, text: "Decisiones, prensa y la presión de la directiva.", variants: [] },
      { href: "/cotrero.html", label: "Cotrero simple", icon: Crown, text: "De potrero a leyenda, decisión por temporada.", variants: [] },
      { href: "/cotrero-medio.html", label: "Cotrero medio", icon: Brain, text: "Reputación, selección y un lugar en el salón de leyendas.", variants: [] },
    ],
  },
];

function Entry({ game }) {
  const Icon = game.icon;
  const inner = (
    <>
      <span className="w-10 h-10 shrink-0 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><Icon size={20} /></span>
      <span className="min-w-0">
        <span className="block font-semibold leading-tight">{game.label}</span>
        <span className="block text-xs text-gray-400 mt-0.5 leading-snug">{game.text}</span>
      </span>
    </>
  );
  const cls = "flex items-start gap-3 rounded-2xl border border-border bg-panel p-3 hover:border-accent/60 transition-colors";
  return (
    <div className="space-y-1">
      {game.href ? <a href={game.href} className={cls}>{inner}</a> : <Link to={game.to} className={cls}>{inner}</Link>}
      {game.variants.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {game.variants.map(([label, to]) => (
            to.endsWith(".html")
              ? <a key={label} href={to} className="text-[11px] rounded-full border border-border px-2 py-0.5 text-gray-400 hover:text-white">{label}</a>
              : <Link key={label} to={to} className="text-[11px] rounded-full border border-border px-2 py-0.5 text-gray-400 hover:text-white">{label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

// «Para ti»: tres tarjetas que cambian cada día, para no decidir con la lista entera.
function forYou() {
  const day = Math.floor(Date.now() / 86400000);
  const arcade = SECTIONS[0].games;
  const social = SECTIONS[1].games;
  return [
    { title: "El partido del día", text: "Tres partes, el mismo para todo tu club.", to: "/partido", accent: true },
    { title: arcade[day % arcade.length].label, text: arcade[day % arcade.length].text, to: arcade[day % arcade.length].to },
    { title: social[day % social.length].label, text: social[day % social.length].text, to: social[day % social.length].to },
  ];
}

export default function Jugar() {
  const picks = forYou();
  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-7">
        <div>
          <p className="t-eyebrow">Jugar</p>
          <h1 className="t-title">¿Qué jugamos?</h1>
        </div>

        <section aria-label="Para ti" className="grid gap-2 sm:grid-cols-3">
          {picks.map((p) => (
            <Link key={p.title} to={p.to} className={`rounded-2xl border p-4 ${p.accent ? "border-accent/50 bg-gradient-to-br from-accent/15 to-transparent" : "border-border bg-panel"} hover:border-accent/70 transition-colors`}>
              <p className="t-eyebrow flex items-center gap-1"><Play size={11} /> Para ti</p>
              <p className="font-semibold mt-1">{p.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{p.text}</p>
            </Link>
          ))}
        </section>

        {SECTIONS.map((s) => (
          <section key={s.key} aria-labelledby={`sec-${s.key}`}>
            <h2 id={`sec-${s.key}`} className="font-semibold">{s.title}</h2>
            <p className="text-xs text-gray-500 mb-2">{s.text}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {s.games.map((g) => <Entry key={g.label} game={g} />)}
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
}
