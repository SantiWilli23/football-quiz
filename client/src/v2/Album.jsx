import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Gift, Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { useToast } from "../context/ToastContext.jsx";

const PACK = { normal: "sobre normal", bueno: "sobre bueno", top: "sobre top" };

// Banner de la temporada especial de un torneo de selecciones (en Hoy): fase, día y próximo partido de Chile.
export function TorneoBanner() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/torneo/current").then((r) => setData(r.data)).catch(() => setData(null)); }, []);
  if (!data?.tournament) return null;
  const t = data.tournament;
  const done = data.nations.filter((n) => n.complete).length;
  return (
    <Card variant="feature" className="fq-rise">
      <p className="t-eyebrow flex items-center gap-1.5"><Trophy size={13} /> {t.name}</p>
      <p className="mt-1 font-semibold">{t.phase} · día {t.day} de {t.total}</p>
      {data.nextRoja && (
        <p className="text-sm text-gray-300">Próximo de Chile: <b>{data.nextRoja.home} vs {data.nextRoja.away}</b> · {new Date(`${data.nextRoja.date}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</p>
      )}
      <Link to="/album" className="btn btn-secondary btn-sm mt-3 inline-flex">Álbum de selecciones · {done}/{data.nations.length}</Link>
    </Card>
  );
}

// Álbum de selecciones: una casilla por selección que se completa con tus cartas distintas de esa
// nacionalidad (hasta 11). Los premios se cobran solos al abrirlo.
export default function Album() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const load = useCallback(() => api.get("/torneo/current").then((r) => setData(r.data)).catch(() => setData(false)), []);

  useEffect(() => {
    (async () => {
      try {
        const { data: c } = await api.post("/torneo/claim");
        for (const g of c.got) toast(g.pack ? `¡${g.label}! Ganaste un ${PACK[g.pack]}.` : `¡${g.label}! Ganaste la insignia del torneo.`);
      } catch { /* sin torneo activo */ }
      load();
    })();
  }, [load, toast]);

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <p className="t-eyebrow">Cartas</p>
          <h1 className="t-title">Álbum de selecciones</h1>
        </div>
        {data === null && <p className="text-sm text-gray-500">Cargando…</p>}
        {data === false && <p className="text-sm text-red-400">No se pudo cargar el álbum.</p>}
        {data && !data.tournament && <Card><p className="text-sm text-gray-400">Todavía no hay un torneo de selecciones. Cuando empiece uno, acá aparece el álbum.</p></Card>}
        {data?.tournament && (
          <>
            <Card variant="feature">
              <p className="t-eyebrow">{data.tournament.name}</p>
              <p className="mt-1 text-sm text-gray-300">{data.tournament.phase} · día {data.tournament.day} de {data.tournament.total}. Cada sobre que abras trae una carta de alguna selección del torneo.</p>
            </Card>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.nations.map((n, i) => (
                <div key={n.name} className={`fq-deal rounded-2xl border p-3 ${n.complete ? "border-accent/60 bg-accent/10" : "border-border bg-panel"}`} style={{ animationDelay: `${i * 50}ms` }}>
                  <p className="flex items-center justify-between font-semibold"><span className="truncate">{n.name}</span>{n.complete && <Check size={15} className="shrink-0 text-accent" />}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.round((n.owned / (n.target || 1)) * 100)}%` }} /></div>
                  <p className="mt-1 text-xs tabular-nums text-gray-400">{n.owned}/{n.target} cartas</p>
                </div>
              ))}
            </div>
            <Card>
              <p className="t-eyebrow flex items-center gap-1.5"><Gift size={13} /> Premios</p>
              <ul className="mt-2 divide-y divide-border text-sm">
                {data.rewards.map((r) => (
                  <li key={r.key} className="flex items-center justify-between gap-3 py-2">
                    <span>{r.label}</span>
                    <span className={`text-xs ${r.claimed ? "text-accent" : "text-gray-500"}`}>{r.pack ? PACK[r.pack] : "insignia del torneo"}{r.claimed ? " · ganado" : ""}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <p className="text-xs text-gray-500">Una selección se completa con tus cartas distintas de esa nacionalidad (hasta 11). Si vendes cartas después, los premios ya ganados se quedan.</p>
          </>
        )}
      </div>
    </Layout>
  );
}
