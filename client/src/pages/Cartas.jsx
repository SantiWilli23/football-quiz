import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, Layers, Package, Puzzle, Shield, ShoppingBag, Swords } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import MatchStage from "../match/MatchStage.jsx";
import { fromEngine } from "../match/simMatch.js";
import CardExtrasPanel from "../components/CardExtrasPanel.jsx";
import CartasTema from "../v2/CartasTema.jsx";
import useFutotal2 from "../v2/useFutotal2.js";
import { useToast } from "../context/ToastContext.jsx";
import { playSfx } from "../utils/sfx.js";

// Clases escritas literales para que Tailwind las genere.
const TIER_STYLE = {
  estrella: "border-purple-500/70 bg-purple-500/10 text-purple-400",
  oro: "border-amber-500/70 bg-amber-500/10 text-amber-500",
  plata: "border-gray-400/60 bg-gray-400/10 text-gray-300",
  bronce: "border-orange-700/60 bg-orange-700/10 text-orange-500",
};
const POS_LABEL = { GK: "Arquero", DEF: "Defensas", MID: "Medios", FWD: "Delanteros", DT: "Entrenadores" };
const FORMATION = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
const SELL_VALUE = { estrella: 120, oro: 40, plata: 15, bronce: 5 };
const SHOP_PRICE = { normal: 30, bueno: 90, top: 220 };
const SHOP_LABEL = { normal: "Sobre normal", bueno: "Sobre bueno", top: "Sobre top" };
// El servidor manda la lista completa (tipos, precios y descripciones); esto es el respaldo.
const SHOP_FALLBACK = { prices: SHOP_PRICE, labels: SHOP_LABEL, descriptions: {} };

function LockedCard({ c, small }) {
  return (
    <div className={`text-left rounded-xl border border-dashed border-border/70 opacity-45 ${small ? "p-2" : "p-3"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-bold tabular-nums leading-none text-gray-600">?</span>
        <span className="text-xs uppercase tracking-wide opacity-70">{c.pos}</span>
      </div>
      <p className="text-sm font-semibold mt-2 leading-tight text-gray-500">{c.name}</p>
      <p className="text-xs opacity-60 mt-1">{c.tierLabel}</p>
    </div>
  );
}

function PlayerCard({ c, selected, onClick, small, onSell }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`relative text-left rounded-xl border ${TIER_STYLE[c.tier]} ${small ? "p-2" : "p-3"} ${selected ? "ring-2 ring-accent" : ""} ${onClick ? "hover:brightness-125 transition" : ""} ${c.special ? "ring-1 ring-amber-400/60" : ""}`}
    >
      {c.special && (
        <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-400 text-black">
          {c.special}
        </span>
      )}
      <div className={`flex items-start justify-between gap-2 ${c.special ? "mt-4" : ""}`}>
        <span className="text-lg font-bold tabular-nums leading-none">{c.ovr}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-80">{c.pos}</span>
      </div>
      <p className="text-sm font-semibold text-white mt-2 leading-tight">{c.realName || c.name}</p>
      <p className="text-[11px] text-gray-400 truncate">{c.note || c.club}</p>
      <p className="text-[10px] opacity-70 mt-1">{c.tierLabel}{c.count > 1 ? ` · x${c.count}` : ""}{c.isNew ? " · ¡NUEVA!" : ""}</p>
      {c.form && <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400" title="Hizo un gol esta semana">En forma +{c.ovrBonus}</span>}
      {onSell && (
        <button
          onClick={(e) => { e.stopPropagation(); onSell(c); }}
          title={`Vender por ${SELL_VALUE[c.tier]} monedas`}
          className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] text-amber-400 hover:bg-black/60"
        >
          <Coins size={10} /> {SELL_VALUE[c.tier]}
        </button>
      )}
    </Tag>
  );
}

// Sobre animado: se "abre" 900ms y cada carta gira al revelarse, en vez de
// aparecer todas de golpe.
function PackOpening({ cards, onDone }) {
  const [phase, setPhase] = useState("closed"); // closed | tearing | revealed
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("tearing"), 120);
    const t2 = setTimeout(() => setPhase("revealed"), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase !== "revealed") {
    return (
      <div className="flex justify-center py-10">
        <div
          className={`relative overflow-hidden w-28 h-40 rounded-xl bg-gradient-to-br from-accent to-accent-dark shadow-lg fq-shine ${
            phase === "tearing" ? "fq-tear" : ""
          }`}
          style={{ clipPath: "polygon(0 12%, 50% 0, 100% 12%, 100% 100%, 0 100%)" }}
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {cards.map((c, i) => (
        <div key={i} className="fq-deal" style={{ animationDelay: `${i * 110}ms` }}>
          <PlayerCard c={c} />
        </div>
      ))}
    </div>
  );
}

// Sobres (Futotal 2.0), como en el prototipo: los que tienes para abrir y cómo se ganan.
const EARN = [
  ["Requisito", "Un club con la temporada iniciada"],
  ["Partido del día", "Mejor marcador, mejor sobre"],
  ["Copa semanal", "El campeón gana uno top"],
  ["Podio del mes", "Súper sobre Élite, solo del club principal"],
  ["Racha del club", "Si juegan todos, sobre extra"],
  ["Partidas libres", "La primera de cada juego al día"],
];
function SobresV2({ state, busy, openPack, claimDaily }) {
  return (
    <div className="p-dgrid even">
      <section className="p-l" style={{ display: "block" }}>
        <div className="p-sect" style={{ marginTop: 0 }}><h3>Para abrir<small>{state.packs} {state.packs === 1 ? "sobre" : "sobres"}</small></h3></div>
        {state.packs > 0 ? (
          <button onClick={openPack} disabled={busy} className="block w-full text-left rounded-2xl p-4 relative overflow-hidden" style={{ background: "linear-gradient(145deg,#2fb673,#0f3d2a)", boxShadow: "0 14px 30px -14px #2fb673", minHeight: 150 }}>
            <b style={{ font: "800 22px var(--f-d)", color: "#fff" }}>Abrir sobre</b>
            <small className="block" style={{ color: "#fffc" }}>5 cartas · toca para abrir{state.packs > 1 ? ` · te quedan ${state.packs}` : ""}</small>
          </button>
        ) : (
          <div className="p-card text-center text-sm p-muted">No tienes sobres. Juega el partido del día para ganar uno.</div>
        )}
        {!state.dailyClaimed && <button onClick={claimDaily} className="p-btn ghost w-full mt-2.5">Reclamar sobre diario</button>}
        {state.lockedPacks > 0 && <p className="p-gap">Tienes {state.lockedPacks} {state.lockedPacks === 1 ? "sobre guardado" : "sobres guardados"}: se abren al entrar a un club con la temporada iniciada.</p>}
      </section>
      <section className="p-sect p-r" style={{ display: "block" }}>
        <h3>Cómo ganas sobres</h3>
        <div className="p-rows">
          {EARN.map(([t, d]) => (
            <div key={t} className="p-row"><Layers size={20} style={{ color: "var(--acc2)" }} /><span className="nm">{t}<small style={{ color: "var(--mute)" }}>{d}</small></span></div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Cartas() {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => (["sobres", "album", "equipo", "sbc", "tienda"].includes(params.get("tab")) ? params.get("tab") : "sobres"));
  const { on: v2 } = useFutotal2();
  const [state, setState] = useState(null);
  const [collection, setCollection] = useState([]);
  const [opened, setOpened] = useState(null);
  const [selected, setSelected] = useState([]);
  const [saved, setSaved] = useState([]); // el once ya guardado (el que usan el capitán y las selecciones)
  const [strength, setStrength] = useState(null);
  const [rivals, setRivals] = useState([]);
  const [rival, setRival] = useState("cpu");
  const [match, setMatch] = useState(null);
  const [matchDone, setMatchDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [allCards, setAllCards] = useState([]);
  const [showMissing, setShowMissing] = useState(false);
  const [posFilter, setPosFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [query, setQuery] = useState("");
  const [wallet, setWallet] = useState(0);
  const [sbcs, setSbcs] = useState([]);
  const [sbcOpen, setSbcOpen] = useState(null);
  const [sbcPicked, setSbcPicked] = useState([]);
  useEffect(() => { api.get("/cards/all").then((r) => setAllCards(r.data.cards)).catch(() => setAllCards([])); }, []);
  useEffect(() => { api.get("/cards/sbc").then((r) => setSbcs(r.data.sbcs)).catch(() => setSbcs([])); }, []);

  function toggleSbcPick(name) {
    setSbcPicked((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : cur.length >= 11 ? cur : [...cur, name]));
  }

  async function submitSbc(id) {
    setBusy(true);
    try {
      const { data } = await api.post(`/cards/sbc/${id}/submit`, { players: sbcPicked });
      toast(`SBC completado — sobre ${data.reward.packQuality}${data.reward.coins ? ` + ${data.reward.coins} monedas` : ""}`);
      setSbcOpen(null);
      setSbcPicked([]);
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo completar el SBC");
    } finally {
      setBusy(false);
    }
  }

  const [shop, setShop] = useState(SHOP_FALLBACK);
  const loadShop = useCallback(() => {
    api.get("/cards/shop").then(({ data }) => data?.prices && setShop({ prices: data.prices, labels: data.labels || SHOP_LABEL, descriptions: data.descriptions || {}, deal: data.deal || null })).catch(() => {});
  }, []);
  useEffect(() => { loadShop(); }, [loadShop]);

  async function buyPack(quality, deal = false) {
    setBusy(true);
    try {
      await api.post("/cards/shop/buy", { quality, deal });
      setWallet((w) => w - (deal ? shop.deal.price : shop.prices[quality] ?? 0));
      toast("Sobre comprado");
      if (deal) loadShop();
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo comprar");
    } finally {
      setBusy(false);
    }
  }

  async function sell(card, confirmTheme = false) {
    try {
      const { data } = await api.post("/cards/sell", { name: card.name, count: 1, confirmTheme });
      setWallet(data.balance);
      toast(`Vendida por ${data.earned} monedas`);
      load();
    } catch (err) {
      // Es una repetida útil para el desafío temático: se pide confirmar antes de venderla.
      if (err.response?.status === 409 && err.response.data?.needsConfirm) {
        if (window.confirm(err.response.data.error)) sell(card, true);
        return;
      }
      toast(err.response?.data?.error || "No se pudo vender");
    }
  }

  const load = useCallback(async () => {
    const [s, c, l, r, w] = await Promise.all([
      api.get("/cards/state"), api.get("/cards/collection"), api.get("/cards/lineup"), api.get("/cards/rivals"), api.get("/cards/wallet"),
    ]);
    setState(s.data);
    setCollection(c.data.cards);
    setSelected(l.data.players.map((p) => p.name));
    setSaved(l.data.players.map((p) => p.name));
    setStrength(l.data.strength);
    setRivals(r.data.rivals);
    setWallet(w.data.balance);
  }, []);

  const [accessError, setAccessError] = useState(null);
  useEffect(() => {
    load().catch((err) => setAccessError(err.response?.data?.error || "No se pudo cargar Cartas"));
  }, [load]);

  async function claimDaily() {
    await api.post("/cards/claim-daily");
    toast("Sobre diario listo");
    load();
  }

  async function openPack() {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post("/cards/open");
      setOpened(data.cards);
      if (data.starBonus > 0) toast(`Sin estrella: el próximo sobre tiene +${data.starBonus}% de probabilidad de estrella`);
      playSfx(data.cards.some((c) => c.tier === "estrella" || c.tier === "oro") ? "win" : "ok");
      await load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo abrir el sobre");
    } finally {
      setBusy(false);
    }
  }

  const byName = useMemo(() => new Map(collection.map((c) => [c.name, c])), [collection]);
  const counts = useMemo(() => {
    const out = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const n of selected) if (byName.get(n)) out[byName.get(n).pos]++;
    return out;
  }, [selected, byName]);

  function toggle(c) {
    setSelected((cur) => {
      if (cur.includes(c.name)) return cur.filter((n) => n !== c.name);
      if (counts[c.pos] >= FORMATION[c.pos]) { toast(`Ya elegiste ${FORMATION[c.pos]} ${POS_LABEL[c.pos].toLowerCase()}`); return cur; }
      return [...cur, c.name];
    });
  }

  async function saveLineup() {
    setBusy(true);
    try {
      const { data } = await api.put("/cards/lineup", { players: selected });
      setStrength(data.strength);
      toast("Equipo guardado");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function play() {
    setBusy(true);
    try {
      const { data } = await api.post("/cards/match", { vs: rival });
      setMatch(data);
      setMatchDone(false); // se revela el resultado recién cuando termina la animación de la cancha
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo jugar");
    } finally {
      setBusy(false);
    }
  }

  function finishMatch() {
    setMatchDone(true);
    if (!match) return;
    playSfx(match.result === "win" ? "win" : match.result === "loss" ? "bad" : "tick");
    if (match.pack) toast("¡Ganaste un sobre!");
  }

  const TABS = v2
    ? [["sobres", "Sobres", Package], ["album", "Álbum", Layers], ["equipo", "Mi once", Shield], ["sbc", "SBC", Puzzle], ["tienda", "Tienda", ShoppingBag]]
    : [["sobres", "Sobres", Package], ["album", "Álbum", Layers], ["equipo", "Mi equipo", Shield]];
  // Con el rediseño, SBC y Tienda tienen su pestaña; antes iban debajo de los sobres.
  const show = (k) => (v2 ? tab === k : tab === "sobres");

  if (accessError) {
    return (
      <Layout>
        <Card>
          <EmptyState
            icon={Package}
            title="Cartas no está activado en tu grupo"
            hint="Un admin de alguno de tus grupos tiene que activarlo (hacen falta 3+ miembros)."
            actions={[{ label: "Ir a Mi grupo", to: "/grupo" }]}
          />
        </Card>
      </Layout>
    );
  }

  return (
    <Layout hub={v2}>
      {v2 ? (
        <div className="mt-1.5 mb-4">
          <header className="p-dhead">
            <div><h1>Cartas</h1><p>Abre sobres, completa el álbum, arma tu once y entrega repetidas en los SBC.</p></div>
            {state && <span className="p-pill" style={{ fontSize: 18 }}><Coins size={16} />{wallet} monedas</span>}
          </header>
          <div className="p-seg scroll" role="tablist" aria-label="Secciones de Cartas">
            {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>)}
          </div>
          {state && (
            <div className="p-eyebrow mt-4 p-only-phone">
              <span>Monedas</span>
              <span className="p-num text-base" style={{ color: "var(--gold)", letterSpacing: 0 }}>{wallet}</span>
            </div>
          )}
          {state && <p className="text-xs p-dim mt-1 p-only-phone">{state.owned} de {state.total} cartas en tu álbum</p>}
        </div>
      ) : (<>
      <div className="mb-6">
        <h1 className="t-title mb-1">Cartas</h1>
        <p className="text-gray-400 text-sm">Cada jugador de la base es una carta. Abre sobres, arma tu once y juega partidos: la química sale de los clubes que compartieron.</p>
      </div>

      <div className="flex gap-1.5 mb-5">
        {TABS.map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-card text-xs font-medium border inline-flex items-center gap-1.5 transition-colors ${
              tab === k ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        {state && (
          <span className="ml-auto flex items-center gap-3 text-xs text-gray-500 self-center">
            <span className="inline-flex items-center gap-1 text-amber-400"><Coins size={12} /> {wallet}</span>
            {state.owned} / {state.total} cartas
          </span>
        )}
      </div>
      </>)}

      {["sobres", "sbc", "tienda"].includes(tab) && state && (
        <div className="space-y-4">
          {show("sobres") && v2 && <SobresV2 state={state} busy={busy} openPack={openPack} claimDaily={claimDaily} />}
          {show("sobres") && !v2 && <Card className="text-center py-8">
            <p className="text-4xl font-bold tabular-nums mb-1">{state.packs}</p>
            <p className="text-sm text-gray-400 mb-5">sobre{state.packs === 1 ? "" : "s"} para abrir · 5 cartas cada uno</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={openPack} disabled={busy || state.packs === 0} className="px-6 py-2.5 rounded-card bg-accent text-onaccent font-semibold text-sm hover:opacity-90 disabled:opacity-40">
                Abrir sobre
              </button>
              {!state.dailyClaimed && (
                <button onClick={claimDaily} className="px-6 py-2.5 rounded-card border border-border text-sm font-medium text-gray-300 hover:text-white">
                  Reclamar sobre diario
                </button>
              )}
            </div>
            <p className="t-meta mt-4">Ganas sobres con el diario, cumpliendo el reto del día y ganando partidos (máx. 2 por día) — mejor calidad cuanto más contundente la victoria.</p>
          </Card>}
          {opened && <PackOpening cards={opened} />}
          {v2 && tab === "sbc" && <CartasTema lockedPacks={state.lockedPacks || 0} onChanged={load} />}

          {show("tienda") && <Card>
            <p className="t-eyebrow mb-1">Tienda de sobres</p>
            <p className="text-xs text-gray-500 mb-3">Compra con la moneda de vender cartas — nunca con dinero real.</p>
            {shop.deal && (
              <div className="deal-card mb-3 flex items-center justify-between gap-3 rounded-card border border-amber-400/50 bg-amber-400/10 px-3 py-2.5">
                <span className="min-w-0 text-sm">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-amber-400">Oferta del día · −30%</span>
                  <span className="block">{shop.deal.label}</span>
                </span>
                <button onClick={() => buyPack(shop.deal.quality, true)} disabled={busy || shop.deal.taken || wallet < shop.deal.price}
                  className="btn btn-secondary btn-sm shrink-0 disabled:opacity-40">
                  {shop.deal.taken ? "Comprada hoy" : <><s className="mr-1 text-gray-500">{shop.deal.normalPrice}</s><Coins size={12} className="inline text-amber-400" /> {shop.deal.price}</>}
                </button>
              </div>
            )}
            <div className="grid sm:grid-cols-3 gap-2">
              {Object.keys(shop.prices).map((q) => (
                <button
                  key={q}
                  onClick={() => buyPack(q)}
                  disabled={busy || wallet < shop.prices[q]}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-card border border-border text-left text-sm hover:border-white/30 disabled:opacity-40 disabled:hover:border-border"
                >
                  <span className="min-w-0">
                    <span className="block">{shop.labels[q] || q}</span>
                    {shop.descriptions[q] && <span className="block text-[11px] text-gray-500 leading-snug">{shop.descriptions[q]}</span>}
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-400 font-semibold shrink-0"><Coins size={12} /> {shop.prices[q]}</span>
                </button>
              ))}
            </div>
          </Card>}

          {show("sbc") && <Card>
            <p className="t-eyebrow mb-1">{v2 ? "Más SBC" : "SBC — arma el equipo, gana el sobre"}</p>
            <p className="text-xs text-gray-500 mb-3">Entregas 11 cartas que cumplan el requisito (se pierden, como en el FIFA real) y te dan un sobre a cambio.</p>
            <div className="space-y-2">
              {sbcs.map((s) => (
                <div key={s.id} className="rounded-card border border-border p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="text-xs text-gray-500">{s.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-amber-400 inline-flex items-center gap-1">Sobre {s.reward.packQuality}{s.reward.coins ? ` + ${s.reward.coins}` : ""}{s.reward.coins ? <Coins size={11} /> : null}</span>
                      <button
                        onClick={() => { setSbcOpen(sbcOpen === s.id ? null : s.id); setSbcPicked([]); }}
                        className={`px-3 py-1.5 rounded-card text-xs font-medium border ${sbcOpen === s.id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-300 hover:text-white"}`}
                      >
                        {sbcOpen === s.id ? "Cancelar" : "Elegir cartas"}
                      </button>
                    </div>
                  </div>
                  {sbcOpen === s.id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-gray-500 mb-2">{sbcPicked.length} / 11 elegidas</p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 max-h-64 overflow-y-auto">
                        {collection.map((c) => (
                          <PlayerCard key={c.name} c={c} small selected={sbcPicked.includes(c.name)} onClick={() => toggleSbcPick(c.name)} />
                        ))}
                      </div>
                      <button
                        onClick={() => submitSbc(s.id)}
                        disabled={busy || sbcPicked.length !== 11}
                        className="mt-3 px-4 py-2 rounded-card bg-accent text-onaccent text-xs font-semibold disabled:opacity-40"
                      >
                        Entregar equipo
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>}
        </div>
      )}

      {tab === "album" && (
        collection.length === 0 ? (
          <Card><EmptyState icon={Package} title="Todavía no tienes cartas" hint="Reclama tu sobre diario y ábrelo para empezar el álbum." actions={[{ label: "Ir a Sobres", onClick: () => setTab("sobres") }]} /></Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar jugador…"
                className="bg-bg border border-border rounded-card px-3 py-2 text-sm flex-1 min-w-[140px]"
              />
              <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="bg-bg border border-border rounded-card px-3 py-2 text-sm">
                <option value="">Toda posición</option>
                {Object.entries(POS_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="bg-bg border border-border rounded-card px-3 py-2 text-sm">
                <option value="">Toda rareza</option>
                {Object.keys(TIER_STYLE).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={() => setShowMissing((v) => !v)}
                className={`px-3 py-2 rounded-card text-sm font-medium border transition-colors ${showMissing ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-gray-400 hover:text-white"}`}
              >
                {showMissing ? "Viendo faltantes" : "Ver faltantes"}
              </button>
            </div>

            {(() => {
              const ownedNames = new Set(collection.map((c) => c.name));
              const q = query.trim().toLowerCase();
              const base = showMissing ? allCards.filter((c) => !ownedNames.has(c.name)) : collection;
              const list = base.filter((c) => (!posFilter || c.pos === posFilter) && (!tierFilter || c.tier === tierFilter) && (!q || c.name.toLowerCase().includes(q)));
              if (!list.length) return <p className="text-sm text-gray-500 text-center py-8">Sin resultados con esos filtros.</p>;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {list.map((c) => showMissing ? <LockedCard key={c.name} c={c} small /> : <PlayerCard key={c.name} c={c} small onSell={sell} />)}
                </div>
              );
            })()}
          </div>
        )
      )}

      {tab === "equipo" && (
        <div className="space-y-4">
          <Card>
            <p className="t-eyebrow mb-3">Tu once (1-4-3-3)</p>
            <div className="flex gap-4 text-sm flex-wrap mb-3">
              {Object.keys(FORMATION).map((k) => (
                <span key={k} className={counts[k] === FORMATION[k] ? "text-emerald-500" : "text-gray-400"}>{POS_LABEL[k]} {counts[k]}/{FORMATION[k]}</span>
              ))}
            </div>
            {strength && <p className="t-meta mb-3">Fuerza {Math.round(strength.total)} · química +{Math.round(strength.chem + strength.nat)}</p>}
            <div className="flex gap-2 flex-wrap">
              <button onClick={saveLineup} disabled={busy || selected.length !== 11} className="px-4 py-2 rounded-card bg-accent text-onaccent text-xs font-semibold disabled:opacity-40">Guardar equipo</button>
            </div>
          </Card>

          <Card>
            <p className="t-eyebrow mb-3">Jugar un partido</p>
            <div className="flex gap-2 items-center flex-wrap">
              <select value={rival} onChange={(e) => setRival(e.target.value)} className="bg-bg border border-border rounded-card px-3 py-2 text-sm">
                <option value="cpu">Contra la CPU</option>
                {rivals.map((r) => <option key={r.id} value={r.id}>Contra {r.username}</option>)}
              </select>
              <button onClick={play} disabled={busy || !strength} className="px-4 py-2 rounded-card border border-border text-xs font-semibold text-gray-300 hover:text-white inline-flex items-center gap-1.5 disabled:opacity-40">
                <Swords size={13} /> Jugar
              </button>
            </div>
            {match && match.events && (
              <div className="mt-4">
                <MatchStage
                  key={`${match.opponent}-${match.score.join("-")}-${match.events.length}`}
                  match={fromEngine({
                    source: "sim:cartas", events: match.events, lineups: match.lineups ? { home: { players: match.lineups.home }, away: { players: match.lineups.away } } : null,
                    home: { name: "Tu equipo", isMe: true }, away: { name: match.opponent },
                  })}
                  onDone={finishMatch}
                />
                {matchDone && (
                  <p className="mt-3 text-sm">
                    {match.result === "win" ? "¡Ganaste" : match.result === "draw" ? "Empate" : "Perdiste"} contra {match.opponent}
                    <span className="t-meta block mt-1">Tu fuerza {match.strength.mine} vs {match.strength.theirs} (química +{match.strength.chemistry}){match.pack ? " · +1 sobre" : ""}</span>
                  </p>
                )}
              </div>
            )}
          </Card>

          {collection.length > 0 && <CardExtrasPanel lineupNames={saved} collection={collection} onChanged={load} />}

          {collection.length === 0 ? (
            <Card><EmptyState icon={Package} title="Sin cartas todavía" hint="Abre sobres para poder armar tu equipo." actions={[{ label: "Ir a Sobres", onClick: () => setTab("sobres") }]} /></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {collection.filter((c) => c.pos !== "DT").map((c) => <PlayerCard key={c.name} c={c} small selected={selected.includes(c.name)} onClick={() => toggle(c)} />)}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
