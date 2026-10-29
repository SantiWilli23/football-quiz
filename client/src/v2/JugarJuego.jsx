import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { Trophy } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import useFutotal2 from "./useFutotal2.js";
import { FUSED, fusedPath, gameBySlug, lastVariant, rememberVariant, unfinishedVariant } from "./fusion.js";
import { ShellContext } from "./ShellContext.js";
import { useDemo } from "../demo/version.js";
import FirstTimeHelp from "../demo/FirstTimeHelp.jsx";
import Picker from "../demo/Picker.jsx";
import RecordsDemo from "../demo/RecordsDemo.jsx";
import { hintFor } from "../demo/hints.js";

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
  const demo = useDemo();
  const nm = (v) => (demo ? hintFor(game, v.key)?.[0] || v.label : v.label);
  const pending = unfinishedVariant(game);
  const base = "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors";
  return (
    <div className="mb-4 space-y-2">
      <div>
        <p className="t-eyebrow">Jugar</p>
        <h1 className="t-title">{g.label}</h1>
      </div>
      {pending && (pending.key !== variant.key || records) && (
        <Link to={fusedPath(game, pending.key)} onClick={() => setRecords(false)} className="fq-rise flex items-center justify-between gap-2 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm">
          <span>Tienes una partida de <b>{pending.label}</b> a medias</span><span className="font-semibold text-accent">Continuar →</span>
        </Link>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 items-center" role="tablist" aria-label={g.pick || "Variantes"}>
        {g.pick && <span className="t-eyebrow shrink-0 mr-1">{g.pick}</span>}
        {g.variants.length > 1 && g.variants.map((v) => (
          <Link key={v.key} role="tab" aria-selected={variant.key === v.key && !records} to={fusedPath(game, v.key)} onClick={() => setRecords(false)}
            className={`${base} ${variant.key === v.key && !records ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{nm(v)}</Link>
        ))}
        <button role="tab" aria-selected={records} onClick={() => setRecords(!records)}
          className={`${base} inline-flex items-center gap-1.5 ${records ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}><Trophy size={13} /> Récords</button>
      </div>
    </div>
  );
}

// Elegir la dificultad (o la versión) antes de jugar: una tarjeta grande por cada una.
function PickVariant({ game, g }) {
  const last = lastVariant(game);
  return (
    <div className="space-y-4">
      <div>
        <p className="t-eyebrow">Jugar</p>
        <h1 className="t-title">{g.label}</h1>
        <p className="text-sm text-gray-400 mt-1">De potrero a leyenda. Elige la {g.pick.toLowerCase()}.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {g.variants.map((v) => (
          <Link key={v.key} to={fusedPath(game, v.key)} className="p-card block hover:border-accent transition-colors" style={v.key === last ? { borderColor: "var(--me-line)" } : undefined}>
            <span className="t-eyebrow">{g.pick}</span>
            <b className="block mt-1" style={{ font: "800 24px var(--f-d)" }}>{v.label}</b>
            <span className="block text-sm text-gray-400 mt-1.5">{v.hint}</span>
            <span className="p-btn sm mt-4">Jugar en {v.label.toLowerCase()}</span>
          </Link>
        ))}
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
  const demo = useDemo();
  const game = found?.[0];
  const g = found?.[1];
  // Un juego con una sola variante (Bingo) vive en /jugar/<juego> a secas: sin esto se
  // redirigía a sí mismo y la pantalla quedaba en negro.
  const variant = g?.variants.find((v) => v.key === variante) || (!variante && g?.variants.length === 1 ? g.variants[0] : null);

  useEffect(() => { if (game && variant) rememberVariant(game, variant.key); }, [game, variant]);
  useEffect(() => { setRecords(false); }, [variante]);

  const shell = useMemo(() => (game && variant ? { chips: <Chips game={game} g={g} variant={variant} records={records} setRecords={setRecords} /> } : null), [game, g, variant, records]);

  if (!ready) return null;
  if (!found || !on || !games.includes(game)) return <Navigate to="/juegos" replace />;
  // Cotrero: sin dificultad elegida se pregunta (Simple o Media) en vez de abrir la última.
  if (!variant && g.pick) return <Layout><PickVariant game={game} g={g} /></Layout>;
  // Demo: se elige cómo jugar antes de entrar a la primera variante.
  if (!variant && demo && !search) {
    return <Picker title={g.label} subtitle="Elige cómo quieres jugar." items={g.variants.map((v) => { const h = hintFor(game, v.key); return { label: h?.[0] || v.label, hint: h?.[1] || v.hint, to: fusedPath(game, v.key) }; })} />;
  }
  if (!variant) return <Navigate to={`${fusedPath(game, lastVariant(game))}${search}`} replace />;
  const Page = variant.Page;
  return (
    <ShellContext.Provider value={shell}>
      <Suspense fallback={<Layout>{shell?.chips}<p className="text-sm text-gray-500">Cargando…</p></Layout>}>
        {records ? <Layout>{demo ? <RecordsDemo game={game} g={g} current={variant.key} /> : <Records variant={variant} />}</Layout> : <Page />}
      </Suspense>
      {demo && !records && <FirstTimeHelp key={variant.key} pathname={`/jugar/${g.slug}/${variant.key}`} />}
    </ShellContext.Provider>
  );
}

export { FUSED };
