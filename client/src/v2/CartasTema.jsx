import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CalendarDays, Lock, Sparkles } from "lucide-react";
import api from "../api.js";
import Card from "../components/Card.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const FORMATIONS = {
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
};
const POS_NAME = { GK: "arquero", DEF: "defensa", MID: "medio", FWD: "delantero" };
const POS_PLURAL = { GK: "arqueros", DEF: "defensas", MID: "medios", FWD: "delanteros" };
const TIER_DOT = { estrella: "bg-purple-400", oro: "bg-amber-400", plata: "bg-gray-300", bronce: "bg-orange-600" };

// Texto de lo que falta: «te falta 1 arquero y 2 defensas».
function missingText(missing) {
  const parts = Object.entries(missing).map(([p, n]) => `${n} ${n === 1 ? POS_NAME[p] : POS_PLURAL[p]}`);
  if (!parts.length) return "";
  return `te falta${parts.length > 1 || Object.values(missing)[0] > 1 ? "n" : ""} ${parts.join(" y ")}`;
}

// Panel de Cartas del rediseño: sobres guardados, desafío temático con repetidas, carta
// del día (álbum calendario) e intercambio de repetidas con amigos del club.
export default function CartasTema({ lockedPacks = 0, onChanged }) {
  const toast = useToast();
  const [sbc, setSbc] = useState(null);
  const [formation, setFormation] = useState("4-3-3");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get("/cards/sbc-tema").then((r) => setSbc(r.data)).catch(() => setSbc(false)), []);
  useEffect(() => { load(); }, [load]);

  const need = FORMATIONS[formation];
  const byPos = useMemo(() => {
    const m = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const c of sbc?.candidates || []) m[c.pos]?.push(c);
    return m;
  }, [sbc]);
  const count = (pos) => picked.filter((n) => (sbc.candidates.find((c) => c.name === n) || {}).pos === pos).length;

  function toggle(card) {
    setPicked((cur) => {
      if (cur.includes(card.name)) return cur.filter((n) => n !== card.name);
      if (count(card.pos) >= need[card.pos]) return cur;
      return [...cur, card.name];
    });
  }
  function autofill() {
    const chosen = [];
    for (const pos of Object.keys(need)) chosen.push(...byPos[pos].slice(0, need[pos]).map((c) => c.name));
    setPicked(chosen);
  }
  async function submit() {
    setBusy(true);
    try {
      await api.post("/cards/sbc-tema/submit", { formation, players: picked });
      toast("¡Desafío completado! Ganaste un sobre muy bueno de la temática.");
      setPicked([]);
      await load();
      onChanged?.();
    } catch (e) {
      toast(e.response?.data?.error || "No se pudo entregar el equipo");
    } finally { setBusy(false); }
  }
  async function buyThemePack() {
    setBusy(true);
    try {
      await api.post("/cards/sbc-tema/shop");
      toast("Sobre temático comprado");
      onChanged?.();
    } catch (e) {
      toast(e.response?.data?.error || "No se pudo comprar");
    } finally { setBusy(false); }
  }

  const ready = sbc && picked.length === 11 && Object.keys(need).every((p) => count(p) === need[p]);
  const missing = sbc ? Object.fromEntries(Object.keys(need).map((p) => [p, Math.max(0, need[p] - (byPos[p].length))]).filter(([, n]) => n > 0)) : {};

  return (
    <div className="space-y-4">
      {lockedPacks > 0 && (
        <Card variant="feature">
          <p className="t-eyebrow flex items-center gap-1.5"><Lock size={13} /> Sobres guardados</p>
          <p className="text-sm mt-1">Tenés <b>{lockedPacks}</b> {lockedPacks === 1 ? "sobre guardado" : "sobres guardados"}. Se abren cuando entres a un club con la temporada iniciada (se guardan hasta 3).</p>
        </Card>
      )}

      {sbc && sbc.theme && (
        <Card>
          <p className="t-eyebrow flex items-center gap-1.5"><Sparkles size={13} /> Desafío de la temporada · {sbc.theme.label}</p>
          <p className="text-sm text-gray-400 mt-1">Entregá 11 cartas <b>repetidas</b> de {sbc.theme.label} y ganá un sobre muy bueno de la temática. Siempre te queda una copia de cada una. Dura hasta el {sbc.theme.end}.</p>
          <p className="text-xs text-gray-500 mt-1">Mientras dure, cada sobre que abras trae una carta de {sbc.theme.label}.</p>

          {sbc.done ? (
            <p className="mt-3 text-sm text-good">Ya completaste este desafío. El próximo tema llega el {sbc.theme.end}.</p>
          ) : (
            <>
              <div className="flex gap-1.5 mt-3">
                {Object.keys(FORMATIONS).map((f) => (
                  <button key={f} onClick={() => { setFormation(f); setPicked([]); }} className={`flex-1 rounded-xl border py-1.5 text-sm ${formation === f ? "border-accent bg-accent/10 font-semibold" : "border-border text-gray-400"}`}>{f}</button>
                ))}
              </div>
              <p className="mt-3 text-sm"><b className="tabular-nums">{picked.length}</b>/11 elegidas
                {Object.keys(missing).length > 0 && <span className="text-gray-400"> · {missingText(missing)} repetidos</span>}
              </p>
              {Object.keys(need).map((pos) => (
                <div key={pos} className="mt-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{POS_PLURAL[pos]} · {count(pos)}/{need[pos]}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {byPos[pos].length === 0 && <span className="text-xs text-gray-600">No tenés repetidos en esta línea.</span>}
                    {byPos[pos].map((c) => (
                      <button key={c.name} onClick={() => toggle(c)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${picked.includes(c.name) ? "border-accent bg-accent/15" : "border-border text-gray-300"}`}>
                        <span className={`h-2 w-2 rounded-full ${TIER_DOT[c.tier]}`} /> {c.name} <span className="text-gray-500 tabular-nums">{c.ovr}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <button onClick={autofill} className="btn btn-secondary btn-sm" disabled={!sbc.candidates.length}>Autocompletar</button>
                <button onClick={submit} disabled={!ready || busy} className="btn btn-primary btn-sm disabled:opacity-40">Entregar equipo</button>
              </div>
            </>
          )}
          <div className="mt-4 border-t border-border pt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-400">Sobre de {sbc.theme.label}: 5 cartas de la temática, una de las mejores asegurada.</p>
            <button onClick={buyThemePack} disabled={busy} className="btn btn-secondary btn-sm shrink-0">{sbc.shopPrice} monedas</button>
          </div>
        </Card>
      )}

      <Album />
      <Trades onChanged={onChanged} />
    </div>
  );
}

// Álbum calendario: una casilla por día. Si no jugaste o fallaste, queda vacía para siempre.
function Album() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/cards/album").then((r) => setData(r.data)).catch(() => setData(false)); }, []);
  if (data === null) return null;
  if (data === false) return null;
  const firstDow = (new Date(`${data.month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  return (
    <Card>
      <p className="t-eyebrow flex items-center gap-1.5"><CalendarDays size={13} /> Álbum del mes · {data.month}</p>
      <p className="text-sm text-gray-400 mt-1">Acertá el primer «¿Quién es?» del partido del día y te llevás esa carta con la fecha. {data.collected} de este mes.</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-gray-500">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
        {Array.from({ length: firstDow }).map((_, i) => <span key={`b${i}`} />)}
        {data.days.map((d) => (
          <div key={d.date} title={d.player || (d.future ? "Todavía no" : "Vacía")} className={`aspect-square rounded-md border flex flex-col items-center justify-center ${d.player ? "border-accent/60 bg-accent/10 text-white" : d.future ? "border-border/40 text-gray-700" : "border-dashed border-border text-gray-600"}`}>
            <span className="tabular-nums leading-none">{Number(d.date.slice(8))}</span>
            {d.player && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${TIER_DOT[d.tier] || "bg-accent"}`} />}
          </div>
        ))}
      </div>
    </Card>
  );
}

// Intercambio de repetidas con un amigo del club: una por día, misma categoría.
function Trades({ onChanged }) {
  const toast = useToast();
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [trades, setTrades] = useState({ trades: [], usedToday: false });
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState({ to: "", give: "", want: "" });

  const reload = useCallback(async () => {
    const [t, c] = await Promise.all([api.get("/cards/trades"), api.get("/cards/collection")]);
    setTrades(t.data);
    setMine(c.data.cards.filter((x) => x.count >= 2));
  }, []);
  useEffect(() => { api.get("/cards/trades/friends").then((r) => setFriends(r.data.friends)).catch(() => {}); reload().catch(() => {}); }, [reload]);

  async function propose(e) {
    e.preventDefault();
    try {
      await api.post("/cards/trades", { toUserId: Number(form.to), give: form.give, want: form.want.trim() });
      toast("Propuesta enviada");
      setForm({ to: "", give: "", want: "" });
      reload();
    } catch (err) { toast(err.response?.data?.error || "No se pudo enviar la propuesta"); }
  }
  async function resolve(id, action) {
    try { await api.post(`/cards/trades/${id}/${action}`); toast(action === "accept" ? "¡Intercambio hecho!" : "Listo"); await reload(); onChanged?.(); }
    catch (err) { toast(err.response?.data?.error || "No se pudo completar"); }
  }

  if (!friends.length) return null;
  return (
    <Card>
      <p className="t-eyebrow flex items-center gap-1.5"><ArrowLeftRight size={13} /> Intercambio con amigos</p>
      <p className="text-sm text-gray-400 mt-1">Una repetida tuya por una repetida de un amigo del club, de la misma categoría. Un intercambio por día para cada uno.</p>

      {trades.trades.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {trades.trades.map((t) => (
            <li key={t.id} className="py-2 text-sm">
              <p><b>{t.from.username}</b> ofrece <b>{t.give}</b> por <b>{t.want}</b> de {t.to.username} <span className="text-gray-500">· {t.status === "pending" ? "pendiente" : t.status === "accepted" ? "hecho" : "cerrado"}</span></p>
              {t.status === "pending" && (
                <div className="mt-1.5 flex gap-2">
                  {t.to.id === user?.id && <ActionButtons trade={t} onResolve={resolve} />}
                  {t.from.id === user?.id && <button onClick={() => resolve(t.id, "decline")} className="btn btn-secondary btn-sm">Cancelar</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!trades.usedToday && (
        <form onSubmit={propose} className="mt-3 grid gap-2">
          <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm">
            <option value="">¿Con quién?</option>
            {friends.map((f) => <option key={f.id} value={f.id}>{f.username}</option>)}
          </select>
          <select value={form.give} onChange={(e) => setForm({ ...form, give: e.target.value })} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm">
            <option value="">Tu carta repetida</option>
            {mine.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.tier})</option>)}
          </select>
          <input value={form.want} onChange={(e) => setForm({ ...form, want: e.target.value })} placeholder="Carta repetida que querés (nombre exacto)" className="rounded-xl border border-border bg-bg px-3 py-2 text-sm" />
          <button className="btn btn-secondary btn-sm" disabled={!form.to || !form.give || !form.want.trim()}>Proponer</button>
        </form>
      )}
      {trades.usedToday && <p className="mt-3 text-xs text-gray-500">Hoy ya hiciste un intercambio. Mañana otro.</p>}
    </Card>
  );
}

function ActionButtons({ trade, onResolve }) {
  return (
    <>
      <button onClick={() => onResolve(trade.id, "accept")} className="btn btn-primary btn-sm">Aceptar</button>
      <button onClick={() => onResolve(trade.id, "decline")} className="btn btn-secondary btn-sm">Rechazar</button>
    </>
  );
}
