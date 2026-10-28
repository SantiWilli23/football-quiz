import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Play, PlayCircle } from "lucide-react";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { loadStats } from "../futgames/storage.js";
import { bySlug } from "./juegos.js";
import Demo from "./Demo.jsx";

// Carcasa común de los juegos fusionados: arriba chips de variante, al medio la tarjeta con el
// botón Jugar (y la demo animada de 10 s) y abajo la pestaña Récords. Jugar abre la pantalla de
// siempre en /jugar/<juego>/<variante>/jugar, así las partidas guardadas y los récords no cambian.
const lastKey = (id) => `fq2_variante:${id}`;
const readLast = (id) => { try { return localStorage.getItem(lastKey(id)); } catch { return null; } };
const writeLast = (id, v) => { try { localStorage.setItem(lastKey(id), v); } catch { /* sin storage */ } };

// ¿Hay una partida a medias de hoy? Los juegos de futgames guardan «futgames:<juego>:<fecha>».
function hasSaved(statsKey) {
  if (!statsKey) return false;
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
    return !!localStorage.getItem(`futgames:${statsKey}:${today}`);
  } catch { return false; }
}

export default function JuegoShell() {
  const { slug, variante } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const juego = bySlug(slug);
  const [tab, setTab] = useState("jugar");
  const [demo, setDemo] = useState(false);
  const wantsTab = new URLSearchParams(search).get("tab");

  const current = useMemo(() => {
    if (!juego) return null;
    const asked = juego.variantes.find((v) => v.id === variante);
    const last = juego.variantes.find((v) => v.id === readLast(juego.id));
    return asked || last || juego.variantes[0];
  }, [juego, variante]);

  useEffect(() => { if (juego && current) writeLast(juego.id, current.id); }, [juego, current]);

  if (!juego) return <Navigate to="/juegos" replace />;
  // Sin variante en la ruta se abre la última que usaste (o la primera).
  if (!variante) return <Navigate to={`/jugar/${juego.slug}/${current.id}${search}`} replace />;

  const votacion = wantsTab === "votacion" && juego.tabs?.[0];
  const target = votacion ? votacion.play : `/jugar/${juego.slug}/${current.id}/jugar${search.replace(/[?&]tab=\w+/, "").replace(/^&/, "?")}`;
  const saved = hasSaved(current.statsKey);
  const Icon = juego.icon;

  return (
    <Layout>
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center gap-3">
          <Icon size={22} className="shrink-0 text-accent" />
          <div className="min-w-0"><h1 className="t-title">{juego.label}</h1><p className="text-sm text-gray-400">{juego.text}</p></div>
        </div>

        {(juego.variantes.length > 1 || juego.tabs) && (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Variante">
            {juego.variantes.map((v) => (
              <Link key={v.id} to={`/jugar/${juego.slug}/${v.id}`} role="tab" aria-selected={!votacion && current.id === v.id} className={`min-h-[40px] rounded-full border px-3.5 py-2 text-sm ${!votacion && current.id === v.id ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{v.label}</Link>
            ))}
            {juego.tabs?.map((t) => (
              <Link key={t.id} to={`/jugar/${juego.slug}/${current.id}?tab=${t.id}`} role="tab" aria-selected={wantsTab === t.id} className={`min-h-[40px] rounded-full border px-3.5 py-2 text-sm ${wantsTab === t.id ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{t.label}</Link>
            ))}
          </div>
        )}

        <div className="flex gap-1" role="tablist" aria-label="Sección">
          {[["jugar", "Jugar"], ["records", "Récords"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[36px] rounded-full border px-3 text-xs ${tab === k ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{l}</button>
          ))}
        </div>

        {tab === "jugar" ? (
          <Card variant="feature">
            <p className="t-eyebrow">{votacion ? votacion.label : current.label}</p>
            <p className="mt-1 text-sm text-gray-300">{votacion ? votacion.text : current.text}</p>
            <button onClick={() => navigate(target)} className="btn btn-primary mt-4 w-full inline-flex items-center justify-center gap-2"><Play size={16} /> {saved ? "Continuar" : "Jugar"}</button>
            <button onClick={() => setDemo(true)} className="btn btn-secondary mt-2 w-full inline-flex items-center justify-center gap-2"><PlayCircle size={16} /> Ver demo</button>
            <p className="mt-3 text-xs text-gray-500">La primera partida del día de {juego.label} suma a tu club si es de modo Total. El resto del día es práctica y da sobres.</p>
          </Card>
        ) : (
          <Records juego={juego} />
        )}
      </div>
      {demo && <Demo onClose={() => setDemo(false)} />}
    </Layout>
  );
}

// Récords: une lo que ya guarda cada pantalla (nada cambia de lugar ni de nombre).
function Records({ juego }) {
  const rows = juego.variantes.map((v) => ({ v, s: v.statsKey ? loadStats(v.statsKey) : null }));
  return (
    <Card>
      <ul className="divide-y divide-border">
        {rows.map(({ v, s }) => (
          <li key={v.id} className="py-2.5 text-sm">
            <p className="font-semibold">{v.label}</p>
            {s && s.played > 0 ? (
              <p className="mt-0.5 text-gray-300 tabular-nums">{s.played} jugadas · {Math.round((100 * s.won) / s.played)}% ganadas · racha {s.streak} (máx. {s.maxStreak})</p>
            ) : (
              <p className="mt-0.5 text-gray-500">{v.statsKey ? "Todavía no jugaste." : "Tus récords están dentro del juego, en el botón de estadísticas."}</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
