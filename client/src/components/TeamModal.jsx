import { useEffect, useState } from "react";
import { X } from "lucide-react";
import api from "../api.js";

const POS_ORDER = ["G", "D", "M", "F"];
const POS_LABEL = { G: "Arqueros", D: "Defensas", M: "Mediocampistas", F: "Delanteros" };

// Posiciones de ESPN: G, CD-L, LB, DM, AM-R, CF, etc. Se agrupan por la
// primera letra útil para no mostrar 15 grupos.
function groupOf(pos) {
  if (!pos) return "M";
  if (pos === "G") return "G";
  if (/^(CD|LB|RB|SW|D)/.test(pos)) return "D";
  if (/^(CF|F|ST|LF|RF|SS)/.test(pos)) return "F";
  return "M";
}

function Section({ title, children }) {
  return (
    <section className="mb-5">
      <h3 className="t-eyebrow mb-2">{title}</h3>
      {children}
    </section>
  );
}

// Ficha de un equipo desde la tabla: liga pasada, títulos, lesiones y plantilla.
export default function TeamModal({ league, team, onClose }) {
  const [info, setInfo] = useState(undefined);

  useEffect(() => {
    let alive = true;
    api.get(`/football/${league}/teams/${team.id}`)
      .then((r) => alive && setInfo(r.data))
      .catch(() => alive && setInfo(null));
    return () => { alive = false; };
  }, [league, team.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups = {};
  for (const p of info?.squad || []) (groups[groupOf(p.position)] ||= []).push(p);

  const ls = info?.lastSeason;
  const t = info?.titles;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={team.name}
        className="bg-panel border border-border rounded-2xl p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          {team.logo && <img src={team.logo} alt="" className="w-10 h-10 shrink-0" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold truncate">{team.name}</h2>
            {info?.team?.coach && <p className="text-xs text-gray-500">DT: {info.team.coach}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {info === undefined && <p className="text-sm text-gray-500">Cargando…</p>}
        {info === null && <p className="text-sm text-red-400">No se pudo cargar la ficha de este equipo.</p>}

        {info && (
          <>
            <Section title="Liga pasada">
              {ls ? (
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold tabular-nums">{ls.position}°</p>
                    <p className="text-xs text-gray-500">de {ls.of} · {ls.label}</p>
                  </div>
                  <p className="text-sm text-gray-300 tabular-nums">
                    {ls.points} pts · {ls.won}G {ls.drawn}E {ls.lost}P · goles {ls.goals_for}-{ls.goals_against}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Este equipo no jugó la liga pasada (o no hay datos).</p>
              )}
            </Section>

            <Section title="Títulos de liga">
              <p className="text-sm text-gray-300">
                <span className="text-2xl font-bold tabular-nums mr-2">{t.count}</span>
                {t.count > 0 ? `desde ${t.from}: ${t.years.join(", ")}` : t.from ? `ninguno desde ${t.from}` : "sin datos"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Se cuentan por la tabla final de cada temporada{t.from ? ` (${t.from}–${t.until})` : ""}; no incluye copas.
                {t.missing?.length > 0 && ` Faltan datos de ${t.missing.join(", ")}.`}
              </p>
            </Section>

            <Section title="Lesiones">
              {info.injuries.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {info.injuries.map((i) => (
                    <li key={i.name} className="flex justify-between gap-3">
                      <span>{i.name}</span>
                      <span className="text-red-400 text-xs text-right">{i.detail}{i.return_date ? ` · vuelve ${i.return_date}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Sin lesionados reportados.</p>
              )}
            </Section>

            <Section title={`Plantilla (${info.squad.length})`}>
              {info.squad.length === 0 && <p className="text-sm text-gray-500">No hay plantilla disponible.</p>}
              {POS_ORDER.filter((g) => groups[g]).map((g) => (
                <div key={g} className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">{POS_LABEL[g]}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {groups[g].map((p) => (
                      <li key={p.name} className="flex items-center gap-2 min-w-0">
                        <span className="w-6 text-right text-xs tabular-nums text-gray-500 shrink-0">{p.number ?? ""}</span>
                        <span className="truncate">{p.name}</span>
                        {p.age && <span className="text-xs text-gray-600 shrink-0">{p.age}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
