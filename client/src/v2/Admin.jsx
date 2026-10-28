import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const pct = (v) => (v == null ? "–" : `${v}%`);

// Panel del dueño: métricas, avisos, tareas y el partido de la semana (se puede cambiar cualquier
// pregunta que nadie haya respondido). Solo funciona para el usuario de OWNER_USERNAME.
export default function Admin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [date, setDate] = useState(addDays(today(), 1));
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/admin/summary").then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || "No se pudo abrir el panel."));
  }, []);

  const loadMatch = useCallback(() => {
    setMatch(null);
    api.get(`/admin/match/${date}`).then((r) => setMatch(r.data)).catch((e) => setMatch({ error: e.response?.data?.error || "No se pudo cargar" }));
  }, [date]);
  useEffect(() => { if (data) loadMatch(); }, [data, loadMatch]);

  async function reroll(idx) {
    setBusy(true);
    try { await api.post(`/admin/match/${date}/reroll`, { idx }); loadMatch(); } catch (e) { setMatch((m) => ({ ...m, error: e.response?.data?.error || "No se pudo cambiar" })); } finally { setBusy(false); }
  }

  if (error) return <Layout exitTo="/hoy"><p className="text-sm text-red-400">{error}</p></Layout>;
  if (!data) return <Layout exitTo="/hoy"><p className="text-sm text-gray-500">Cargando…</p></Layout>;
  const m = data.metrics;

  return (
    <Layout wide>
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <p className="t-eyebrow">Panel del dueño</p>
          <h1 className="t-title">Futotal 2.0 {data.flag ? "" : <span className="text-sm font-normal text-amber">(rediseño apagado: falta FUTOTAL2=1)</span>}</h1>
        </div>

        {data.alerts.length > 0 && (
          <Card variant="feature">
            <p className="t-eyebrow flex items-center gap-1.5"><AlertTriangle size={13} /> Alertas</p>
            <ul className="mt-1 list-disc pl-5 text-sm">{data.alerts.map((a) => <li key={a}>{a}</li>)}</ul>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Usuarios", m.users], ["Nuevos (7 d)", m.newWeek], ["Jugaron hoy", `${m.playedToday} (${pct(m.pctPlayedToday)})`], ["En un club iniciado", pct(m.pctInStartedClub)],
            ["Vuelven al día siguiente", m.d1 ? `${m.d1.pct}% (${m.d1.back}/${m.d1.cohort})` : "–"], ["Vuelven a la semana", m.d7 ? `${m.d7.pct}% (${m.d7.back}/${m.d7.cohort})` : "–"], ["Clubes", `${m.clubs.started}/${m.clubs.total} iniciados`], ["Activos (7 d)", m.active7]].map(([l, v]) => (
            <Card key={l}><p className="text-[11px] uppercase tracking-wide text-gray-500">{l}</p><p className="mt-0.5 text-xl font-bold tabular-nums">{v}</p></Card>
          ))}
        </div>

        <Card>
          <div className="flex items-center justify-between gap-2">
            <p className="t-eyebrow">Partido del día · revisión</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => { const d = addDays(today(), n); return <button key={d} onClick={() => setDate(d)} className={`rounded-full border px-2.5 py-1 text-xs ${date === d ? "border-accent bg-accent/10" : "border-border text-gray-400"}`}>{d.slice(5)}</button>; })}
            </div>
          </div>
          {!match && <p className="mt-2 text-sm text-gray-500">Cargando…</p>}
          {match?.error && <p className="mt-2 text-sm text-red-400">{match.error}</p>}
          {match?.event && <p className="mt-2 text-sm text-amber">Partido temático: {match.event.home_name} vs {match.event.away_name}</p>}
          {match?.locked && <p className="mt-2 text-xs text-gray-500">Ya hay respuestas de ese día: no se puede cambiar.</p>}
          <ol className="mt-2 space-y-1.5">
            {(match?.items || []).map((it, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <span className="w-6 shrink-0 text-xs tabular-nums text-gray-500">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-gray-500">{it.kind} · {it.area}</span>
                  {it.kind === "quien" && <>Carrera: {it.clues.map((c) => c.club).join(" → ")} <b className="text-accent">= {it.options[it.answer]}</b></>}
                  {it.kind === "mas_menos" && <>{it.left.name} (€{it.left.value} M) vs {it.right.name} <b className="text-accent">= {it.options[it.answer]} (€{it.rightValue} M)</b></>}
                  {(it.kind === "penal" || it.kind === "especial") && <>{it.question} <b className="text-accent">= {it.options[it.answer]}</b></>}
                </span>
                {!match.locked && it.kind !== "especial" && <button disabled={busy} onClick={() => reroll(i)} className="btn btn-secondary btn-sm shrink-0" aria-label="Cambiar esta pregunta"><RefreshCw size={13} /></button>}
              </li>
            ))}
          </ol>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="t-eyebrow">Eventos temáticos</p>
            <ul className="mt-1 text-sm">{data.upcoming.length === 0 ? <li className="text-gray-500">Ninguno detectado.</li> : data.upcoming.map((e) => <li key={e.date}>{e.date} · {e.kit_key} · {e.home_name} vs {e.away_name}</li>)}</ul>
            <p className="mt-2 text-xs text-gray-500">Kits: {data.kits.map((k) => k.label).join(", ")}. Se editan en server/data/events/kits.json.</p>
          </Card>
          <Card>
            <p className="t-eyebrow">Uso (últimos 7 días)</p>
            <ul className="mt-1 text-sm">{m.events.length === 0 ? <li className="text-gray-500">Sin datos.</li> : m.events.map((e) => <li key={e.name} className="flex justify-between"><span>{e.name}</span><b className="tabular-nums">{e.n}</b></li>)}</ul>
          </Card>
        </div>

        <SbcAdmin />
        <TournamentAdmin />

        <Card>
          <p className="t-eyebrow">Errores y tareas</p>
          <ul className="mt-1 space-y-1 text-xs">
            {data.errors.length === 0 && <li className="text-gray-500">Sin errores registrados.</li>}
            {data.errors.map((e, i) => <li key={i}><b>{e.source}</b> · {e.message} <span className="text-gray-500">×{e.count} · {e.last_at}</span></li>)}
          </ul>
          <ul className="mt-3 space-y-1 text-xs text-gray-400">
            {data.jobs.map((j) => <li key={j.at}>{j.at}: {Object.entries(j.result).map(([k, v]) => `${k} ${v.ok ? "ok" : "FALLÓ"}`).join(" · ")}</li>)}
          </ul>
        </Card>
      </div>
    </Layout>
  );
}

// Desafíos de plantilla (SBC): filtro, fechas y premio extra. Mientras uno está activo
// reemplaza a la temática que rota sola cada 14 días.
function SbcAdmin() {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ label: "", filterType: "nacionalidad", filterValue: "", start: today(), end: addDays(today(), 13), bonusCoins: 0 });
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api.get("/admin/sbc").then((r) => setInfo(r.data)).catch(() => setInfo(false)), []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPreview(null);
    const t = setTimeout(() => {
      api.get("/admin/sbc/preview", { params: { filterType: form.filterType, filterValue: form.filterValue } }).then((r) => setPreview(r.data)).catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.filterType, form.filterValue]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function create(e) {
    e.preventDefault();
    setMsg("");
    try { await api.post("/admin/sbc", { ...form, bonusCoins: Number(form.bonusCoins) || 0 }); setMsg("Desafío creado."); setForm((f) => ({ ...f, label: "" })); load(); }
    catch (err) { setMsg(err.response?.data?.error || "No se pudo crear."); }
  }
  async function remove(id) {
    try { await api.delete(`/admin/sbc/${id}`); load(); } catch { setMsg("No se pudo borrar."); }
  }
  if (info === null || info === false) return null;
  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm";
  return (
    <Card>
      <p className="t-eyebrow">Desafíos de plantilla (SBC)</p>
      <p className="mt-1 text-xs text-gray-400">Eliges el filtro y las fechas. Mientras esté activo, reemplaza a la temática automática y todos los sobres traen una carta de esa temática.</p>
      <ul className="mt-2 divide-y divide-border text-sm">
        {info.sbcs.length === 0 && <li className="py-2 text-gray-500">No hay desafíos creados: rota la temática automática.</li>}
        {info.sbcs.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1"><b className="block truncate">{c.label}</b><span className="text-xs text-gray-500">{info.filters[c.filter_type]}{c.filter_value ? `: ${c.filter_value}` : ""} · {c.start_date} a {c.end_date}{c.bonus_coins ? ` · +${c.bonus_coins} monedas` : ""}</span></span>
            <button onClick={() => remove(c.id)} className="btn btn-secondary btn-sm">Borrar</button>
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="mt-3 grid gap-2">
        <input value={form.label} onChange={set("label")} maxLength={40} placeholder="Nombre (por ejemplo, Los albicelestes)" className={field} />
        <div className="grid grid-cols-2 gap-2">
          <select value={form.filterType} onChange={set("filterType")} className={field} aria-label="Filtro">
            {Object.entries(info.filters).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input value={form.filterValue} onChange={set("filterValue")} disabled={form.filterType === "retirados"} placeholder={form.filterType === "liga" ? "premier, laliga…" : "Valor"} className={`${field} disabled:opacity-40`} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-gray-500">Desde<input type="date" value={form.start} onChange={set("start")} className={field} /></label>
          <label className="text-xs text-gray-500">Hasta<input type="date" value={form.end} onChange={set("end")} className={field} /></label>
          <label className="text-xs text-gray-500">Monedas extra<input type="number" min="0" max="500" value={form.bonusCoins} onChange={set("bonusCoins")} className={field} /></label>
        </div>
        {preview && (
          <p className={`text-xs ${preview.feasible ? "text-accent" : "text-amber"}`}>
            {preview.total} cartas: {preview.by.GK} arqueros, {preview.by.DEF} defensas, {preview.by.MID} medios, {preview.by.FWD} delanteros. {preview.feasible ? "Alcanza para armar el once." : "No alcanza (se necesitan 2, 5, 5 y 4)."}
          </p>
        )}
        <button className="btn btn-primary btn-sm" disabled={!form.label.trim() || (preview && !preview.feasible)}>Crear desafío</button>
        {msg && <p className="text-sm text-gray-300" role="status">{msg}</p>}
      </form>
    </Card>
  );
}

// Torneos de selecciones (W7): nombre, fechas y las selecciones que juegan.
function TournamentAdmin() {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ name: "", starts: today(), ends: addDays(today(), 29), groupsEnd: "", nations: [] });
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api.get("/admin/tournaments").then((r) => setInfo(r.data)).catch(() => setInfo(false)), []);
  useEffect(() => { load(); }, [load]);
  if (info === null || info === false) return null;
  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm";
  const toggle = (n) => setForm((f) => ({ ...f, nations: f.nations.includes(n) ? f.nations.filter((x) => x !== n) : [...f.nations, n] }));
  async function create(e) {
    e.preventDefault();
    setMsg("");
    try { await api.post("/admin/tournaments", { ...form, groupsEnd: form.groupsEnd || null }); setMsg("Torneo creado."); setForm((f) => ({ ...f, name: "", nations: [] })); load(); }
    catch (err) { setMsg(err.response?.data?.error || "No se pudo crear."); }
  }
  return (
    <Card>
      <p className="t-eyebrow">Torneo de selecciones (álbum)</p>
      <p className="mt-1 text-xs text-gray-400">Mientras dura: álbum de selecciones, banner en Hoy y una carta de selección en cada sobre. Solo hay selecciones con al menos 5 cartas.</p>
      <ul className="mt-2 divide-y divide-border text-sm">
        {info.tournaments.length === 0 && <li className="py-2 text-gray-500">No hay torneos creados.</li>}
        {info.tournaments.map((t) => (
          <li key={t.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1"><b className="block truncate">{t.name}</b><span className="text-xs text-gray-500">{t.starts} a {t.ends} · {t.nations.length} selecciones</span></span>
            <button onClick={() => api.delete(`/admin/tournaments/${t.id}`).then(load)} className="btn btn-secondary btn-sm">Borrar</button>
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="mt-3 grid gap-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={50} placeholder="Nombre (por ejemplo, Copa América 2028)" className={field} />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-gray-500">Desde<input type="date" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} className={field} /></label>
          <label className="text-xs text-gray-500">Hasta<input type="date" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} className={field} /></label>
          <label className="text-xs text-gray-500">Fin de grupos<input type="date" value={form.groupsEnd} onChange={(e) => setForm({ ...form, groupsEnd: e.target.value })} className={field} /></label>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Selecciones">
          {info.available.map((n) => (
            <button type="button" key={n.name} onClick={() => toggle(n.name)} aria-pressed={form.nations.includes(n.name)}
              className={`rounded-full border px-2.5 py-1 text-xs ${form.nations.includes(n.name) ? "border-accent bg-accent/15" : "border-border text-gray-400"}`}>{n.name} <span className="text-gray-500">{n.cards}</span></button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" disabled={!form.name.trim() || form.nations.length < 2}>Crear torneo</button>
        {msg && <p className="text-sm text-gray-300" role="status">{msg}</p>}
      </form>
    </Card>
  );
}
