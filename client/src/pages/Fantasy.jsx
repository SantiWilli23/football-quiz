import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Coins, Gavel, Home, Shirt, Trophy, Users } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import FormationPitch from "../components/FormationPitch.jsx";
import PlayerFace, { ClubCrest } from "../components/PlayerFace.jsx";
import { useGroups } from "../context/GroupContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { playSfx } from "../utils/sfx.js";

// Fantasy: una liga de fantasy sobre la Premier o LaLiga para tu grupo. Cada uno arma su plantel con un banco,
// puja a ciegas en la tienda los primeros 3 días de cada temporada y ficha a otros participantes. Cada día se
// juega una fecha de la liga real y tus puntos salen de la calificación (1 a 10) de los jugadores de tu once.
const TABS = [["inicio", "Inicio", Home], ["plantilla", "Plantilla", Shirt], ["tienda", "Tienda", Gavel], ["ligas", "Ligas", Trophy]];
const POS_LABEL = { GK: "Arquero", DEF: "Defensor", MID: "Mediocampista", FWD: "Delantero" };
const POS_ORDER = ["GK", "DEF", "MID", "FWD"];
const MENTALITY = { defensiva: "Defensiva", equilibrada: "Equilibrada", ofensiva: "Ofensiva" };
const money = (v) => `${Math.round(v * 10) / 10} M`;

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!target) return null;
  const s = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d ? `${d} d ` : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const formArrow = (f) => (f >= 7.2 ? { t: "▲", c: "text-emerald-400" } : f <= 5.8 ? { t: "▼", c: "text-red-400" } : { t: "●", c: "text-gray-500" });

// ------------------------------------------------------------------ lista y creación
function Lobby() {
  const navigate = useNavigate();
  const { groups } = useGroups();
  const [leagues, setLeagues] = useState(null);
  const [form, setForm] = useState({ name: "", groupId: "", leagueKey: "premier", mode: "actual" });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => api.get("/fantasy").then((r) => setLeagues(r.data.leagues)).catch(() => setLeagues([])), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!form.groupId && groups?.length) setForm((f) => ({ ...f, groupId: String(groups[0].id) })); }, [groups, form.groupId]);

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/fantasy", { ...form, groupId: Number(form.groupId) });
      navigate(`/fantasy/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la liga");
    }
  }
  async function join(id) {
    try { await api.post(`/fantasy/${id}/join`); navigate(`/fantasy/${id}`); } catch (err) { setError(err.response?.data?.error || "No se pudo unir"); }
  }

  return (
    <Layout>
      <div className="mb-5 flex items-center gap-3">
        <Coins size={22} className="text-accent shrink-0" />
        <div>
          <h1 className="t-title">Fantasy</h1>
          <p className="text-gray-400 text-sm">Armá tu plantel, pujá en la tienda y sumá puntos con lo que rinden tus jugadores en la Premier o LaLiga.</p>
        </div>
      </div>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] items-start">
        <div className="space-y-3">
          {leagues === null && <Card><p className="text-sm text-gray-500 py-3 text-center">Cargando…</p></Card>}
          {leagues?.length === 0 && <Card><p className="text-sm text-gray-400 text-center py-6">Todavía no hay ligas en tus grupos. Creá la primera.</p></Card>}
          {leagues?.map((l) => (
            <Card key={l.id}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{l.name}</p>
                  <p className="text-xs text-gray-500">{l.leagueLabel} · {l.mode === "historica" ? "histórica" : "actual"} · grupo {l.group_name} · {l.member_count} participante{l.member_count === 1 ? "" : "s"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l.status === "lobby" ? "Esperando que arranque" : l.status === "shop" ? `Tienda abierta · temporada ${l.season}` : l.status === "season" ? `Temporada ${l.season} · fecha ${l.round}` : "Terminada"}</p>
                </div>
                {l.joined || l.status !== "lobby"
                  ? <Link to={`/fantasy/${l.id}`} className="btn btn-primary btn-sm">{l.joined ? "Entrar" : "Ver"}</Link>
                  : <button onClick={() => join(l.id)} className="btn btn-secondary btn-sm">Unirme</button>}
              </div>
            </Card>
          ))}
        </div>

        <Card className="space-y-3">
          <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between font-bold" aria-expanded={open}>Crear una liga <span className="text-accent">{open ? "−" : "+"}</span></button>
          {open && (
            <form onSubmit={create} className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre de la liga" maxLength={40} className="w-full bg-bg border border-border rounded-card px-3 py-2 text-sm focus:outline-none focus:border-accent" />
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="w-full bg-bg border border-border rounded-card px-3 py-2 text-sm" aria-label="Grupo">
                {(groups || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <div>
                <p className="t-eyebrow mb-1.5">Liga</p>
                <div className="flex gap-2">
                  {[["premier", "Premier League"], ["laliga", "LaLiga"]].map(([k, label]) => (
                    <button type="button" key={k} onClick={() => setForm({ ...form, leagueKey: k })} aria-pressed={form.leagueKey === k} className={`flex-1 px-3 py-2 rounded-card text-sm border ${form.leagueKey === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400"}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="t-eyebrow mb-1.5">Jugadores</p>
                <div className="grid grid-cols-2 gap-2">
                  {[["actual", "Actual", "Los planteles de hoy."], ["historica", "Histórica", "Los clubes de hoy con leyendas en su mejor momento."]].map(([k, label, hint]) => (
                    <button type="button" key={k} onClick={() => setForm({ ...form, mode: k })} aria-pressed={form.mode === k} className={`text-left px-3 py-2 rounded-card border ${form.mode === k ? "border-accent/40 bg-accent/10" : "border-border"}`}>
                      <span className={`block text-sm font-semibold ${form.mode === k ? "text-accent" : ""}`}>{label}</span>
                      <span className="block text-[11px] text-gray-500">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary w-full" disabled={!form.name.trim() || !form.groupId}>Crear liga</button>
            </form>
          )}
        </Card>
      </div>
    </Layout>
  );
}

// ------------------------------------------------------------------ Inicio
function Inicio({ L, reload }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const closes = useCountdown(L.status === "shop" ? L.shop?.closesAt : L.status === "season" ? L.nextRoundAt : null);
  async function start() {
    setBusy(true); setErr("");
    try { await api.post(`/fantasy/${L.id}/start`); await reload(); } catch (e) { setErr(e.response?.data?.error || "No se pudo arrancar"); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      {L.status === "lobby" && (
        <Card className="space-y-3">
          <p className="font-semibold">Participantes ({L.members.length}/8)</p>
          <p className="text-sm text-gray-300">{L.members.map((m) => m.username).join(", ")}</p>
          <p className="text-xs text-gray-500">Al arrancar, cada uno recibe un plantel de 18 jugadores de valor parecido y {money(250)} para la tienda. Hacen falta al menos 2 participantes.</p>
          {L.isCreator ? <button onClick={start} disabled={busy || L.members.length < 2} className="btn btn-primary">{busy ? "Armando la liga…" : L.members.length < 2 ? "Esperando participantes" : "Arrancar la liga"}</button> : <p className="text-sm text-gray-400">Esperando que quien creó la liga la arranque.</p>}
          {err && <p className="text-sm text-red-400">{err}</p>}
        </Card>
      )}

      {L.status === "shop" && (
        <div className="hero-b rounded-3xl p-5" style={{ "--hero-a": "var(--c-amber)", "--hero-b": "var(--c-pink)" }}>
          <p className="t-eyebrow">Temporada {L.season} · antes de la primera fecha</p>
          <h2 className="text-xl font-bold mt-1">Tienda abierta: día {L.shop.day} de {L.shop.totalDays}</h2>
          <p className="text-sm text-gray-200 mt-1">Pujá a ciegas por jugadores. Cierra en <b className="tabular-nums">{closes}</b>. Después se juega la primera fecha.</p>
        </div>
      )}

      {L.status === "season" && (
        <div className="hero-b rounded-3xl p-5" style={{ "--hero-a": "var(--c-blue)", "--hero-b": "var(--c-emerald)" }}>
          <p className="t-eyebrow">{L.leagueLabel} · temporada {L.season} de {L.maxSeasons}</p>
          <h2 className="text-xl font-bold mt-1">Fecha {L.round} de {L.totalRounds}</h2>
          <p className="text-sm text-gray-200 mt-1">{L.round < L.totalRounds ? <>Próxima fecha en <b className="tabular-nums">{closes}</b>.</> : "Terminó la temporada."}</p>
          {L.lastRound.myPoints != null && <p className="text-sm mt-2">Tus puntos en la última fecha: <b className="text-lg tabular-nums">{L.lastRound.myPoints}</b></p>}
        </div>
      )}

      {L.status === "finished" && <Card><p className="font-semibold">La liga terminó sus {L.maxSeasons} temporadas.</p></Card>}

      {L.status !== "lobby" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="t-eyebrow mb-2">{L.lastRound.round ? `Resultados de la fecha ${L.lastRound.round}` : "Fecha 1"}</p>
            {L.lastRound.matches.length === 0 ? (
              <>
                <p className="text-sm text-gray-500 mb-2">Todavía no se jugó ninguna fecha. Así arranca:</p>
                <ul className="space-y-1 text-sm">{(L.nextFixtures.length ? L.nextFixtures : []).map((m, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{m.homeName}</span><span className="text-gray-500">vs</span><span className="truncate text-right">{m.awayName}</span></li>)}</ul>
              </>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {L.lastRound.matches.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 flex items-center gap-1.5 truncate"><ClubCrest name={m.homeName} size={16} />{m.homeName}</span>
                    <span className="font-bold tabular-nums shrink-0">{m.hg} - {m.ag}</span>
                    <span className="flex-1 min-w-0 flex items-center gap-1.5 justify-end truncate text-right">{m.awayName}<ClubCrest name={m.awayName} size={16} /></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <p className="t-eyebrow mb-2">Tu once en la última fecha</p>
            {L.lastRound.myDetail.length === 0 ? <p className="text-sm text-gray-500">Todavía no sumaste puntos.</p> : (
              <ul className="space-y-1 text-sm">
                {L.lastRound.myDetail.map((d) => {
                  const p = L.players.find((x) => x.id === d.id);
                  return (
                    <li key={d.id} className="flex items-center gap-2">
                      <PlayerFace name={p?.name || "?"} size={22} />
                      <span className="flex-1 truncate">{p?.name}</span>
                      {d.goals > 0 && <span className="text-xs">⚽{d.goals}</span>}
                      {d.assists > 0 && <span className="text-xs">🅰️{d.assists}</span>}
                      <span className={`font-bold tabular-nums w-10 text-right ${d.rating == null ? "text-gray-600" : d.rating >= 7.5 ? "text-emerald-400" : d.rating < 5.5 ? "text-red-400" : ""}`}>{d.rating == null ? "no jugó" : d.points}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {L.awards?.length > 0 && (
        <Card>
          <p className="t-eyebrow mb-2">Premios de temporadas anteriores</p>
          <ul className="text-sm space-y-1">{L.awards.map((a, i) => <li key={i}>Temporada {a.season}: {a.position}° {a.username} (+{a.points} puntos al grupo)</li>)}</ul>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Plantilla
function Plantilla({ L, reload }) {
  const [formation, setFormation] = useState(L.formation);
  const [lineup, setLineup] = useState(L.lineup);
  const [mentality, setMentality] = useState(L.mentality);
  const [slot, setSlot] = useState(null); // puesto elegido para asignarle un jugador
  const [msg, setMsg] = useState("");
  const byId = useMemo(() => new Map(L.players.map((p) => [p.id, p])), [L.players]);
  const slots = useMemo(() => { const shape = { "4-3-3": [1, 4, 3, 3], "4-4-2": [1, 4, 4, 2], "3-5-2": [1, 3, 5, 2], "5-3-2": [1, 5, 3, 2] }[formation]; return POS_ORDER.flatMap((pos, i) => Array.from({ length: shape[i] }, () => pos)); }, [formation]);
  const picks = slots.map((_, i) => { const p = byId.get(lineup[i]); return p ? { name: p.name, ovr: p.ovr } : null; });
  const used = new Set(lineup.filter(Boolean));
  const bench = L.players.filter((p) => !used.has(p.id));

  async function save(nextFormation, nextLineup, nextMentality) {
    try {
      await api.post(`/fantasy/${L.id}/lineup`, { formation: nextFormation, lineup: nextLineup, mentality: nextMentality });
      setMsg("");
      await reload();
    } catch (e) { setMsg(e.response?.data?.error || "No se pudo guardar"); }
  }
  function changeFormation(f) {
    // al cambiar de formación se rearma el mejor once posible
    const sl = { "4-3-3": [1, 4, 3, 3], "4-4-2": [1, 4, 4, 2], "3-5-2": [1, 3, 5, 2], "5-3-2": [1, 5, 3, 2] }[f];
    const taken = new Set();
    const next = POS_ORDER.flatMap((pos, i) => Array.from({ length: sl[i] }, () => {
      const c = L.players.filter((p) => p.pos === pos && !taken.has(p.id)).sort((a, b) => b.ovr - a.ovr)[0];
      if (c) taken.add(c.id);
      return c ? c.id : null;
    }));
    setFormation(f); setLineup(next); setSlot(null);
    save(f, next, mentality);
  }
  function assign(playerId) {
    const next = [...lineup];
    next[slot] = playerId;
    setLineup(next); setSlot(null);
    save(formation, next, mentality);
  }
  async function sell(p) {
    if (!window.confirm(`¿Vender a ${p.name} al banco por ${money(Math.round(p.value * 0.9 * 10) / 10)}? (el 90% de su valor)`)) return;
    try { await api.post(`/fantasy/${L.id}/sell`, { playerId: p.id }); playSfx("tap"); await reload(); } catch (e) { setMsg(e.response?.data?.error || "No se pudo vender"); }
  }
  const candidates = slot != null ? L.players.filter((p) => p.pos === slots[slot]).sort((a, b) => b.ovr - a.ovr) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <select value={formation} onChange={(e) => changeFormation(e.target.value)} className="bg-panel border border-border rounded-card px-2 py-1.5 text-sm font-medium" aria-label="Formación">
            {L.formations.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={mentality} onChange={(e) => { setMentality(e.target.value); save(formation, lineup, e.target.value); }} className="bg-panel border border-border rounded-card px-2 py-1.5 text-sm font-medium" aria-label="Táctica">
            {L.mentalities.map((m) => <option key={m} value={m}>Táctica {MENTALITY[m].toLowerCase()}</option>)}
          </select>
        </div>
        <FormationPitch slots={slots} picks={picks} faces selected={slot} onSelect={(i) => setSlot(i)} onEmptyClick={(i) => setSlot(i)} />
        <p className="text-xs text-gray-500">Tocá un puesto para elegir quién lo ocupa. Cada jugador solo puede jugar en su posición. La táctica ofensiva suma a los delanteros y resta a los defensores; la defensiva, al revés.</p>
        {msg && <p className="text-sm text-red-400">{msg}</p>}
      </div>

      <div className="space-y-4">
        {slot != null && (
          <Card className="space-y-2">
            <div className="flex items-center justify-between"><p className="font-semibold text-sm">Elegí al {POS_LABEL[slots[slot]].toLowerCase()}</p><button onClick={() => setSlot(null)} className="text-xs text-gray-500 hover:text-white">Cancelar</button></div>
            {lineup[slot] != null && <button onClick={() => assign(null)} className="text-xs text-red-400 hover:underline">Dejar el puesto vacío</button>}
            <ul className="grid sm:grid-cols-2 gap-1.5">
              {candidates.map((p) => (
                <li key={p.id}>
                  <button onClick={() => assign(p.id)} disabled={used.has(p.id) && lineup[slot] !== p.id} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-card border border-border text-left text-sm hover:border-accent/40 disabled:opacity-40">
                    <PlayerFace name={p.name} size={28} /><span className="flex-1 truncate">{p.name}</span><b className="tabular-nums">{p.ovr}</b>
                  </button>
                </li>
              ))}
              {candidates.length === 0 && <li className="text-sm text-gray-500">No tenés jugadores de esa posición. Fichá uno en la tienda.</li>}
            </ul>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-2"><p className="t-eyebrow">Tu plantel ({L.players.length})</p><p className="text-xs text-gray-400">Plata: <b className="text-accent">{money(L.cash)}</b></p></div>
          {POS_ORDER.map((pos) => (
            <div key={pos} className="mb-3 last:mb-0">
              <p className="text-xs font-semibold text-gray-400 mb-1">{POS_LABEL[pos]}s</p>
              <ul className="space-y-1">
                {L.players.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).map((p) => {
                  const f = formArrow(p.form);
                  return (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <PlayerFace name={p.name} size={26} />
                      <span className="flex-1 min-w-0 truncate">{p.name}{p.legend && <span className="ml-1 text-[10px] text-amber-400 uppercase">leyenda</span>}{used.has(p.id) && <span className="ml-1 text-[10px] text-emerald-400">titular</span>}</span>
                      <span className={`text-xs ${f.c}`} title={`Forma ${p.form}`}>{f.t}</span>
                      <span className="text-xs text-gray-500 tabular-nums w-14 text-right">{p.points} pts</span>
                      <span className="text-xs text-gray-400 tabular-nums w-14 text-right">{money(p.value)}</span>
                      <b className="tabular-nums w-7 text-right">{p.ovr}</b>
                      <button onClick={() => sell(p)} className="text-[11px] text-gray-500 hover:text-red-400 shrink-0" title="Vender al banco (90% del valor)">Vender</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {bench.length === 0 && <p className="text-xs text-gray-500">Todos tus jugadores están en el once.</p>}
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Tienda y fichajes
function Tienda({ L, reload, me }) {
  const [bids, setBids] = useState({});
  const [offer, setOffer] = useState({});
  const [msg, setMsg] = useState({});
  const closes = useCountdown(L.shop?.closesAt);
  const committed = (L.shop?.items || []).reduce((s, it) => s + (it.myBid || 0), 0);

  async function bid(it) {
    const amount = Math.round(Number(bids[it.shopId] ?? it.myBid ?? it.minBid));
    try {
      await api.post(`/fantasy/${L.id}/bid`, { shopId: it.shopId, amount });
      setMsg((m) => ({ ...m, [it.shopId]: "Puja guardada" }));
      playSfx("ok");
      await reload();
    } catch (e) { setMsg((m) => ({ ...m, [it.shopId]: e.response?.data?.error || "No se pudo pujar" })); }
  }
  async function withdraw(it) {
    try { await api.post(`/fantasy/${L.id}/bid`, { shopId: it.shopId, amount: 0 }); setBids((b) => ({ ...b, [it.shopId]: "" })); await reload(); } catch { /* sigue igual */ }
  }
  async function makeOffer(p) {
    try {
      await api.post(`/fantasy/${L.id}/offer`, { playerId: p.id, amount: Number(offer[p.id]) });
      setMsg((m) => ({ ...m, [`o${p.id}`]: "Oferta enviada" }));
      await reload();
    } catch (e) { setMsg((m) => ({ ...m, [`o${p.id}`]: e.response?.data?.error || "No se pudo ofertar" })); }
  }
  async function respond(o, accept, cancel = false) {
    try { await api.post(`/fantasy/${L.id}/offer/${o.id}/respond`, { accept, cancel }); await reload(); } catch (e) { setMsg((m) => ({ ...m, offers: e.response?.data?.error || "No se pudo responder" })); }
  }

  return (
    <div className="space-y-5">
      {L.shop ? (
        <>
          <div className="hero-b rounded-3xl p-5" style={{ "--hero-a": "var(--c-amber)", "--hero-b": "var(--c-pink)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="t-eyebrow">Tienda · día {L.shop.day} de {L.shop.totalDays}</p>
                <h2 className="text-xl font-bold">7 jugadores, pujas a ciegas</h2>
                <p className="text-sm text-gray-200">Gana la oferta más alta y no ves cuánto puso el resto. La mínima es la mitad del valor. Cierra en <b className="tabular-nums">{closes}</b>; mañana cambia la vitrina.</p>
              </div>
              <div className="text-right"><p className="text-xs text-gray-300">Tu plata</p><p className="text-2xl font-extrabold tabular-nums">{money(L.cash)}</p><p className="text-xs text-gray-300">Comprometido: {money(committed)}</p></div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {L.shop.items.map((it) => (
              <Card key={it.shopId} className="space-y-2">
                <div className="flex items-center gap-3">
                  <PlayerFace name={it.player.name} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{it.player.name}{it.player.legend && <span className="ml-1 text-[10px] text-amber-400 uppercase">leyenda</span>}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 truncate"><ClubCrest name={it.player.clubName} size={14} />{it.player.clubName} · {POS_LABEL[it.player.pos]}</p>
                  </div>
                  <b className="text-2xl tabular-nums">{it.player.ovr}</b>
                </div>
                <p className="text-xs text-gray-400">Valor {money(it.player.value)} · mínima <b className="text-white">{it.minBid} M</b>{it.myBid ? <> · tu puja <b className="text-accent">{it.myBid} M</b></> : null}</p>
                <div className="flex gap-2">
                  <input value={bids[it.shopId] ?? ""} onChange={(e) => setBids({ ...bids, [it.shopId]: e.target.value.replace(/\D/g, "") })} placeholder={`${it.myBid || it.minBid}`} inputMode="numeric" aria-label={`Puja por ${it.player.name}`} className="flex-1 min-w-0 bg-bg border border-border rounded-card px-3 py-2 text-sm focus:outline-none focus:border-accent" />
                  <button onClick={() => bid(it)} className="btn btn-primary btn-sm">Pujar</button>
                  {it.myBid ? <button onClick={() => withdraw(it)} className="btn btn-secondary btn-sm">Retirar</button> : null}
                </div>
                {msg[it.shopId] && <p className="text-xs text-gray-300" role="status">{msg[it.shopId]}</p>}
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="text-center py-8">
          <Gavel size={26} className="mx-auto text-accent mb-2" />
          <p className="font-semibold">La tienda está cerrada</p>
          <p className="text-sm text-gray-400 mt-1">Abre 3 días al empezar cada temporada. Mientras tanto podés vender al banco y ficharle jugadores a otros participantes.</p>
        </Card>
      )}

      <Card className="space-y-3">
        <p className="t-eyebrow">Fichajes entre participantes</p>
        {L.offers.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {L.offers.map((o) => (
              <li key={o.id} className="flex items-center gap-2 flex-wrap">
                <span className="flex-1 min-w-0">{o.toId === me ? <><b>{o.fromName}</b> ofrece <b>{money(o.amount)}</b> por {o.playerName}</> : <>Ofreciste <b>{money(o.amount)}</b> a {o.toName} por {o.playerName}</>}</span>
                {o.toId === me ? (<><button onClick={() => respond(o, true)} className="btn btn-primary btn-sm">Aceptar</button><button onClick={() => respond(o, false)} className="btn btn-secondary btn-sm">Rechazar</button></>) : <button onClick={() => respond(o, false, true)} className="btn btn-secondary btn-sm">Cancelar</button>}
              </li>
            ))}
          </ul>
        )}
        {msg.offers && <p className="text-xs text-red-400">{msg.offers}</p>}
        <details>
          <summary className="cursor-pointer text-sm text-accent">Jugadores de los demás ({L.marketPlayers.length})</summary>
          <ul className="mt-2 space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {[...L.marketPlayers].sort((a, b) => b.ovr - a.ovr).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <PlayerFace name={p.name} size={24} />
                <span className="flex-1 min-w-0 truncate">{p.name} <span className="text-xs text-gray-500">· {p.ownerName} · {money(p.value)}</span></span>
                <b className="tabular-nums w-7 text-right">{p.ovr}</b>
                <input value={offer[p.id] ?? ""} onChange={(e) => setOffer({ ...offer, [p.id]: e.target.value.replace(/\D/g, "") })} placeholder="M" inputMode="numeric" aria-label={`Oferta por ${p.name}`} className="w-16 bg-bg border border-border rounded-card px-2 py-1 text-xs" />
                <button onClick={() => makeOffer(p)} disabled={!offer[p.id]} className="btn btn-secondary btn-sm disabled:opacity-40">Ofertar</button>
                {msg[`o${p.id}`] && <span className="text-[11px] text-gray-400">{msg[`o${p.id}`]}</span>}
              </li>
            ))}
          </ul>
        </details>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Ligas
function Ligas({ L, me }) {
  const [sub, setSub] = useState("nosotros");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[["nosotros", "Nosotros", Users], ["liga", L.leagueLabel, Trophy]].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setSub(k)} aria-pressed={sub === k} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-card text-sm font-semibold border ${sub === k ? "border-accent bg-accent text-bg" : "border-border text-gray-400 hover:text-white"}`}><Icon size={14} /> {label}</button>
        ))}
      </div>
      {sub === "nosotros" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="t-eyebrow mb-2">Puntos de la temporada {L.season}</p>
            <ol className="space-y-1.5">
              {L.ranking.map((r, i) => (
                <li key={r.userId} className={`flex items-center gap-3 text-sm ${r.userId === me ? "text-accent font-semibold" : ""}`}>
                  <span className="w-5 text-center text-gray-500">{i + 1}</span><span className="flex-1 truncate">{r.username}</span><b className="tabular-nums">{r.points}</b>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-gray-500 mt-3">Al final de la temporada: 1° {60 + 5 * (L.season - 1)}, 2° {40 + 5 * (L.season - 1)}, 3° {20 + 5 * (L.season - 1)} y 4° {10 + 5 * (L.season - 1)} puntos para el grupo.</p>
          </Card>
          <Card>
            <p className="t-eyebrow mb-2">Los jugadores que más puntos llevan</p>
            <ol className="space-y-1.5">
              {L.topPlayers.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center text-gray-500">{i + 1}</span><PlayerFace name={p.name} size={24} />
                  <span className="flex-1 min-w-0 truncate">{p.name} <span className="text-xs text-gray-500">· {p.ownerName}</span></span><b className="tabular-nums">{p.points}</b>
                </li>
              ))}
              {L.topPlayers.length === 0 && <li className="text-sm text-gray-500">Todavía no se jugó ninguna fecha.</li>}
            </ol>
          </Card>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[460px]">
            <thead><tr className="text-xs text-gray-500 text-left"><th className="py-1 pr-2">#</th><th>Club</th><th className="text-right">PJ</th><th className="text-right">G</th><th className="text-right">E</th><th className="text-right">P</th><th className="text-right">GF</th><th className="text-right">GC</th><th className="text-right">DG</th><th className="text-right">Pts</th></tr></thead>
            <tbody>
              {L.standings.map((s, i) => (
                <tr key={s.club} className="border-t border-border/50">
                  <td className="py-1.5 pr-2 text-gray-500">{i + 1}</td>
                  <td className="flex items-center gap-2 py-1.5"><ClubCrest name={s.name} size={16} />{s.name}</td>
                  {[s.pj, s.g, s.e, s.p, s.gf, s.gc, s.gf - s.gc].map((v, k) => <td key={k} className="text-right tabular-nums text-gray-300">{v}</td>)}
                  <td className="text-right font-bold tabular-nums">{s.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ liga abierta
function League({ id }) {
  const { user } = useAuth();
  const [L, setL] = useState(null);
  const [tab, setTab] = useState("inicio");
  const [error, setError] = useState("");
  const load = useCallback(() => api.get(`/fantasy/${id}`).then((r) => { setL(r.data.league); setError(""); }).catch((e) => setError(e.response?.data?.error || "No se pudo cargar la liga")), [id]);
  useEffect(() => { load(); const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000); return () => clearInterval(t); }, [load]);

  if (error) return <Layout><p className="text-sm text-red-400">{error}</p><Link to="/fantasy" className="text-sm text-accent">Volver</Link></Layout>;
  if (!L) return <Layout><p className="text-sm text-gray-500 py-8 text-center">Cargando…</p></Layout>;
  const playing = L.status !== "lobby" && L.joined;
  return (
    <Layout wide>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <Link to="/fantasy" className="text-xs text-gray-500 hover:text-white">← Mis ligas</Link>
          <h1 className="t-title truncate">{L.name}</h1>
          <p className="text-xs text-gray-400">{L.leagueLabel} · {L.mode === "historica" ? "histórica (con leyendas)" : "actual"} · temporada {L.season} de {L.maxSeasons}</p>
        </div>
        {playing && <div className="text-right"><p className="text-xs text-gray-500">Tu plata</p><p className="text-xl font-extrabold tabular-nums text-accent">{money(L.cash)}</p></div>}
      </div>
      {playing && (
        <div className="flex gap-1.5 mb-5 overflow-x-auto" role="tablist" aria-label="Secciones del Fantasy">
          {TABS.map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-card text-sm font-semibold border whitespace-nowrap ${tab === k ? "border-accent bg-accent text-bg" : "border-border text-gray-400 hover:text-white"}`}><Icon size={14} /> {label}</button>
          ))}
        </div>
      )}
      {(!playing || tab === "inicio") && <Inicio L={L} reload={load} />}
      {playing && tab === "plantilla" && <Plantilla L={L} reload={load} key={L.players.length + L.formation} />}
      {playing && tab === "tienda" && <Tienda L={L} reload={load} me={user?.id} />}
      {playing && tab === "ligas" && <Ligas L={L} me={user?.id} />}
    </Layout>
  );
}

export default function Fantasy() {
  const { id } = useParams();
  return id ? <League id={id} /> : <Lobby />;
}
