import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dna, RotateCw, TrendingDown, TrendingUp } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import { useClubs } from "./useClubs.js";

const AREAS = ["chile", "europa", "leyendas", "actualidad", "mercado", "velocidad"];
const LABEL = { chile: "Chile", europa: "Europa", leyendas: "Leyendas", actualidad: "Actualidad", mercado: "Mercado", velocidad: "Velocidad" };
const SIZE = 300;
const C = SIZE / 2;
const R = 100;

// Punto del hexágono: el área `i` de 6, con una distancia de 0 a 1 desde el centro.
const point = (i, t, r = R) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / AREAS.length;
  return [C + Math.cos(a) * r * t, C + Math.sin(a) * r * t];
};
const polygon = (scores) => AREAS.map((a, i) => point(i, (scores?.[a] ?? 0) / 99).map((n) => n.toFixed(1)).join(",")).join(" ");

function Hexagon({ areas, previous }) {
  const now = Object.fromEntries(AREAS.map((a) => [a, areas[a].score]));
  const prev = previous ? Object.fromEntries(AREAS.map((a) => [a, previous[a].score])) : null;
  return (
    <svg viewBox={`-45 -5 ${SIZE + 90} ${SIZE + 10}`} className="mx-auto w-full max-w-[340px]" role="img" aria-label={`ADN futbolero: ${AREAS.map((a) => `${LABEL[a]} ${areas[a].score ?? "sin datos"}`).join(", ")}`}>
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <polygon key={t} points={AREAS.map((_, i) => point(i, t).join(",")).join(" ")} fill="none" stroke="currentColor" className="text-white/10" strokeWidth="1" />
      ))}
      {AREAS.map((_, i) => <line key={i} x1={C} y1={C} x2={point(i, 1)[0]} y2={point(i, 1)[1]} stroke="currentColor" className="text-white/10" />)}
      {prev && <polygon points={polygon(prev)} fill="none" stroke="currentColor" className="text-gray-400" strokeWidth="1.5" strokeDasharray="4 4" />}
      <polygon points={polygon(now)} className="fill-accent/25 stroke-accent" strokeWidth="2" strokeLinejoin="round" style={{ transition: "all .6s ease" }} />
      {AREAS.map((a, i) => {
        const [x, y] = point(i, 1, R + 28);
        const anchor = x < C - 5 ? "end" : x > C + 5 ? "start" : "middle";
        return (
          <g key={a}>
            <text x={x} y={y} textAnchor={anchor} className="fill-white" style={{ font: "600 12px sans-serif" }}>{LABEL[a]}</text>
            <text x={x} y={y + 14} textAnchor={anchor} className={areas[a].score == null ? "fill-gray-500" : "fill-accent"} style={{ font: "700 12px sans-serif" }}>{areas[a].score == null ? "Faltan datos" : areas[a].score}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Adn() {
  const { main } = useClubs();
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get("/me/adn", { params: { range, groupId: main?.id } }).then((r) => setData(r.data)).catch(() => setData(false));
  }, [range, main?.id]);

  const known = data ? AREAS.filter((a) => data.areas[a].score != null).length : 0;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="t-eyebrow flex items-center gap-1.5"><Dna size={13} /> ADN futbolero</p>
        <div className="flex gap-1" role="tablist" aria-label="Período">
          {[["week", "Semana"], ["month", "Mes"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={`min-h-[36px] rounded-full border px-3 text-xs ${range === k ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{l}</button>
          ))}
        </div>
      </div>

      {data === null && <p className="mt-3 text-sm text-gray-500">Calculando…</p>}
      {data === false && <p className="mt-3 text-sm text-red-400">No se pudo cargar tu ADN.</p>}
      {data && (
        <>
          <div className="mt-2"><Hexagon areas={data.areas} previous={range === "month" ? data.previous : data.previous} /></div>
          <p className="text-center text-[11px] text-gray-500">{data.previous ? "La línea punteada es el período anterior. " : ""}Un área aparece con 15 respuestas o más.</p>

          {known === 0 && <p className="mt-3 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-gray-400">Todavía no hay datos suficientes. Juega el partido del día: cada pregunta suma a un área.</p>}

          {(data.archetype || data.specialty) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.archetype && <span className="rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-sm font-semibold">{data.archetype}</span>}
              {data.specialty && <span className="rounded-full border border-border px-3 py-1 text-sm">Especialidad del mes: {LABEL[data.specialty]}</span>}
            </div>
          )}

          {data.best && (
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>Tu mejor área: <b>{LABEL[data.best]}</b> ({data.areas[data.best].score}).</li>
              {data.worst && <li>La que más puede mejorar: <b>{LABEL[data.worst]}</b> ({data.areas[data.worst].score}).</li>}
              {AREAS.filter((a) => data.deltas[a] != null && data.deltas[a] !== 0).slice(0, 3).map((a) => (
                <li key={a} className="flex items-center gap-1.5 text-gray-300">
                  {data.deltas[a] > 0 ? <TrendingUp size={14} className="text-good" /> : <TrendingDown size={14} className="text-bad" />}
                  {LABEL[a]} {data.deltas[a] > 0 ? "subió" : "bajó"} {Math.abs(data.deltas[a])} puntos.
                </li>
              ))}
              {data.club && data.club[data.best] != null && <li className="text-gray-400">Tu club promedia {data.club[data.best]} en {LABEL[data.best]}.</li>}
            </ul>
          )}

          {data.suggestion && (
            <div className="mt-3 rounded-xl border border-border bg-bg px-3 py-3">
              <p className="text-sm">{data.suggestion.text}</p>
              <div className="mt-2 flex gap-2">
                <Link to={`/entrenar/${data.suggestion.area}`} className="btn btn-primary btn-sm">Entrenar 2 minutos</Link>
                <Link to={data.suggestion.game} className="btn btn-secondary btn-sm">Ir al juego</Link>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

const TIER_STYLE = {
  bronce: "from-orange-800 to-orange-950 border-orange-500/60",
  plata: "from-slate-400 to-slate-700 border-slate-200/60",
  oro: "from-amber-400 to-amber-700 border-amber-200/70",
  especial: "from-fuchsia-500 via-indigo-600 to-cyan-500 border-white/70",
};

// Tu carta Futotal: su media es el promedio de tus últimos 30 partidos del día. Se da vuelta y
// muestra tu ADN; se comparte como texto.
export function CartaFutotal() {
  const [card, setCard] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api.get("/me/card").then((r) => setCard(r.data)).catch(() => setCard(false)); }, []);

  const share = useMemo(() => {
    if (!card?.media) return "";
    const top = AREAS.filter((a) => card.adn[a].score != null).sort((a, b) => card.adn[b].score - card.adn[a].score).slice(0, 3);
    return `⚽ Futotal · Carta de ${card.username}: ${card.media} (${card.tier})${top.length ? "\n" + top.map((a) => `${LABEL[a]} ${card.adn[a].score}`).join(" · ") : ""}`;
  }, [card]);

  if (card === null) return null;
  if (card === false) return null;
  if (!card.media) {
    return <Card><p className="t-eyebrow">Tu carta Futotal</p><p className="mt-1 text-sm text-gray-400">Aparece cuando juegues tu primer partido del día. Su media es el promedio de tus últimos 30.</p></Card>;
  }
  async function copy() {
    try { await navigator.clipboard.writeText(share); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin portapapeles */ }
  }
  return (
    <Card>
      <p className="t-eyebrow">Tu carta Futotal</p>
      <button onClick={() => setFlipped((f) => !f)} aria-label="Dar vuelta la carta" className="mx-auto mt-3 block [perspective:900px]">
        <div className="relative h-72 w-52 transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : "none" }}>
          <div className={`absolute inset-0 flex flex-col items-center justify-between rounded-2xl border-2 bg-gradient-to-br p-4 text-white [backface-visibility:hidden] ${TIER_STYLE[card.tier]}`}>
            <div className="text-center"><p className="text-5xl font-extrabold tabular-nums leading-none drop-shadow">{card.media}</p><p className="text-xs uppercase tracking-widest opacity-90">{card.tier}</p></div>
            <p className="text-xl font-bold drop-shadow">{card.username}</p>
            <p className="text-[11px] opacity-90">Promedio de {card.played} {card.played === 1 ? "partido" : "partidos"}</p>
          </div>
          <div className={`absolute inset-0 rounded-2xl border-2 bg-gradient-to-br p-3 text-white [backface-visibility:hidden] ${TIER_STYLE[card.tier]}`} style={{ transform: "rotateY(180deg)" }}>
            <p className="text-center text-xs font-semibold uppercase tracking-widest">ADN</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {AREAS.map((a) => <li key={a} className="flex justify-between"><span>{LABEL[a]}</span><b className="tabular-nums">{card.adn[a].score ?? "–"}</b></li>)}
            </ul>
          </div>
        </div>
      </button>
      <div className="mt-3 flex justify-center gap-2">
        <button onClick={() => setFlipped((f) => !f)} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"><RotateCw size={14} /> Dar vuelta</button>
        <button onClick={copy} className="btn btn-secondary btn-sm">{copied ? "Copiado" : "Compartir"}</button>
      </div>
    </Card>
  );
}
