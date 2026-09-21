import { Link } from "react-router-dom";
import { ClipboardList, GraduationCap, Play, Shirt } from "lucide-react";
import { listSaveSlots } from "../carrera/hooks/useCareerSave.js";

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Las partidas largas ya guardan su progreso en localStorage; esto sólo lo
// junta en un lugar para retomarlas desde el inicio. Cada lectura es tolerante:
// un guardado con otro formato simplemente no aparece, nunca rompe el panel.
export function findSavedGames() {
  const items = [];

  const pres = readJSON("presidente_v1");
  if (pres?.season) {
    const total = pres.weeksPerSeason || 38;
    items.push({
      key: "presidente", to: "/presidente", icon: GraduationCap,
      label: `Presidente · Temporada ${pres.season}`,
      progress: Math.min(100, Math.round(((pres.week || 0) / total) * 100)),
    });
  }

  try {
    const slots = listSaveSlots().filter((s) => !s.gameOver);
    if (slots.length > 0) {
      const latest = [...slots].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      items.push({
        key: "dt", to: "/carrera-dt", icon: ClipboardList,
        label: `Modo DT · Temporada ${latest.season} · Fecha ${latest.week}`,
        progress: null,
      });
    }
  } catch { /* sin partidas de DT */ }

  const cot = readJSON("cotrero_v1");
  if (cot && cot.age && !cot.retired && !cot.gameOver) {
    items.push({
      key: "cotrero", href: "/cotrero.html", icon: Shirt,
      label: `Cotrero · ${cot.age} años`,
      progress: Math.min(100, Math.round(((cot.age - 16) / 22) * 100)),
    });
  }

  return items;
}

export default function ContinuePlaying({ items }) {
  if (!items.length) return null;
  return (
    <div className="mb-10">
      <h2 className="t-eyebrow mb-4">Continuar jugando</h2>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
        {items.map((it) => {
          const inner = (
            <>
              <span className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                <it.icon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.label}</p>
                {it.progress !== null && (
                  <div className="h-1 rounded-full bg-white/10 mt-2 overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${it.progress}%` }} />
                  </div>
                )}
              </div>
              <span className="text-xs text-accent inline-flex items-center gap-1 shrink-0"><Play size={11} /> Seguir</span>
            </>
          );
          const cls = "snap-start shrink-0 w-72 flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-panel hover:border-white/20 transition-colors";
          return it.to
            ? <Link key={it.key} to={it.to} className={cls}>{inner}</Link>
            : <a key={it.key} href={it.href} className={cls}>{inner}</a>;
        })}
      </div>
    </div>
  );
}

