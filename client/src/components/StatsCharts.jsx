import { useEffect, useState } from "react";
import { LineChart } from "lucide-react";
import api from "../api.js";
import Card from "./Card.jsx";
import { SkeletonCard } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

// Aciertos de los últimos 7 días (barras) + puntos acumulados del mes (línea
// con área). Los datos son personales: /stats/my-daily no pide grupo.
export default function StatsCharts() {
  const [days, setDays] = useState(undefined);

  useEffect(() => {
    api.get("/stats/my-daily").then(({ data }) => setDays(data.days)).catch(() => setDays(null));
  }, []);

  if (days === undefined) {
    return <div className="grid md:grid-cols-2 gap-3 mb-6"><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>;
  }
  if (!days || days.every((d) => d.total === 0)) {
    return (
      <Card className="mb-6">
        <EmptyState
          icon={LineChart}
          title="Todavía no hay gráficos"
          hint="Respondé la trivia unos días y acá vas a ver tus aciertos y tus puntos."
          actions={[{ label: "Ir a la trivia", to: "/trivia" }]}
        />
      </Card>
    );
  }

  const week = days.slice(-7);
  const maxTotal = Math.max(1, ...week.map((d) => d.total));

  let acc = 0;
  const cumulative = days.map((d) => (acc += d.points));
  const maxC = Math.max(1, acc);
  const W = 300, H = 90;
  const pts = cumulative.map((v, i) => [(i / (days.length - 1)) * W, H - 8 - (v / maxC) * (H - 20)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [ex, ey] = pts[pts.length - 1];

  return (
    <div className="grid md:grid-cols-2 gap-3 mb-6">
      <Card>
        <p className="t-eyebrow mb-4">Aciertos · últimos 7 días</p>
        <div className="flex items-end gap-2 h-24">
          {week.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col justify-end h-full" title={`${d.correct} de ${d.total}`}>
              <div className="w-full rounded-t bg-blue-500/20" style={{ height: `${(d.total / maxTotal) * 100}%` }}>
                <div className="w-full rounded-t bg-blue-500" style={{ height: d.total ? `${(d.correct / d.total) * 100}%` : 0 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2 text-[11px] text-gray-500">
          {week.map((d) => (
            <span key={d.date} className="flex-1 text-center">{DAY_LETTERS[new Date(`${d.date}T12:00:00`).getDay()]}</span>
          ))}
        </div>
      </Card>
      <Card>
        <p className="t-eyebrow mb-4">Puntos · último mes</p>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-24" role="img" aria-label="Puntos acumulados del mes">
          <defs>
            <linearGradient id="ptsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgb(var(--c-accent))" stopOpacity="0.35" />
              <stop offset="1" stopColor="rgb(var(--c-accent))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} V${H} H0Z`} fill="url(#ptsFill)" />
          <path d={line} fill="none" stroke="rgb(var(--c-accent))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle cx={ex} cy={ey} r="3.5" fill="rgb(var(--c-accent))" />
        </svg>
        <p className="t-meta mt-2">+{acc} pts en 30 días</p>
      </Card>
    </div>
  );
}
