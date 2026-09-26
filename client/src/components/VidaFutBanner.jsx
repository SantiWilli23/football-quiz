import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { isVidaFut } from "../utils/vidaFut.js";

// Aviso arriba de Carrera DT / Presidente cuando la partida es la de Vida FUT
// (guardado aparte), para que no se confunda con una partida suelta.
export default function VidaFutBanner() {
  if (!isVidaFut()) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-card border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5 text-accent font-medium">
        <Sparkles size={13} /> Partida de Vida FUT — se guarda aparte de tus partidas sueltas
      </span>
      <Link to="/vida-fut" className="text-gray-300 hover:text-white shrink-0">Volver a Vida FUT ›</Link>
    </div>
  );
}
