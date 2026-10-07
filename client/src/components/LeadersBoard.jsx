import { Target, HandHelping, Gauge } from "lucide-react";

const BOARDS = [
  { key: "goals", title: "Goleadores", icon: Target, tone: "#22c55e", unit: (p) => `${p.goals}`, sub: (p) => `${p.assists} asist.`, label: "goles" },
  { key: "assists", title: "Asistidores", icon: HandHelping, tone: "#38bdf8", unit: (p) => `${p.assists}`, sub: (p) => `${p.goals} goles`, label: "asist." },
  { key: "perGame", title: "Mejor promedio por partido", icon: Gauge, tone: "#f59e0b", unit: (p) => p.value.toFixed(2), sub: (p) => `${p.goals}G + ${p.assists}A en ${p.matches} PJ`, label: "G+A / PJ" },
];

function Row({ p, i, board, onPick }) {
  return (
    <button
      onClick={() => onPick(p)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-card border border-border bg-bg hover:border-white/30 text-left transition-colors"
    >
      <span className="w-5 text-center text-sm font-bold tabular-nums shrink-0" style={{ color: i === 0 ? board.tone : undefined }}>{i + 1}</span>
      <img src={p.photo} alt="" className="w-9 h-9 rounded-full object-cover bg-panel shrink-0" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{p.name}</p>
        <p className="text-xs text-gray-500 truncate flex items-center gap-1.5">
          {p.team?.logo && <img src={p.team.logo} alt="" className="w-3.5 h-3.5 shrink-0" />}
          {p.team?.name}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-bold tabular-nums leading-none" style={{ color: board.tone }}>{board.unit(p)}</p>
        <p className="text-[10px] text-gray-500 mt-1">{board.sub(p)}</p>
      </div>
    </button>
  );
}

// Tres podios de 5: goles, asistencias y participaciones en gol por partido.
// Tocar un jugador abre su ficha de carrera.
export default function LeadersBoard({ data, onPick }) {
  if (!data) return null;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {BOARDS.map((b) => {
        const list = data[b.key] || [];
        const Icon = b.icon;
        return (
          <section key={b.key}>
            <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
              <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${b.tone}26`, color: b.tone }}><Icon size={14} /></span>
              {b.title}
            </h3>
            <div className="space-y-2">
              {list.length === 0 && <p className="text-sm text-gray-500">Sin datos todavía.</p>}
              {list.map((p, i) => <Row key={p.id} p={p} i={i} board={b} onPick={onPick} />)}
            </div>
            {b.key === "perGame" && list.length > 0 && (
              <p className="text-[11px] text-gray-600 mt-2">Goles + asistencias por partido, con al menos {data.minMatches} partidos jugados.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
