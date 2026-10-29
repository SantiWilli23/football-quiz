import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Building2, Crown, Gavel, Grid3x3, Shield, Star, Swords, Timer, Trophy, User, Users } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import useFutotal2 from "./useFutotal2.js";
import { useClubs } from "./useClubs.js";
import { fusedPath } from "./fusion.js";
import { useDemo } from "../demo/version.js";

// Jugar (Futotal 2.0): de ~35 entradas a 12 juegos, en tres filas deslizables como en el
// prototipo. Cada juego fusionado abre su carcasa /jugar/<juego>; si todavía no está abierto
// (FUTOTAL2_JUEGOS), la tarjeta lleva a la pantalla de siempre.
const GAMES = [
  { id: "quien_es", label: "¿Quién es?", icon: User, color: "#2fb673", min: 3, solo: true, sec: "arcade", old: "/fulbodle", desc: "Adivina al futbolista por su parecido o por su carrera.", replaces: "Fichado y ¿Quién es?" },
  { id: "que_club", label: "¿Qué club?", icon: Shield, color: "#4aa8e8", min: 3, solo: true, sec: "arcade", old: "/escudos", desc: "Un escudo borroso o las nacionalidades de un plantel.", replaces: "Escudos y Torta de plantel" },
  { id: "mas_o_menos", label: "Más o menos", icon: ArrowUpDown, color: "#f2b84b", min: 3, solo: true, sec: "arcade", old: "/a-quien-me-compro", desc: "¿Quién vale más? Ordena o apuesta por uno.", replaces: "Pirámide y ¿A quién me compro?" },
  { id: "trivia", label: "Trivia", icon: Timer, color: "#8e7dff", min: 2, solo: true, sec: "arcade", old: "/un-minuto", desc: "Preguntas contra el reloj o hasta que falles.", replaces: "Un Minuto y Supervivencia" },
  { id: "var", label: "VAR", icon: Gavel, color: "#ef5b5b", min: 3, solo: true, sec: "arcade", old: "/arbitraje-var", desc: "Mira la jugada y decide como árbitro.", replaces: "Arbitraje y Votación del VAR" },
  { id: "bingo", label: "Bingo", icon: Grid3x3, color: "#3cd6c4", min: 5, solo: true, sec: "arcade", old: "/bingo", desc: "Completa el tablero con jugadores que pasaron por cada club.", replaces: "Bingo y Tatetí" },
  { id: "versus", label: "Versus", icon: Swords, color: "#f27aa8", min: 5, solo: false, sec: "amigos", to: "/versus", desc: "Una ruleta elige el modo y juegas contra alguien de tu club.", replaces: "Duelos, Mentiroso, Equipo-Jugador, ¿Quién es? en vivo" },
  { id: "draft", label: "Draft", icon: Star, color: "#2fb673", min: 10, solo: false, sec: "amigos", old: "/copa-8a2", desc: "Arma tu once por rondas: solo, en copa, en subasta o contra un amigo.", replaces: "8a2, Copa 8a2 y Subasta" },
  { id: "dtonline", label: "DT Online", icon: Trophy, color: "#f2b84b", min: 60, solo: false, sec: "amigos", to: "/dt-liga", desc: "Una liga de verdad con tus amigos, jornada a jornada.", replaces: "" },
  { id: "dt", label: "Modo DT", icon: Users, color: "#4aa8e8", min: 60, solo: true, sec: "carrera", to: "/carrera-dt", desc: "Dirige un club: tácticas, fichajes y partidos.", replaces: "" },
  { id: "presidente", label: "Presidente", icon: Building2, color: "#c9a9e8", min: 30, solo: true, sec: "carrera", to: "/presidente", desc: "Decisiones, prensa y la presión de la directiva.", replaces: "" },
  { id: "cotrero", label: "Cotrero", icon: Crown, color: "#f2b84b", min: 15, solo: true, sec: "carrera", old: "/cotrero.html", desc: "De potrero a leyenda. Eliges la dificultad: simple o media.", replaces: "Cotrero simple y Cotrero medio" },
];
const SECS = [["arcade", "Arcade", "Rápido y solo"], ["amigos", "Con amigos", "Versus, Draft y ligas"], ["carrera", "Carrera", "Partidas largas"]];

function pathOf(g, open) {
  if (g.to) return { to: g.to };
  if (open.includes(g.id)) return { to: fusedPath(g.id, g.variant) };
  return g.old.endsWith(".html") ? { href: g.old } : { to: g.old };
}

function GameCard({ g, open, big = false }) {
  const Icon = g.icon;
  const dest = pathOf(g, open);
  const inner = (
    <>
      <span className="gi"><Icon size={big ? 30 : 24} /></span>
      <b>{g.label}</b>
      <span className="desc">{g.desc}</span>
      <small>{g.min >= 60 ? `${g.min / 60} h` : `${g.min} min`} · {g.solo ? "solo" : "con amigos"}</small>
      {big && g.replaces && <small style={{ color: "var(--dim)" }}>Reúne: {g.replaces}</small>}
    </>
  );
  const props = { className: `p-gc ${big ? "big" : ""}`, style: { "--gc": g.color }, title: g.replaces ? `Reúne: ${g.replaces}` : g.label };
  return dest.href ? <a href={dest.href} {...props}>{inner}</a> : <Link to={dest.to} {...props}>{inner}</Link>;
}

// «Para ti»: tres tarjetas que cambian cada día, para no decidir con la lista entera.
function forYou() {
  const day = Math.floor(Date.now() / 86400000);
  const arcade = GAMES.filter((g) => g.sec === "arcade");
  const social = GAMES.filter((g) => g.sec === "amigos");
  const career = GAMES.filter((g) => g.sec === "carrera");
  return [arcade[day % arcade.length], arcade[(day + 2) % arcade.length], day % 2 ? social[day % social.length] : career[day % career.length]];
}

export default function Jugar() {
  const demo = useDemo();
  const { games: open = [] } = useFutotal2();
  const { main } = useClubs();
  const [free, setFree] = useState(null);
  useEffect(() => { api.get("/clubs/me/free").then((r) => setFree(r.data)).catch(() => setFree(null)); }, []);

  const total = main && main.mode === "total" && main.started;
  const cap = total
    ? <div className="p-cap">Partidas libres hoy <b>{free?.points ?? 0}/100</b><i style={{ width: `${free?.points ?? 0}%` }} /></div>
    : <div className="p-cap">{!main ? "Sin club no hay puntos ni sobres. Crea uno o únete." : !main.started ? "Pretemporada: aún no suman puntos ni sobres." : "Club Clásico: las partidas libres dan sobres, no puntos."}</div>;

  return (
    <Layout hub>
      <header className="p-dhead">
        <div><h1>Jugar</h1><p>12 juegos: los de antes viven dentro de cada uno como variantes.</p></div>
        <div style={{ minWidth: 320 }}>{cap}</div>
      </header>
      {!demo && (
      <section className="p-sect p-stg" style={{ "--i": 0, marginTop: 6 }}>
        <h3>Para ti</h3>
        <div className="p-hrow big">{forYou().map((g) => <GameCard key={g.label} g={g} open={open} big />)}</div>
      </section>
      )}
      <div className="p-stg p-only-phone" style={{ "--i": 1 }}>{cap}</div>
      {SECS.map(([k, label, sub], i) => (
        <section key={k} className="p-sect p-stg" style={{ "--i": i + 2 }}>
          <h3>{label}<small>{sub}</small></h3>
          {(() => {
            const list = GAMES.filter((g) => g.sec === k);
            // En computador: columnas según cuántos juegos hay (6 → 3×2, 4 → 4, 3 → 3).
            return <div className="p-hrow" style={{ "--cols": list.length <= 4 ? list.length : 3 }}>{list.map((g) => <GameCard key={g.label} g={g} open={open} />)}</div>;
          })()}
        </section>
      ))}
      <p className="text-xs p-dim text-center mt-5 p-only-phone">12 juegos. Los de antes siguen dentro de cada uno como variantes.</p>
    </Layout>
  );
}
