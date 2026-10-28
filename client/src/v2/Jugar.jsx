import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Building2, Crown, Gavel, Grid3x3, Shield, Sparkles, Star, Swords, Timer, Trophy, User, Users } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import useFutotal2 from "./useFutotal2.js";
import { useClubs } from "./useClubs.js";
import { fusedPath } from "./fusion.js";

// Jugar (Futotal 2.0): de ~35 entradas a 13 juegos, en tres filas deslizables como en el
// prototipo. Cada juego fusionado abre su carcasa /jugar/<juego>; si todavía no está abierto
// (FUTOTAL2_JUEGOS), la tarjeta lleva a la pantalla de siempre.
const GAMES = [
  { id: "quien_es", label: "¿Quién es?", icon: User, color: "#2fb673", min: 3, solo: true, sec: "arcade", old: "/fulbodle", replaces: "Fichado, ¿Quién es? y Traspasos" },
  { id: "que_club", label: "¿Qué club?", icon: Shield, color: "#4aa8e8", min: 3, solo: true, sec: "arcade", old: "/escudos", replaces: "Escudos y Torta de plantel" },
  { id: "mas_o_menos", label: "Más o menos", icon: ArrowUpDown, color: "#f2b84b", min: 3, solo: true, sec: "arcade", old: "/a-quien-me-compro", replaces: "Pirámide y ¿A quién me compro?" },
  { id: "trivia", label: "Trivia", icon: Timer, color: "#8e7dff", min: 2, solo: true, sec: "arcade", old: "/un-minuto", replaces: "Un Minuto y Supervivencia" },
  { id: "var", label: "VAR", icon: Gavel, color: "#ef5b5b", min: 3, solo: true, sec: "arcade", old: "/arbitraje-var", replaces: "Arbitraje y Votación del VAR" },
  { id: "bingo", label: "Bingo", icon: Grid3x3, color: "#3cd6c4", min: 5, solo: true, sec: "arcade", old: "/bingo", replaces: "Bingo y Tatetí" },
  { id: "versus", label: "Versus", icon: Swords, color: "#f27aa8", min: 5, solo: false, sec: "amigos", to: "/versus", replaces: "Duelos, Mentiroso, Equipo-Jugador, ¿Quién es? en vivo" },
  { id: "draft", label: "Draft", icon: Star, color: "#2fb673", min: 10, solo: false, sec: "amigos", old: "/copa-8a2", replaces: "8a2, Copa 8a2 y Subasta" },
  { id: "dtonline", label: "DT Online", icon: Trophy, color: "#f2b84b", min: 60, solo: false, sec: "amigos", to: "/dt-liga", replaces: "" },
  { id: "dt", label: "Modo DT", icon: Users, color: "#4aa8e8", min: 60, solo: true, sec: "carrera", to: "/carrera-dt", replaces: "" },
  { id: "presidente", label: "Presidente", icon: Building2, color: "#c9a9e8", min: 30, solo: true, sec: "carrera", to: "/presidente", replaces: "" },
  { id: "cotrero", variant: "simple", label: "Cotrero simple", icon: Crown, color: "#f2b84b", min: 15, solo: true, sec: "carrera", old: "/cotrero.html", replaces: "De potrero a leyenda" },
  { id: "cotrero", variant: "medio", label: "Cotrero medio", icon: Sparkles, color: "#ef5b5b", min: 25, solo: true, sec: "carrera", old: "/cotrero-medio.html", replaces: "Reputación y selección" },
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
  const { games: open = [] } = useFutotal2();
  const { main } = useClubs();
  const [free, setFree] = useState(null);
  useEffect(() => { api.get("/clubs/me/free").then((r) => setFree(r.data)).catch(() => setFree(null)); }, []);

  const total = main && main.mode === "total" && main.started;
  const cap = total
    ? <div className="p-cap">Partidas libres hoy <b>{free?.points ?? 0}/100</b><i style={{ width: `${free?.points ?? 0}%` }} /></div>
    : <div className="p-cap">{!main ? "Sin club no hay puntos ni sobres. Crea uno o únete." : !main.started ? "Pretemporada: aún no suman puntos ni sobres." : "Club Clásico: las partidas libres dan sobres, no puntos."}</div>;

  return (
    <Layout>
      <section className="p-sect p-stg" style={{ "--i": 0, marginTop: 6 }}>
        <h3>Para ti</h3>
        <div className="p-hrow">{forYou().map((g) => <GameCard key={g.label} g={g} open={open} big />)}</div>
      </section>
      <div className="p-stg" style={{ "--i": 1 }}>{cap}</div>
      {SECS.map(([k, label, sub], i) => (
        <section key={k} className="p-sect p-stg" style={{ "--i": i + 2 }}>
          <h3>{label}<small>{sub}</small></h3>
          <div className="p-hrow">{GAMES.filter((g) => g.sec === k).map((g) => <GameCard key={g.label} g={g} open={open} />)}</div>
        </section>
      ))}
      <p className="text-xs p-dim text-center mt-5">13 juegos. Los de antes siguen dentro de cada uno como variantes.</p>
    </Layout>
  );
}
