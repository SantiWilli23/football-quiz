import { useEffect, useState } from "react";
import { Check, Repeat } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";
import SeasonWindowNotice from "../components/SeasonWindowNotice.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Mercado de pases: predecí a dónde juega (o si se queda) cada figura.
export default function Mercado() {
  const { toast } = useToast();
  const [data, setData] = useState(undefined);
  const [region, setRegion] = useState("europa");

  const load = () => api.get("/transfers", { params: { region } }).then((r) => setData(r.data)).catch(() => setData(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setData(undefined); load(); }, [region]);

  async function pick(rumor, option) {
    if (rumor.answer || !data?.open) return;
    setData((d) => ({ ...d, rumors: d.rumors.map((r) => (r.id === rumor.id ? { ...r, pick: option } : r)) }));
    try {
      await api.post("/transfers/predict", { rumorId: rumor.id, pick: option });
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo guardar");
      load();
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-3">
        <Repeat size={22} className="text-accent shrink-0" />
        <div>
          <h1 className="t-title">Mercado de pases</h1>
          <p className="text-gray-400 text-sm">Elegí el destino de cada figura. Abre solo en las vacaciones de verano; cuando se resuelve, cada acierto suma {data?.points ?? 10} puntos.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[["europa", "Europa"], ["chile", "Chile"]].map(([k, l]) => (
          <button key={k} onClick={() => setRegion(k)} className={`btn btn-sm ${region === k ? "btn-primary" : "btn-secondary"}`} aria-pressed={region === k}>{l}</button>
        ))}
      </div>

      {data && <SeasonWindowNotice status={data.status} />}
      {data && !data.window && <Card><p className="text-sm text-gray-500">Todavía no hubo ningún mercado de {region === "chile" ? "Chile" : "Europa"}.</p></Card>}

      {data === undefined && <SkeletonCard lines={4} />}
      {data === null && <Card><p className="text-sm text-gray-500">No se pudo cargar el mercado.</p></Card>}

      {data && data.window && (
        <>
          <p className="t-eyebrow mb-3">{data.window}</p>
          <div className="space-y-3">
            {data.rumors.map((r) => (
              <Card key={r.id}>
                <p className="font-semibold mb-3">{r.player}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {r.options.map((o) => {
                    const mine = r.pick === o;
                    const right = r.answer === o;
                    return (
                      <button
                        key={o}
                        onClick={() => pick(r, o)}
                        disabled={!!r.answer || !data.open}
                        className={`text-left px-3 py-2 rounded-card border text-sm transition-colors ${
                          right ? "border-emerald-500/60 bg-emerald-500/10"
                            : mine ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border text-gray-300 hover:border-white/30"
                        } ${r.answer && !right && !mine ? "opacity-50" : ""}`}
                      >
                        <span className="inline-flex items-center gap-1.5">{(mine || right) && <Check size={13} />}{o}</span>
                      </button>
                    );
                  })}
                </div>
                {r.answer && <p className="t-meta mt-2">Resultado: {r.answer}{r.pick === r.answer ? ` · ¡acertaste! +${data.points} pts` : ""}</p>}
              </Card>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
