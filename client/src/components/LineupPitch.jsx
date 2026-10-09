// Alineación de un partido real: cancha horizontal ancha con los dos equipos. El local está a la
// izquierda (ataca hacia la derecha) y el visitante a la derecha. Cada ficha lleva el número de
// camiseta y el apellido. Debajo van los suplentes y el DT de cada equipo.
const W = 1000;
const H = 520;
const surname = (n) => String(n || "").split(" ").slice(-1)[0];

// Si la API trae "fila:columna" (grid) se usa tal cual; si no, se arma por línea (G, D, M, F).
function place(starters, side) {
  const hasGrid = starters.every((p) => /^\d+:\d+$/.test(String(p.grid || "")));
  let rows;
  if (hasGrid) {
    rows = new Map();
    starters.forEach((p) => {
      const [r, c] = p.grid.split(":").map(Number);
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r).push({ ...p, col: c });
    });
    rows = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list.sort((a, b) => a.col - b.col));
  } else {
    const order = ["G", "D", "M", "F"];
    rows = order.map((k) => starters.filter((p) => String(p.position || "").toUpperCase().startsWith(k))).filter((r) => r.length);
    const rest = starters.filter((p) => !order.some((k) => String(p.position || "").toUpperCase().startsWith(k)));
    if (rest.length) rows.push(rest);
  }
  const out = [];
  rows.forEach((list, ri) => {
    const x = rows.length === 1 ? 25 : 5 + (ri / (rows.length - 1)) * 40; // 5% (arquero) a 45% (delanteros)
    list.forEach((p, k) => {
      const y = ((k + 1) / (list.length + 1)) * 100;
      out.push({ ...p, x: side === "home" ? x : 100 - x, y: side === "home" ? y : 100 - y });
    });
  });
  return out;
}

function Dots({ side, color }) {
  return place(side.starters, color === "home" ? "home" : "away").map((p, i) => {
    const px = (p.x / 100) * W;
    const py = (p.y / 100) * H;
    return (
      <g key={i} transform={`translate(${px} ${py})`}>
        <circle r="19" fill={color === "home" ? "rgb(56 189 248)" : "rgb(251 113 133)"} stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" />
        <text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0b1220">{p.number ?? ""}</text>
        <text y="38" textAnchor="middle" fontSize="14" fontWeight="600" fill="white" stroke="rgba(0,0,0,0.55)" strokeWidth="3" paintOrder="stroke">{surname(p.name).slice(0, 12)}</text>
      </g>
    );
  });
}

function Bench({ side }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold flex items-center gap-2 mb-1.5">
        {side.team.logo && <img src={side.team.logo} alt="" className="w-4 h-4" loading="lazy" />}
        <span className="truncate">{side.team.name}</span>
        {side.formation && <span className="text-gray-500 ml-auto shrink-0">{side.formation}</span>}
      </p>
      {side.coach && <p className="text-xs text-gray-500 mb-1.5">DT: {side.coach}</p>}
      {side.substitutes?.length > 0 && (
        <p className="text-xs text-gray-400 leading-relaxed">
          <span className="text-gray-500">Suplentes: </span>
          {side.substitutes.map((p) => `${p.number ?? ""} ${surname(p.name)}`.trim()).join(" · ")}
        </p>
      )}
    </div>
  );
}

export default function LineupPitch({ lineups }) {
  const [home, away] = lineups;
  return (
    <div className="space-y-3 w-full">
      <div className="rounded-2xl overflow-hidden border border-white/15" style={{ background: "rgb(6 78 59)" }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={`Alineación de ${home.team.name} y ${away.team.name}`}>
          {Array.from({ length: 10 }).map((_, i) => <rect key={i} x={i * (W / 10)} width={W / 10} height={H} fill={i % 2 === 0 ? "rgba(255,255,255,0.035)" : "transparent"} />)}
          <rect x="4" y="4" width={W - 8} height={H - 8} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          <line x1={W / 2} y1="4" x2={W / 2} y2={H - 4} stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          <circle cx={W / 2} cy={H / 2} r="70" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          <rect x="4" y={H / 2 - 110} width="150" height="220" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          <rect x={W - 154} y={H / 2 - 110} width="150" height="220" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          <rect x="4" y={H / 2 - 50} width="50" height="100" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          <rect x={W - 54} y={H / 2 - 50} width="50" height="100" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          <Dots side={home} color="home" />
          <Dots side={away} color="away" />
        </svg>
        <div className="flex items-center justify-between px-4 py-2 bg-black/30 text-sm font-semibold">
          <span className="flex items-center gap-1.5 truncate"><span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400" />{home.team.name}{home.formation ? ` · ${home.formation}` : ""}</span>
          <span className="flex items-center gap-1.5 truncate justify-end">{away.formation ? `${away.formation} · ` : ""}{away.team.name}<span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400" /></span>
        </div>
      </div>
      <div className="flex gap-6 flex-wrap sm:flex-nowrap">
        <Bench side={home} />
        <Bench side={away} />
      </div>
    </div>
  );
}
