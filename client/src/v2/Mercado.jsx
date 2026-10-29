import { useCallback, useEffect, useState } from "react";
import { Clock, Coins, History, Gavel } from "lucide-react";
import api from "../api.js";
import FigCard from "../demo/FigCard.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Mercado de cartas: subastas entre miembros de tu club, con las monedas del juego.
const left = (iso) => {
  const ms = Date.parse(`${iso.replace(" ", "T")}Z`) - Date.now();
  if (ms <= 0) return "terminando";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

function Historial({ name, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/market/history", { params: { name } }).then((r) => setRows(r.data.history)).catch(() => setRows([])); }, [name]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={`Historial de ${name}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl border border-border bg-panel p-4 sm:rounded-2xl">
        <p className="font-bold">Historial · {name}</p>
        {rows === null && <p className="mt-2 text-sm text-gray-500">Cargando…</p>}
        {rows && rows.length === 0 && <p className="mt-2 text-sm text-gray-400">Todavía no cambió de manos.</p>}
        <ul className="mt-2 space-y-1.5 text-sm">
          {(rows || []).map((r, i) => (
            <li key={i} className="flex justify-between gap-2 border-b border-border/50 pb-1.5">
              <span>{r.from || "?"} → <b>{r.to || "?"}</b></span>
              <span className="text-gray-400">{r.kind === "subasta" ? `subasta · ${r.price} 🪙` : "trueque"}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="btn btn-secondary mt-3 w-full">Cerrar</button>
      </div>
    </div>
  );
}

export default function Mercado({ collection, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [pick, setPick] = useState(null);
  const [base, setBase] = useState("");
  const [bids, setBids] = useState({});
  const [hist, setHist] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get("/market").then((r) => setData(r.data)).catch(() => setData({ listings: [], mine: [], balance: 0 })), []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast(ok); await load(); onChanged?.(); }
    catch (e) { toast(e.response?.data?.error || "No se pudo"); }
    finally { setBusy(false); }
  };
  const publish = () => act(async () => { await api.post("/market", { name: pick.name, base: Number(base) }); setPick(null); setBase(""); }, "Tu carta salió a subasta por 24 horas");
  const bid = (l) => act(() => api.post(`/market/${l.id}/bid`, { amount: Number(bids[l.id] || l.minBid) }), "Puja hecha");
  const cancel = (l) => act(() => api.post(`/market/${l.id}/cancel`), "Subasta cancelada");

  if (!data) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (data.noClub) return <div className="p-card text-center text-sm p-muted">El mercado es entre miembros de un club. Crea uno o únete para usarlo.</div>;
  const repeated = (collection || []).filter((c) => c.count >= 2);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold"><Gavel size={18} /> Mercado del club</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm font-semibold"><Coins size={14} className="text-amber-400" /> {data.balance}</span>
      </div>

      <section className="p-card space-y-3" aria-label="Vender una repetida">
        <p className="font-semibold">Vender una repetida</p>
        {repeated.length === 0 && <p className="text-sm p-muted">Cuando tengas una carta repetida, la puedes subastar aquí.</p>}
        {repeated.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {repeated.map((c) => (
              <div key={c.name} className="w-24 shrink-0"><FigCard c={c} small selected={pick?.name === c.name} onClick={() => { setPick(c); setBase(String(({ estrella: 240, oro: 80, plata: 30, bronce: 10 })[c.tier] || 10)); }} /></div>
            ))}
          </div>
        )}
        {pick && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{pick.realName || pick.name} · precio de salida</span>
            <input type="number" min="1" value={base} onChange={(e) => setBase(e.target.value)} aria-label="Precio de salida" className="w-24 rounded-card border border-border bg-bg px-2 py-1.5 text-sm" />
            <button type="button" disabled={busy || !Number(base)} onClick={publish} className="btn btn-primary btn-sm">Subastar 24 h</button>
          </div>
        )}
        <p className="text-xs p-dim">Comisión del 5% al vender. Máximo 3 subastas abiertas. Solo con monedas del juego.</p>
      </section>

      <section aria-label="Subastas del club" className="space-y-3">
        <p className="font-semibold">Subastas abiertas</p>
        {data.listings.length === 0 && <div className="p-card text-sm p-muted text-center">No hay subastas de tu club por ahora.</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          {data.listings.map((l) => (
            <div key={l.id} className="p-card flex gap-3">
              <div className="w-24 shrink-0"><FigCard c={l.card} small /></div>
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <p className="font-semibold truncate">{l.card.realName || l.card.name}</p>
                <p className="text-xs p-muted">de {l.seller.username} · <Clock size={11} className="inline" /> {left(l.endsAt)}</p>
                <p>{l.top === null ? <>Sale en <b>{l.base}</b> 🪙</> : <>Va en <b>{l.top}</b> 🪙{l.leading && <span className="ml-1 text-accent">· tú lideras</span>}</>}</p>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={l.minBid} value={bids[l.id] ?? l.minBid} onChange={(e) => setBids((b) => ({ ...b, [l.id]: e.target.value }))} aria-label="Tu puja" className="w-20 rounded-card border border-border bg-bg px-2 py-1 text-sm" />
                  <button type="button" disabled={busy || l.leading} onClick={() => bid(l)} className="btn btn-primary btn-sm">Pujar</button>
                  <button type="button" onClick={() => setHist(l.card.name)} aria-label="Historial de la carta" className="p-1 text-gray-400 hover:text-white"><History size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.mine.length > 0 && (
        <section aria-label="Mis subastas" className="space-y-2">
          <p className="font-semibold">Mis subastas</p>
          {data.mine.map((l) => (
            <div key={l.id} className="p-card flex items-center gap-3 text-sm">
              <div className="w-14 shrink-0"><FigCard c={l.card} small /></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{l.card.realName || l.card.name}</p>
                <p className="text-xs p-muted">{l.top === null ? `Sin pujas · sale en ${l.base}` : `Va en ${l.top}`} · {left(l.endsAt)}</p>
              </div>
              {l.top === null && <button type="button" disabled={busy} onClick={() => cancel(l)} className="btn btn-secondary btn-sm">Cancelar</button>}
            </div>
          ))}
        </section>
      )}
      {hist && <Historial name={hist} onClose={() => setHist(null)} />}
    </div>
  );
}
