import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Flame } from "lucide-react";
import api from "../api.js";

// Pantalla -> juego del historial. Solo estos juegos muestran la racha de plenos.
const GAME_OF_PATH = {
  "/escudos": "escudos",
  "/arbitraje-var": "arbitraje_var",
  "/un-minuto": "un_minuto",
  "/bingo": "tateti",
  "/piramide": "piramide",
  "/torta": "torta",
  "/traspasos": "traspasos",
  "/a-quien-me-compro": "a_quien_me_compro",
  "/fulbodle": "fichado",
};

// Racha de plenos del juego (partidas seguidas con el rendimiento máximo). Aparece al
// entrar a cada juego, apenas hay una racha en marcha.
export default function PlenoStreak() {
  const { pathname } = useLocation();
  const game = GAME_OF_PATH[pathname];
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(0);
    if (!game) return;
    let alive = true;
    api.get("/game-history/streak", { params: { game } }).then((r) => alive && setStreak(Number(r.data.streak) || 0)).catch(() => {});
    return () => { alive = false; };
  }, [game]);

  if (!game || streak < 1) return null;
  return (
    <p className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-500 text-xs font-semibold" title="Plenos seguidos en este juego">
      <Flame size={14} /> Racha de plenos: {streak}
    </p>
  );
}
