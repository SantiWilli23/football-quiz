import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Gift, ListOrdered, Lock } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import Avatar from "./Avatar.jsx";
import Sparkline from "./Sparkline.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Liga del grupo: antes era una pantalla propia en el catálogo de Juegos,
// ahora vive acá porque es una función DEL GRUPO (como Cartas), no un juego
// suelto. Opt-in, con un mínimo de gente porque dos divisiones necesitan
// bastante grupo para tener sentido: menos de 10 y una de las dos queda
// vacía o con dos personas jugándose la vida solas.
const MIN_MEMBERS = 10;

export default function GroupLeague({ groupId, isCreator }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(undefined);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setData(undefined);
    api.get(`/group-league/${groupId}`).then((r) => setData(r.data)).catch(() => setData(null));
  };

  useEffect(() => { if (groupId) load(); }, [groupId]);

  async function toggleLeague(enable) {
    setBusy(true);
    try {
      await api.post(`/groups/${groupId}/league/toggle`, { enable });
      toast(enable ? "Liga del grupo activada" : "Liga del grupo desactivada");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo cambiar la liga");
    } finally {
      setBusy(false);
    }
  }

  async function togglePacks(packsEnabled) {
    setBusy(true);
    try {
      await api.post(`/groups/${groupId}/league/toggle`, { packsEnabled });
      toast(packsEnabled ? "Vas a repartir sobres al cerrar la temporada" : "Sobres de cierre desactivados");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo cambiar el reparto de sobres");
    } finally {
      setBusy(false);
    }
  }

  if (data === undefined) return <Card><p className="text-sm text-gray-500">Cargando liga del grupo...</p></Card>;
  if (data === null) return null;

  if (!data.enabled) {
    const missing = Math.max(0, MIN_MEMBERS - data.memberCount);
    return (
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <ListOrdered size={15} className="text-accent" />
          <h3 className="font-semibold">Liga del grupo</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Temporada trimestral con dos divisiones (Primera y Segunda): todos los juegos suman a una misma tabla, cada semana es
          una fecha, y al cerrar el trimestre suben los 2 mejores de Segunda y bajan los 2 peores de Primera.
        </p>
        {isCreator ? (
          missing > 0 ? (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Lock size={12} /> Hacen falta {MIN_MEMBERS} miembros para activarla (hoy son {data.memberCount}).
            </p>
          ) : (
            <button onClick={() => toggleLeague(true)} disabled={busy} className="px-4 py-2 rounded-card bg-accent text-onaccent text-xs font-semibold disabled:opacity-40">
              Activar liga del grupo
            </button>
          )
        ) : (
          <p className="text-xs text-gray-500">Solo quien creó el grupo puede activarla — hacen falta {MIN_MEMBERS} miembros (hoy son {data.memberCount}).</p>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <ListOrdered size={15} className="text-accent" />
          <h3 className="font-semibold">Liga del grupo</h3>
        </div>
        {isCreator && (
          <button onClick={() => toggleLeague(false)} disabled={busy} className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40">
            Desactivar
          </button>
        )}
      </div>
      <p className="t-meta mb-3">{data.season} · fecha {data.matchday} ({data.week.from} a {data.week.to}) · cierra {data.seasonEnds}</p>

      {isCreator && (
        <label className="flex items-center gap-2 mb-4 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={data.packsEnabled} disabled={busy} onChange={(e) => togglePacks(e.target.checked)} className="accent-accent" />
          <Gift size={13} className={data.packsEnabled ? "text-accent" : "text-gray-500"} />
          Repartir sobres de Cartas según posición y división al cerrar la temporada
        </label>
      )}

      <div className="space-y-4">
        {data.divisions.map((d) => (
          <div key={d.name}>
            <h4 className="text-sm font-semibold mb-2">{d.name}</h4>
            <div className="space-y-1.5">
              {d.rows.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-card border ${r.id === (data.me ?? user?.id) ? "border-accent/40 bg-accent/5" : "border-border"}`}
                >
                  <span className="w-5 text-xs text-gray-500 tabular-nums">{i + 1}</span>
                  <Avatar user={r} size={26} />
                  <span className="text-sm font-medium flex-1 truncate">{r.username}</span>
                  {r.zone === "sube" && <span className="text-emerald-500 inline-flex items-center text-xs"><ArrowUp size={12} />Sube</span>}
                  {r.zone === "baja" && <span className="text-red-400 inline-flex items-center text-xs"><ArrowDown size={12} />Baja</span>}
                  <Sparkline values={r.weekSeries} className={`hidden sm:block shrink-0 ${r.zone === "sube" ? "text-emerald-500" : r.zone === "baja" ? "text-red-400" : "text-accent"}`} />
                  <span className="text-xs text-gray-500 tabular-nums w-16 text-right">+{r.weekPoints} sem.</span>
                  <span className="text-sm font-semibold tabular-nums w-14 text-right">{r.seasonPoints}</span>
                </div>
              ))}
              {d.rows.length === 0 && <p className="text-xs text-gray-600">Sin miembros en esta división.</p>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
