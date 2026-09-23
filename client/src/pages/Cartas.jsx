import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, Layers, Package, Shield, Swords } from "lucide-react";
import api from "../api.js";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import MatchPitch from "../components/MatchPitch.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { playSfx } from "../utils/sfx.js";

// Clases escritas literales para que Tailwind las genere.
const TIER_STYLE = {
  estrella: "border-purple-500/70 bg-purple-500/10 text-purple-400",
  oro: "border-amber-500/70 bg-amber-500/10 text-amber-500",
  plata: "border-gray-400/60 bg-gray-400/10 text-gray-300",
  bronce: "border-orange-700/60 bg-orange-700/10 text-orange-500",
};
const POS_LABEL = { GK: "Arquero", DEF: "Defensas", MID: "Medios", FWD: "Delanteros" };
const FORMATION = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
const SELL_VALUE = { estrella: 120, oro: 40, plata: 15, bronce: 5 };
const SHOP_PRICE = { normal: 30, bueno: 90, top: 220 };
const SHOP_LABEL = { normal: "Sobre normal", bueno: "Sobre bueno", top: "Sobre top" };

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
      className={`relative text-left rounded-xl border ${TIER_STYLE[c.tier]} ${small ? "p-2" : "p-3"} ${selected ? "ring-2 ring-accent" : ""} ${onClick ? "hover:brightness-125 transition" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-bold tabular-nums leading-none">{c.ovr}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-80">{c.pos}</span>
      </div>
      <p className="text-sm font-semibold text-white mt-2 leading-tight">{c.name}</p>
      <p className="text-[11px] text-gray-400 truncate">{c.club}</p>
      <p className="text-[10px] opacity-70 mt-1">{c.tierLabel}{c.count > 1 ? ` · x${c.count}` : ""}{c.isNew ? " · ¡NUEVA!" : ""}</p>
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
          className={`w-28 h-40 rounded-xl bg-gradient-to-br from-accent to-accent-dark shadow-lg transition-all duration-500 ${
            phase === "tearing" ? "scale-110 opacity-0 -rotate-6" : "scale-100 opacity-100"
          }`}
          style={{ clipPath: "polygon(0 12%, 50% 0, 100% 12%, 100% 100%, 0 100%)" }}
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {cards.map((c, i) => (
        <div key={i} className="animate-result-pop" style={{ animationDelay: `${i * 80}ms` }}>
          <PlayerCard c={c} />
        </div>
      ))}
    </div>
  );
}

export default function Cartas() {
  const { toast } = useToast();
  const [tab, setTab] = useState("sobres");
  const [state, setState] = useState(null);
  const [collection, setCollection] = useState([]);
  const [opened, setOpened] = useState(null);
  const [selected, setSelected] = useState([]);
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

  async function buyPack(quality) {
    setBusy(true);
    try {
      await api.post("/cards/shop/buy", { quality });
      setWallet((w) => w - SHOP_PRICE[quality]);
      toast("Sobre comprado");
      load();
    } catch (err) {
      toast(err.response?.data?.error || "No se pudo comprar");
    } finally {
      setBusy(false);
    }
  }

  async function sell(card) {
    try {
      const { data } = await api.post("/cards/sell", { name: card.name, count: 1 });
      setWallet(data.balance);
      toast(`Vendida por ${data.earned} monedas`);
      load();
    } catch (err) {
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

  const TABS = [["sobres", "Sobres", Package], ["album", "Álbum", Layers], ["equipo", "Mi equipo", Shield]];

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
    <Layout>
      <div className="mb-6">
        <h1 className="t-title mb-1">Cartas</h1>
        <p className="text-gray-400 text-sm">Cada jugador de la base es una carta. Abrí sobres, armá tu once y jugá partidos: la química sale de los clubes que compartieron.</p>
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

      {tab === "sobres" && state && (
        <div className="space-y-4">
          <Card className="text-center py-8">
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
            <p className="t-meta mt-4">Ganás sobres con el diario, cumpliendo el reto del día y ganando partidos (máx. 2 por día) — mejor calidad cuanto más contundente la victoria.</p>
          </Card>
          {opened && <PackOpening cards={opened} />}

          <Card>
            <p className="t-eyebrow mb-1">Tienda de sobres</p>
            <p className="text-xs text-gray-500 mb-3">Comprá con la moneda de vender cartas — nunca con dinero real.</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {Object.keys(SHOP_PRICE).map((q) => (
                <button
                  key={q}
                  onClick={() => buyPack(q)}
                  disabled={busy || wallet < SHOP_PRICE[q]}
                  className="flex items-center justify-between px-3 py-2.5 rounded-card border border-border text-sm hover:border-white/30 disabled:opacity-40 disabled:hover:border-border"
                >
                  <span>{SHOP_LABEL[q]}</span>
                  <span className="inline-flex items-center gap-1 text-amber-400 font-semibold"><Coins size={12} /> {SHOP_PRICE[q]}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <p className="t-eyebrow mb-1">SBC — armá el equipo, ganá el sobre</p>
            <p className="text-xs text-gray-500 mb-3">Entregás 11 cartas que cumplan el requisito (se pierden, como en el FIFA real) y te dan un sobre a cambio.</p>
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
          </Card>
        </div>
      )}

      {tab === "album" && (
        collection.length === 0 ? (
          <Card><EmptyState icon={Package} title="Todavía no tenés cartas" hint="Reclamá tu sobre diario y abrilo para empezar el álbum." actions={[{ label: "Ir a Sobres", onClick: () => setTab("sobres") }]} /></Card>
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
              <button onClick={play} disabled={busy || !strength} className="px-4 py-2 rounded-card border border-border text-xs font-semibold text-gray-200 hover:text-white inline-flex items-center gap-1.5 disabled:opacity-40">
                <Swords size={13} /> Jugar
              </button>
            </div>
            {match && match.events && (
              <div className="mt-4">
                <MatchPitch
                  key={`${match.opponent}-${match.score.join("-")}-${match.events.length}`}
                  events={match.events}
                  homeLabel="Tu equipo"
                  awayLabel={match.opponent}
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

          {collection.length === 0 ? (
            <Card><EmptyState icon={Package} title="Sin cartas todavía" hint="Abrí sobres para poder armar tu equipo." actions={[{ label: "Ir a Sobres", onClick: () => setTab("sobres") }]} /></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {collection.map((c) => <PlayerCard key={c.name} c={c} small selected={selected.includes(c.name)} onClick={() => toggle(c)} />)}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
