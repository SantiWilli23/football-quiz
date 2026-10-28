import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import useFutotal2 from "./useFutotal2.js";
import { FUSED, fusedPath, gameBySlug, lastVariant, rememberVariant } from "./fusion.js";
import { ShellContext } from "./ShellContext.js";

// Récords de la variante: lo que ya guarda el Historial (partidas, mejor puntaje, promedio,
// plenos y racha). No se cambia ninguna clave: se leen las que ya existen.
function Records({ variant }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get("/game-history/historic").then((r) => setRows(r.data.games)).catch(() => setRows([]));
  }, []);
  const mine = (rows || []).filter((g) => variant.keys.includes(g.game_key));
  return (
    <Card>
      <p className="t-eyebrow flex items-center gap-1.5"><Trophy size={13} /> Récords · {variant.label}</p>
      {rows === null && <p className="mt-2 text-sm text-gray-500">Cargando…</p>}
      {rows !== null && variant.keys.length === 0 && <p className="mt-2 text-sm text-gray-400">Esta variante no guarda récords personales.</p>}
      {rows !== null && variant.keys.length > 0 && mine.length === 0 && <p className="mt-2 text-sm text-gray-400">Todavía no jugaste esta variante. Tu primera partida aparece acá.</p>}
      {mine.map((g) => (
        <dl key={g.game_key} className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[["Partidas", g.played], ["Mejor", g.best_score], ["Promedio", g.average], ["Mejor racha de plenos", g.best_streak]].map(([label, v]) => (
            <div key={label} className="rounded-xl border border-border px-2 py-2.5">
              <dd className="text-xl font-bold tabular-nums">{v}</dd>
              <dt className="text-[11px] leading-tight text-gray-500">{label}</dt>
            </div>
          ))}
        </dl>
      ))}
    </Card>
  );
}

function Chips({ game, g, variant, records, setRecords }) {
  const base = "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors";
  return (
    <div className="mb-4 space-y-2">
      <div>
        <p className="t-eyebrow">Jugar</p>
        <h1 className="t-title">{g.label}</h1>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Variantes">
        {g.variants.length > 1 && g.variants.map((v) => (
          <Link key={v.key} role="tab" aria-selected={variant.key === v.key && !records} to={fusedPath(game, v.key)} onClick={() => setRecords(false)}
            className={`${base} ${variant.key === v.key && !records ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{v.label}</Link>
        ))}
        <button role="tab" aria-selected={records} onClick={() => setRecords(!records)}
          className={`${base} inline-flex items-center gap-1.5 ${records ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}><Trophy size={13} /> Récords</button>
      </div>
    </div>
  );
}

// Carcasa de un juego fusionado: `/jugar/<juego>` abre la última variante que usaste (o la
// primera) y `/jugar/<juego>/<variante>` abre esa. Los chips viajan por contexto hasta el
// `Layout` de la pantalla del juego, que los muestra arriba y los oculta en modo enfoque.
export default function JugarJuego() {
  const { juego, variante } = useParams();
  const { ready, on, games } = useFutotal2();
  const { search } = useLocation();
  const found = gameBySlug(juego);
  const [records, setRecords] = useState(false);
  const game = found?.[0];
  const g = found?.[1];
  const variant = g?.variants.find((v) => v.key === variante) || null;

  useEffect(() => { if (game && variant) rememberVariant(game, variant.key); }, [game, variant]);
  useEffect(() => { setRecords(false); }, [variante]);

  const shell = useMemo(() => (game && variant ? { chips: <Chips game={game} g={g} variant={variant} records={records} setRecords={setRecords} /> } : null), [game, g, variant, records]);

  if (!ready) return null;
  if (!found || !on || !games.includes(game)) return <Navigate to="/juegos" replace />;
  if (!variant) return <Navigate to={`${fusedPath(game, lastVariant(game))}${search}`} replace />;
  const Page = variant.Page;
  return (
    <ShellContext.Provider value={shell}>
      <Suspense fallback={<Layout>{shell?.chips}<p className="text-sm text-gray-500">Cargando…</p></Layout>}>
        {records ? <Layout><Records variant={variant} /></Layout> : <Page />}
      </Suspense>
    </ShellContext.Provider>
  );
}

export { FUSED };
