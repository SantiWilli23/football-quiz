import { useEffect, useState } from "react";
import { Award, Lock } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { FRAMES, FRAME_REQUIREMENTS, frameStyle } from "./Avatar.jsx";

const FRAME_LABELS = { ninguno: "Ninguno", bronce: "Bronce", plata: "Plata", oro: "Oro", fuego: "Fuego", leyenda: "Leyenda" };

// Una sola vitrina para lo que se gana: los logros (con su progreso) y los
// marcos de avatar que esos logros desbloquean. Antes vivían en dos lugares
// distintos (Estadísticas y el editor del avatar).
export default function Vitrina() {
  const { activeGroupId } = useGroups();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get("/stats/achievements", { params: activeGroupId ? { groupId: activeGroupId } : {} })
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ achievements: [], unlocked_count: 0, total: 0 }));
  }, [activeGroupId]);

  if (!data) return null;
  const unlocked = data.unlocked_count || 0;
  const frames = FRAMES.filter((f) => f !== "ninguno");

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Award size={16} className="text-accent" />
        <h2 className="font-semibold flex-1">Vitrina</h2>
        <span className="text-xs text-gray-500">{unlocked} de {data.total} logros</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Lo desbloqueado brilla; lo que falta se ve apagado con su progreso.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {(data.achievements || []).map((a) => (
          <div
            key={a.id}
            title={a.description}
            className={`rounded-lg border px-3 py-2.5 ${a.unlocked ? "border-accent/40 bg-accent/5" : "border-border opacity-60"}`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-lg ${a.unlocked ? "" : "grayscale"}`}>{a.emoji}</span>
              <span className={`text-xs font-semibold leading-tight ${a.unlocked ? "text-accent" : "text-gray-400"}`}>{a.title}</span>
            </div>
            {!a.unlocked && (
              <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gray-500" style={{ width: `${a.progress}%` }} />
              </div>
            )}
          </div>
        ))}

        {frames.map((f) => {
          const need = FRAME_REQUIREMENTS[f];
          const ok = unlocked >= need;
          return (
            <div key={f} className={`rounded-lg border px-3 py-2.5 flex items-center gap-2.5 ${ok ? "border-accent/40 bg-accent/5" : "border-border opacity-60"}`}>
              <span className="w-6 h-6 rounded-full bg-white/10 shrink-0" style={ok ? frameStyle(f) || {} : {}} />
              <span className="text-xs font-semibold leading-tight">
                Marco {FRAME_LABELS[f]}
                {!ok && <span className="flex items-center gap-1 text-gray-500 font-normal mt-0.5"><Lock size={10} /> {need} logros</span>}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
