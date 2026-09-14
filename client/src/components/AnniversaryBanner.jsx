import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import api from "../api.js";

// Solo se muestra el día exacto del aniversario del grupo (ver GET
// /groups/:id/anniversary) — el resto del año este componente no renderiza nada.
export default function AnniversaryBanner({ groupId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    api.get(`/groups/${groupId}/anniversary`).then(({ data }) => setData(data.anniversary)).catch(() => setData(null));
  }, [groupId]);

  if (!data) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber/30 bg-amber/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <PartyPopper size={18} className="text-amber" />
        <h2 className="font-bold text-amber">
          {data.years} {data.years === 1 ? "año" : "años"} de {data.groupName}
        </h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        {data.topScorer && (
          <div>
            <p className="text-gray-500 text-xs">Quién sumó más puntos</p>
            <p className="font-medium">{data.topScorer.username} — {data.topScorer.points} pts</p>
          </div>
        )}
        {data.longestStreak && (
          <div>
            <p className="text-gray-500 text-xs">Racha más larga (activa)</p>
            <p className="font-medium">{data.longestStreak.username} — {data.longestStreak.streak} días</p>
          </div>
        )}
        {data.closestDuel && (
          <div>
            <p className="text-gray-500 text-xs">Duelo más reñido</p>
            <p className="font-medium">{data.closestDuel.a} {data.closestDuel.scoreA}-{data.closestDuel.scoreB} {data.closestDuel.b}</p>
          </div>
        )}
      </div>
    </div>
  );
}
