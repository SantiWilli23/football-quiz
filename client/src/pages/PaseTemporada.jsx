import { useEffect, useState } from "react";
import { Award, Check, Gift } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { playSfx } from "../utils/sfx.js";

// Pase de temporada: un tema por mes, misiones con datos reales y 5 escalones.
export default function PaseTemporada() {
  const { toast } = useToast();
  const [data, setData] = useState(undefined);

  const load = () => api.get("/season-pass").then((r) => setData(r.data)).catch(() => setData(null));
  useEffect(() => { load(); }, []);

  async function claim(tier) {
    try {
      const { data: r } = await api.post("/season-pass/claim", { tier });
      toast(r.title ? `Título «${r.title}» desbloqueado` : `+${r.packs} sobre${r.packs === 1 ? "" : "s"} en Cartas`);
      playSfx("win");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo reclamar");
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="t-title mb-1">Pase de temporada</h1>
        <p className="text-gray-400 text-sm">Cada mes tiene un tema y misiones con lo que ya jugás. Sumá experiencia y reclamá sobres de cartas y títulos.</p>
      </div>

      {data === undefined && <SkeletonCard lines={4} />}
      {data === null && <Card><p className="text-sm text-gray-500">No se pudo cargar el pase.</p></Card>}

      {data && (
        <div className="space-y-4">
          <Card variant="feature">
            <p className="t-eyebrow mb-1">{data.season} · {data.theme}</p>
            <p className="text-4xl font-bold tabular-nums">{data.xp}<span className="text-sm font-normal text-gray-500 ml-2">XP</span></p>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-3">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (data.xp / 500) * 100)}%` }} />
            </div>
          </Card>

          <Card>
            <p className="t-eyebrow mb-3">Misiones</p>
            <div className="space-y-4">
              {data.missions.map((m) => (
                <div key={m.key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className={m.progress >= m.target ? "text-emerald-500" : ""}>{m.label}</span>
                    <span className="text-gray-500 tabular-nums">{m.progress}/{m.target}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-accent/70" style={{ width: `${(m.progress / m.target) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="t-eyebrow mb-3">Recompensas</p>
            <div className="space-y-2">
              {data.tiers.map((t) => (
                <div key={t.tier} className={`flex items-center gap-3 px-3 py-2.5 rounded-card border ${t.reached ? "border-accent/40" : "border-border opacity-70"}`}>
                  <Gift size={16} className={t.reached ? "text-accent" : "text-gray-500"} />
                  <span className="text-sm flex-1">{t.xp} XP · {t.label}</span>
                  {t.claimed ? <Check size={15} className="text-emerald-500" /> : t.reached ? (
                    <button onClick={() => claim(t.tier)} className="px-3 py-1 rounded-card bg-accent text-onaccent text-xs font-semibold hover:opacity-90">Reclamar</button>
                  ) : <span className="text-xs text-gray-500">Bloqueado</span>}
                </div>
              ))}
            </div>
          </Card>

          {data.titles.length > 0 && (
            <Card>
              <p className="t-eyebrow mb-3">Tus títulos</p>
              <div className="flex flex-wrap gap-2">
                {data.titles.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-500 text-xs">
                    <Award size={12} /> {t.title} · {t.season}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}
