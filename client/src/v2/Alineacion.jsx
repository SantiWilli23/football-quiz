import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Adivina la alineación: eliges equipo y armas los 11 titulares. Cuando sale la alineación
// real, cada ficha se da vuelta (verde si estaba, roja si no). 8 aciertos o más = sobre del evento.
export default function Alineacion() {
  const { date } = useParams();
  const toast = useToast();
  const [team, setTeam] = useState("home");
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState(0); // fichas ya dadas vuelta

  const load = (t = team) => api.get("/events/lineup", { params: { date, team: t } }).then((r) => {
    setData(r.data);
    if (r.data.guess && !picked.length) { setPicked(r.data.guess.xi); setTeam(r.data.guess.team); }
  }).catch((e) => setData({ error: e.response?.data?.error || "No se pudo cargar" }));
  useEffect(() => { load(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = data?.reveal;
  // las fichas se dan vuelta una por una
  useEffect(() => {
    if (!reveal) return undefined;
    setShown(0);
    const t = setInterval(() => setShown((n) => { if (n >= reveal.marks.length) { clearInterval(t); return n; } return n + 1; }), 450);
    return () => clearInterval(t);
  }, [reveal]);

  const squad = data?.candidates?.[team] || [];
  const locked = !!data?.guess?.revealed;
  const ev = data?.event;
  const toggle = (name) => setPicked((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : cur.length >= 11 ? cur : [...cur, name]));
  const names = useMemo(() => ev ? { home: ev.teams.home.name, away: ev.teams.away.name } : {}, [ev]);

  async function save() {
    setSaving(true);
    try { await api.post("/events/lineup-guess", { date, team, players: picked }); toast("Alineación guardada. Te avisamos cuando salga la real."); await load(); }
    catch (e) { toast(e.response?.data?.error || "No se pudo guardar"); } finally { setSaving(false); }
  }

  if (!data) return <Layout exitTo="/hoy"><p className="text-sm text-gray-500">Cargando…</p></Layout>;
  if (data.error) return <Layout exitTo="/hoy"><p className="text-sm text-red-400">{data.error}</p></Layout>;

  return (
    <Layout>
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <p className="t-eyebrow">{ev.label}</p>
          <h1 className="t-title">Adivina la alineación</h1>
          <p className="text-sm text-gray-400">Elige un equipo y arma su once titular. Con 8 aciertos o más ganas un sobre del evento (no da puntos).</p>
        </div>

        {!locked && !data.guess && (
          <div className="flex gap-1.5" role="tablist" aria-label="Equipo">
            {["home", "away"].map((s) => (
              <button key={s} role="tab" aria-selected={team === s} onClick={() => { setTeam(s); setPicked([]); load(s); }} className={`min-h-[44px] flex-1 rounded-xl border text-sm ${team === s ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{names[s]}</button>
            ))}
          </div>
        )}

        {reveal ? (
          <Card variant="feature">
            <p className="t-eyebrow">La alineación real ya salió</p>
            <p className="text-sm mt-1">Acertaste <b>{data.guess.hits}</b> de 11{reveal.pack ? " · ¡ganaste un sobre del evento!" : "."}</p>
            <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {reveal.marks.map((m, i) => (
                <li key={m.name} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${i < shown ? (m.hit ? "border-good bg-good/15" : "border-bad bg-bad/15") : "border-border"}`}>
                  {i < shown ? (m.hit ? <Check size={14} className="text-good" /> : <X size={14} className="text-bad" />) : <span className="h-3.5 w-3.5" />}
                  <span className="min-w-0 truncate">{m.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">El once real: {reveal.real.join(", ")}.</p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm"><b className="tabular-nums">{picked.length}</b>/11 elegidos · {names[team]}</p>
            {squad.length === 0 && <p className="mt-2 text-sm text-gray-500">Todavía no hay plantel disponible para este equipo.</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {squad.map((n) => (
                <button key={n} onClick={() => toggle(n)} className={`min-h-[36px] rounded-full border px-3 text-sm ${picked.includes(n) ? "border-accent bg-accent/15" : "border-border text-gray-300"}`}>{n}</button>
              ))}
            </div>
            <button onClick={save} disabled={picked.length !== 11 || saving} className="btn btn-primary mt-4 w-full disabled:opacity-40">{data.guess ? "Actualizar mi alineación" : "Guardar mi alineación"}</button>
            {data.guess && <p className="mt-2 text-xs text-gray-500">Guardada. Cuando salga la alineación real, se revela acá.</p>}
          </Card>
        )}
      </div>
    </Layout>
  );
}
