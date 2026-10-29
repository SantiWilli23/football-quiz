import { useEffect, useState } from "react";
import { Flame, Target, Trophy } from "lucide-react";
import api from "../api.js";
import { hintFor } from "./hints.js";

// Récords de un juego fusionado: una tarjeta por variante (Fichado, Carrera…), con el mejor
// puntaje en grande y el resto de los números como fichas.
export default function RecordsDemo({ game, g, current }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/game-history/historic").then((r) => setRows(r.data.games)).catch(() => setRows([])); }, []);
  return (
    <div className="space-y-3">
      <div>
        <p className="t-eyebrow flex items-center gap-1.5"><Trophy size={13} /> Récords</p>
        <h1 className="t-title">{g.label}</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {g.variants.map((v) => {
          const name = hintFor(game, v.key)?.[0] || v.label;
          const mine = (rows || []).filter((r) => v.keys.includes(r.game_key));
          const best = mine.length ? Math.max(...mine.map((r) => Number(r.best_score) || 0)) : null;
          const played = mine.reduce((n, r) => n + (Number(r.played) || 0), 0);
          const avg = mine.length ? Math.round(mine.reduce((n, r) => n + (Number(r.average) || 0), 0) / mine.length) : null;
          const streak = mine.length ? Math.max(...mine.map((r) => Number(r.best_streak) || 0)) : null;
          return (
            <section key={v.key} className="p-card" style={{ borderTop: `3px solid ${v.key === current ? "var(--c-accent)" : "var(--c-border)"}` }}>
              <p className="font-bold">{name}</p>
              {rows === null && <p className="mt-3 text-sm text-gray-500">Cargando…</p>}
              {rows !== null && v.keys.length === 0 && <p className="mt-3 text-sm text-gray-400">Esta variante no guarda récords personales.</p>}
              {rows !== null && v.keys.length > 0 && !mine.length && <p className="mt-3 text-sm text-gray-400">Aún no la juegas. Tu primera partida aparece aquí.</p>}
              {mine.length > 0 && (
                <>
                  <p className="mt-3 text-xs uppercase tracking-wide text-gray-500">Mejor puntaje</p>
                  <p className="tabular-nums" style={{ font: "800 52px/1 var(--f-n, inherit)", color: "var(--c-amber)" }}>{best}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[[Target, "Partidas", played], [Trophy, "Promedio", avg], [Flame, "Racha de plenos", streak]].map(([Icon, label, val]) => (
                      <div key={label} className="rounded-xl border border-border px-1.5 py-2">
                        <Icon size={14} className="mx-auto text-gray-500" />
                        <dd className="mt-0.5 text-lg font-bold tabular-nums">{val}</dd>
                        <dt className="text-[10px] leading-tight text-gray-500">{label}</dt>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
