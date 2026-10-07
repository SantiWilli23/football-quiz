import { useEffect, useState } from "react";
import { ArrowLeft, Trophy, Stethoscope, Users, CalendarClock, History, MapPin } from "lucide-react";
import api from "../api.js";
import PlayerModal from "./PlayerModal.jsx";

const POS_ORDER = ["G", "D", "M", "F"];
const POS_LABEL = { G: "Arqueros", D: "Defensas", M: "Mediocampistas", F: "Delanteros" };
const POS_TONE = { G: "#f59e0b", D: "#38bdf8", M: "#22c55e", F: "#ef4444" };

// Posiciones de ESPN: G, CD-L, LB, DM, AM-R, CF, etc. Se agrupan por la
// primera letra útil para no mostrar 15 grupos.
function groupOf(pos) {
  if (!pos) return "M";
  if (pos === "G") return "G";
  if (/^(CD|LB|RB|SW|D)/.test(pos)) return "D";
  if (/^(CF|F|ST|LF|RF|SS)/.test(pos)) return "F";
  return "M";
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

function Panel({ icon: Icon, title, accent, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-border bg-panel p-5 ${className}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}26`, color: accent }}><Icon size={15} /></span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-border bg-panel px-5 py-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: tone }}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ResultRow({ g, teamId }) {
  const mineHome = g.home.id === teamId;
  const mine = Number(mineHome ? g.home.score : g.away.score);
  const other = Number(mineHome ? g.away.score : g.home.score);
  const res = mine > other ? "G" : mine < other ? "P" : "E";
  const tone = res === "G" ? "#22c55e" : res === "P" ? "#ef4444" : "#9ca3af";
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0" style={{ background: `${tone}26`, color: tone }}>{res}</span>
      <span className="text-xs text-gray-500 w-20 shrink-0">{fmtDate(g.date)}</span>
      <img src={g.home.logo} alt="" className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1">{g.home.name}</span>
      <span className="font-semibold tabular-nums shrink-0">{g.home.score} - {g.away.score}</span>
      <span className="truncate flex-1 text-right">{g.away.name}</span>
      <img src={g.away.logo} alt="" className="w-4 h-4 shrink-0" />
    </li>
  );
}

// Página del club (a ancho completo, con la barra lateral a la izquierda):
// cabecera con los colores del club, números de la liga pasada, forma
// reciente, títulos, lesiones y plantilla completa (tocá un jugador para ver su carrera).
export default function TeamModal({ league, team, onClose }) {
  const [info, setInfo] = useState(undefined);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    let alive = true;
    setInfo(undefined);
    api.get(`/football/${league}/teams/${team.id}`)
      .then((r) => alive && setInfo(r.data))
      .catch(() => alive && setInfo(null));
    return () => { alive = false; };
  }, [league, team.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !player) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, player]);

  const groups = {};
  for (const p of info?.squad || []) (groups[groupOf(p.position)] ||= []).push(p);

  const ls = info?.lastSeason;
  const t = info?.titles;
  const color = info?.team?.color && info.team.color !== "#000000" ? info.team.color : "#3b82f6";

  return (
    <div>
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
        <ArrowLeft size={16} /> Volver a la tabla
      </button>

      <div className="rounded-2xl border border-border overflow-hidden mb-5" style={{ background: `linear-gradient(120deg, ${color}55, ${color}11 55%, transparent)` }}>
        <div className="flex items-center gap-5 p-6 flex-wrap">
          {team.logo && <img src={team.logo} alt="" className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 object-contain drop-shadow-lg" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-4xl font-extrabold truncate">{team.name}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-gray-300">
              {info?.team?.standing && <span>{info.team.standing}</span>}
              {info?.team?.coach && <span>DT: <b className="font-semibold">{info.team.coach}</b></span>}
              {info?.team?.record && <span className="text-gray-400">Récord {info.team.record}</span>}
            </div>
          </div>
          {t && (
            <div className="text-center px-5 py-3 rounded-2xl bg-black/25">
              <Trophy size={20} className="mx-auto mb-1" style={{ color: "#facc15" }} />
              <p className="text-3xl font-extrabold tabular-nums leading-none">{t.count}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">títulos de liga</p>
            </div>
          )}
        </div>
      </div>

      {info === undefined && <p className="text-sm text-gray-500">Cargando la ficha del club…</p>}
      {info === null && <p className="text-sm text-red-400">No se pudo cargar la ficha de este equipo.</p>}

      {info && (
        <div className="space-y-5">
          {ls ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Kpi label={`Liga ${ls.label}`} value={`${ls.position}°`} sub={`de ${ls.of} equipos`} tone="#facc15" />
              <Kpi label="Puntos" value={ls.points} sub={`${ls.won}G ${ls.drawn}E ${ls.lost}P`} tone="#22c55e" />
              <Kpi label="Goles a favor" value={ls.goals_for} tone="#38bdf8" />
              <Kpi label="Goles en contra" value={ls.goals_against} tone="#ef4444" />
              <Kpi label="Diferencia" value={`${ls.goals_for - ls.goals_against > 0 ? "+" : ""}${ls.goals_for - ls.goals_against}`} tone="#a78bfa" />
            </div>
          ) : (
            <p className="text-sm text-gray-500">Este equipo no jugó la liga pasada (o no hay datos).</p>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel icon={History} title="Últimos resultados" accent="#22c55e" className="lg:col-span-2">
              {info.recent?.length > 0 ? (
                <ul className="space-y-2.5">{info.recent.map((g) => <ResultRow key={g.id} g={g} teamId={info.team.id} />)}</ul>
              ) : (
                <p className="text-sm text-gray-500">Sin resultados recientes.</p>
              )}
              {info.upcoming?.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-2"><CalendarClock size={13} /> Próximos</p>
                  <ul className="space-y-2 text-sm">
                    {info.upcoming.map((g) => (
                      <li key={g.id} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-28 shrink-0">{fmtDate(g.date)} · {fmtTime(g.date)}</span>
                        <span className="truncate">{g.home.name} vs {g.away.name}</span>
                        {g.venue && <span className="ml-auto text-xs text-gray-600 hidden sm:flex items-center gap-1 shrink-0"><MapPin size={11} />{g.venue}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            <div className="space-y-5">
              <Panel icon={Trophy} title="Títulos de liga" accent="#facc15">
                <p className="text-sm text-gray-300">
                  {t.count > 0 ? `Campeón en: ${t.years.join(", ")}` : t.from ? `Ninguno desde ${t.from}` : "Sin datos"}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Por la tabla final de cada temporada{t.from ? ` (${t.from}–${t.until})` : ""}; no incluye copas.
                  {t.missing?.length > 0 && ` Faltan datos de ${t.missing.join(", ")}.`}
                </p>
              </Panel>

              <Panel icon={Stethoscope} title="Lesiones" accent="#ef4444">
                {info.injuries.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {info.injuries.map((i) => (
                      <li key={i.name} className="flex justify-between gap-3">
                        <span className="truncate">{i.name}</span>
                        <span className="text-red-400 text-xs text-right shrink-0">{i.detail}{i.return_date ? ` · vuelve ${i.return_date}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Sin lesionados reportados.</p>
                )}
              </Panel>
            </div>
          </div>

          <Panel icon={Users} title={`Plantilla (${info.squad.length})`} accent="#38bdf8">
            {info.squad.length === 0 && <p className="text-sm text-gray-500">No hay plantilla disponible.</p>}
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {POS_ORDER.filter((g) => groups[g]).map((g) => (
                <div key={g}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 pb-1 border-b" style={{ color: POS_TONE[g], borderColor: `${POS_TONE[g]}55` }}>
                    {POS_LABEL[g]} · {groups[g].length}
                  </p>
                  <ul className="space-y-1">
                    {groups[g].map((p) => (
                      <li key={p.name}>
                        <button
                          disabled={!p.id}
                          onClick={() => setPlayer(p)}
                          className="w-full flex items-center gap-2 min-w-0 text-sm text-left px-1.5 py-1 rounded hover:bg-white/5 disabled:hover:bg-transparent"
                        >
                          <span className="w-6 text-right text-xs tabular-nums text-gray-500 shrink-0">{p.number ?? ""}</span>
                          <span className="truncate">{p.name}</span>
                          {p.age && <span className="text-xs text-gray-600 ml-auto shrink-0">{p.age}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {player && <PlayerModal playerId={player.id} fallback={{ name: player.name, photo: `https://a.espncdn.com/i/headshots/soccer/players/full/${player.id}.png` }} onClose={() => setPlayer(null)} />}
    </div>
  );
}
