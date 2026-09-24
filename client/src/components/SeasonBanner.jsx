import { Sparkles } from "lucide-react";
import { useSeasonSkin } from "../hooks/useSeasonSkin.js";

// Solo se muestra durante una ventana real del calendario futbolero (ver
// useSeasonSkin) — el resto del año no renderiza nada, no hay que
// desactivarlo a mano.
export default function SeasonBanner() {
  const season = useSeasonSkin();
  if (!season) return null;

  return (
    <div className="mb-6 flex items-center gap-2.5 px-4 py-2.5 rounded-card border border-amber-500/30 bg-amber-500/10 text-amber-500 text-sm">
      <Sparkles size={15} className="shrink-0" />
      <span className="font-medium">{season.label}</span>
      <span className="text-amber-500/70">· la app está de fiesta hasta que termine</span>
    </div>
  );
}
