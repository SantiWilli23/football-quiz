import { useEffect, useState } from "react";
import { X, Flag, Ruler, Cake, MapPin, Shirt } from "lucide-react";
import api from "../api.js";

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-card border border-border bg-bg px-3 py-2.5 text-center">
      <p className={`text-2xl font-bold tabular-nums ${tone || ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
    </div>
  );
}

function Fact({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-300">
      <Icon size={13} className="text-gray-500" />
      {children}
    </span>
  );
}

function ClubBlock({ club }) {
  const span = club.from && club.to ? (club.from === club.to ? club.from : `${club.from}–${club.to}`) : "";
  return (
    <div className="rounded-card border border-border bg-bg p-3">
      <div className="flex items-center gap-3">
        <img src={club.logo} alt="" className="w-9 h-9 shrink-0 object-contain" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{club.name}</p>
          <p className="text-xs text-gray-500">{span}</p>
        </div>
        <div className="text-right text-xs tabular-nums shrink-0">
          <p><span className="font-bold text-emerald-500 text-base">{club.totals.goals}</span> goles</p>
          <p className="text-gray-400">{club.totals.assists} asist. · {club.totals.starts} tit.</p>
        </div>
      </div>
      {club.seasons.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="font-medium pb-1 pr-3">Temp.</th>
                <th className="font-medium pb-1 pr-3 text-right">Tit.</th>
                <th className="font-medium pb-1 pr-3 text-right">Goles</th>
                <th className="font-medium pb-1 pr-3 text-right">Asist.</th>
                <th className="font-medium pb-1 pr-3 text-right">Amar.</th>
                <th className="font-medium pb-1 text-right">Rojas</th>
              </tr>
            </thead>
            <tbody>
              {club.seasons.map((s, i) => (
                <tr key={`${s.year}-${i}`} className="border-t border-border/60">
                  <td className="py-1 pr-3">{s.year}</td>
                  <td className="py-1 pr-3 text-right">{s.starts}</td>
                  <td className="py-1 pr-3 text-right font-semibold">{s.goals}</td>
                  <td className="py-1 pr-3 text-right">{s.assists}</td>
                  <td className="py-1 pr-3 text-right text-amber-500">{s.yellow}</td>
                  <td className="py-1 text-right text-red-400">{s.red}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Ficha de carrera de un jugador: datos personales, totales y cada club con
// sus temporadas. Los datos vienen de ESPN (puede faltar alguna temporada).
export default function PlayerModal({ playerId, fallback, onClose }) {
  const [info, setInfo] = useState(undefined);

  useEffect(() => {
    let alive = true;
    setInfo(undefined);
    api.get(`/football/players/${playerId}`)
      .then((r) => alive && setInfo(r.data))
      .catch(() => alive && setInfo(null));
    return () => { alive = false; };
  }, [playerId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const name = info?.name || fallback?.name;
  const photo = info?.photo || fallback?.photo;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        className="bg-panel border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 p-5 border-b border-border" style={{ background: "linear-gradient(135deg, rgba(34,197,94,.14), rgba(59,130,246,.10))" }}>
          {photo && (
            <img src={photo} alt="" className="w-20 h-20 rounded-full object-cover bg-bg border border-border shrink-0" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold truncate">{name}</h2>
            {info && (
              <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-0.5 min-w-0">
                {info.team?.logo && <img src={info.team.logo} alt="" className="w-4 h-4 shrink-0" />}
                <span className="truncate">{[info.position, info.team?.name].filter(Boolean).join(" · ")}</span>
              </p>
            )}
            {info && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <Fact icon={Cake}>{info.birth ? `${info.birth}${info.age ? ` (${info.age} años)` : ""}` : info.age ? `${info.age} años` : null}</Fact>
                <Fact icon={Flag}>{info.nationality}</Fact>
                <Fact icon={MapPin}>{info.birthPlace}</Fact>
                <Fact icon={Ruler}>{[info.height, info.weight].filter(Boolean).join(" · ")}</Fact>
                <Fact icon={Shirt}>{info.jersey ? `Dorsal ${info.jersey}` : null}</Fact>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white shrink-0" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {info === undefined && <p className="text-sm text-gray-500">Cargando carrera…</p>}
          {info === null && <p className="text-sm text-red-400">No se pudo cargar la ficha de este jugador.</p>}

          {info && (
            <>
              <section>
                <h3 className="t-eyebrow mb-2">Carrera en clubes</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Goles" value={info.totals.goals} tone="text-emerald-500" />
                  <Stat label="Asistencias" value={info.totals.assists} tone="text-sky-400" />
                  <Stat label="Titular en" value={info.totals.starts} tone="text-amber-500" />
                </div>
              </section>

              <section>
                <h3 className="t-eyebrow mb-2">Clubes ({info.clubs.length})</h3>
                {info.clubs.length === 0 && <p className="text-sm text-gray-500">No hay datos de clubes.</p>}
                <div className="space-y-2">{info.clubs.map((c) => <ClubBlock key={c.id} club={c} />)}</div>
              </section>

              {info.national.length > 0 && (
                <section>
                  <h3 className="t-eyebrow mb-2">Selección</h3>
                  <div className="space-y-2">{info.national.map((c) => <ClubBlock key={c.id} club={c} />)}</div>
                </section>
              )}
              <p className="text-[11px] text-gray-600">Datos de ESPN. Las temporadas viejas pueden estar incompletas.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
