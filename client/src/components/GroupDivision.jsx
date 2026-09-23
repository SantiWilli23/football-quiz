import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Shield } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import Avatar from "./Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Liga mensual del grupo: divisiones de ~5 personas, con ascenso y descenso
// al cerrar el mes. Solo tiene sentido con el grupo grande — con pocos
// amigos no hay margen para separar en más de una división.
export default function GroupDivision({ groupId }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    setData(null);
    api.get("/stats/division", { params: { groupId } }).then((r) => setData(r.data)).catch(() => setData({ enabled: false }));
  }, [groupId]);

  if (!data) return <Card><p className="text-sm text-gray-500">Cargando...</p></Card>;

  if (!data.enabled) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Shield size={15} className="text-accent" />
          <h3 className="font-semibold">Liga del grupo</h3>
        </div>
        <p className="text-sm text-gray-400">
          Necesitás al menos {data.minSize} miembros para armar divisiones con ascensos y descensos.
          Por ahora son {data.memberCount ?? 0}.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-accent" />
          <h3 className="font-semibold">División {data.division}</h3>
        </div>
        <span className="text-xs text-gray-500">de {data.divisionCount}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Los primeros suben de división y los últimos bajan al cerrar el mes.
      </p>
      <div className="space-y-2">
        {data.ranking.map((r) => (
          <div
            key={r.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-card border ${
              r.id === user?.id ? "border-accent/40 bg-accent/5" : "border-border"
            }`}
          >
            <div className="w-6 text-center text-sm font-semibold text-gray-400">{r.position}°</div>
            <Avatar user={r} size={30} />
            <p className="flex-1 min-w-0 text-sm font-medium truncate">{r.username}</p>
            {r.promotes && (
              <span className="flex items-center gap-1 text-xs font-medium text-good shrink-0" title="Sube de división">
                <ArrowUp size={13} /> Sube
              </span>
            )}
            {r.relegates && (
              <span className="flex items-center gap-1 text-xs font-medium text-bad shrink-0" title="Baja de división">
                <ArrowDown size={13} /> Baja
              </span>
            )}
            <span className="text-sm font-semibold shrink-0">{r.points} pts</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
