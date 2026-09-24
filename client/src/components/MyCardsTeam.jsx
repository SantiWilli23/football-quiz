import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";

// Clases literales para que Tailwind las genere (mismo criterio que Cartas.jsx).
const TIER_STYLE = {
  estrella: "border-purple-500/70 bg-purple-500/10 text-purple-400",
  oro: "border-amber-500/70 bg-amber-500/10 text-amber-500",
  plata: "border-gray-400/60 bg-gray-400/10 text-gray-300",
  bronce: "border-orange-700/60 bg-orange-700/10 text-orange-500",
};

// Vidriera de tu equipo de Cartas en la pantalla de Juegos — no hace falta
// entrar a Cartas para ver con qué equipo estás jugando. Si Cartas no está
// activado en ningún grupo (404) o todavía no armaste un once, no muestra
// nada (no tiene sentido un cartel vacío acá).
export default function MyCardsTeam() {
  const [players, setPlayers] = useState(null);
  const [strength, setStrength] = useState(null);

  useEffect(() => {
    api.get("/cards/lineup")
      .then(({ data }) => { setPlayers(data.players); setStrength(data.strength); })
      .catch(() => setPlayers(null));
  }, []);

  if (!players || players.length !== 11) return null;

  return (
    <Card className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-accent" />
          <p className="t-eyebrow">Tu equipo de Cartas</p>
        </div>
        <div className="flex items-center gap-3">
          {strength && <span className="text-xs text-gray-500">Fuerza {Math.round(strength.total)}</span>}
          <Link to="/cartas" className="text-xs text-gray-500 hover:text-white transition-colors">Ir a Cartas ›</Link>
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-11 gap-1.5">
        {players.map((p) => (
          <div key={p.name} className={`rounded-lg border px-1.5 py-2 text-center ${TIER_STYLE[p.tier]}`} title={p.realName || p.name}>
            <p className="text-sm font-bold tabular-nums leading-none">{p.ovr}</p>
            <p className="text-[9px] mt-1 truncate">{(p.realName || p.name).split(" ").pop()}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
