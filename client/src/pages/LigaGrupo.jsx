import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import Avatar from "../components/Avatar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import Sparkline from "../components/Sparkline.jsx";
import { useGroups } from "../context/GroupContext.jsx";

// Liga del grupo: temporada trimestral con una fecha por semana y divisiones.
export default function LigaGrupo() {
  const { activeGroupId: groupId } = useGroups();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!groupId) { setData(null); return; }
    setData(undefined);
    api.get(`/group-league/${groupId}`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [groupId]);

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="t-title mb-1">Liga del grupo</h1>
          <p className="text-gray-400 text-sm">
            Todos los juegos suman a una misma tabla. Cada semana es una fecha; arriba se sube de división y abajo se baja.
          </p>
        </div>
        <GroupSelector />
      </div>

      {!groupId && <Card><EmptyState icon={Trophy} title="Elegí un grupo" hint="La liga se juega entre los miembros de tu grupo." actions={[{ label: "Ir a Mi grupo", to: "/grupo" }]} /></Card>}
      {groupId && data === undefined && <Card><SkeletonRows rows={6} /></Card>}
      {groupId && data === null && <Card><EmptyState icon={Trophy} title="No se pudo cargar la liga" hint="Probá de nuevo en un rato." /></Card>}

      {data && (
        <>
          <p className="t-meta mb-4">{data.season} · fecha {data.matchday} ({data.week.from} a {data.week.to})</p>
          <div className="space-y-4">
            {data.divisions.map((d) => (
              <Card key={d.name}>
                <h2 className="t-heading mb-3">{d.name} división</h2>
                <div className="space-y-2">
                  {d.rows.map((r, i) => (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-card border ${r.id === data.me ? "border-accent/40 bg-accent/5" : "border-border"}`}
                    >
                      <span className="w-6 text-sm text-gray-500 tabular-nums">{i + 1}</span>
                      <Avatar user={r} size={28} />
                      <span className="text-sm font-medium flex-1 truncate">{r.username}</span>
                      {r.zone === "sube" && <span className="text-emerald-500 inline-flex items-center text-xs"><ArrowUp size={13} />Sube</span>}
                      {r.zone === "baja" && <span className="text-red-400 inline-flex items-center text-xs"><ArrowDown size={13} />Baja</span>}
                      <Sparkline values={r.weekSeries} className={`hidden sm:block shrink-0 ${r.zone === "sube" ? "text-emerald-500" : r.zone === "baja" ? "text-red-400" : "text-accent"}`} />
                      <span className="text-xs text-gray-500 tabular-nums w-20 text-right">+{r.weekPoints} sem.</span>
                      <span className="text-sm font-semibold tabular-nums w-16 text-right">{r.seasonPoints}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          {data.divisions.length === 0 && <Card><EmptyState icon={Trophy} title="Todavía no hay puntos" hint="Cuando el grupo juegue, aparece la tabla." actions={[{ label: "Jugar trivia", to: "/trivia" }]} /></Card>}
        </>
      )}
    </Layout>
  );
}
