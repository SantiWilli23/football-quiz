import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function dismissedKey(groupId, weekStart) {
  return `fq_recap_dismissed_${groupId}_${weekStart}`;
}

// "Así fue tu semana": mismo dato que /season pero acotado a la semana en
// curso — se puede pedir cualquier día, no espera al domingo a la noche. Se
// puede cerrar y queda cerrada para esa semana puntual (vuelve a aparecer la
// semana siguiente).
export default function WeeklyRecap({ groupId }) {
  const { user } = useAuth();
  const [recap, setRecap] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    api
      .get("/stats/weekly-recap", { params: { groupId } })
      .then(({ data }) => {
        setRecap(data);
        try {
          setDismissed(localStorage.getItem(dismissedKey(groupId, data.weekStart)) === "1");
        } catch {
          setDismissed(false);
        }
      })
      .catch(() => setRecap(null));
  }, [groupId]);

  function dismiss() {
    try {
      if (recap) localStorage.setItem(dismissedKey(groupId, recap.weekStart), "1");
    } catch { /* noop */ }
    setDismissed(true);
  }

  if (!recap || dismissed || !recap.me || recap.me.points === 0) return null;

  const isTop = recap.top?.id === user?.id;

  return (
    <Card className="mb-6 relative border-accent/30">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
        aria-label="Cerrar"
      >
        <X size={15} />
      </button>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-accent" />
        <h3 className="font-semibold">Así va tu semana</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-2xl font-bold">{recap.me.points}</p>
          <p className="text-[11px] text-gray-500">puntos</p>
        </div>
        <div>
          <p className="text-2xl font-bold">#{recap.myPosition}</p>
          <p className="text-[11px] text-gray-500">en el grupo</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{recap.me.accuracy}%</p>
          <p className="text-[11px] text-gray-500">de aciertos</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {isTop
          ? "Vas primero esta semana. 🔥"
          : recap.top
          ? `${recap.top.username} va primero con ${recap.top.points} puntos.`
          : "Todavía nadie sumó puntos esta semana."}
      </p>
    </Card>
  );
}
