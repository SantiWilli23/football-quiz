import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Lock, Star } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useClubs } from "./useClubs.js";
import Copa from "./Copa.jsx";

const VIEWS = [["hoy", "Hoy"], ["mes", "Mes"], ["general", "General"]];
const MODES = {
  clasico: { label: "Clásico", text: "Cuentan el partido del día y la copa." },
  total: { label: "Total", text: "Todo cuenta; el partido del día y la copa valen el doble. Las partidas libres suman con tope de 100 por día." },
};

export default function Club() {
  const { user } = useAuth();
  const { clubs, loaded, main, reload } = useClubs();
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("hoy");
  const [table, setTable] = useState(null);
  const [invite, setInvite] = useState("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newMode, setNewMode] = useState("clasico");

  const club = clubs.find((c) => c.id === selected) || main;

  const loadTable = () => {
    if (!club) return;
    setTable(null);
    api.get(`/clubs/${club.id}/table`, { params: { view } }).then((r) => setTable(r.data)).catch(() => setTable({ table: [], error: true }));
  };
  useEffect(loadTable, [club?.id, view, club?.started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setInvite("");
    if (club) api.get(`/groups/${club.id}`).then((r) => setInvite(r.data.group?.invite_code || "")).catch(() => {});
  }, [club?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(fn, ok) {
    setMsg("");
    try { await fn(); setMsg(ok); await reload(); } catch (e) { setMsg(e.response?.data?.error || "No se pudo completar la acción."); }
  }

  const start = () => act(() => api.post(`/clubs/${club.id}/start`), "¡Temporada iniciada! Desde ahora suman los puntos.");
  const setMode = (mode) => act(() => api.post(`/clubs/${club.id}/mode`, { mode }), `Modo ${MODES[mode].label} activado.`);
  const makeMain = () => act(() => api.post("/clubs/main", { groupId: club.id }), "Es tu club principal.");
  const create = (e) => { e.preventDefault(); if (name.trim()) act(async () => { const r = await api.post("/groups", { name: name.trim(), mode: newMode }); setSelected(r.data.group.id); setName(""); }, "Club creado. Invitá a tus amigos con el código."); };
  const join = (e) => { e.preventDefault(); if (code.trim()) act(async () => { const r = await api.post("/groups/join", { invite_code: code.trim() }); setSelected(r.data.group.id); setCode(""); }, "¡Te uniste al club!"); };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <p className="t-eyebrow">Club</p>
          <h1 className="t-title">{club ? club.name : "Tu club"}</h1>
        </div>

        {clubs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {clubs.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)} className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${club?.id === c.id ? "border-accent bg-accent/10 text-white" : "border-border text-gray-400"}`}>
                {c.main && <Star size={12} className="text-amber" />}{c.name}
              </button>
            ))}
          </div>
        )}

        {club && (
          <>
            {!club.started && (
              <Card variant="feature">
                <p className="t-eyebrow flex items-center gap-1.5"><Lock size={13} /> Pretemporada</p>
                <p className="text-sm text-gray-300 mt-1">El club todavía no suma puntos. Cuando estén todos adentro, el dueño inicia la temporada y arranca la tabla.</p>
                <p className="text-sm text-gray-500 mt-1">{club.members} {club.members === 1 ? "miembro" : "miembros"}{club.members < 2 ? " · hacen falta al menos 2" : ""}.</p>
                {club.owner && <button onClick={start} disabled={club.members < 2} className="btn btn-primary mt-3 disabled:opacity-50">Iniciar temporada</button>}
              </Card>
            )}

            <Card>
              <div className="flex items-center justify-between gap-2">
                <p className="t-eyebrow">Modo {MODES[club.mode].label}</p>
                {club.owner && (
                  <div className="flex gap-1.5">
                    {Object.entries(MODES).filter(([k]) => k !== club.mode).map(([k, m]) => (
                      <button key={k} onClick={() => setMode(k)} className="btn btn-secondary btn-sm">Pasar a {m.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">{MODES[club.mode].text}</p>
              {club.owner && club.started && <p className="text-xs text-gray-600 mt-1">El modo solo se cambia el día 1 de cada mes.</p>}
            </Card>

            {club.started && (
              <Card>
                <div className="flex gap-1.5 mb-3" role="tablist">
                  {VIEWS.map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`flex-1 rounded-xl border py-1.5 text-sm ${view === k ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{label}</button>
                  ))}
                </div>
                {table === null && <p className="text-sm text-gray-500">Cargando…</p>}
                {table?.error && <p className="text-sm text-red-400">No se pudo cargar la tabla.</p>}
                {table && !table.error && table.table.length === 0 && <p className="text-sm text-gray-500">Nadie sumó puntos todavía.</p>}
                <ol className="divide-y divide-border">
                  {(table?.table || []).map((r) => (
                    <li key={r.userId} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="w-6 text-center font-bold text-gray-400 tabular-nums">{r.rank === 1 ? <Crown size={15} className="mx-auto text-amber" /> : r.rank}</span>
                      <span className={`flex-1 min-w-0 truncate ${r.userId === user?.id ? "font-semibold text-accent" : ""}`}>{r.username}</span>
                      <span className="font-semibold tabular-nums">{r.points}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            <Copa clubId={club.id} userId={user?.id} />

            <Card>
              <p className="t-eyebrow mb-2">Invitar</p>
              <p className="text-sm text-gray-400">Pásales este código a tus amigos:</p>
              <p className="mt-1 select-all rounded-xl border border-dashed border-border bg-bg px-3 py-2 text-center font-mono text-lg tracking-widest">{invite || "…"}</p>
              {invite && <button onClick={() => { const url = `${window.location.origin}/invitacion/${invite}?de=${encodeURIComponent(user?.username || "")}`; navigator.clipboard?.writeText(url).then(() => setMsg("Link copiado: tu amigo verá tu marcador como desafío."), () => setMsg(url)); }} className="btn btn-secondary btn-sm mt-3">Copiar link con desafío</button>}
              {!club.main && <button onClick={makeMain} className="btn btn-secondary btn-sm mt-3">Hacer mi club principal</button>}
              {club.main && <p className="text-xs text-gray-500 mt-3 flex items-center gap-1"><Star size={12} className="text-amber" /> Es tu club principal: de acá sale el súper sobre del podio del mes.</p>}
            </Card>

            <Link to="/grupo" className="block text-center text-xs text-gray-500 hover:text-white">Copa, retos y más del club</Link>
          </>
        )}

        {msg && <p className="text-sm text-center text-accent" role="status">{msg}</p>}

        {loaded && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <p className="t-eyebrow mb-2">Crear un club</p>
              <form onSubmit={create} className="space-y-2">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nombre del club" className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm" />
                <div className="flex gap-1.5">
                  {Object.entries(MODES).map(([k, m]) => (
                    <button type="button" key={k} onClick={() => setNewMode(k)} className={`flex-1 rounded-xl border py-1.5 text-xs ${newMode === k ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{m.label}</button>
                  ))}
                </div>
                <button className="btn btn-primary w-full btn-sm">Crear</button>
              </form>
            </Card>
            <Card>
              <p className="t-eyebrow mb-2">Unirme con un código</p>
              <form onSubmit={join} className="space-y-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código del club" className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm uppercase" />
                <button className="btn btn-secondary w-full btn-sm">Unirme</button>
              </form>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
